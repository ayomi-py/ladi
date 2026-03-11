import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/use-admin";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

const DELIVERY_FEE_PER_ORDER = 500;

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    name: string;
    price: number;
    images: string[] | null;
    stock: number;
    seller_id: string;
  } | null;
}

interface Coupon {
  id: string;
  seller_id: string | null;
  code: string;
  discount_percent: number;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
}

const Checkout = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, adminLoading } = useAdminRole();

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !adminLoading && user && isAdmin) {
      navigate("/admin");
    }
  }, [user, authLoading, adminLoading, isAdmin, navigate]);

  const { data: cartItems, isLoading } = useQuery<CartItem[]>({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(name, price, images, stock, seller_id)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  const groupedBySeller = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    if (!cartItems) return map;
    for (const item of cartItems) {
      const sellerId = item.products?.seller_id;
      if (!sellerId) continue;
      if (!map.has(sellerId)) map.set(sellerId, []);
      map.get(sellerId)!.push(item);
    }
    return map;
  }, [cartItems]);

  const subtotal = useMemo(() => {
    if (!cartItems) return 0;
    return cartItems.reduce(
      (sum, item) =>
        sum +
        Number(item.products?.price || 0) *
          Number(item.quantity || 0),
      0,
    );
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon || !cartItems) return 0;
    if (!appliedCoupon.seller_id) return 0;
    const sellerItems = cartItems.filter(
      (i) => i.products?.seller_id === appliedCoupon.seller_id,
    );
    const sellerSubtotal = sellerItems.reduce(
      (sum, item) =>
        sum +
        Number(item.products?.price || 0) *
          Number(item.quantity || 0),
      0,
    );
    return (
      (sellerSubtotal * Number(appliedCoupon.discount_percent)) / 100
    );
  }, [appliedCoupon, cartItems]);

  const deliveryTotal =
    groupedBySeller.size * DELIVERY_FEE_PER_ORDER;

  const grandTotal = Math.max(
    0,
    subtotal - discountAmount + deliveryTotal,
  );

  const applyCoupon = useMutation({
    mutationFn: async () => {
      if (!couponCode.trim()) {
        throw new Error("Enter a coupon code");
      }
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.trim())
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Coupon not found or inactive");

      const coupon = data as Coupon;
      const now = new Date();
      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        throw new Error("Coupon has expired");
      }
      if (
        coupon.usage_limit !== null &&
        coupon.usage_limit > 0 &&
        coupon.usage_count >= coupon.usage_limit
      ) {
        throw new Error("Coupon usage limit reached");
      }

      // Ensure cart contains items from this seller only
      if (!cartItems || cartItems.length === 0) {
        throw new Error("Your cart is empty");
      }
      if (coupon.seller_id) {
        const sellerIds = Array.from(
          new Set(
            cartItems
              .map((i) => i.products?.seller_id)
              .filter(Boolean),
          ),
        );
        if (
          sellerIds.length !== 1 ||
          sellerIds[0] !== coupon.seller_id
        ) {
          throw new Error(
            "This coupon only applies to a specific seller's cart",
          );
        }
      }

      return coupon;
    },
    onSuccess: (coupon) => {
      setAppliedCoupon(coupon);
      toast({
        title: "Coupon applied",
        description: `${coupon.discount_percent}% discount`,
      });
    },
    onError: (e: any) =>
      toast({
        title: "Coupon error",
        description: e.message,
        variant: "destructive",
      }),
  });

  const checkout = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!cartItems || cartItems.length === 0) {
        throw new Error("Your cart is empty");
      }

      // In production, integrate Paystack here and only proceed after successful payment.
      // For now, simulate successful payment and create orders directly.

      const sellerEntries = Array.from(groupedBySeller.entries());

      const ordersToInsert = sellerEntries.map(
        ([sellerId, items]) => {
          const sellerSubtotal = items.reduce(
            (sum, item) =>
              sum +
              Number(item.products?.price || 0) *
                Number(item.quantity || 0),
            0,
          );
          const sellerDiscount =
            appliedCoupon &&
            appliedCoupon.seller_id === sellerId
              ? (sellerSubtotal *
                  Number(appliedCoupon.discount_percent)) /
                100
              : 0;
          const total =
            sellerSubtotal -
            sellerDiscount +
            DELIVERY_FEE_PER_ORDER;

          return {
            buyer_id: user.id,
            seller_id: sellerId,
            total,
            delivery_fee: DELIVERY_FEE_PER_ORDER,
            coupon_id:
              appliedCoupon &&
              appliedCoupon.seller_id === sellerId
                ? appliedCoupon.id
                : null,
            status: "pending" as const,
            payment_ref: null,
          };
        },
      );

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .insert(ordersToInsert)
        .select("id, seller_id");
      if (ordersError) throw ordersError;

      const orderItemsPayload: {
        order_id: string;
        product_id: string;
        quantity: number;
        price: number;
      }[] = [];

      for (const order of orders || []) {
        const items = groupedBySeller.get(order.seller_id) || [];
        for (const item of items) {
          if (!item.products) continue;
          orderItemsPayload.push({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: Number(item.products.price),
          });
        }
      }

      if (orderItemsPayload.length) {
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItemsPayload);
        if (itemsError) throw itemsError;
      }

      if (appliedCoupon) {
        await supabase
          .from("coupons")
          .update({
            usage_count: (appliedCoupon.usage_count || 0) + 1,
          })
          .eq("id", appliedCoupon.id);
      }

      // Clear cart
      const { error: clearError } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id);
      if (clearError) throw clearError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-orders", user?.id] });
    },
    onError: (e: any) => {
      throw e;
    },
  });

  const handleCheckout = async () => {
    try {
      setProcessing(true);
      await checkout.mutateAsync();
      toast({
        title: "Order placed",
        description:
          "Payment simulated. Integrate Paystack before going live.",
      });
      navigate("/orders");
    } catch (e: any) {
      toast({
        title: "Checkout failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

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

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container max-w-2xl py-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-2 text-lg font-medium">
            Your cart is empty
          </p>
          <Link to="/">
            <Button variant="link" className="mt-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to products
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">
            Checkout
          </h1>
          <Link to="/cart">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to cart
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[2fr,1.4fr]">
          <section className="space-y-4">
            {Array.from(groupedBySeller.entries()).map(
              ([sellerId, items]) => (
                <Card key={sellerId}>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Seller: {sellerId.slice(0, 8)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            {item.products?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold">
                          ₦
                          {(
                            Number(item.products?.price || 0) *
                            item.quantity
                          ).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Delivery: ₦
                      {DELIVERY_FEE_PER_ORDER.toLocaleString()} for
                      this seller
                    </p>
                  </CardContent>
                </Card>
              ),
            )}
          </section>

          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>₦{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery</span>
                  <span>₦{deliveryTotal.toLocaleString()}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>-₦{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>₦{grandTotal.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Coupon
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="coupon">Coupon code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="coupon"
                      value={couponCode}
                      onChange={(e) =>
                        setCouponCode(e.target.value)
                      }
                      placeholder="Enter coupon"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => applyCoupon.mutate()}
                      disabled={applyCoupon.isPending}
                    >
                      {applyCoupon.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Pay (Simulated)"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  This environment uses a simulated payment flow.
                  Integrate Paystack's inline payments before going
                  to production.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Checkout;

