import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Mic, Target, BrainCircuit, ArrowRight } from "lucide-react";

export default function Landing() {
  const { isAuthenticated, login } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-4xl mx-auto text-center space-y-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          Next-Gen AI Voice Interviews
        </div>
        
        <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight leading-tight">
          Master your next interview with <span className="gradient-text">Conversational AI</span>
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Upload your resume, practice with realistic AI voice scenarios, and get graded instantly on your technical skills and English proficiency.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          {isAuthenticated ? (
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" variant="gradient" className="w-full sm:w-auto group">
                Go to Dashboard
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          ) : (
            <Button size="lg" variant="gradient" onClick={login} className="w-full sm:w-auto group">
              Start Practicing Free
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}
          <Link href="/employer" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto bg-black/20 backdrop-blur-md border-white/10">
              I'm an Employer
            </Button>
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto w-full">
        {[
          {
            icon: Mic,
            title: "Realistic Voice",
            desc: "Speak naturally. Our AI listens, understands context, and responds with human-like voice."
          },
          {
            icon: Target,
            title: "Skill Assessment",
            desc: "Get scored on specific technical requirements tailored to your resume and target job."
          },
          {
            icon: BrainCircuit,
            title: "Actionable Feedback",
            desc: "Receive a detailed report highlighting strengths and exact areas for improvement."
          }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center gap-4 hover:-translate-y-1 transition-transform duration-300"
          >
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <feature.icon className="h-6 w-6" />
            </div>
            <h3 className="font-display font-semibold text-xl">{feature.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
