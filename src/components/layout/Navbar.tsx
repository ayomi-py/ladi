import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ShoppingCart, User, MessageSquare, Menu, X, Search, LogOut, LayoutDashboard, Sun, Moon } from "lucide-react";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // initialize theme from localStorage / system
  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial =
      stored === "dark" || (!stored && prefersDark) ? "dark" : "light";
    setTheme(initial);
    if (initial === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    window.localStorage.setItem("theme", next);
  };

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`navbar-messages-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["unread-messages", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, queryClient]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to={user ? "/home" : "/"} className="flex items-center gap-2">
          <span className="text-2xl font-display font-bold text-primary">LADI</span>
        </Link>

        {/* Desktop Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (user) {
                    navigate(
                      `/home?q=${encodeURIComponent(searchTerm.trim())}`,
                    );
                  } else {
                    navigate("/login");
                  }
                }
              }}
              className="w-full h-10 rounded-lg border bg-secondary/50 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Link to="/messages">
                <Button variant="ghost" size="icon" className="relative">
                  <MessageSquare className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Link to="/cart">
                <Button variant="ghost" size="icon"><ShoppingCart className="h-5 w-5" /></Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" size="icon"><LayoutDashboard className="h-5 w-5" /></Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              <Link to="/profile">
                <Button variant="ghost" size="icon"><User className="h-5 w-5" /></Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button>Get Started</Button>
              </Link>
            </>
          )}
        </nav>

        {/* Mobile toggle */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-3 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setMobileOpen(false);
                  if (user) {
                    navigate(
                      `/home?q=${encodeURIComponent(searchTerm.trim())}`,
                    );
                  } else {
                    navigate("/login");
                  }
                }
              }}
              className="w-full h-10 rounded-lg border bg-secondary/50 pl-10 pr-4 text-sm outline-none"
            />
          </div>
          {user ? (
            <div className="flex flex-col gap-1">
              <Link to="/messages" onClick={() => setMobileOpen(false)} className="relative">
                <Button variant="ghost" className="w-full justify-start">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Messages
                  {unreadCount > 0 && (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Link to="/cart" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start"><ShoppingCart className="mr-2 h-4 w-4" />Cart</Button>
              </Link>
              <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Button>
              </Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start"><User className="mr-2 h-4 w-4" />Profile</Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  toggleTheme();
                }}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    Light mode
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark mode
                  </>
                )}
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full">Sign In</Button>
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)}>
                <Button className="w-full">Get Started</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
