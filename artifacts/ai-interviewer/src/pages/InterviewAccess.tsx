import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { motion } from "framer-motion";
import { Mic, Lock, ChevronRight, Loader2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function InterviewAccess() {
  const [, params] = useRoute("/interview-access/:id");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, login, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const checkAccess = async () => {
    if (!email) { toast.error("Enter your email"); return; }
    setChecking(true);
    try {
      const r = await fetch("/api/scheduled-interviews/validate-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledInterviewId: params?.id, email }),
      });
      const data = await r.json();
      setResult(data);
    } catch { toast.error("Failed to check access"); }
    setChecking(false);
  };

  const startInterview = async () => {
    if (!isAuthenticated) { login(); return; }
    setStarting(true);
    try {
      const r = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledInterviewId: Number(params?.id) }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      const iv = await r.json();
      setLocation(`/interview/${iv.id}`);
    } catch (err: any) { toast.error(err.message || "Failed to start"); setStarting(false); }
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-md">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-3xl p-8 text-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/25">
          <Mic className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">Interview Access</h1>
        <p className="text-muted-foreground text-sm mb-8">Verify your email to access this scheduled interview</p>

        <div className="grid gap-3 text-left mb-6">
          <label className="text-sm font-medium">Your Email Address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            onKeyDown={e => e.key === "Enter" && checkAccess()}
          />
        </div>

        {!result ? (
          <button onClick={checkAccess} disabled={checking} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold btn-gradient disabled:opacity-60">
            {checking ? <><Loader2 className="h-5 w-5 animate-spin" />Checking...</> : <><Lock className="h-5 w-5" />Check Access</>}
          </button>
        ) : result.allowed ? (
          <div className="grid gap-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
              Access verified! You're registered for this interview.
            </div>
            {!isAuthenticated ? (
              <button onClick={login} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold btn-gradient">
                <ChevronRight className="h-5 w-5" />Sign In to Continue
              </button>
            ) : (
              <button onClick={startInterview} disabled={starting} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold btn-gradient disabled:opacity-60">
                {starting ? <><Loader2 className="h-5 w-5 animate-spin" />Starting...</> : <><Mic className="h-5 w-5" />Start Interview</>}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-left">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{result.reason}</span>
            </div>
            {result.startTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Starts: {new Date(result.startTime).toLocaleString()}
              </div>
            )}
            <button onClick={() => { setResult(null); setEmail(""); }} className="w-full py-3 rounded-xl font-medium border border-border hover:bg-secondary transition-colors text-sm">
              Try Again
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
