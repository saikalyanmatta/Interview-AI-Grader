import { Link } from "wouter";
import { useListInterviews } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Mic, ArrowRight, FileText, CheckCircle2, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function CandidateDashboard() {
  const { data: interviews, isLoading } = useListInterviews();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3"/> Completed</Badge>;
      case "in_progress": return <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3"/> In Progress</Badge>;
      default: return <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3"/> Pending</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">My Interviews</h1>
          <p className="text-muted-foreground mt-1">Track your practice sessions and view results.</p>
        </div>
        <Link href="/setup">
          <Button variant="gradient" className="gap-2">
            <Plus className="h-4 w-4" /> New Interview
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : interviews?.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center border-dashed border-2 border-white/20">
          <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Mic className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-display font-semibold mb-2">No interviews yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">Start your first AI mock interview by uploading your resume. Practice makes perfect.</p>
          <Link href="/setup">
            <Button variant="gradient">Start Practice Session</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {interviews?.map((interview, index) => (
            <motion.div
              key={interview.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:border-indigo-500/50 transition-colors duration-300 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between gap-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-1">{interview.jobTitle || "General Technical Interview"}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(interview.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    {getStatusBadge(interview.status)}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <div className="text-sm text-muted-foreground">
                      {interview.status === "completed" ? "Report Available" : 
                       interview.status === "in_progress" ? `Questions: ${interview.answeredQuestions || 0}/${interview.totalQuestions || 0}` : "Ready to start"}
                    </div>
                    
                    {interview.status === "completed" ? (
                      <Link href={`/interview/${interview.id}/report`}>
                        <Button variant="secondary" size="sm" className="gap-2">
                          View Results <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Link href={`/interview/${interview.id}`}>
                        <Button variant="default" size="sm" className="bg-white/10 hover:bg-white/20 text-white gap-2">
                          Continue <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
