import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/use-admin";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Minus, Plus, ShoppingBag } from "lucide-react";

const Cart = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, adminLoading } = useAdminRole();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !adminLoading && user && isAdmin) {
      navigate("/admin");
    }
  }, [user, authLoading, adminLoading, isAdmin, navigate]);

  const { data: cartItems, isLoading } = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(name, price, images, stock, seller_id)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity < 1) {
        const { error } = await supabase.from("cart_items").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast({ title: "Item removed" });
    },
  });

  const total = cartItems?.reduce((sum, item: any) => sum + Number(item.products?.price || 0) * item.quantity, 0) || 0;

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
      <main className="container max-w-5xl py-8">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Shopping cart</h1>
            <p className="text-sm text-muted-foreground">
              Review your items before heading to checkout.
            </p>
          </div>
          {cartItems && cartItems.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {cartItems.length} item{cartItems.length > 1 ? "s" : ""} in cart
            </p>
          )}
        </div>

        {cartItems && cartItems.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-[1.8fr,1.1fr]">
            {/* Items list */}
            <section className="space-y-4">
              {cartItems.map((item: any) => {
                const images: string[] = Array.isArray(item.products?.images)
                  ? item.products.images
                  : [];
                const price = Number(item.products?.price || 0);
                const lineTotal = price * item.quantity;

                return (
                  <Card key={item.id} className="border-muted">
                    <CardContent className="flex gap-4 p-4 sm:gap-6">
                      <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {images.length > 0 ? (
                          <img
                            src={images[0]}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <Link to={`/product/${item.product_id}`}>
                              <h3 className="font-medium text-sm sm:text-base truncate hover:underline">
                                {item.products?.name}
                              </h3>
                            </Link>
                            <p className="mt-1 text-sm font-semibold">
                              ₦{price.toLocaleString()}
                            </p>
                          </div>
                          <p className="hidden text-sm font-semibold whitespace-nowrap sm:block">
                            ₦{lineTotal.toLocaleString()}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center border rounded-full bg-background px-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateQuantity.mutate({
                                  id: item.id,
                                  quantity: item.quantity - 1,
                                })
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateQuantity.mutate({
                                  id: item.id,
                                  quantity: Math.min(
                                    item.products?.stock || 99,
                                    item.quantity + 1,
                                  ),
                                })
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold sm:hidden">
                              ₦{lineTotal.toLocaleString()}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeItem.mutate(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            {/* Order summary */}
            <section className="lg:sticky lg:top-20 h-fit">
              <Card>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Subtotal
                    </span>
                    <span className="text-xl font-display font-semibold">
                      ₦{total.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Delivery fee and discounts are calculated at checkout.
                  </p>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => navigate("/checkout")}
                  >
                    Proceed to checkout
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate("/")}
                  >
                    Continue shopping
                  </Button>
                </CardContent>
              </Card>
            </section>
          </div>
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <ShoppingBag className="h-12 w-12 mb-4 text-muted-foreground" />
            <p className="text-lg font-display font-semibold mb-1">
              Your cart is empty
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Add items from the marketplace to see them here.
            </p>
            <Link to="/">
              <Button variant="link" className="mt-1">
                Browse products
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default Cart;
