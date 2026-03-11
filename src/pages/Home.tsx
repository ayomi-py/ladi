import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import ProductCard from "@/components/products/ProductCard";
import CategoryFilter from "@/components/products/CategoryFilter";
import { Loader2, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useAdminRole } from "@/hooks/use-admin";

const Home = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const initialMin = searchParams.get("minPrice") || "";
  const initialMax = searchParams.get("maxPrice") || "";

  const [category, setCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState(initialMin);
  const [maxPrice, setMaxPrice] = useState(initialMax);
  const search = searchParams.get("q")?.trim() || "";
  const { isAdmin, adminLoading } = useAdminRole();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && !adminLoading && user && isAdmin) {
      navigate("/admin");
    }
  }, [user, loading, adminLoading, isAdmin, navigate]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", category, search, minPrice, maxPrice],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .gt("stock", 0)
        .order("created_at", { ascending: false });

      if (category !== "all") {
        query = query.eq("category", category as any);
      }

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,description.ilike.%${search}%`,
        );
      }

      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      if (!Number.isNaN(min)) {
        query = query.gte("price", min);
      }
      if (!Number.isNaN(max)) {
        query = query.lte("price", max);
      }

      const { data, error } = await query;
      if (error) throw error;

      const sellerIds = [...new Set(data.map((p) => p.seller_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", sellerIds);
      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, p.full_name]) || [],
      );
      return data.map((p) => ({
        ...p,
        seller_name: profileMap.get(p.seller_id) || "Unknown Seller",
      }));
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-6 space-y-6">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
              Marketplace
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              Browse active listings from students across campus, filtered by category, price, and search.
            </p>
          </div>
          <div className="flex gap-3 text-xs md:text-sm">
            <span className="rounded-full bg-primary/10 text-primary px-3 py-1">
              Secure student‑only marketplace
            </span>
            <span className="hidden sm:inline rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 border border-emerald-100">
              Multi‑vendor selling
            </span>
          </div>
        </section>

        <section className="rounded-2xl border bg-card/60 backdrop-blur p-4 md:p-5 space-y-3">
          <CategoryFilter selected={category} onSelect={setCategory} />
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Price:</span>
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="h-9 w-24 rounded-md border bg-background px-2 text-xs outline-none"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="h-9 w-24 rounded-md border bg-background px-2 text-xs outline-none"
              />
            </div>
            {search && (
              <span className="text-xs text-muted-foreground">
                Showing results for{" "}
                <span className="font-medium">{search}</span>
              </span>
            )}
          </div>
        </section>

        <section aria-label="Marketplace products">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {products.map((product: any) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={Number(product.price)}
                  image={
                    Array.isArray(product.images) &&
                    product.images.length > 0
                      ? product.images[0]
                      : undefined
                  }
                  sellerName={product.seller_name}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No products yet</p>
              <p className="text-sm">Be the first to list something!</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Home;

