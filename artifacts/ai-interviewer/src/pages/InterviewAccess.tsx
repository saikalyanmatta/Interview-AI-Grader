import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, ShieldX, Calendar, Clock, Mic } from "lucide-react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function validateAccess(scheduledInterviewId: number, email: string) {
  const r = await fetch(`${BASE}/api/scheduled-interviews/validate-access`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledInterviewId, email }),
  });
  if (!r.ok) throw new Error("Validation failed");
  return r.json();
}

async function createInterviewFromScheduled(scheduledInterviewId: number, codingLanguage: string) {
  const r = await fetch(`${BASE}/api/interviews`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledInterviewId, codingLanguage }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as any).error || "Failed to create interview");
  }
  return r.json();
}

const CODING_LANGUAGES = ["Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Ruby", "Rust", "Swift"];

export default function InterviewAccess() {
  const [, params] = useRoute("/interview-access/:id");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { toast } = useToast();
  const scheduledId = parseInt(params?.id || "0");

  const [step, setStep] = useState<"checking" | "email_entry" | "access_denied" | "language_select" | "starting">("checking");
  const [email, setEmail] = useState("");
  const [validation, setValidation] = useState<any>(null);
  const [codingLanguage, setCodingLanguage] = useState("Python");
  const [isValidating, setIsValidating] = useState(false);
  const [si, setSi] = useState<any>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        setStep("email_entry");
      } else {
        setEmail(user?.email || "");
        setStep("email_entry");
      }
    }
  }, [authLoading, isAuthenticated, user]);

  const handleValidate = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" }); return;
    }
    setIsValidating(true);
    try {
      const result = await validateAccess(scheduledId, email);
      setValidation(result);
      setSi(result.scheduledInterview);
      if (result.allowed) {
        setStep("language_select");
      } else {
        setStep("access_denied");
      }
    } catch (e: any) {
      toast({ title: "Validation error", description: e.message, variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleStart = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    setStep("starting");
    try {
      const interview = await createInterviewFromScheduled(scheduledId, codingLanguage);
      setLocation(`/interview/${interview.id}`);
    } catch (e: any) {
      toast({ title: "Failed to start", description: e.message, variant: "destructive" });
      setStep("language_select");
    }
  };

  if (step === "checking" || authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-12">
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
          <Mic className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-display font-bold">Interview Access</h1>
        <p className="text-muted-foreground mt-2">Enter your email to verify your invitation.</p>
      </div>

      <Card className="glass-panel border-white/10">
        <CardContent className="p-6">
          {step === "email_entry" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-black/20 border-white/10"
                  onKeyDown={(e) => e.key === "Enter" && handleValidate()}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter the email address your employer used to invite you.
                </p>
              </div>
              {!isAuthenticated && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
                  <p className="text-primary font-medium mb-1">Sign in required</p>
                  <p className="text-muted-foreground text-xs">You'll need to sign in with Google to take the interview. Use the same email as your invitation.</p>
                  <Button variant="gradient" size="sm" className="mt-2" onClick={login}>Sign In with Google</Button>
                </div>
              )}
              <Button variant="gradient" className="w-full" onClick={handleValidate} disabled={isValidating}>
                {isValidating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</> : "Verify Access"}
              </Button>
            </motion.div>
          )}

          {step === "access_denied" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
              <ShieldX className="h-16 w-16 text-red-400 mx-auto" />
              <div>
                <h3 className="text-xl font-bold text-red-400">Access Denied</h3>
                <p className="text-muted-foreground mt-2">{validation?.reason}</p>
                {validation?.startTime && (
                  <div className="mt-3 bg-white/5 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground justify-center">
                      <Calendar className="h-4 w-4" />
                      <span>Opens: {new Date(validation.startTime).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
              <Button variant="outline" className="border-white/20" onClick={() => setStep("email_entry")}>
                Try Different Email
              </Button>
            </motion.div>
          )}

          {step === "language_select" && si && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-emerald-400 font-medium text-sm">Access Verified</p>
                  <p className="text-muted-foreground text-xs">{email}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Deadline: {new Date(si.deadlineTime).toLocaleString()}</span>
                </div>
                {si.codingQuestionsCount > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-3 block mt-4">Preferred Coding Language</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CODING_LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setCodingLanguage(lang)}
                          className={`p-2.5 rounded-xl border text-sm font-medium transition-all ${codingLanguage === lang ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30"}`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
                <p className="text-yellow-400 font-medium mb-1">⚠️ Interview Rules</p>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li>• The interview will run in full-screen mode</li>
                  <li>• Tab switching will be detected and flagged</li>
                  <li>• Once started, you must complete the interview</li>
                  {si.codingQuestionsCount > 0 && <li>• {si.codingQuestionsCount} coding question(s) at the end</li>}
                </ul>
              </div>

              {!isAuthenticated ? (
                <Button variant="gradient" className="w-full" onClick={login}>
                  Sign In to Start Interview
                </Button>
              ) : (
                <Button variant="gradient" className="w-full" onClick={handleStart} disabled={step === "starting"}>
                  {step === "starting" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...</> : "Start Interview →"}
                </Button>
              )}
            </motion.div>
          )}

          {step === "starting" && (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Setting up your interview...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
