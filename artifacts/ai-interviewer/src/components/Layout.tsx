import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "./ui/button";
import { LogOut, Mic, Briefcase, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated, login, logout, isLoading } = useAuth();

  const isEmployerSection = location.startsWith("/employer");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />

      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Vocalize.ai</span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
              <Link href="/dashboard">
                <button className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  !isEmployerSection ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                )}>
                  <LayoutDashboard className="h-4 w-4" />
                  Candidate
                </button>
              </Link>
              <Link href="/employer">
                <button className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  isEmployerSection ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                )}>
                  <Briefcase className="h-4 w-4" />
                  Employer
                </button>
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {!isLoading && !isAuthenticated && (
              <div className="flex items-center gap-2">
                <Button onClick={login} variant="outline" className="font-semibold border-white/20 bg-black/20">
                  Sign In
                </Button>
                <Button onClick={login} variant="gradient" className="font-semibold">
                  Sign Up Free
                </Button>
              </div>
            )}

            {isAuthenticated && user && (
              <div className="flex items-center gap-2">
                <Link href="/profile">
                  <button className="relative h-9 w-9 rounded-full border border-white/20 overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all shrink-0">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt={user.firstName || "User"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-secondary flex items-center justify-center text-sm font-bold">
                        {user.firstName?.[0] || "U"}
                      </div>
                    )}
                  </button>
                </Link>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
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
