import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package } from "lucide-react";

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
                  <p className="font-semibold text-sm mt-3">Total: ₦{Number(order.total).toLocaleString()}</p>
                  {order.status === "shipped" && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => confirmDelivery.mutate(order.id)}
                        disabled={confirmDelivery.isPending}
                      >
                        {confirmDelivery.isPending ? "Confirming..." : "Received"}
                      </Button>
                    </div>
                  )}
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
    </div>
  );
};

export default Orders;
