import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Plus, Trash2, Briefcase, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

export default function CreateJob() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("Software Engineer");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<{ name: string; requiredLevel: number; weight: number }[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [saving, setSaving] = useState(false);

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || skills.find(x => x.name.toLowerCase() === s.toLowerCase())) return;
    setSkills(prev => [...prev, { name: s, requiredLevel: 7, weight: 50 }]);
    setNewSkill("");
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) { toast.error("Title and description are required"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, role, description, skills }),
      });
      if (!r.ok) throw new Error();
      toast.success("Job profile created");
      setLocation("/employer");
    } catch {
      toast.error("Failed to create job");
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="mb-8">
        <Link href="/employer">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ChevronLeft className="h-4 w-4" />Back to Dashboard
          </button>
        </Link>
        <h1 className="text-3xl font-display font-bold mb-1">Create Job Profile</h1>
        <p className="text-muted-foreground">Define the role requirements for AI-powered interviews</p>
      </motion.div>

      <div className="grid gap-5">
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-2xl p-6 grid gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Job Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Developer"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Role / Function</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Software Engineer"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Job Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              placeholder="Describe the role, responsibilities, and requirements..."
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-2xl p-6">
          <h3 className="font-display font-semibold mb-4">Required Skills</h3>
          <div className="flex gap-2 mb-4">
            <input
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
              placeholder="Add a skill (e.g. React, Python, SQL...)"
              className="flex-1 rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button onClick={addSkill} className="px-4 py-2.5 rounded-xl btn-gradient text-sm font-medium flex items-center gap-1">
              <Plus className="h-4 w-4" />Add
            </button>
          </div>

          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No skills added yet. Add skills to make interviews more targeted.</p>
          ) : (
            <div className="grid gap-3">
              {skills.map((skill, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                  <span className="font-medium text-sm flex-1">{skill.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Level:</span>
                      <select value={skill.requiredLevel}
                        onChange={e => setSkills(prev => prev.map((s, j) => j === i ? { ...s, requiredLevel: Number(e.target.value) } : s))}
                        className="rounded-lg bg-secondary border border-border px-2 py-1 text-xs focus:outline-none"
                      >
                        {[...Array(10)].map((_, n) => <option key={n + 1} value={n + 1}>{n + 1}/10</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Weight:</span>
                      <input type="number" min={0} max={100} value={skill.weight}
                        onChange={e => setSkills(prev => prev.map((s, j) => j === i ? { ...s, weight: Number(e.target.value) } : s))}
                        className="w-14 rounded-lg bg-secondary border border-border px-2 py-1 text-xs focus:outline-none text-center"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <button onClick={() => setSkills(prev => prev.filter((_, j) => j !== i))} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={3}>
          <button onClick={handleSubmit} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold btn-gradient disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 className="h-5 w-5 animate-spin" />Saving...</> : <><Briefcase className="h-5 w-5" />Create Job Profile</>}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
