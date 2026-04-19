import React from "react";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { motion } from "framer-motion";
import {
  Mic, Target, BrainCircuit, ArrowRight, Star, Shield,
  Zap, ChevronRight, Play, BarChart3, Users, Clock
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

const stats = [
  { label: "Interviews Conducted", value: "12,400+", icon: Mic },
  { label: "Average Score Improvement", value: "38%", icon: BarChart3 },
  { label: "Active Users", value: "3,200+", icon: Users },
  { label: "Avg Session Length", value: "28 min", icon: Clock },
];

const features = [
  {
    icon: Mic,
    title: "Realistic Voice Interviews",
    desc: "Speak naturally with our AI interviewer. It listens, understands context, and responds with human-like voice in real time.",
    color: "from-indigo-500 to-blue-600",
    badge: "Voice AI",
  },
  {
    icon: Target,
    title: "Adaptive Skill Assessment",
    desc: "Get scored on technical skills tailored to your resume and target role. Questions adapt based on your answers.",
    color: "from-purple-500 to-pink-600",
    badge: "Smart",
  },
  {
    icon: BrainCircuit,
    title: "Deep Performance Analysis",
    desc: "Receive detailed reports on English fluency, behavioral patterns, STAR structure, and confidence scoring.",
    color: "from-emerald-500 to-teal-600",
    badge: "Analytics",
  },
  {
    icon: Shield,
    title: "Anti-Malpractice Monitoring",
    desc: "Fullscreen enforcement, tab-switch detection, and facial confidence analysis ensure a secure interview environment.",
    color: "from-amber-500 to-orange-600",
    badge: "Secure",
  },
  {
    icon: Zap,
    title: "Instant Grading & Reports",
    desc: "Get your comprehensive interview report the moment you finish — no waiting, no manual review needed.",
    color: "from-rose-500 to-red-600",
    badge: "Instant",
  },
  {
    icon: Star,
    title: "Employer Portal",
    desc: "Employers can set custom job profiles, invite candidates, and compare results with hire/no-hire recommendations.",
    color: "from-sky-500 to-cyan-600",
    badge: "Teams",
  },
];

export default function Landing() {
  const { isAuthenticated, login } = useAuth();

  return (
    <div className="flex flex-col items-center w-full overflow-hidden">
      <section className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-20">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial="hidden" animate="show"
            variants={fadeUp} custom={0}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Next-Generation AI Voice Interviews
          </motion.div>

          <motion.h1
            initial="hidden" animate="show" variants={fadeUp} custom={1}
            className="text-5xl sm:text-6xl md:text-7xl font-display font-extrabold tracking-tight leading-[1.1] mb-6"
          >
            Ace every interview with{" "}
            <span className="gradient-text">Conversational AI</span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="show" variants={fadeUp} custom={2}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Upload your resume, practice with a realistic AI voice interviewer, and get instant graded reports on your technical skills, English fluency, and behavioral patterns.
          </motion.p>

          <motion.div
            initial="hidden" animate="show" variants={fadeUp} custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            {isAuthenticated ? (
              <Link href="/dashboard">
                <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold btn-gradient text-base group">
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            ) : (
              <button onClick={login} className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold btn-gradient text-base group">
                Start Practicing Free
                <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
            <Link href="/employer">
              <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold border border-border bg-secondary/60 hover:bg-secondary transition-colors text-base">
                <Briefcase2 className="h-5 w-5 text-primary" />
                I'm an Employer
              </button>
            </Link>
          </motion.div>

          <motion.div
            initial="hidden" animate="show" variants={fadeUp} custom={4}
            className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            {["Free to get started", "No credit card required", "AI-powered feedback"].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {t}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="w-full py-16 border-y border-border/50 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial="hidden" animate="show" variants={fadeUp} custom={i}
                className="flex flex-col items-center text-center gap-2"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-1">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="font-display font-bold text-2xl md:text-3xl">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-secondary/50 text-sm font-medium text-muted-foreground mb-4">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Everything you need to succeed
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Built for serious interview prep
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From first-time job seekers to senior engineers — get the practice and feedback you need to land your dream role.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={i * 0.5}
                className="glass-panel p-6 rounded-2xl card-hover group"
              >
                <div className="flex items-start gap-4">
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-display font-semibold text-base">{feature.title}</h3>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 ml-2 flex-shrink-0">
                        {feature.badge}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 p-[1px]"
          >
            <div className="rounded-3xl bg-card/95 backdrop-blur-xl px-8 py-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/25">
                <Play className="h-7 w-7 text-white ml-1" />
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                Ready to ace your next interview?
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-8 text-lg">
                Join thousands of candidates who improved their interview skills with EvalPro. Start your first session in under 2 minutes.
              </p>
              {isAuthenticated ? (
                <Link href="/setup">
                  <button className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold btn-gradient text-base">
                    Start New Interview <ChevronRight className="h-5 w-5" />
                  </button>
                </Link>
              ) : (
                <button onClick={login} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold btn-gradient text-base">
                  Get Started Free <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function Briefcase2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
