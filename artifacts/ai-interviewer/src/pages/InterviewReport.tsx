import React from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, AlertTriangle, TrendingUp, ChevronLeft, BrainCircuit, Eye, MessageSquare, Zap } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

function ScoreCircle({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 40, circ = 2 * Math.PI * r;
  const offset = circ - (circ * value) / 100;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} strokeWidth="8" fill="transparent" stroke="currentColor" className="text-border" />
          <circle cx="50" cy="50" r={r} strokeWidth="8" fill="transparent" stroke={color} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <span className="absolute text-xl font-bold font-display">{value}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-1.5 rounded-full bg-border overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function InterviewReport() {
  const [, params] = useRoute("/interview/:id/report");
  const id = parseInt(params?.id || "0");

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const r = await fetch(`/api/interviews/${id}/report`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
  });

  if (isLoading) return (
    <div className="flex flex-col h-[70vh] items-center justify-center gap-4">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
      <h2 className="text-lg font-display font-semibold animate-pulse">Generating your analysis...</h2>
      <p className="text-muted-foreground text-sm">This may take a moment.</p>
    </div>
  );

  if (!report) return (
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold mb-4">Report not available</h2>
      <Link href="/dashboard"><button className="px-5 py-2.5 rounded-xl border border-border hover:bg-secondary transition-colors text-sm">Back to Dashboard</button></Link>
    </div>
  );

  const recMap: Record<string, { label: string; icon: any; cls: string }> = {
    hire: { label: "Strong Hire", icon: CheckCircle, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
    no_hire: { label: "Do Not Hire", icon: AlertTriangle, cls: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" },
    maybe: { label: "Needs Growth", icon: TrendingUp, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  };
  const rec = recMap[report.recommendation] || recMap.maybe;
  const RecIcon = rec.icon;

  const radarData = (report.skillScores || []).map((s: any) => ({
    subject: s.skill.length > 10 ? s.skill.slice(0, 10) + "…" : s.skill,
    score: s.score, fullMark: 100,
  }));

  const confidenceScore = report.confidenceScore ?? 70;
  const confidenceNotes = report.confidenceNotes ?? "";
  const stutterAnalysis = report.stutterAnalysis ?? [];
  const behavioralScore = report.behavioralScore ?? 70;
  const behavioralAnalysis = report.behavioralAnalysis ?? {};
  const communicationAnalysis = report.communicationAnalysis ?? {};
  const answerQuality = report.answerQualityBreakdown ?? [];
  const [activeTab, setActiveTab] = React.useState("overview");

  const tabs = ["overview", "communication", "behavioral", "suggestions"];

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-8 pb-20">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0}>
        <Link href="/dashboard">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ChevronLeft className="h-4 w-4" />Back to Dashboard
          </button>
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold mb-1">Interview Results</h1>
            <p className="text-muted-foreground">Full AI-powered performance assessment</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${rec.cls}`}>
            <RecIcon className="h-4 w-4" />
            {rec.label}
          </div>
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel rounded-2xl p-6 md:col-span-2">
          <h3 className="font-semibold text-muted-foreground text-sm mb-6">Core Scores</h3>
          <div className="flex flex-wrap items-center gap-8">
            <ScoreCircle value={report.overallScore} label="Overall" color="#8b5cf6" />
            <ScoreCircle value={report.englishScore} label="English" color="#06b6d4" />
            <ScoreCircle value={behavioralScore} label="Behavioral" color="#f59e0b" />
            <ScoreCircle value={confidenceScore} label="Confidence" color="#10b981" />
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="font-semibold text-muted-foreground text-sm mb-4">Skill Radar</h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground/40 text-sm">No skill data</div>
          )}
        </div>
        <div className="glass-panel rounded-2xl p-6 md:col-span-3 bg-gradient-to-br from-primary/5 to-transparent">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />Executive Summary</h3>
          <p className="text-foreground/90 leading-relaxed">{report.feedback}</p>
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-2xl overflow-hidden">
        <div className="flex border-b border-border p-1 gap-1">
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === t ? "bg-background border border-border shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >{t}</button>
          ))}
        </div>
        <div className="p-6">
          {activeTab === "overview" && <p className="text-sm text-muted-foreground leading-relaxed">{report.feedback}</p>}
          {activeTab === "communication" && (
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: communicationAnalysis.clarityScore ?? report.englishScore, label: "Clarity", color: "text-cyan-500" },
                  { value: communicationAnalysis.totalFillers ?? 0, label: "Filler Words", color: "text-amber-500" },
                  { value: communicationAnalysis.sentenceStructureScore ?? 70, label: "Sentence Structure", color: "text-purple-500" },
                ].map((s, i) => (
                  <div key={i} className="p-4 rounded-xl bg-secondary/50 border border-border text-center">
                    <div className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{communicationAnalysis.summary ?? report.englishFeedback}</p>
            </div>
          )}
          {activeTab === "behavioral" && (
            <div className="grid gap-4">
              <div className="flex items-center gap-5 p-4 rounded-xl bg-secondary/50">
                <div className="font-display font-bold text-4xl text-amber-500">{behavioralScore}</div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">STAR completeness, problem solving, and emotional intelligence</p>
                  <ScoreBar score={behavioralScore} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                  <h4 className="font-semibold text-sm mb-2">Missing STAR Elements</h4>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(behavioralAnalysis.missingElements) && behavioralAnalysis.missingElements.length > 0
                      ? behavioralAnalysis.missingElements.join(", ")
                      : "No major missing elements detected."}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                  <h4 className="font-semibold text-sm mb-2">Suggestions</h4>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(behavioralAnalysis.suggestions) ? behavioralAnalysis.suggestions[0] : behavioralAnalysis.starCompleteness ?? "Use clear STAR framing."}
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === "suggestions" && (
            answerQuality.length > 0 ? (
              <div className="grid gap-4">
                {answerQuality.map((item: any, i: number) => (
                  <div key={i} className="p-5 rounded-xl bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm">Question {i + 1}</h4>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.rating >= 75 ? "badge-hire" : item.rating >= 50 ? "badge-maybe" : "badge-no-hire"}`}>{item.rating}/100</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{item.question}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-background/50">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Your Answer</p>
                        <p className="text-sm leading-relaxed">{item.yourAnswer}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-[10px] uppercase tracking-wider text-primary mb-1.5">Suggested Better Answer</p>
                        <p className="text-sm leading-relaxed">{item.suggestedBetterAnswer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Suggestions will appear here after full transcript analysis.</p>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={3} className="glass-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Eye className="h-5 w-5 text-emerald-500" />Confidence Analysis</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="font-display font-bold text-4xl text-emerald-500">{confidenceScore}</div>
            <div className="flex-1"><ScoreBar score={confidenceScore} /><p className="text-xs text-muted-foreground mt-1">Based on facial analysis</p></div>
          </div>
          {confidenceNotes && <p className="text-sm text-muted-foreground pt-4 border-t border-border">{confidenceNotes}</p>}
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={4} className="glass-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><MessageSquare className="h-5 w-5 text-cyan-500" />English Fluency</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="font-display font-bold text-4xl text-cyan-500">{report.englishScore}</div>
            <div className="flex-1"><ScoreBar score={report.englishScore} /><p className="text-xs text-muted-foreground mt-1">Grammar, articulation, vocabulary</p></div>
          </div>
          {report.englishFeedback && <p className="text-sm text-muted-foreground pt-4 border-t border-border">{report.englishFeedback}</p>}
        </motion.div>
      </div>

      {report.skillScores?.length > 0 && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={5}>
          <h2 className="text-xl font-display font-bold mb-4">Skill Breakdown</h2>
          <div className="grid gap-3">
            {report.skillScores.map((skill: any, i: number) => (
              <div key={i} className="glass-panel rounded-2xl p-5 flex gap-5 items-start">
                <div className="w-32 flex-shrink-0">
                  <div className="font-display font-bold text-2xl mb-1">{skill.score}</div>
                  <ScoreBar score={skill.score} />
                  <p className="font-semibold text-sm mt-2">{skill.skill}</p>
                  {skill.meetRequirement === true && <span className="text-xs text-emerald-500 font-medium">✓ Passed</span>}
                  {skill.meetRequirement === false && <span className="text-xs text-red-500 font-medium">✗ Failed</span>}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed border-l border-border pl-5">{skill.feedback}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex justify-center">
        <Link href="/dashboard">
          <button className="px-8 py-3.5 rounded-xl font-bold btn-gradient">Back to Dashboard</button>
        </Link>
      </div>
    </div>
  );
}
