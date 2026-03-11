import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/use-admin";

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isAdmin, adminLoading } = useAdminRole();

  useEffect(() => {
    if (!loading && !adminLoading && user) {
      if (isAdmin) {
        navigate("/admin");
      } else {
        navigate("/home");
      }
    }
  }, [user, loading, adminLoading, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-6">
        {/* Hero */}
        <section className="mb-10 text-center py-12 rounded-3xl bg-primary/10 border">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-3 tracking-tight">
            LADI - Babcock Campus Marketplace
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A safe, student‑only platform to buy and sell on campus. List items in minutes, discover deals from fellow
            students, and manage everything from one dashboard.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            <a href="#features" className="underline-offset-4 hover:underline text-primary">
              Features
            </a>
            <a href="#how-it-works" className="underline-offset-4 hover:underline text-primary">
              How it works
            </a>
            <a href="#faq" className="underline-offset-4 hover:underline text-primary">
              FAQ
            </a>
            <a href="#docs" className="underline-offset-4 hover:underline text-primary">
              Docs
            </a>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mb-12">
          <h2 className="text-2xl font-display font-bold mb-3 text-center">Features</h2>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-2xl mx-auto">
            LADI combines marketplace basics with campus‑specific workflows: student verification, seller dashboards,
            messaging, and admin oversight.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-xl border bg-card/80 backdrop-blur p-4 text-left shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold mb-1 text-sm">Student‑only marketplace</h3>
              <p className="text-xs text-muted-foreground">
                Accounts are tied to student emails, with per‑user profiles for matric number, department, and avatar.
              </p>
            </div>
            <div className="rounded-xl border bg-card/80 backdrop-blur p-4 text-left shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold mb-1 text-sm">Multi‑vendor selling</h3>
              <p className="text-xs text-muted-foreground">
                Any student can become a seller, manage listings, track orders, and see revenue in their dashboard.
              </p>
            </div>
            <div className="rounded-xl border bg-card/80 backdrop-blur p-4 text-left shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold mb-1 text-sm">Cart, checkout & coupons</h3>
              <p className="text-xs text-muted-foreground">
                Modern cart and checkout flow with seller‑grouped orders, delivery fees, and coupon support.
              </p>
            </div>
            <div className="rounded-xl border bg-card/80 backdrop-blur p-4 text-left shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold mb-1 text-sm">Gated reviews</h3>
              <p className="text-xs text-muted-foreground">
                Only buyers with delivered orders can leave ratings and reviews, keeping feedback trustworthy.
              </p>
            </div>
            <div className="rounded-xl border bg-card/80 backdrop-blur p-4 text-left shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold mb-1 text-sm">In‑app messaging</h3>
              <p className="text-xs text-muted-foreground">
                Real‑time messaging between buyers and sellers so you can clarify details before and after purchase.
              </p>
            </div>
            <div className="rounded-xl border bg-card/80 backdrop-blur p-4 text-left shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold mb-1 text-sm">Admin controls</h3>
              <p className="text-xs text-muted-foreground">
                Admins can view users, moderate products, inspect revenue analytics, and see all coupons.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mb-10">
          <h2 className="text-2xl font-display font-bold mb-3 text-center">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Step 1</p>
              <h3 className="font-semibold mb-1">Create your account</h3>
              <p className="text-xs text-muted-foreground">
                Sign up with your Babcock email, complete your profile, and verify your identity as a student.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Step 2</p>
              <h3 className="font-semibold mb-1">Browse or list products</h3>
              <p className="text-xs text-muted-foreground">
                Browse by category, search, and filters - or use the seller dashboard to list your own items for sale.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Step 3</p>
              <h3 className="font-semibold mb-1">Checkout, message, and review</h3>
              <p className="text-xs text-muted-foreground">
                Add items to cart, complete checkout, message sellers, and leave reviews after successful delivery.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-10">
          <h2 className="text-2xl font-display font-bold mb-3 text-center">FAQ</h2>
          <div className="max-w-2xl mx-auto space-y-3 text-sm">
            <details className="rounded-lg border bg-card p-3">
              <summary className="cursor-pointer font-medium">
                Who can use LADI?
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                LADI is designed for Babcock University students. Authentication is tied to student email addresses,
                and each account has a matric number and department profile.
              </p>
            </details>
            <details className="rounded-lg border bg-card p-3">
              <summary className="cursor-pointer font-medium">
                How do I start selling?
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                After signing in, open the seller dashboard, create your first listing, and upload images. Once a
                listing is active, you&apos;re treated as a seller and can manage orders in the same dashboard.
              </p>
            </details>
            <details className="rounded-lg border bg-card p-3">
              <summary className="cursor-pointer font-medium">
                How are payments handled?
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                The current environment uses a simulated checkout flow. In production, the checkout is intended to be
                wired to Paystack for secure payments and automatic order recording.
              </p>
            </details>
            <details className="rounded-lg border bg-card p-3">
              <summary className="cursor-pointer font-medium">
                Can I message sellers before buying?
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Yes. Each product page links to an in‑app message thread with the seller so you can ask questions
                before or after purchase.
              </p>
            </details>
          </div>
        </section>

        {/* Docs */}
        <section id="docs" className="mb-10">
          <h2 className="text-2xl font-display font-bold mb-3 text-center">Docs</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto text-center mb-4">
            For developers and maintainers, the project README documents the architecture, core features, and local
            setup. Supabase migrations in the <code>supabase/migrations</code> folder define the database schema.
          </p>
          <div className="flex justify-center">
            <a
              href="https://github.com/ayomi-py/ladi.git"
              className="text-primary underline underline-offset-4 text-sm"
            >
              View project docs (README) on GitHub
            </a>
          </div>
        </section>

        {/* Products / dashboard are intentionally hidden on SEO page.
            Authenticated users are redirected to /home above. */}
      </main>
    </div>
  );
};

export default Index;
