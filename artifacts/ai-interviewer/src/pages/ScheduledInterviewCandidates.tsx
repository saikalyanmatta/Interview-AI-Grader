import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, Plus, Trash2, Copy, Mail, Calendar, Clock } from "lucide-react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchSI(id: number) {
  const r = await fetch(`${BASE}/api/scheduled-interviews/${id}`, { credentials: "include" });
  if (!r.ok) throw new Error("Not found");
  return r.json();
}

async function addCandidates(id: number, emails: string[]) {
  const r = await fetch(`${BASE}/api/scheduled-interviews/${id}/candidates`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emails }),
  });
  if (!r.ok) throw new Error("Failed to add");
  return r.json();
}

async function removeCandidate(id: number, email: string) {
  const r = await fetch(`${BASE}/api/scheduled-interviews/${id}/candidates`, {
    method: "DELETE", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!r.ok) throw new Error("Failed to remove");
  return r.json();
}

function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = text.match(emailRegex) || [];
  return [...new Set(found.map(e => e.toLowerCase().trim()))];
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ScheduledInterviewCandidates() {
  const [, params] = useRoute("/employer/scheduled/:id/candidates");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const id = parseInt(params?.id || "0");

  const [si, setSi] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pasteText, setPasteText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);

  useEffect(() => {
    fetchSI(id).then(setSi).catch(() => setLocation("/employer")).finally(() => setIsLoading(false));
  }, [id]);

  const handleAdd = async () => {
    const emails = extractEmails(pasteText);
    if (emails.length === 0) {
      toast({ title: "No valid emails found", description: "Paste emails separated by newlines or commas.", variant: "destructive" });
      return;
    }
    setIsAdding(true);
    try {
      const result = await addCandidates(id, emails);
      setSi((prev: any) => ({ ...prev, candidates: result.candidates }));
      setPasteText("");
      setShowPasteArea(false);
      toast({ title: `${result.added} candidate(s) added`, description: result.added === 0 ? "All emails already exist." : undefined });
    } catch (e: any) {
      toast({ title: "Failed to add candidates", description: e.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    try {
      const result = await removeCandidate(id, email);
      setSi((prev: any) => ({ ...prev, candidates: result.candidates }));
      toast({ title: "Candidate removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    }
  };

  const previewEmails = extractEmails(pasteText);
  const interviewLink = si ? `${window.location.origin}${BASE}/interview-access/${id}` : "";

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!si) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/employer")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold">{si.title}</h1>
          <p className="text-muted-foreground text-sm">Manage candidate invitations</p>
        </div>
      </div>

      <Card className="glass-panel border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Start: <strong className="text-white">{formatDateTime(si.startTime)}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-400" />
              <span>Deadline: <strong className="text-white">{formatDateTime(si.deadlineTime)}</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" /> Interview Link
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary text-xs"
              onClick={() => { navigator.clipboard.writeText(interviewLink); toast({ title: "Link copied!" }); }}
            >
              Copy Link
            </Button>
          </div>
          <div className="bg-black/30 rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground break-all">
            {interviewLink}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Share this link with candidates. Only listed emails can access the interview.</p>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Candidates ({si.candidates?.length ?? 0})
            </h2>
            <Button variant="gradient" size="sm" className="gap-2" onClick={() => setShowPasteArea(!showPasteArea)}>
              <Plus className="h-4 w-4" /> Add Candidates
            </Button>
          </div>

          {showPasteArea && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Paste Emails
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Paste email addresses — one per line, comma-separated, or copied from Excel. Duplicates are automatically removed.
                </p>
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"alice@company.com\nbob@company.com\ncharlie@company.com"}
                  className="bg-black/20 border-white/10 min-h-[120px] font-mono text-sm"
                />
                {pasteText && (
                  <p className="text-xs text-primary mt-1">
                    {previewEmails.length} unique valid email{previewEmails.length !== 1 ? "s" : ""} detected
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="gradient" size="sm" onClick={handleAdd} disabled={isAdding || previewEmails.length === 0}>
                  {isAdding ? "Adding..." : `Add ${previewEmails.length} Email${previewEmails.length !== 1 ? "s" : ""}`}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowPasteArea(false); setPasteText(""); }}>Cancel</Button>
              </div>
            </motion.div>
          )}

          {si.candidates?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No candidates added yet.</p>
              <p className="text-xs mt-1">Click "Add Candidates" to paste email addresses.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {si.candidates?.map((c: any, i: number) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {c.email[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-mono">{c.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                    onClick={() => handleRemove(c.email)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {new Date() >= new Date(si.startTime) && (
        <div className="flex justify-end">
          <Link href={`/employer/scheduled/${id}/results`}>
            <Button variant="gradient">View Results →</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
