import React, { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Users, Plus, Trash2, ChevronLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

export default function ScheduledInterviewCandidates() {
  const [, params] = useRoute("/employer/scheduled/:id/candidates");
  const id = params?.id;
  const [si, setSi] = useState<any>(null);
  const [emailInput, setEmailInput] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/scheduled-interviews/${id}`).then(r => r.json()).then(setSi);
  }, [id]);

  const addCandidates = async () => {
    const emails = emailInput.split(/[\n,;]+/).map(e => e.trim()).filter(e => e);
    if (!emails.length) { toast.error("Enter at least one email"); return; }
    setAdding(true);
    try {
      const r = await fetch(`/api/scheduled-interviews/${id}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await r.json();
      setSi((prev: any) => ({ ...prev, candidates: data.candidates }));
      toast.success(`Added ${data.added} candidate(s)`);
      setEmailInput("");
    } catch { toast.error("Failed to add candidates"); }
    setAdding(false);
  };

  const removeCandidate = async (email: string) => {
    try {
      const r = await fetch(`/api/scheduled-interviews/${id}/candidates`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      setSi((prev: any) => ({ ...prev, candidates: data.candidates }));
      toast.success("Removed candidate");
    } catch { toast.error("Failed to remove"); }
  };

  const inviteLink = `${window.location.origin}/interview-access/${id}`;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="mb-8">
        <Link href="/employer">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ChevronLeft className="h-4 w-4" />Back to Dashboard
          </button>
        </Link>
        <h1 className="text-3xl font-display font-bold mb-1">{si?.title || "Manage Candidates"}</h1>
        <p className="text-muted-foreground">Add or remove candidates for this interview session</p>
      </motion.div>

      <div className="grid gap-5">
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Invite Link</h3>
            <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copied!"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />Copy Link
            </button>
          </div>
          <code className="text-xs text-muted-foreground break-all bg-secondary/50 rounded-lg px-3 py-2 block">{inviteLink}</code>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-2xl p-6">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />Add Candidates
          </h3>
          <textarea
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder="Enter emails separated by commas, semicolons, or new lines&#10;&#10;john@example.com&#10;jane@example.com"
            rows={5}
            className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground mb-4"
          />
          <button onClick={addCandidates} disabled={adding}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold btn-gradient text-sm disabled:opacity-60"
          >
            {adding ? <><Loader2 className="h-4 w-4 animate-spin" />Adding...</> : <><Plus className="h-4 w-4" />Add Candidates</>}
          </button>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={3} className="glass-panel rounded-2xl p-6">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Candidates ({si?.candidates?.length || 0})
          </h3>
          {!si?.candidates?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No candidates added yet</p>
          ) : (
            <div className="grid gap-2">
              {si.candidates.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/40 border border-border">
                  <span className="text-sm">{c.email}</span>
                  <button onClick={() => removeCandidate(c.email)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
