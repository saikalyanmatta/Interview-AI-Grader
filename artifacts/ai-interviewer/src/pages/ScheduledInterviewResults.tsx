import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, SortAsc, Users, CheckCircle, XCircle, Clock, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchResults(id: number) {
  const r = await fetch(`${BASE}/api/scheduled-interviews/${id}/results`, { credentials: "include" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as any).error || "Failed to fetch");
  }
  return r.json();
}

type SortKey = "name_asc" | "name_desc" | "score_desc" | "score_asc" | "recommendation";

function sortResults(results: any[], key: SortKey) {
  return [...results].sort((a, b) => {
    switch (key) {
      case "name_asc": return (a.candidateName || "").localeCompare(b.candidateName || "");
      case "name_desc": return (b.candidateName || "").localeCompare(a.candidateName || "");
      case "score_desc": return (b.overallScore ?? -1) - (a.overallScore ?? -1);
      case "score_asc": return (a.overallScore ?? 999) - (b.overallScore ?? 999);
      case "recommendation": {
        const order: Record<string, number> = { hire: 0, maybe: 1, no_hire: 2 };
        return (order[a.recommendation] ?? 3) - (order[b.recommendation] ?? 3);
      }
      default: return 0;
    }
  });
}

function RecBadge({ rec }: { rec: string | null }) {
  if (!rec) return null;
  const map: Record<string, string> = {
    hire: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    maybe: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    no_hire: "text-red-400 bg-red-400/10 border-red-400/20",
  };
  const labels: Record<string, string> = { hire: "Hire", maybe: "Maybe", no_hire: "No Hire" };
  return <Badge className={`border text-xs ${map[rec] || ""}`}>{labels[rec] || rec}</Badge>;
}

export default function ScheduledInterviewResults() {
  const [, params] = useRoute("/employer/scheduled/:id/results");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const id = parseInt(params?.id || "0");

  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("score_desc");
  const [tab, setTab] = useState<"attempted" | "not_attempted">("attempted");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchResults(id)
      .then(setResults)
      .catch(e => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const r = await fetch(`${BASE}/api/scheduled-interviews/${id}/results/export`, { credentials: "include" });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `results-${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="text-center py-16 text-red-400"><XCircle className="h-10 w-10 mx-auto mb-3" /><p>{error}</p></div>;
  if (!results) return null;

  const attempted = sortResults(results.attempted || [], sort);
  const notAttempted = results.notAttempted || [];

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "score_desc", label: "Score (High → Low)" },
    { value: "score_asc", label: "Score (Low → High)" },
    { value: "name_asc", label: "Name (A → Z)" },
    { value: "name_desc", label: "Name (Z → A)" },
    { value: "recommendation", label: "Recommendation" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/employer")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">{results.scheduledInterview?.title}</h1>
            <p className="text-muted-foreground text-sm">Interview Results</p>
          </div>
        </div>
        <Button variant="gradient" className="gap-2" onClick={handleDownload} disabled={isDownloading}>
          <Download className="h-4 w-4" />
          {isDownloading ? "Exporting..." : "Export XLSX"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Candidates", value: (results.attempted?.length || 0) + (results.notAttempted?.length || 0), icon: Users, color: "text-primary" },
          { label: "Attempted", value: results.attempted?.length || 0, icon: CheckCircle, color: "text-emerald-400" },
          { label: "Not Attempted", value: results.notAttempted?.length || 0, icon: Clock, color: "text-yellow-400" },
        ].map((stat) => (
          <Card key={stat.label} className="glass-panel border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color} shrink-0`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setTab("attempted")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "attempted" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
          >
            Attempted ({results.attempted?.length || 0})
          </button>
          <button
            onClick={() => setTab("not_attempted")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "not_attempted" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
          >
            Not Attempted ({results.notAttempted?.length || 0})
          </button>
        </div>

        {tab === "attempted" && (
          <div className="flex items-center gap-2">
            <SortAsc className="h-4 w-4 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {tab === "attempted" && (
        <div className="space-y-3">
          {attempted.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No candidates have attempted this interview yet.</p>
            </div>
          ) : (
            attempted.map((r: any, i: number) => (
              <motion.div key={r.interviewId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="glass-panel border-white/10 hover:border-white/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {(r.candidateName || r.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold">{r.candidateName || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {r.overallScore !== null && (
                          <div className="text-right">
                            <p className="text-2xl font-bold">{r.overallScore}<span className="text-sm text-muted-foreground">/100</span></p>
                            <p className="text-xs text-muted-foreground">Overall</p>
                          </div>
                        )}
                        <RecBadge rec={r.recommendation} />
                      </div>
                    </div>
                    {r.report && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {r.englishScore !== null && <span>English: <strong className="text-white">{r.englishScore}</strong></span>}
                        {r.behavioralScore !== null && <span>Behavioral: <strong className="text-white">{r.behavioralScore}</strong></span>}
                        {r.confidenceScore !== null && <span>Confidence: <strong className="text-white">{r.confidenceScore}</strong></span>}
                        {r.skillScores?.slice(0, 3).map((s: any) => (
                          <span key={s.skill}>{s.skill}: <strong className="text-white">{s.score}</strong></span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === "not_attempted" && (
        <div className="space-y-2">
          {notAttempted.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-3 text-emerald-400 opacity-50" />
              <p>All candidates have attempted the interview!</p>
            </div>
          ) : (
            notAttempted.map((c: any, i: number) => (
              <motion.div key={c.email} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
                    {c.email[0].toUpperCase()}
                  </div>
                  <span className="font-mono text-sm">{c.email}</span>
                  <Badge className="ml-auto border text-xs text-yellow-400 bg-yellow-400/10 border-yellow-400/20">Not Attempted</Badge>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
