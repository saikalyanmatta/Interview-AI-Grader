import { Link } from "wouter";
import { useListJobs, useDeleteJob } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Briefcase, Trash2, Users, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function EmployerDashboard() {
  const { data: jobs, isLoading, refetch } = useListJobs();
  const deleteMutation = useDeleteJob();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this job profile?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast({ title: "Job deleted" });
        refetch();
      } catch (err: any) {
        toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Job Profiles</h1>
          <p className="text-muted-foreground mt-1">Define requirements and evaluate candidates automatically.</p>
        </div>
        <Link href="/employer/jobs/new">
          <Button variant="gradient" className="gap-2">
            <Plus className="h-4 w-4" /> Create Profile
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : jobs?.length === 0 ? (
        <div className="glass-panel rounded-2xl p-16 text-center flex flex-col items-center border-dashed border-2 border-white/20">
          <div className="h-16 w-16 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6">
            <Briefcase className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-display font-semibold mb-2">No Job Profiles</h3>
          <p className="text-muted-foreground mb-6 max-w-md">Create a job profile with specific skill requirements to start evaluating candidates efficiently.</p>
          <Link href="/employer/jobs/new">
            <Button variant="outline" className="border-white/20 bg-black/20">Create First Profile</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobs?.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full flex flex-col glass-panel hover:-translate-y-1 transition-transform duration-300">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-display font-semibold text-xl leading-tight">{job.title}</h3>
                      <p className="text-xs text-primary mt-1">{(job as any).role ?? "Software Engineer"}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 -mt-2 -mr-2"
                      onClick={() => handleDelete(job.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
                    {job.description}
                  </p>

                  <div className="space-y-3 mb-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {job.skills.map((skill, i) => (
                        <Badge key={i} variant="secondary" className="bg-white/5 border-white/10 text-xs">
                          {skill.name} <span className="opacity-50 ml-1">L{skill.requiredLevel} · {(skill as any).weight ?? 50}%</span>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-between items-center mt-auto">
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <Users className="h-4 w-4" />
                      <span>Ready for candidates</span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 gap-1">
                      Share Link <ArrowRight className="h-3 w-3" />
                    </Button>
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
