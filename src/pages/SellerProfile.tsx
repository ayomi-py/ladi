import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ProductCard from "@/components/products/ProductCard";
import { Loader2, User, MessageSquare, Package } from "lucide-react";

const SellerProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["seller-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, department, matric_number")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["seller-products", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", userId!)
        .eq("is_active", true)
        .gt("stock", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const isLoading = authLoading || profileLoading || productsLoading;

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

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-20 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">Seller not found</p>
          <Link to="/home">
            <Button variant="link" className="mt-2">Back to shop</Button>
          </Link>
        </main>
      </div>
    );
  }

  const images = (p: any) =>
    Array.isArray(p?.images) && p.images.length > 0 ? p.images[0] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <Link to="/home">
          <Button variant="ghost" size="sm" className="mb-6">Back</Button>
        </Link>

        <Card className="mb-8">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-display font-bold">{profile.full_name || "Unknown Seller"}</h1>
              {(profile.department || profile.matric_number) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {[profile.department, profile.matric_number].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {user && profile.user_id !== user.id && (
              <Link to={`/messages?to=${profile.user_id}`}>
                <Button variant="outline" size="sm">
                  <MessageSquare className="mr-2 h-4 w-4" />Message
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold mb-4">
          Products ({products?.length ?? 0})
        </h2>
        {products && products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {products.map((p: any) => (
              <ProductCard
                key={p.id}
                id={p.id}
                name={p.name}
                price={Number(p.price)}
                image={images(p)}
                sellerName={profile.full_name || undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No products listed yet.</p>
        )}
      </main>
    </div>
  );
};

export default SellerProfile;
