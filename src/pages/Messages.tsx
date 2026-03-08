import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Send } from "lucide-react";

interface MessageWithProfile {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_profile?: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  receiver_profile?: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

const Messages = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const { data: selectedPeerProfile } = useQuery({
    queryKey: ["profile", selectedPeerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .eq("user_id", selectedPeerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPeerId,
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: true });
      if (error) throw error;

      if (!data || data.length === 0) return [] as MessageWithProfile[];

      const userIds = Array.from(
        new Set(data.flatMap((m) => [m.sender_id, m.receiver_id])),
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p]),
      );

      return data.map((m) => ({
        ...m,
        sender_profile: profileMap.get(m.sender_id),
        receiver_profile: profileMap.get(m.receiver_id),
      })) as MessageWithProfile[];
    },
    enabled: !!user,
  });

  // Initialize selected peer from URL (?to=...)
  useEffect(() => {
    if (!user || !messages) return;
    const to = searchParams.get("to");
    if (to) {
      setSelectedPeerId(to);
      return;
    }
    if (!selectedPeerId && messages.length > 0) {
      const firstPeer =
        messages[0].sender_id === user.id
          ? messages[0].receiver_id
          : messages[0].sender_id;
      setSelectedPeerId(firstPeer);
    }
  }, [user, messages, searchParams, selectedPeerId]);

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (!user || !selectedPeerId || !messages?.length) return;
    const unreadIds = messages
      .filter(
        (m) =>
          m.receiver_id === user.id &&
          m.sender_id === selectedPeerId &&
          !m.is_read
      )
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase
      .from("messages")
      .update({ is_read: true })
      .in("id", unreadIds)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
        queryClient.invalidateQueries({ queryKey: ["unread-messages", user.id] });
      });
  }, [user, selectedPeerId, messages, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!selectedPeerId) throw new Error("No recipient selected");
      if (!draft.trim()) return;

      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: selectedPeerId,
        content: draft.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages", user?.id] });
    },
    onError: (e: any) =>
      toast({
        title: "Message failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  // Realtime updates - subscribe to both sent and received messages
  useEffect(() => {
    if (!user) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages", user.id] });
    };

    const ch1 = supabase
      .channel(`messages-sent-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` }, invalidate)
      .subscribe();

    const ch2 = supabase
      .channel(`messages-received-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [user, queryClient]);

  const conversations = useMemo(() => {
    if (!messages || !user) return [];
    const map = new Map<
      string,
      {
        peerId: string;
        lastMessage: MessageWithProfile;
        unreadCount: number;
      }
    >();

    for (const m of messages) {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      const existing = map.get(peerId);
      const unreadIncrement =
        !m.is_read && m.receiver_id === user.id ? 1 : 0;

      if (!existing || m.created_at > existing.lastMessage.created_at) {
        map.set(peerId, {
          peerId,
          lastMessage: m,
          unreadCount: (existing?.unreadCount || 0) + unreadIncrement,
        });
      } else if (unreadIncrement) {
        existing.unreadCount += unreadIncrement;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.lastMessage.created_at < b.lastMessage.created_at ? 1 : -1,
    );
  }, [messages, user]);

  const activeMessages = useMemo(() => {
    if (!messages || !user || !selectedPeerId) return [];
    return messages.filter(
      (m) =>
        (m.sender_id === user.id && m.receiver_id === selectedPeerId) ||
        (m.sender_id === selectedPeerId && m.receiver_id === user.id),
    );
  }, [messages, user, selectedPeerId]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-6 grid gap-4 md:grid-cols-[280px,1fr]">
        <section>
          <h1 className="mb-4 text-xl font-display font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </h1>

          <Input placeholder="Search by name..." className="mb-3" />

          <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1">
            {conversations.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No conversations yet.
              </p>
            )}
            {conversations.map(({ peerId, lastMessage, unreadCount }) => {
              const profile =
                lastMessage.sender_id === peerId
                  ? lastMessage.sender_profile
                  : lastMessage.receiver_profile;
              const initials =
                profile?.full_name
                  ?.split(" ")
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase() || "?";

              return (
                <Card
                  key={peerId}
                  className={`cursor-pointer transition hover:bg-accent ${
                    selectedPeerId === peerId ? "border-primary bg-accent" : ""
                  }`}
                  onClick={() => setSelectedPeerId(peerId)}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <Avatar className="h-8 w-8">
                      {profile?.avatar_url && (
                        <AvatarImage src={profile.avatar_url} alt="" />
                      )}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {profile?.full_name || "User"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lastMessage.content}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                        {unreadCount}
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardContent className="flex-1 p-4 flex flex-col">
              {selectedPeerId ? (
                activeMessages.length > 0 ? (
                  <>
                    <div className="mb-3 text-sm text-muted-foreground">
                      Conversation with{" "}
                      {(() => {
                        const first = activeMessages[0];
                        const profile =
                          first.sender_id === selectedPeerId
                            ? first.sender_profile
                            : first.receiver_profile;
                        return profile?.full_name || "User";
                      })()}
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto mb-3">
                      {activeMessages.map((m) => {
                        const isMe = m.sender_id === user?.id;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${
                              isMe ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                isMe
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {m.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {selectedPeerProfile?.full_name || "User"}
                    </p>
                    <p className="mt-1">No messages yet. Start the conversation below.</p>
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select a conversation or open a product and click Message to start chatting.
                </div>
              )}

              {selectedPeerId && (
                <form
                  className="mt-3 flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage.mutate();
                  }}
                >
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message..."
                    rows={2}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10"
                    disabled={sendMessage.isPending || !draft.trim()}
                  >
                    {sendMessage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Messages;

