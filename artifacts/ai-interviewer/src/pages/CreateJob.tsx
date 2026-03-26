import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateJob } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Plus, X, Save } from "lucide-react";
import { motion } from "framer-motion";

export default function CreateJob() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateJob();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<{name: string, requiredLevel: number}[]>([
    { name: "", requiredLevel: 5 }
  ]);

  const handleAddSkill = () => {
    setSkills([...skills, { name: "", requiredLevel: 5 }]);
  };

  const handleRemoveSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleSkillChange = (index: number, field: string, value: string | number) => {
    const newSkills = [...skills];
    newSkills[index] = { ...newSkills[index], [field]: value };
    setSkills(newSkills);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!title.trim()) return toast({ title: "Title required", variant: "destructive" });
    const validSkills = skills.filter(s => s.name.trim() !== "");
    if (validSkills.length === 0) return toast({ title: "At least one skill required", variant: "destructive" });

    try {
      await createMutation.mutateAsync({
        data: { title, description, skills: validSkills }
      });
      toast({ title: "Job profile created" });
      setLocation("/employer");
    } catch (err: any) {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Link href="/employer">
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground hover:text-white -ml-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Profiles
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Create Job Profile</h1>
        <p className="text-muted-foreground mt-2">Define the role and specific skills the AI should evaluate.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="glass-panel border-white/10 overflow-hidden">
          <CardContent className="p-8 space-y-8">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-foreground/90">Job Title</label>
                <Input 
                  placeholder="e.g. Senior Frontend Engineer" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block text-foreground/90">Role Description</label>
                <Textarea 
                  placeholder="Briefly describe the responsibilities and context..." 
                  className="min-h-[100px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold font-display">Required Skills</h3>
                  <p className="text-sm text-muted-foreground">Add skills and set the minimum proficiency (1-10).</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddSkill} className="gap-1 bg-white/5 border-white/10">
                  <Plus className="h-4 w-4" /> Add Skill
                </Button>
              </div>

              <div className="space-y-3">
                {skills.map((skill, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-white/5"
                  >
                    <div className="flex-1">
                      <Input 
                        placeholder="e.g. React.js, System Design, Communication" 
                        value={skill.name}
                        onChange={(e) => handleSkillChange(index, "name", e.target.value)}
                        className="bg-transparent border-white/10"
                      />
                    </div>
                    <div className="w-32 flex flex-col gap-1">
                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>Lvl {skill.requiredLevel}</span>
                        <span>/ 10</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" max="10" 
                        value={skill.requiredLevel}
                        onChange={(e) => handleSkillChange(index, "requiredLevel", parseInt(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-red-400 shrink-0"
                      onClick={() => handleRemoveSkill(index)}
                      disabled={skills.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <Button 
                type="submit" 
                size="lg" 
                variant="gradient" 
                className="w-full sm:w-auto shadow-xl"
                isLoading={createMutation.isPending}
              >
                <Save className="h-5 w-5 mr-2" />
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
