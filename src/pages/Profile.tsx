import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Camera, ShoppingBag, LayoutDashboard, Star, LogOut } from "lucide-react";

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [hall, setHall] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const { data: profile, isLoading } = useQuery({
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

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      const [ordersRes, sellerOrdersRes, productsRes, reviewsRes] =
        await Promise.all([
          supabase
            .from("orders")
            .select("id, total")
            .eq("buyer_id", user!.id),
          supabase
            .from("orders")
            .select("id, total")
            .eq("seller_id", user!.id),
          supabase
            .from("products")
            .select("id, is_active")
            .eq("seller_id", user!.id),
          supabase
            .from("reviews")
            .select("rating")
            .eq("user_id", user!.id),
        ]);

      if (ordersRes.error) throw ordersRes.error;
      if (sellerOrdersRes.error) throw sellerOrdersRes.error;
      if (productsRes.error) throw productsRes.error;
      if (reviewsRes.error) throw reviewsRes.error;

      const buyerOrders = ordersRes.data || [];
      const sellerOrders = sellerOrdersRes.data || [];
      const products = productsRes.data || [];
      const reviews = reviewsRes.data || [];

      const totalSpent = buyerOrders.reduce(
        (sum: number, o: any) => sum + Number(o.total || 0),
        0,
      );
      const sellerRevenue = sellerOrders.reduce(
        (sum: number, o: any) => sum + Number(o.total || 0),
        0,
      );
      const activeListings = products.filter((p: any) => p.is_active).length;
      const avgRating =
        reviews.length > 0
          ? reviews.reduce(
              (sum: number, r: any) => sum + Number(r.rating || 0),
              0,
            ) / reviews.length
          : null;

      return {
        ordersCount: buyerOrders.length,
        totalSpent,
        sellerOrdersCount: sellerOrders.length,
        sellerRevenue,
        listingsCount: products.length,
        activeListings,
        givenReviews: reviews.length,
        avgRating,
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setMatricNumber(profile.matric_number || "");
      setDepartment(profile.department || "");
      setHall((profile as any).hall_of_residence || "");
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          matric_number: matricNumber,
          department,
          hall_of_residence: hall || null,
        } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Profile updated!" });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast({ title: "Avatar updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
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
      <main className="container py-8 flex flex-col min-h-[calc(100vh-4rem)]">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">My Profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your student identity, seller presence, and account stats.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/orders">
              <Button variant="outline" size="sm">
                <ShoppingBag className="mr-2 h-4 w-4" />
                My orders
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="sm" variant="default">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Seller dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr] flex-1">
          {/* Left column - identity & form */}
          <section>
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Account overview</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-foreground/30 opacity-0 hover:opacity-100 cursor-pointer transition-opacity rounded-full">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
                    ) : (
                      <Camera className="h-5 w-5 text-primary-foreground" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={uploadAvatar}
                      disabled={uploading}
                    />
                  </label>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {profile?.full_name || "Set your name"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="text-xs">
                      Student
                    </Badge>
                    {stats?.activeListings ? (
                      <Badge variant="outline" className="text-xs">
                        Seller · {stats.activeListings} active listing
                        {stats.activeListings > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Buyer
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Student details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Matric number</Label>
                    <Input
                      value={matricNumber}
                      onChange={(e) => setMatricNumber(e.target.value)}
                      placeholder="e.g. 20/0001"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hall of residence</Label>
                    <Input
                      value={hall}
                      onChange={(e) => setHall(e.target.value)}
                      placeholder="e.g. Gideon Troopers"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => updateProfile.mutate()}
                  disabled={updateProfile.isPending}
                  className="w-full sm:w-auto"
                >
                  {updateProfile.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save changes
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Right column - stats & activity */}
          <section className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Activity summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Orders placed
                  </p>
                  <p className="text-lg font-semibold">
                    {stats?.ordersCount ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Total spent: ₦
                    {(stats?.totalSpent ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Orders received
                  </p>
                  <p className="text-lg font-semibold">
                    {stats?.sellerOrdersCount ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Seller revenue: ₦
                    {(stats?.sellerRevenue ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Listings
                  </p>
                  <p className="text-lg font-semibold">
                    {stats?.activeListings ?? 0} /{" "}
                    {stats?.listingsCount ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Active / total products
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Reviews given
                    </p>
                    <p className="text-lg font-semibold">
                      {stats?.givenReviews ?? 0}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="h-3 w-3 text-warning fill-warning" />
                    <span>
                      {stats?.avgRating
                        ? `${stats.avgRating.toFixed(1)} avg rating`
                        : "No ratings yet"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Shortcuts</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <Link to="/cart" className="hover:underline">
                  View cart and continue shopping
                </Link>
                <Link to="/orders" className="hover:underline">
                  Track my orders
                </Link>
                <Link to="/dashboard" className="hover:underline">
                  Manage my listings
                </Link>
                <Link to="/messages" className="hover:underline">
                  Open messages
                </Link>
              </CardContent>
            </Card>
          </section>
        </div>
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
