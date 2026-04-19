import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { motion } from "framer-motion";
import { BarChart3, Download, ChevronLeft, Users } from "lucide-react";
import { Link } from "wouter";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

function recBadge(rec: string | null) {
  if (rec === "hire") return <span className="badge-hire px-2.5 py-1 rounded-full text-xs font-semibold">Hire</span>;
  if (rec === "maybe") return <span className="badge-maybe px-2.5 py-1 rounded-full text-xs font-semibold">Maybe</span>;
  if (rec === "no_hire") return <span className="badge-no-hire px-2.5 py-1 rounded-full text-xs font-semibold">No Hire</span>;
  return <span className="bg-secondary text-muted-foreground px-2.5 py-1 rounded-full text-xs font-semibold">Pending</span>;
}

export default function ScheduledInterviewResults() {
  const [, params] = useRoute("/employer/scheduled/:id/results");
  const id = params?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/scheduled-interviews/${id}/results`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const exportXlsx = () => {
    window.open(`/api/scheduled-interviews/${id}/results/export`, "_blank");
  };

  const attempted = data?.attempted || [];
  const notAttempted = data?.notAttempted || [];
  const si = data?.scheduledInterview;

  const hires = attempted.filter((r: any) => r.recommendation === "hire");
  const maybes = attempted.filter((r: any) => r.recommendation === "maybe");
  const noHires = attempted.filter((r: any) => r.recommendation === "no_hire");
  const avgScore = attempted.filter((r: any) => r.overallScore).length
    ? Math.round(attempted.filter((r: any) => r.overallScore).reduce((s: number, r: any) => s + r.overallScore, 0) / attempted.filter((r: any) => r.overallScore).length)
    : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="mb-8">
        <Link href="/employer">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ChevronLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold mb-1">{si?.title || "Interview Results"}</h1>
            <p className="text-muted-foreground">{attempted.length} attempted • {notAttempted.length} not attempted</p>
          </div>
          <button onClick={exportXlsx} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold btn-gradient text-sm">
            <Download className="h-4 w-4" />Export Excel
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid gap-4">{[1, 2, 3].map(i => <div key={i} className="glass-panel rounded-2xl h-20 animate-pulse bg-secondary/30" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Attempted", value: attempted.length, color: "from-indigo-500 to-blue-600" },
              { label: "Hire", value: hires.length, color: "from-emerald-500 to-teal-600" },
              { label: "Maybe", value: maybes.length, color: "from-amber-500 to-orange-600" },
              { label: "Avg Score", value: avgScore !== null ? `${avgScore}` : "—", color: "from-purple-500 to-pink-600" },
            ].map((stat, i) => (
              <motion.div key={i} initial="hidden" animate="show" variants={fadeUp} custom={i} className="glass-panel rounded-2xl p-5 text-center">
                <div className={`font-display font-bold text-2xl bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-3 mb-8">
            <h2 className="font-display font-semibold text-lg">Attempted Candidates</h2>
            {attempted.length === 0 ? (
              <div className="glass-panel rounded-2xl p-10 text-center text-muted-foreground text-sm">No candidates have attempted yet</div>
            ) : attempted.map((r: any, i: number) => (
              <motion.div key={r.interviewId} initial="hidden" animate="show" variants={fadeUp} custom={i} className="glass-panel rounded-2xl p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold">{r.candidateName || "Unknown"}</span>
                    {recBadge(r.recommendation)}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                  {r.englishScore != null && <span>English: <strong>{r.englishScore}</strong></span>}
                  {r.behavioralScore != null && <span>Behavioral: <strong>{r.behavioralScore}</strong></span>}
                  {r.confidenceScore != null && <span>Confidence: <strong>{r.confidenceScore}</strong></span>}
                </div>
                {r.overallScore != null && (
                  <div className={`font-display font-bold text-xl flex-shrink-0 ${r.overallScore >= 75 ? "text-emerald-500" : r.overallScore >= 50 ? "text-amber-500" : "text-red-500"}`}>
                    {r.overallScore}<span className="text-xs font-normal text-muted-foreground">/100</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {notAttempted.length > 0 && (
            <div className="grid gap-3">
              <h2 className="font-display font-semibold text-lg text-muted-foreground">Not Attempted ({notAttempted.length})</h2>
              {notAttempted.map((c: any, i: number) => (
                <motion.div key={i} initial="hidden" animate="show" variants={fadeUp} custom={i} className="glass-panel rounded-2xl p-4 flex items-center gap-3 opacity-60">
                  <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{c.email}</span>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
