import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Users, PackageSearch, BarChart3, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) result += chars[arr[i] % 32];
  return result;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createCouponOpen, setCreateCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, department, matric_number, created_at, is_active" as any);
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, created_at, seller_id");
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: coupons } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const toggleProductActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Product updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: any) =>
      toast({
        title: "Update failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const toggleUserActive = useMutation({
    mutationFn: async ({ user_id, is_active }: { user_id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active } as any)
        .eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "User updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (e: any) =>
      toast({
        title: "Update failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      let code = couponCode.trim().toUpperCase() || generateCouponCode();
      const discount = parseFloat(discountPercent);
      if (isNaN(discount) || discount <= 0 || discount > 100) {
        throw new Error("Discount must be between 1 and 100");
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("coupons")
          .insert({
            code,
            discount_percent: discount,
            expires_at: expiresAt || null,
            usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
            seller_id: null,
            is_active: true,
          })
          .select()
          .single();
        if (!error) return data;
        if (error.code === "23505" && !couponCode.trim()) {
          code = generateCouponCode();
          continue;
        }
        throw error;
      }
      throw new Error("Could not generate unique code, try again");
    },
    onSuccess: (data) => {
      toast({
        title: "Coupon created",
        description: `Code: ${data.code}`,
      });
      setCreateCouponOpen(false);
      setCouponCode("");
      setDiscountPercent("");
      setExpiresAt("");
      setUsageLimit("");
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: any) =>
      toast({
        title: "Failed to create coupon",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container max-w-xl py-10 text-center">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-display font-bold">Admin access only</h1>
          <p className="text-sm text-muted-foreground">
            You need an admin role to view this dashboard.
          </p>
        </main>
      </div>
    );
  }

  const COMMISSION_RATE = 0.065;

  const totalRevenue =
    orders?.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0) || 0;
  const commission = totalRevenue * COMMISSION_RATE;
  const orderCount = orders?.length || 0;
  const activeCoupons =
    coupons?.filter((c: any) => c.is_active).length ?? 0;

  // Monthly revenue analytics (last 12 months)
  type MonthlyPoint = { monthKey: string; monthLabel: string; revenue: number; orders: number };
  const monthlyMap = new Map<string, MonthlyPoint>();
  (orders || []).forEach((o: any) => {
    const d = new Date(o.created_at);
    if (Number.isNaN(d.getTime())) return;
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-11
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = `${d.toLocaleString("default", {
      month: "short",
    })} ${String(year).slice(-2)}`;
    const existing = monthlyMap.get(key) || {
      monthKey: key,
      monthLabel: label,
      revenue: 0,
      orders: 0,
    };
    existing.revenue += Number(o.total || 0);
    existing.orders += 1;
    monthlyMap.set(key, existing);
  });
  const monthlyDataAll = Array.from(monthlyMap.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
  const monthlyData = monthlyDataAll.slice(-12);

  const revenueChartConfig: ChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
  };

  const sellerStats = new Map<
    string,
    { orders: number; revenue: number; commission: number }
  >();
  (orders || []).forEach((o: any) => {
    const sellerId = o.seller_id;
    if (!sellerId) return;
    const revenue = Number(o.total || 0);
    const prev = sellerStats.get(sellerId) || {
      orders: 0,
      revenue: 0,
      commission: 0,
    };
    const newRevenue = prev.revenue + revenue;
    const newOrders = prev.orders + 1;
    sellerStats.set(sellerId, {
      orders: newOrders,
      revenue: newRevenue,
      commission: newRevenue * COMMISSION_RATE,
    });
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Platform-wide users, listings, and revenue overview.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </Badge>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                ₦{totalRevenue.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Across {orderCount} orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Platform commission (6.5%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                ₦{commission.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Estimated, based on order totals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Active listings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {products?.filter((p: any) => p.is_active).length ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {products?.length ?? 0} total products
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger
              value="users"
              className="flex-1 justify-center gap-1"
            >
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger
              value="products"
              className="flex-1 justify-center gap-1"
            >
              <PackageSearch className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex-1 justify-center gap-1"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="coupons"
              className="flex-1 justify-center gap-1"
            >
              Coupons
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Users</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!profiles?.length && (
                  <p className="text-sm text-muted-foreground">
                    No users found.
                  </p>
                )}
                {profiles?.map((p: any) => {
                  const stats = sellerStats.get(p.user_id);
                  return (
                    <div
                      key={p.user_id}
                      className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0"
                    >
                      <div>
                        <p className="font-medium">
                          {p.full_name || "Unnamed user"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.department || "No department"} ·{" "}
                          {p.matric_number || "No matric"}
                        </p>
                        {stats && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Sales:{" "}
                            <span className="font-medium">
                              {stats.orders}
                            </span>{" "}
                            · Revenue:{" "}
                            <span className="font-medium">
                              ₦{stats.revenue.toLocaleString()}
                            </span>{" "}
                            · Commission (6.5%):{" "}
                            <span className="font-medium">
                              ₦{stats.commission.toLocaleString()}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={p.is_active === false ? "secondary" : "default"}
                            className="text-xs"
                          >
                            {p.is_active === false ? "Deactivated" : "Active"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleUserActive.mutate({
                                user_id: p.user_id,
                                is_active: p.is_active === false,
                              })
                            }
                          >
                            {p.is_active === false ? "Activate" : "Deactivate"}
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Product moderation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!products?.length && (
                  <p className="text-sm text-muted-foreground">
                    No products found.
                  </p>
                )}
                {products?.map((prod: any) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{prod.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ₦{Number(prod.price).toLocaleString()} ·{" "}
                        {prod.category} · Stock {prod.stock}
                      </p>
                    </div>
                    <Badge
                      variant={prod.is_active ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {prod.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleProductActive.mutate({
                          id: prod.id,
                          is_active: !prod.is_active,
                        })
                      }
                    >
                      {prod.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Revenue analytics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="w-full">
                  <ChartContainer
                    config={revenueChartConfig}
                    className="w-full max-w-full"
                  >
                    <BarChart data={monthlyData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        className="stroke-border/40"
                      />
                      <XAxis
                        dataKey="monthLabel"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={4}
                        tickFormatter={(v) => `₦${Number(v).toLocaleString()}`}
                      />
                      <ChartTooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        content={
                          <ChartTooltipContent
                            labelKey="monthLabel"
                            nameKey="revenue"
                          />
                        }
                      />
                      <Bar
                        dataKey="revenue"
                        fill="var(--color-revenue)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
                <div className="space-y-1">
                  <p>
                    <span className="text-muted-foreground">Total orders: </span>
                    <strong>{orderCount}</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Total revenue: </span>
                    <strong>₦{totalRevenue.toLocaleString()}</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      Platform commission (6.5%):{" "}
                    </span>
                    <strong>₦{commission.toLocaleString()}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coupons" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">
                  Coupons ({activeCoupons} active)
                </CardTitle>
                <Dialog open={createCouponOpen} onOpenChange={setCreateCouponOpen}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateCouponOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create coupon
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create coupon</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createCoupon.mutate();
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <Label htmlFor="coupon-code">Code (optional)</Label>
                        <Input
                          id="coupon-code"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="Leave blank to auto-generate"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="discount">Discount % (required)</Label>
                        <Input
                          id="discount"
                          type="number"
                          min="1"
                          max="100"
                          step="0.01"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                          placeholder="e.g. 10"
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="expires">Expires at (optional)</Label>
                        <Input
                          id="expires"
                          type="datetime-local"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="usage-limit">Usage limit (optional)</Label>
                        <Input
                          id="usage-limit"
                          type="number"
                          min="0"
                          value={usageLimit}
                          onChange={(e) => setUsageLimit(e.target.value)}
                          placeholder="0 = unlimited"
                          className="mt-1"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={createCoupon.isPending}
                      >
                        {createCoupon.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        Create
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!coupons?.length && (
                  <p className="text-sm text-muted-foreground">
                    No coupons defined yet.
                  </p>
                )}
                {coupons?.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.discount_percent}% off ·{" "}
                        {c.usage_count}/{c.usage_limit ?? "∞"} uses ·{" "}
                        {c.expires_at
                          ? `Expires ${new Date(
                              c.expires_at,
                            ).toLocaleDateString()}`
                          : "No expiry"}
                      </p>
                    </div>
                    <Badge
                      variant={c.is_active ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;

