import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateInterview, useUploadResume, useStartInterview, useListJobs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, FileText, ChevronRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function InterviewSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [resumeText, setResumeText] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [interviewId, setInterviewId] = useState<number | null>(null);
  
  const { data: jobs } = useListJobs();
  const createMutation = useCreateInterview();
  const uploadMutation = useUploadResume();
  const startMutation = useStartInterview();

  const isProcessing = createMutation.isPending || uploadMutation.isPending || startMutation.isPending;

  const handleStart = async () => {
    if (!resumeText.trim()) {
      toast({ title: "Resume required", description: "Please paste your resume text.", variant: "destructive" });
      return;
    }

    try {
      // 1. Create interview container
      const interview = await createMutation.mutateAsync({ data: { jobId: selectedJobId || undefined } });
      setInterviewId(interview.id);
      
      // 2. Upload resume
      await uploadMutation.mutateAsync({ 
        id: interview.id, 
        data: { resumeText, candidateName: candidateName || "Candidate" } 
      });
      
      // 3. Start interview (generates questions)
      setStep(3); // Show generating UI
      await startMutation.mutateAsync({ id: interview.id });
      
      // 4. Navigate to session
      setLocation(`/interview/${interview.id}`);
      
    } catch (error: any) {
      toast({ title: "Setup failed", description: error.message || "Failed to start interview", variant: "destructive" });
      setStep(1);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-display font-bold">Setup Interview</h1>
        <p className="text-muted-foreground mt-2">Provide your details so the AI can tailor the questions.</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>1</div>
          <div className={`h-1 w-12 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-secondary'}`} />
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>2</div>
        </div>
      </div>

      <Card className="glass-panel border-white/10 overflow-hidden relative">
        {step === 3 && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center">
            <BrainCircuit className="h-16 w-16 text-primary animate-pulse mb-6" />
            <h3 className="text-2xl font-display font-bold mb-2">Analyzing Profile...</h3>
            <p className="text-muted-foreground max-w-md">Our AI is reading your resume and generating personalized technical and behavioral questions.</p>
          </div>
        )}

        <CardContent className="p-8">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Full Name</label>
                <Input 
                  placeholder="e.g. Jane Doe" 
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Paste Resume Text
                </label>
                <Textarea 
                  placeholder="Paste your professional experience, skills, and education here..." 
                  className="min-h-[250px] font-mono text-xs leading-relaxed"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!resumeText.trim()}
                  variant="gradient"
                  className="gap-2"
                >
                  Next Step <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Target Job Profile (Optional)</label>
                <p className="text-sm text-muted-foreground mb-4">Select a specific job to be evaluated against its requirements, or skip for a general assessment.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div 
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedJobId === null ? 'border-primary bg-primary/10' : 'border-white/10 bg-black/20 hover:border-white/30'}`}
                    onClick={() => setSelectedJobId(null)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">General Assessment</h4>
                      {selectedJobId === null && <Check className="h-5 w-5 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Standard software engineering interview based purely on your resume.</p>
                  </div>

                  {jobs?.map(job => (
                    <div 
                      key={job.id}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedJobId === job.id ? 'border-primary bg-primary/10' : 'border-white/10 bg-black/20 hover:border-white/30'}`}
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold truncate pr-2">{job.title}</h4>
                        {selectedJobId === job.id && <Check className="h-5 w-5 text-primary shrink-0" />}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.skills.slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{s.name}</Badge>
                        ))}
                        {job.skills.length > 3 && <span className="text-xs text-muted-foreground">+{job.skills.length - 3}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-white/10">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button 
                  onClick={handleStart} 
                  isLoading={isProcessing}
                  variant="gradient"
                >
                  Generate Interview
                </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
