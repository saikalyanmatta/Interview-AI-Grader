import React from "react";
import { motion } from "framer-motion";

interface Interview {
  status: string;
  overallScore?: number | null;
  recommendation?: string | null;
  behavioralScore?: number | null;
  codingScore?: number | null;
  technicalScore?: number | null;
  englishScore?: number | null;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  unlocked: boolean;
  progress?: string;
}

const TIER_COLORS = {
  bronze: "from-amber-700 to-amber-500",
  silver: "from-slate-400 to-slate-300",
  gold: "from-yellow-500 to-amber-400",
  platinum: "from-indigo-400 to-purple-400",
};
const TIER_BORDER = {
  bronze: "border-amber-500/40",
  silver: "border-slate-400/40",
  gold: "border-yellow-400/40",
  platinum: "border-indigo-400/40",
};
const TIER_GLOW = {
  bronze: "shadow-amber-500/20",
  silver: "shadow-slate-400/20",
  gold: "shadow-yellow-400/30",
  platinum: "shadow-indigo-400/30",
};

function computeBadges(interviews: Interview[]): Badge[] {
  const completed = interviews.filter(i => i.status === "completed");
  const hireCount = completed.filter(i => i.recommendation === "hire").length;
  const highScores = completed.filter(i => (i.overallScore ?? 0) >= 70).length;
  const scores = completed.map(i => i.overallScore ?? 0);
  const maxScore = scores.length ? Math.max(...scores) : 0;

  return [
    // ─── Milestone: Attempts ─────────────────────────────────────────────
    {
      id: "first_step",
      name: "First Step",
      emoji: "🎯",
      tier: "bronze",
      description: "Complete your first interview",
      unlocked: completed.length >= 1,
      progress: `${Math.min(completed.length, 1)}/1`,
    },
    {
      id: "on_a_roll",
      name: "On a Roll",
      emoji: "🔥",
      tier: "silver",
      description: "Complete 5 interviews",
      unlocked: completed.length >= 5,
      progress: `${Math.min(completed.length, 5)}/5`,
    },
    {
      id: "interview_pro",
      name: "Interview Pro",
      emoji: "⭐",
      tier: "gold",
      description: "Complete 10 interviews",
      unlocked: completed.length >= 10,
      progress: `${Math.min(completed.length, 10)}/10`,
    },
    {
      id: "veteran",
      name: "Veteran",
      emoji: "🏆",
      tier: "platinum",
      description: "Complete 25 interviews",
      unlocked: completed.length >= 25,
      progress: `${Math.min(completed.length, 25)}/25`,
    },
    // ─── Score Badges ────────────────────────────────────────────────────
    {
      id: "high_achiever",
      name: "High Achiever",
      emoji: "📈",
      tier: "bronze",
      description: "Score 80 or above in any interview",
      unlocked: maxScore >= 80,
      progress: maxScore >= 80 ? "Unlocked" : `Best: ${maxScore}/100`,
    },
    {
      id: "top_performer",
      name: "Top Performer",
      emoji: "💎",
      tier: "gold",
      description: "Score 90 or above in any interview",
      unlocked: maxScore >= 90,
      progress: maxScore >= 90 ? "Unlocked" : `Best: ${maxScore}/100`,
    },
    {
      id: "consistent",
      name: "Consistent",
      emoji: "🎖️",
      tier: "silver",
      description: "Score 70+ in 3 or more interviews",
      unlocked: highScores >= 3,
      progress: `${Math.min(highScores, 3)}/3 interviews ≥ 70`,
    },
    // ─── Hire Badges ─────────────────────────────────────────────────────
    {
      id: "hire_ready",
      name: "Hire Ready",
      emoji: "✅",
      tier: "silver",
      description: "Earn a 'Hire' recommendation",
      unlocked: hireCount >= 1,
      progress: `${Math.min(hireCount, 1)}/1`,
    },
    {
      id: "always_hire",
      name: "Always Hired",
      emoji: "🌟",
      tier: "gold",
      description: "Earn 'Hire' in 3 interviews",
      unlocked: hireCount >= 3,
      progress: `${Math.min(hireCount, 3)}/3`,
    },
    // ─── Skill Badges ────────────────────────────────────────────────────
    {
      id: "people_person",
      name: "People Person",
      emoji: "🤝",
      tier: "bronze",
      description: "Behavioral score ≥ 85 in any interview",
      unlocked: completed.some(i => (i.behavioralScore ?? 0) >= 85),
      progress: completed.some(i => (i.behavioralScore ?? 0) >= 85)
        ? "Unlocked"
        : `Best: ${Math.max(0, ...completed.map(i => i.behavioralScore ?? 0))}/100`,
    },
    {
      id: "code_warrior",
      name: "Code Warrior",
      emoji: "💻",
      tier: "bronze",
      description: "Coding score ≥ 85 in any interview",
      unlocked: completed.some(i => (i.codingScore ?? 0) >= 85),
      progress: completed.some(i => (i.codingScore ?? 0) >= 85)
        ? "Unlocked"
        : completed.some(i => i.codingScore != null)
          ? `Best: ${Math.max(0, ...completed.map(i => i.codingScore ?? 0))}/100`
          : "Complete a coding interview",
    },
    {
      id: "tech_expert",
      name: "Tech Expert",
      emoji: "🧠",
      tier: "silver",
      description: "Technical theory score ≥ 85 in any interview",
      unlocked: completed.some(i => (i.technicalScore ?? 0) >= 85),
      progress: completed.some(i => (i.technicalScore ?? 0) >= 85)
        ? "Unlocked"
        : completed.some(i => i.technicalScore != null)
          ? `Best: ${Math.max(0, ...completed.map(i => i.technicalScore ?? 0))}/100`
          : "Complete a technical interview",
    },
    {
      id: "fluent_speaker",
      name: "Fluent Speaker",
      emoji: "🗣️",
      tier: "silver",
      description: "English fluency score ≥ 90",
      unlocked: completed.some(i => (i.englishScore ?? 0) >= 90),
      progress: completed.some(i => (i.englishScore ?? 0) >= 90)
        ? "Unlocked"
        : `Best: ${Math.max(0, ...completed.map(i => i.englishScore ?? 0))}/100`,
    },
  ] as Badge[];
}

export function BadgesPanel({ interviews }: { interviews: Interview[] }) {
  const badges = computeBadges(interviews);
  const unlocked = badges.filter(b => b.unlocked);
  const locked = badges.filter(b => !b.unlocked);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-display font-bold">Badges & Achievements</h2>
          <p className="text-sm text-muted-foreground">{unlocked.length} of {badges.length} earned</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["bronze", "silver", "gold", "platinum"] as const).map(t => (
            <span key={t} className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${TIER_COLORS[t]} text-white font-semibold`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[...unlocked, ...locked].map((badge, i) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className={`glass-panel rounded-2xl p-4 flex flex-col items-center text-center gap-2 border transition-all ${badge.unlocked
              ? `${TIER_BORDER[badge.tier]} shadow-lg ${TIER_GLOW[badge.tier]}`
              : "border-border/30 opacity-40 grayscale"
            }`}
          >
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl ${badge.unlocked ? `bg-gradient-to-br ${TIER_COLORS[badge.tier]} shadow-md` : "bg-secondary"}`}>
              {badge.emoji}
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">{badge.name}</div>
              <div className={`text-[10px] font-medium mt-0.5 ${badge.unlocked ? `bg-gradient-to-r ${TIER_COLORS[badge.tier]} bg-clip-text text-transparent` : "text-muted-foreground"}`}>
                {badge.tier.toUpperCase()}
              </div>
            </div>
            <div className="text-xs text-muted-foreground leading-snug">{badge.description}</div>
            {badge.progress && (
              <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.unlocked ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground"}`}>
                {badge.unlocked ? "✓ Earned" : badge.progress}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
