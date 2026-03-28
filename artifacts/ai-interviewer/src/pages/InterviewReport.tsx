import { useRoute, Link } from "wouter";
import { useGetInterviewReport } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, ChevronLeft, BrainCircuit, Eye, MessageSquare, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";

export default function InterviewReport() {
  const [, params] = useRoute("/interview/:id/report");
  const id = parseInt(params?.id || "0");

  const { data: report, isLoading } = useGetInterviewReport(id, {
    query: { retry: 3 },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h2 className="text-xl font-display animate-pulse">Generating comprehensive analysis...</h2>
        <p className="text-muted-foreground text-sm">This may take a moment.</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Report not available</h2>
        <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
      </div>
    );
  }

  const radarData = report.skillScores.map((s) => ({ subject: s.skill.length > 10 ? s.skill.slice(0, 10) + "…" : s.skill, score: s.score, fullMark: 100 }));

  const getRec = (rec: string) => {
    if (rec === "hire") return { label: "Strong Hire", icon: <CheckCircle className="w-4 h-4 mr-1.5" />, cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    if (rec === "no_hire") return { label: "Do Not Hire", icon: <AlertTriangle className="w-4 h-4 mr-1.5" />, cls: "bg-red-500/20 text-red-400 border-red-500/30" };
    return { label: "Needs Growth", icon: <TrendingUp className="w-4 h-4 mr-1.5" />, cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
  };

  const getBar = (score: number) => score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  const getStutterBar = (s: number) => s < 25 ? "bg-emerald-500" : s < 55 ? "bg-amber-500" : "bg-red-500";
  const getStutterLabel = (s: number) => s < 25 ? "Fluent" : s < 55 ? "Moderate disfluency" : "High disfluency";

  const rec = getRec(report.recommendation);
  const confidenceScore = (report as any).confidenceScore ?? 70;
  const confidenceNotes = (report as any).confidenceNotes ?? "";
  const stutterAnalysis: Array<{ skill: string; avgStutterScore: number; questionsAsked: number; notes: string }> = (report as any).stutterAnalysis ?? [];

  const scoreCircle = (value: number, label: string, color: string) => {
    const r = 40;
    const circ = 2 * Math.PI * r;
    const offset = circ - (circ * value) / 100;
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative inline-flex items-center justify-center w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
            <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="8" fill="transparent" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
          </svg>
          <span className="absolute text-xl font-bold font-display">{value}</span>
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground hover:text-white -ml-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Button>
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight">Interview Results</h1>
          <p className="text-muted-foreground mt-2">Full AI-powered assessment of your performance.</p>
        </div>
        <Badge className={cn("px-4 py-1.5 text-sm flex items-center", rec.cls)}>{rec.icon}{rec.label}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-panel col-span-1 md:col-span-2">
          <CardContent className="p-8">
            <h3 className="text-lg font-medium text-muted-foreground mb-6">Core Scores</h3>
            <div className="flex flex-wrap items-center gap-10">
              {scoreCircle(report.overallScore, "Overall", "#8b5cf6")}
              {scoreCircle(report.englishScore, "English", "#06b6d4")}
              {scoreCircle(confidenceScore, "Confidence", "#10b981")}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-8 h-full flex flex-col">
            <h3 className="text-lg font-medium text-muted-foreground mb-4">Skill Radar</h3>
            {radarData.length > 0 ? (
              <div className="flex-1" style={{ minHeight: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                    <Radar name="Score" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground/40 text-sm">No skill data</div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel col-span-1 md:col-span-3 bg-gradient-to-br from-indigo-500/10 to-transparent">
          <CardContent className="p-8">
            <h3 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <BrainCircuit className="text-primary h-5 w-5" /> Executive Summary
            </h3>
            <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{report.feedback}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-panel">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-400" /> Confidence Analysis
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold font-display text-emerald-400">{confidenceScore}</div>
              <div className="flex-1">
                <Progress value={confidenceScore} className="h-2" indicatorClassName={getBar(confidenceScore)} />
                <p className="text-xs text-muted-foreground mt-1">Based on facial analysis throughout the interview</p>
              </div>
            </div>
            {confidenceNotes && (
              <p className="text-sm text-muted-foreground leading-relaxed border-t border-white/10 pt-4">{confidenceNotes}</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-cyan-400" /> English Fluency
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold font-display text-cyan-400">{report.englishScore}</div>
              <div className="flex-1">
                <Progress value={report.englishScore} className="h-2" indicatorClassName={getBar(report.englishScore)} />
                <p className="text-xs text-muted-foreground mt-1">Grammar, articulation, vocabulary</p>
              </div>
            </div>
            {report.englishFeedback && (
              <p className="text-sm text-muted-foreground leading-relaxed border-t border-white/10 pt-4">{report.englishFeedback}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {stutterAnalysis.length > 0 && (
        <div>
          <h3 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" /> Fluency Breakdown by Topic
          </h3>
          <div className="space-y-3">
            {stutterAnalysis.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="bg-black/20 border-white/5">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                      <div className="w-full md:w-1/3">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{item.skill}</h4>
                          <span className="text-xs text-muted-foreground">({item.questionsAsked} q{item.questionsAsked !== 1 ? "s" : ""})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-sm font-semibold", item.avgStutterScore < 25 ? "text-emerald-400" : item.avgStutterScore < 55 ? "text-amber-400" : "text-red-400")}>
                            {getStutterLabel(item.avgStutterScore)}
                          </span>
                        </div>
                        <Progress value={item.avgStutterScore} className="h-1.5 mt-1" indicatorClassName={getStutterBar(item.avgStutterScore)} />
                      </div>
                      <div className="w-full md:w-2/3 md:pl-6 md:border-l border-white/10">
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.notes}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-2xl font-display font-bold mb-4">Skill-by-Skill Breakdown</h3>
        <div className="space-y-4">
          {report.skillScores.map((skill, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
              <Card className="bg-black/20 border-white/5 hover:bg-black/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <div className="w-full md:w-1/4">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{skill.skill}</h4>
                        {skill.meetRequirement === true && <Badge className="h-5 text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Passed</Badge>}
                        {skill.meetRequirement === false && <Badge variant="destructive" className="h-5 text-[10px]">Failed</Badge>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold font-display">{skill.score}</span>
                        <Progress value={skill.score} className="h-1.5 flex-1" indicatorClassName={getBar(skill.score)} />
                      </div>
                    </div>
                    <div className="w-full md:w-3/4 pl-0 md:pl-6 md:border-l border-white/10">
                      <p className="text-sm text-muted-foreground leading-relaxed">{skill.feedback}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Link href="/dashboard">
          <Button variant="gradient" size="lg">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
