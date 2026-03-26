import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "./ui/button";
import { LogOut, LayoutDashboard, Briefcase, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated, login, logout, isLoading } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "My Interviews", icon: Mic },
    { href: "/employer", label: "Job Profiles", icon: Briefcase },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />

      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Vocalize.ai</span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {navItems.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
                      isActive 
                        ? "bg-white/10 text-white shadow-sm" 
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-4">
            {!isLoading && !isAuthenticated && (
              <Button onClick={login} variant="gradient" className="font-semibold">
                Sign in with Google
              </Button>
            )}
            
            {isAuthenticated && user && (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt={user.firstName || "User"} className="h-9 w-9 rounded-full border border-white/20" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center border border-white/20">
                      {user.firstName?.[0] || "U"}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-red-400">
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
        {children}
      </main>
    </div>
  );
}
