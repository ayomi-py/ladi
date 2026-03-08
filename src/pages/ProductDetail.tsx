import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Star,
  ShoppingCart,
  MessageSquare,
  Loader2,
  ArrowLeft,
  Package,
  User,
  Minus,
  Plus,
} from "lucide-react";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [canReview, setCanReview] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Fetch seller profile separately
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, user_id")
        .eq("user_id", data.seller_id)
        .maybeSingle();
      return { ...data, seller_profile: sellerProfile };
    },
    enabled: !!id,
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch reviewer names
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
      return data.map((r) => ({ ...r, reviewer_name: profileMap.get(r.user_id) || "User" }));
    },
    enabled: !!id,
  });

  useQuery({
    queryKey: ["can-review", id, user?.id],
    queryFn: async () => {
      if (!user || !id) return false;

      // First find all order_ids that include this product
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("product_id", id);
      if (itemsError) throw itemsError;

      const orderIds = Array.from(
        new Set((items || []).map((i: any) => i.order_id)),
      );
      if (orderIds.length === 0) {
        setCanReview(false);
        return false;
      }

      // Then check if the current user has any delivered order among those
      const { data: ordersForUser, error: ordersError } = await supabase
        .from("orders")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("status", "delivered")
        .in("id", orderIds);
      if (ordersError) throw ordersError;

      const allowed = !!ordersForUser && ordersForUser.length > 0;
      setCanReview(allowed);
      return allowed;
    },
    enabled: !!user && !!id,
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in");
      if (product && product.seller_id === user.id) {
        throw new Error("You cannot buy your own product");
      }
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", id!)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: user.id, product_id: id!, quantity });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Added to cart!" });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in");
      if (!canReview) throw new Error("You can only review products you have purchased and received");
      const { error } = await supabase.from("reviews").insert({
        product_id: id!,
        user_id: user.id,
        rating: reviewRating,
        comment: reviewComment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Review submitted!" });
      setReviewComment("");
      queryClient.invalidateQueries({ queryKey: ["reviews", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const images: string[] =
    product && Array.isArray(product.images) ? (product.images as string[]) : [];
  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">Product not found</p>
          <Link to="/">
            <Button variant="link" className="mt-2">
              <ArrowLeft className="mr-2 h-4 w-4" />Back to shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square rounded-xl overflow-hidden bg-muted">
              {images.length > 0 ? (
                <img src={images[selectedImage]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`h-16 w-16 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                      i === selectedImage ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                {avgRating !== null && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">({reviews?.length} reviews)</span>
                  </div>
                )}
                <span className="text-sm text-muted-foreground capitalize">{product.category}</span>
              </div>
            </div>

            <p className="text-3xl font-bold text-foreground">₦{Number(product.price).toLocaleString()}</p>

            {product.description && (
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>
            )}

            <div className="text-sm text-muted-foreground">
              {product.stock > 0 ? (
                <span className="text-success font-medium">{product.stock} in stock</span>
              ) : (
                <span className="text-destructive font-medium">Out of stock</span>
              )}
            </div>

            {/* Quantity & Cart */}
            {product.stock > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center border rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center text-sm font-medium">
                      {quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setQuantity(Math.min(product.stock, quantity + 1))
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => addToCart.mutate()}
                    disabled={
                      addToCart.isPending ||
                      !user ||
                      (!!user && product.seller_id === user.id)
                    }
                    className="flex-1"
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {!user
                      ? "Sign in to buy"
                      : product.seller_id === user.id
                        ? "You are the seller"
                        : "Add to Cart"}
                  </Button>
                </div>
                {user && product.seller_id === user.id && (
                  <p className="text-xs text-muted-foreground">
                    You cannot purchase your own listing. Switch to another
                    account to buy this item.
                  </p>
                )}
              </div>
            )}

            {/* Seller Info */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <Link
                  to={`/seller/${product.seller_id}`}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {product.seller_profile?.avatar_url ? (
                      <img src={product.seller_profile.avatar_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{product.seller_profile?.full_name || "Unknown Seller"}</p>
                    <p className="text-xs text-muted-foreground">View profile & products</p>
                  </div>
                </Link>
                {user && product.seller_profile?.user_id !== user.id && (
                  <Link to={`/messages?to=${product.seller_profile?.user_id}`}>
                    <Button variant="outline" size="sm">
                      <MessageSquare className="mr-2 h-4 w-4" />Message
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reviews */}
        <section className="mt-12">
          <h2 className="text-xl font-display font-bold mb-6">Reviews</h2>

          {user && product.seller_id !== user.id && canReview && (
            <Card className="mb-6">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setReviewRating(s)}>
                      <Star
                        className={`h-5 w-5 ${s <= reviewRating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Write a review..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                />
                <Button size="sm" onClick={() => submitReview.mutate()} disabled={submitReview.isPending}>
                  Submit Review
                </Button>
              </CardContent>
            </Card>
          )}

          {user && product.seller_id !== user.id && !canReview && (
            <p className="mb-4 text-sm text-muted-foreground">
              You can leave a review after your order for this product is marked as delivered.
            </p>
          )}

          {reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.reviewer_name}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${s <= r.rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No reviews yet.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default ProductDetail;
