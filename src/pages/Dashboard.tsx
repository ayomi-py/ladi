import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Package, ShoppingCart, Trash2, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Constants } from "@/integrations/supabase/types";

const categories = Constants.public.Enums.product_category;

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [stock, setStock] = useState("1");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportOrderId, setReportOrderId] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: myProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["my-products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: sellerOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["seller-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name))")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch buyer names
      const buyerIds = [...new Set(data.map((o) => o.buyer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", buyerIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
      return data.map((o) => ({ ...o, buyer_name: profileMap.get(o.buyer_id) || "Buyer" }));
    },
    enabled: !!user,
  });

  const profileComplete =
    !!profile &&
    !!profile.full_name &&
    !!profile.matric_number &&
    !!profile.department;

  const createProduct = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!name || !price) throw new Error("Name and price are required");
       if (!profileComplete) {
        throw new Error("Complete your profile (name, matric number, department) before listing products");
      }

      // Upload images
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrls.push(publicUrl);
      }

      const { error } = await supabase.from("products").insert({
        seller_id: user.id,
        name,
        description: description || null,
        price: parseFloat(price),
        category: category as any,
        stock: parseInt(stock) || 0,
        images: imageUrls,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Product created!" });
      setCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Product deleted" });
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Order status updated" });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
    },
  });

  const reportBuyer = useMutation({
    mutationFn: async () => {
      if (!user || !reportOrderId) throw new Error("Missing data");
      const order = sellerOrders?.find((o: any) => o.id === reportOrderId);
      if (!order) throw new Error("Order not found");
      if (!reportText.trim()) throw new Error("Describe the issue");

      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: order.buyer_id,
        order_id: order.id,
        product_id: null,
        role: "buyer",
        category: "fraud",
        description: reportText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Our team will review this buyer.",
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

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setCategory("other");
    setStock("1");
    setImageFiles([]);
  };

  const startEdit = (product: any) => {
    setEditingProduct(product);
    setName(product.name || "");
    setDescription(product.description || "");
    setPrice(String(product.price ?? ""));
    setCategory(product.category || "other");
    setStock(String(product.stock ?? "1"));
    setImageFiles([]);
    setCreateOpen(true);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    confirmed: "bg-primary/20 text-primary",
    shipped: "bg-accent text-accent-foreground",
    delivered: "bg-success/20 text-success",
    cancelled: "bg-destructive/20 text-destructive",
  };

  if (authLoading || productsLoading || profileLoading) {
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
      <main className="container py-8">
        {!profileComplete && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Complete your profile (full name, matric number, department) before creating product listings.
            <button
              className="ml-2 underline underline-offset-4"
              onClick={() => navigate("/profile")}
            >
              Go to profile
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold">Seller Dashboard</h1>
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) {
                setEditingProduct(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Product" : "Create Product"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your product" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (₦) *</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" min="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock</Label>
                    <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="1" min="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Images</Label>
                  <Input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} />
                </div>
                <Button
                  onClick={() => createProduct.mutate()}
                  disabled={createProduct.isPending}
                  className="w-full"
                >
                  {createProduct.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingProduct ? "Save changes" : "Create Product"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="products" className="flex-1 justify-center">
              <Package className="mr-2 h-4 w-4" />
              My Products
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 justify-center">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            {myProducts && myProducts.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myProducts.map((p: any) => {
                  const imgs: string[] = Array.isArray(p.images) ? p.images : [];
                  return (
                    <Card key={p.id}>
                      <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                        {imgs.length > 0 ? (
                          <img src={imgs[0]} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">No image</div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium text-sm truncate">{p.name}</h3>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-semibold">₦{Number(p.price).toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">{p.stock} in stock</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Badge variant={p.is_active ? "default" : "secondary"} className="text-xs">
                            {p.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <span className="text-xs text-muted-foreground capitalize">{p.category}</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => startEdit(p)}
                          >
                            <Edit2 className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            onClick={() => deleteProduct.mutate(p.id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4" />
                <p className="font-medium">No products yet</p>
                <p className="text-sm">Create your first listing to start selling!</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            {ordersLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : sellerOrders && sellerOrders.length > 0 ? (
              <div className="space-y-4">
                {sellerOrders.map((order: any) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.buyer_name} · {new Date(order.created_at).toLocaleDateString()}
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
                      <div className="flex items-center justify-between mt-3">
                        <p className="font-semibold text-sm">
                          Total: ₦{Number(order.total).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setReportOrderId(order.id);
                              setReportOpen(true);
                            }}
                          >
                            Report buyer
                          </Button>
                          {order.status !== "delivered" &&
                            order.status !== "cancelled" && (
                              <Select
                                value={order.status}
                                onValueChange={(v) =>
                                  updateOrderStatus.mutate({
                                    id: order.id,
                                    status: v,
                                  })
                                }
                              >
                                <SelectTrigger className="w-36 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">
                                    Pending
                                  </SelectItem>
                                  <SelectItem value="confirmed">
                                    Confirmed
                                  </SelectItem>
                                  <SelectItem value="shipped">
                                    Sent
                                  </SelectItem>
                                  <SelectItem value="cancelled">
                                    Cancelled
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4" />
                <p className="font-medium">No orders yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report buyer</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">
            Use this if you suspect fraud, scams, or serious policy
            violations. This does not automatically cancel the order.
          </p>
          <Textarea
            rows={4}
            placeholder="Describe what happened..."
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
          />
          <Button
            className="mt-3"
            disabled={reportBuyer.isPending}
            onClick={() => reportBuyer.mutate()}
          >
            {reportBuyer.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Submit report
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
