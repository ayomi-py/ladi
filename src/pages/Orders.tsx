import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package } from "lucide-react";

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportOrderId, setReportOrderId] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name, images))")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const sellerIds = [...new Set(data.map((o) => o.seller_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", sellerIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
      return data.map((o) => ({ ...o, seller_name: profileMap.get(o.seller_id) || "Unknown" }));
    },
    enabled: !!user,
  });

  const confirmDelivery = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Order confirmed as delivered" });
      queryClient.invalidateQueries({ queryKey: ["my-orders", user?.id] });
    },
    onError: (e: any) =>
      toast({
        title: "Failed to confirm delivery",
        description: e.message,
        variant: "destructive",
      }),
  });

  const reportSeller = useMutation({
    mutationFn: async () => {
      if (!user || !reportOrderId) throw new Error("Missing data");
      const order = orders?.find((o: any) => o.id === reportOrderId);
      if (!order) throw new Error("Order not found");
      if (!reportText.trim()) throw new Error("Describe the issue");

      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: order.seller_id,
        order_id: order.id,
        product_id: null,
        role: "seller",
        category: "fraud",
        description: reportText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Our team will review this seller.",
      });
      setReportOpen(false);
      setReportOrderId(null);
      setReportText("");
    },
    onError: (e: any) =>
      toast({
        title: "Failed to submit report",
        description: e.message,
        variant: "destructive",
      }),
  });

  const statusColors: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    confirmed: "bg-primary/20 text-primary",
    shipped: "bg-accent text-accent-foreground",
    delivered: "bg-success/20 text-success",
    cancelled: "bg-destructive/20 text-destructive",
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-2xl py-8">
        <h1 className="text-2xl font-display font-bold mb-6">My Orders</h1>
        {orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        <Link to={`/seller/${order.seller_id}`} className="hover:underline text-primary font-medium">
                          {order.seller_name}
                        </Link>
                        {" · "}
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={`text-xs ${statusColors[order.status] || ""}`}>
                    {order.status === "shipped" ? "Sent" : order.status}
                  </Badge>
                  </div>
                  {order.order_items?.map((item: any) => (
                    <p key={item.id} className="text-sm text-muted-foreground">
                      {item.products?.name} × {item.quantity} — ₦{Number(item.price).toLocaleString()}
                    </p>
                  ))}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">
                      Total: ₦{Number(order.total).toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => {
                          setReportOrderId(order.id);
                          setReportOpen(true);
                        }}
                      >
                        Report seller
                      </Button>
                      {order.status === "shipped" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => confirmDelivery.mutate(order.id)}
                          disabled={confirmDelivery.isPending}
                        >
                          {confirmDelivery.isPending
                            ? "Confirming..."
                            : "Received"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4" />
            <p className="font-medium">No orders yet</p>
          </div>
        )}
      </main>
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report seller</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">
            Use this if you suspect fraud or serious policy violations. This
            does not automatically cancel your order.
          </p>
          <Textarea
            rows={4}
            placeholder="Describe what happened..."
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
          />
          <Button
            className="mt-3"
            disabled={reportSeller.isPending}
            onClick={() => reportSeller.mutate()}
          >
            {reportSeller.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Submit report
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
