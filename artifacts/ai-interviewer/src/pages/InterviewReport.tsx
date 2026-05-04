import React, { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Loader2, CheckCircle, AlertTriangle, TrendingUp, ChevronLeft,
  BrainCircuit, Eye, MessageSquare, Zap, Code2, BookOpen, Star,
  ShieldAlert, ThumbsUp, ThumbsDown, Target, Clock, BarChart3,
  Lightbulb, Award, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.06 } }),
};

function ScoreCircle({ value, label, color, size = "md" }: { value: number; label: string; color: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: { r: 28, dim: "w-16 h-16", text: "text-base" }, md: { r: 36, dim: "w-20 h-20", text: "text-lg" }, lg: { r: 42, dim: "w-24 h-24", text: "text-2xl" } };
  const s = sizes[size];
  const circ = 2 * Math.PI * s.r;
  const offset = circ - (circ * Math.min(value, 100)) / 100;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`relative inline-flex items-center justify-center ${s.dim}`}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={s.r} strokeWidth="7" fill="transparent" stroke="currentColor" className="text-border" />
          <circle cx="50" cy="50" r={s.r} strokeWidth="7" fill="transparent" stroke={color} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <span className={`absolute font-bold font-display ${s.text}`}>{value}</span>
      </div>
      <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

function ScoreBar({ score, showLabel = false }: { score: number; showLabel?: boolean }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      {showLabel && <span className={`text-xs font-semibold w-7 text-right ${score >= 75 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500"}`}>{score}</span>}
    </div>
  );
}

function DimensionPill({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" : score >= 50 ? "text-amber-600 bg-amber-500/10 border-amber-500/20" : "text-red-600 bg-red-500/10 border-red-500/20";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {label}: {score}
    </span>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const cls = rating >= 75 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : rating >= 50 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-red-500/10 text-red-600 border-red-500/20";
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>{rating}/100</span>;
}

export default function InterviewReport() {
  const [, params] = useRoute("/interview/:id/report");
  const id = parseInt(params?.id || "0");
  const [activeTab, setActiveTab] = useState("overview");

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
      <h2 className="text-lg font-display font-semibold animate-pulse">Generating your AI analysis...</h2>
      <p className="text-muted-foreground text-sm">Powered by GPT-5.4 — this may take a moment.</p>
    </div>
  );

  if (!report) return (
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold mb-4">Report not available</h2>
      <Link href="/dashboard"><button className="px-5 py-2.5 rounded-xl border border-border hover:bg-secondary transition-colors text-sm">Back to Dashboard</button></Link>
    </div>
  );

  const recMap: Record<string, { label: string; icon: any; cls: string; barColor: string }> = {
    hire: { label: "Strong Hire", icon: CheckCircle, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20", barColor: "#10b981" },
    no_hire: { label: "Do Not Hire", icon: AlertTriangle, cls: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20", barColor: "#ef4444" },
    maybe: { label: "Needs Growth", icon: TrendingUp, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20", barColor: "#f59e0b" },
  };
  const rec = recMap[report.recommendation] || recMap.maybe;
  const RecIcon = rec.icon;

  const radarData = (report.skillScores || []).map((s: any) => ({
    subject: s.skill.length > 12 ? s.skill.slice(0, 12) + "…" : s.skill,
    score: s.score, fullMark: 100,
  }));

  const scoreData = [
    { name: "Overall", score: report.overallScore, color: "#8b5cf6" },
    { name: "Behavioral", score: report.behavioralScore ?? 0, color: "#f59e0b" },
    { name: "English", score: report.englishScore, color: "#06b6d4" },
    { name: "Confidence", score: report.confidenceScore ?? 0, color: "#10b981" },
    ...(report.technicalScore != null ? [{ name: "Technical", score: report.technicalScore, color: "#6366f1" }] : []),
    ...(report.codingScore != null ? [{ name: "Coding", score: report.codingScore, color: "#ec4899" }] : []),
  ];

  const ba = report.behavioralAnalysis || {};
  const ca = report.communicationAnalysis || {};
  const aq = report.answerQualityBreakdown || [];
  const strengths: string[] = report.strengths || [];
  const redFlags: string[] = report.redFlags || [];
  const growthAreas: any[] = report.growthAreas || [];
  const hr = report.hiringRationale || {};
  const pacing = report.interviewPacing || {};

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "answers", label: "Answer Breakdown", icon: Target },
    { id: "communication", label: "Communication", icon: MessageSquare },
    { id: "behavioral", label: "Behavioral", icon: BrainCircuit },
    { id: "growth", label: "Growth Plan", icon: Lightbulb },
    { id: "rationale", label: "Hire Rationale", icon: Award },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-7 pb-24">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0}>
        <Link href="/dashboard">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ChevronLeft className="h-4 w-4" />Back to Dashboard
          </button>
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold mb-1">Interview Report</h1>
            <p className="text-muted-foreground text-sm">AI-powered assessment via GPT-5.4</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${rec.cls}`}>
            <RecIcon className="h-4 w-4" />
            {rec.label}
          </div>
        </div>
      </motion.div>

      {/* Score Grid */}
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-2xl p-6">
        <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider mb-5">Performance Scores</h3>
        <div className="flex flex-wrap gap-6 items-end">
          <ScoreCircle value={report.overallScore} label="Overall" color="#8b5cf6" size="lg" />
          <div className="w-px h-16 bg-border hidden sm:block" />
          <ScoreCircle value={report.behavioralScore ?? 0} label="Behavioral" color="#f59e0b" size="md" />
          <ScoreCircle value={report.englishScore} label="English" color="#06b6d4" size="md" />
          <ScoreCircle value={report.confidenceScore ?? 0} label="Confidence" color="#10b981" size="md" />
          {report.technicalScore != null && <ScoreCircle value={report.technicalScore} label="Technical" color="#6366f1" size="md" />}
          {report.codingScore != null && <ScoreCircle value={report.codingScore} label="Coding" color="#ec4899" size="md" />}
        </div>
      </motion.div>

      {/* Score Bar Chart + Radar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-2xl p-6">
          <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider mb-4">Score Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} width={72} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${v}/100`, "Score"]}
              />
              <Bar dataKey="score" radius={4}>
                {scoreData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={3} className="glass-panel rounded-2xl p-6">
          <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider mb-2">Skill Radar</h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-muted-foreground/40 text-sm">No skill data</div>
          )}
        </motion.div>
      </div>

      {/* Executive Summary */}
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={4} className="glass-panel rounded-2xl p-6 bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" />Executive Summary
        </h3>
        <p className="text-foreground/90 leading-relaxed">{report.feedback}</p>
      </motion.div>

      {/* Strengths & Red Flags */}
      {(strengths.length > 0 || redFlags.length > 0) && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={5} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {strengths.length > 0 && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <ThumbsUp className="h-4 w-4" />Key Strengths
              </h3>
              <ul className="space-y-2">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-foreground/80">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {redFlags.length > 0 && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                <ShieldAlert className="h-4 w-4" />Red Flags
              </h3>
              <ul className="space-y-2">
                {redFlags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={6} className="glass-panel rounded-2xl overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeTab === t.id ? "border-b-2 border-primary text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Clarity Score", value: ca.clarityScore ?? report.englishScore, color: "text-cyan-500" },
                  { label: "Filler Words", value: ca.totalFillers ?? ca.total_fillers ?? 0, color: "text-amber-500" },
                  { label: "Sentence Structure", value: ca.sentenceStructureScore ?? ca.sentence_structure_score ?? 70, color: "text-purple-500" },
                ].map((s, i) => (
                  <div key={i} className="p-4 rounded-xl bg-secondary/50 border border-border text-center">
                    <div className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              {pacing.overallAssessment && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border flex gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Interview Pacing</p>
                    <p className="text-sm">{pacing.overallAssessment}</p>
                    {pacing.bestAnswer && <p className="text-xs text-emerald-500 mt-1">Best answer: {pacing.bestAnswer}</p>}
                    {pacing.shortestAnswer && <p className="text-xs text-amber-500 mt-0.5">Weakest answer: {pacing.shortestAnswer}</p>}
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed">{report.feedback}</p>
            </div>
          )}

          {/* ANSWER BREAKDOWN TAB */}
          {activeTab === "answers" && (
            aq.length > 0 ? (
              <div className="space-y-5">
                {aq.map((item: any, i: number) => (
                  <div key={i} className="p-5 rounded-xl bg-secondary/30 border border-border space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">Q{i + 1}</span>
                          <RatingBadge rating={item.rating} />
                        </div>
                        <p className="text-sm font-medium">{item.question}</p>
                      </div>
                    </div>

                    {item.dimensions && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.dimensions.relevance != null && <DimensionPill label="Relevance" score={item.dimensions.relevance} />}
                        {item.dimensions.depth != null && <DimensionPill label="Depth" score={item.dimensions.depth} />}
                        {item.dimensions.clarity != null && <DimensionPill label="Clarity" score={item.dimensions.clarity} />}
                        {item.dimensions.starUsage != null && <DimensionPill label="STAR" score={item.dimensions.starUsage} />}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-background/60 border border-border">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Candidate's Answer</p>
                        <p className="text-sm leading-relaxed">{item.yourAnswer}</p>
                        {item.gaps && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-[10px] uppercase tracking-wider text-red-500 mb-1">Gaps</p>
                            <p className="text-xs text-muted-foreground">{item.gaps}</p>
                          </div>
                        )}
                      </div>
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-[10px] uppercase tracking-wider text-primary mb-1.5">Stronger Answer Structure</p>
                        <p className="text-sm leading-relaxed">{item.suggestedBetterAnswer}</p>
                        {item.strengths && (
                          <div className="mt-2 pt-2 border-t border-primary/10">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-500 mb-1">What Worked</p>
                            <p className="text-xs text-muted-foreground">{item.strengths}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Answer analysis will appear after interview completion.</p>
          )}

          {/* COMMUNICATION TAB */}
          {activeTab === "communication" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Clarity", value: ca.clarityScore ?? report.englishScore, color: "text-cyan-500" },
                  { label: "Structure", value: ca.sentenceStructureScore ?? ca.sentence_structure_score ?? 70, color: "text-purple-500" },
                  { label: "Filler Words", value: ca.totalFillers ?? ca.total_fillers ?? 0, color: "text-amber-500" },
                  { label: "Avg Words/Answer", value: ca.avgWordsPerAnswer ?? ca.avg_words_per_answer ?? "—", color: "text-blue-500" },
                ].map((s, i) => (
                  <div key={i} className="p-4 rounded-xl bg-secondary/50 border border-border text-center">
                    <div className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {ca.vocabularyRichness && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Vocabulary Assessment</p>
                  <p className="text-sm">{ca.vocabularyRichness}</p>
                </div>
              )}

              {Object.keys(ca.fillerWords || ca.filler_words || {}).length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Filler Word Frequency</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ca.fillerWords || ca.filler_words || {}).map(([word, count]: [string, any]) => (
                      <span key={word} className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-medium">
                        "{word}" ×{count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                <p className="text-sm font-medium mb-1">English Fluency Feedback</p>
                <p className="text-sm text-muted-foreground">{report.englishFeedback}</p>
              </div>

              <p className="text-sm text-muted-foreground">{ca.summary || ca.summary}</p>
            </div>
          )}

          {/* BEHAVIORAL TAB */}
          {activeTab === "behavioral" && (
            <div className="space-y-5">
              <div className="flex items-center gap-5 p-5 rounded-xl bg-secondary/50 border border-border">
                <div className="font-display font-bold text-5xl text-amber-500">{report.behavioralScore ?? 0}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Behavioral & Soft Skills Score</p>
                  <ScoreBar score={report.behavioralScore ?? 0} />
                  <p className="text-xs text-muted-foreground mt-1.5">STAR completeness, problem solving, emotional intelligence</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
                  <h4 className="font-semibold text-sm">STAR Framework</h4>
                  <p className="text-sm text-muted-foreground">{ba.starCompleteness || "Not assessed"}</p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
                  <h4 className="font-semibold text-sm">Problem Solving</h4>
                  <p className="text-sm text-muted-foreground">{ba.problemSolving || "Not assessed"}</p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
                  <h4 className="font-semibold text-sm">Emotional Intelligence</h4>
                  <p className="text-sm text-muted-foreground">{ba.emotionalIntelligence || "Not assessed"}</p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
                  <h4 className="font-semibold text-sm">Missing STAR Elements</h4>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(ba.missingElements) && ba.missingElements.length > 0
                      ? ba.missingElements.join(", ")
                      : "No major missing elements."}
                  </p>
                </div>
              </div>

              {Array.isArray(ba.suggestions) && ba.suggestions.length > 0 && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-primary" />Improvement Suggestions</h4>
                  <ul className="space-y-1.5">
                    {ba.suggestions.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* GROWTH PLAN TAB */}
          {activeTab === "growth" && (
            <div className="space-y-4">
              {growthAreas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No growth areas identified — great performance!</p>
              ) : growthAreas.map((area: any, i: number) => (
                <div key={i} className="p-5 rounded-xl bg-secondary/30 border border-border">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-semibold text-sm">{area.area}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{area.currentLevel}</p>
                    </div>
                    <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Suggestion</p>
                      <p className="text-sm">{area.suggestion}</p>
                    </div>
                    {area.resources && (
                      <div className="p-2.5 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recommended Resources</p>
                        <p className="text-sm text-muted-foreground">{area.resources}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* HIRE RATIONALE TAB */}
          {activeTab === "rationale" && (
            <div className="space-y-5">
              <div className={`flex items-center gap-3 p-4 rounded-xl font-semibold ${rec.cls}`}>
                <RecIcon className="h-5 w-5" />
                <div>
                  <p className="text-base font-bold">{rec.label}</p>
                  <p className="text-xs font-normal opacity-80">Final hiring recommendation</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hr.forHiring && hr.forHiring.length > 0 && (
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                    <h4 className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                      <ThumbsUp className="h-3.5 w-3.5" />Reasons to Hire
                    </h4>
                    <ul className="space-y-2">
                      {hr.forHiring.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {hr.againstHiring && hr.againstHiring.length > 0 && (
                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15">
                    <h4 className="font-semibold text-sm text-red-600 dark:text-red-400 mb-3 flex items-center gap-1.5">
                      <ThumbsDown className="h-3.5 w-3.5" />Concerns
                    </h4>
                    <ul className="space-y-2">
                      {hr.againstHiring.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {hr.conditions && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <h4 className="font-semibold text-sm text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />Conditions / Caveats
                  </h4>
                  <p className="text-sm text-foreground/80">{hr.conditions}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Skill Breakdown */}
      {report.skillScores?.length > 0 && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={7}>
          <h2 className="text-xl font-display font-bold mb-4">Skill Assessment</h2>
          <div className="grid gap-3">
            {report.skillScores.map((skill: any, i: number) => (
              <div key={i} className="glass-panel rounded-2xl p-5 flex gap-5 items-start">
                <div className="w-28 flex-shrink-0 space-y-1">
                  <div className="font-display font-bold text-2xl">{skill.score}</div>
                  <ScoreBar score={skill.score} />
                  <p className="font-semibold text-sm mt-1.5">{skill.skill}</p>
                  {skill.meetRequirement === true && <span className="text-xs text-emerald-500 font-medium">✓ Meets bar</span>}
                  {skill.meetRequirement === false && <span className="text-xs text-red-500 font-medium">✗ Below bar</span>}
                </div>
                <div className="flex-1 border-l border-border pl-5 space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">{skill.feedback}</p>
                  {skill.evidence && (
                    <p className="text-xs text-muted-foreground/60 italic border-t border-border pt-2">Evidence: {skill.evidence}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Confidence + English pair */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={8} className="glass-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Eye className="h-5 w-5 text-emerald-500" />Confidence</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="font-display font-bold text-4xl text-emerald-500">{report.confidenceScore ?? 0}</div>
            <div className="flex-1"><ScoreBar score={report.confidenceScore ?? 0} /><p className="text-xs text-muted-foreground mt-1">Based on facial expression analysis</p></div>
          </div>
          {report.confidenceNotes && <p className="text-sm text-muted-foreground pt-3 border-t border-border">{report.confidenceNotes}</p>}
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={9} className="glass-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><MessageSquare className="h-5 w-5 text-cyan-500" />English Fluency</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="font-display font-bold text-4xl text-cyan-500">{report.englishScore}</div>
            <div className="flex-1"><ScoreBar score={report.englishScore} /><p className="text-xs text-muted-foreground mt-1">Grammar, vocabulary, articulation</p></div>
          </div>
          {report.englishFeedback && <p className="text-sm text-muted-foreground pt-3 border-t border-border">{report.englishFeedback}</p>}
        </motion.div>
      </div>

      <div className="flex justify-center pt-2">
        <Link href="/dashboard">
          <button className="px-8 py-3.5 rounded-xl font-bold btn-gradient">Back to Dashboard</button>
        </Link>
      </div>
    </div>
  );
}
