import { useRoute, Link } from "wouter";
import { useGetInterviewReport } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip as RechartsTooltip } from "recharts";

export default function InterviewReport() {
  const [, params] = useRoute("/interview/:id/report");
  const id = parseInt(params?.id || "0");

  const { data: report, isLoading } = useGetInterviewReport(id, {
    query: { retry: 2 } // Allow a few retries if report generation takes time
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h2 className="text-xl font-display animate-pulse">Generating comprehensive analysis...</h2>
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

  const radarData = report.skillScores.map(s => ({
    subject: s.skill,
    A: s.score,
    fullMark: 100,
  }));

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "hire": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-4 py-1.5 text-sm"><CheckCircle className="w-4 h-4 mr-1.5" /> Strong Hire</Badge>;
      case "no_hire": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-4 py-1.5 text-sm"><AlertTriangle className="w-4 h-4 mr-1.5" /> Do Not Hire</Badge>;
      default: return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-4 py-1.5 text-sm"><TrendingUp className="w-4 h-4 mr-1.5" /> Needs Growth</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground hover:text-white -ml-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Button>
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight">Interview Results</h1>
          <p className="text-muted-foreground mt-2">Detailed breakdown of performance and AI assessment.</p>
        </div>
        {getRecommendationBadge(report.recommendation)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Metrics */}
        <Card className="glass-panel col-span-1 md:col-span-2">
          <CardContent className="p-8 flex flex-col h-full justify-center">
            <h3 className="text-lg font-medium text-muted-foreground mb-6">Overall Performance</h3>
            <div className="flex items-center gap-12">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" 
                      strokeDasharray={377} strokeDashoffset={377 - (377 * report.overallScore) / 100}
                      className="text-primary transition-all duration-1000 ease-out" 
                    />
                  </svg>
                  <span className="absolute text-4xl font-display font-bold">{report.overallScore}</span>
                </div>
                <p className="mt-4 font-medium">Overall Score</p>
              </div>

              <div className="flex-1 space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-sm">English Proficiency</span>
                    <span className="font-bold text-sm">{report.englishScore}/100</span>
                  </div>
                  <Progress value={report.englishScore} indicatorClassName={getScoreColor(report.englishScore)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {report.englishFeedback || "Demonstrated clear communication and technical articulation."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card className="glass-panel col-span-1">
          <CardContent className="p-6 h-full min-h-[300px] flex flex-col items-center">
            <h3 className="text-sm font-medium text-muted-foreground self-start mb-2">Skill Distribution</h3>
            <div className="w-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                  <Radar name="Score" dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Summary Feedback */}
        <Card className="glass-panel col-span-1 md:col-span-3 bg-gradient-to-br from-indigo-500/10 to-transparent">
          <CardContent className="p-8">
            <h3 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <BrainCircuit className="text-primary h-5 w-5" /> Executive Summary
            </h3>
            <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {report.feedback}
            </p>
          </CardContent>
        </Card>

        {/* Detailed Skill Breakdown */}
        <div className="col-span-1 md:col-span-3 space-y-4 mt-4">
          <h3 className="text-2xl font-display font-bold mb-4">Detailed Skill Analysis</h3>
          {report.skillScores.map((skill, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-black/20 border-white/5 hover:bg-black/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <div className="w-full md:w-1/4">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{skill.skill}</h4>
                        {skill.meetRequirement === true && <Badge variant="success" className="h-5 text-[10px]">Passed</Badge>}
                        {skill.meetRequirement === false && <Badge variant="destructive" className="h-5 text-[10px]">Failed</Badge>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold font-display">{skill.score}</span>
                        <Progress value={skill.score} className="h-1.5 flex-1" indicatorClassName={getScoreColor(skill.score)} />
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
    </div>
  );
}
