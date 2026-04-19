import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useTheme } from "./ThemeProvider";
import {
  LayoutDashboard, Briefcase, LogOut, Sun, Moon,
  Menu, X, ChevronRight, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated, login, logout, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isEmployerSection = location.startsWith("/employer");
  const isInterview = location.startsWith("/interview/") && !location.includes("/report");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-x-hidden">
      <div className="bg-blob-1 top-[-20%] left-[-10%] w-[60%] h-[60%] animate-blob" />
      <div className="bg-blob-2 bottom-[-20%] right-[-10%] w-[50%] h-[50%] animate-blob" style={{ animationDelay: "2s" }} />

      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="h-9 w-9 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <img src="/evalpro-logo.png" alt="EvalPro" className="w-full h-full object-cover" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Eval<span className="text-primary">Pro</span></span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1 bg-secondary/60 rounded-xl p-1 border border-border">
              <Link href="/dashboard">
                <button className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  !isEmployerSection
                    ? "bg-background shadow-sm text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                  <LayoutDashboard className="h-4 w-4" />
                  Candidate
                </button>
              </Link>
              <Link href="/employer">
                <button className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  isEmployerSection
                    ? "bg-background shadow-sm text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                  <Briefcase className="h-4 w-4" />
                  Employer
                </button>
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl flex items-center justify-center border border-border bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {!isLoading && !isAuthenticated && (
              <>
                <button onClick={login} className="hidden sm:flex items-center px-4 py-2 rounded-xl text-sm font-medium border border-border bg-secondary/60 hover:bg-secondary transition-colors">
                  Sign In
                </button>
                <button onClick={login} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold btn-gradient">
                  Get Started <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {isAuthenticated && user && (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/profile">
                  <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary transition-colors">
                    <div className="h-7 w-7 rounded-lg overflow-hidden border border-border flex-shrink-0">
                      {user.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt={user.firstName || "User"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          {user.firstName?.[0] || "U"}
                        </div>
                      )}
                    </div>
                    <div className="text-left hidden lg:block">
                      <p className="text-xs font-semibold leading-none">{user.firstName} {user.lastName}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{user.email}</p>
                    </div>
                  </button>
                </Link>
                <button
                  onClick={logout}
                  className="h-9 w-9 rounded-xl flex items-center justify-center border border-border bg-secondary/60 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors text-muted-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              className="md:hidden h-9 w-9 rounded-xl flex items-center justify-center border border-border bg-secondary/60"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl overflow-hidden"
            >
              <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
                {isAuthenticated ? (
                  <>
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors">
                        <LayoutDashboard className="h-5 w-5 text-primary" />
                        <span className="font-medium">Candidate Dashboard</span>
                      </div>
                    </Link>
                    <Link href="/employer" onClick={() => setMobileOpen(false)}>
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <span className="font-medium">Employer Portal</span>
                      </div>
                    </Link>
                    <Link href="/profile" onClick={() => setMobileOpen(false)}>
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors">
                        <User className="h-5 w-5 text-primary" />
                        <span className="font-medium">My Profile</span>
                      </div>
                    </Link>
                    <button onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 text-destructive transition-colors w-full text-left">
                      <LogOut className="h-5 w-5" />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </>
                ) : (
                  <button onClick={() => { login(); setMobileOpen(false); }} className="w-full py-3 rounded-xl font-semibold btn-gradient text-center">
                    Get Started Free
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 relative z-10">
        {children}
      </main>
    </div>
  );
}
