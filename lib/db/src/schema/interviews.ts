import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const skillRequirementSchema = z.object({
  name: z.string(),
  requiredLevel: z.number().min(1).max(10),
  weight: z.number().min(0).max(100).optional(),
});
export type SkillRequirement = z.infer<typeof skillRequirementSchema>;

export const skillScoreSchema = z.object({
  skill: z.string(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  meetRequirement: z.boolean().nullable().optional(),
});
export type SkillScore = z.infer<typeof skillScoreSchema>;

export const stutterItemSchema = z.object({
  skill: z.string(),
  avgStutterScore: z.number(),
  questionsAsked: z.number(),
  notes: z.string(),
});
export type StutterItem = z.infer<typeof stutterItemSchema>;

export const codingAnswerSchema = z.object({
  questionText: z.string(),
  language: z.string(),
  code: z.string(),
  score: z.number().optional(),
  feedback: z.string().optional(),
});
export type CodingAnswer = z.infer<typeof codingAnswerSchema>;

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  role: text("role").notNull().default("Software Engineer"),
  description: text("description").notNull(),
  skills: jsonb("skills").$type<SkillRequirement[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;

export const scheduledInterviewsTable = pgTable("scheduled_interviews", {
  id: serial("id").primaryKey(),
  employerId: text("employer_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  jobId: integer("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  startTime: timestamp("start_time").notNull(),
  deadlineTime: timestamp("deadline_time").notNull(),
  codingQuestionsCount: integer("coding_questions_count").notNull().default(0),
  role: text("role").notNull().default("Software Engineer"),
  difficulty: text("difficulty").notNull().default("Medium"),
  interviewStyle: text("interview_style").notNull().default("Friendly"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ScheduledInterview = typeof scheduledInterviewsTable.$inferSelect;

export const interviewCandidatesTable = pgTable("interview_candidates", {
  id: serial("id").primaryKey(),
  scheduledInterviewId: integer("scheduled_interview_id")
    .notNull()
    .references(() => scheduledInterviewsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export type InterviewCandidate = typeof interviewCandidatesTable.$inferSelect;

export const interviewsTable = pgTable("interviews", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  jobId: integer("job_id").references(() => jobsTable.id, {
    onDelete: "set null",
  }),
  scheduledInterviewId: integer("scheduled_interview_id").references(
    () => scheduledInterviewsTable.id,
    { onDelete: "set null" }
  ),
  role: text("role").notNull().default("Software Engineer"),
  difficulty: text("difficulty").notNull().default("Medium"),
  interviewStyle: text("interview_style").notNull().default("Friendly"),
  status: text("status", {
    enum: ["pending", "in_progress", "completed"],
  })
    .notNull()
    .default("pending"),
  candidateName: text("candidate_name"),
  resumeText: text("resume_text"),
  codingLanguage: text("coding_language"),
  codingAnswers: jsonb("coding_answers").$type<CodingAnswer[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInterviewSchema = createInsertSchema(interviewsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviewsTable.$inferSelect;

export const interviewQuestionsTable = pgTable("interview_questions", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id")
    .notNull()
    .references(() => interviewsTable.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionIndex: integer("question_index").notNull(),
  category: text("category").notNull().default("general"),
  skill: text("skill"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InterviewQuestion = typeof interviewQuestionsTable.$inferSelect;

export const interviewAnswersTable = pgTable("interview_answers", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id")
    .notNull()
    .references(() => interviewsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => interviewQuestionsTable.id, { onDelete: "cascade" }),
  transcript: text("transcript").notNull(),
  stutterScore: integer("stutter_score").default(0),
  stutterNotes: text("stutter_notes").default(""),
  confidenceScore: integer("confidence_score"),
  confidenceNotes: text("confidence_notes").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InterviewAnswer = typeof interviewAnswersTable.$inferSelect;

export const interviewReportsTable = pgTable("interview_reports", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id")
    .notNull()
    .unique()
    .references(() => interviewsTable.id, { onDelete: "cascade" }),
  englishScore: integer("english_score").notNull(),
  englishFeedback: text("english_feedback").notNull().default(""),
  overallScore: integer("overall_score").notNull(),
  confidenceScore: integer("confidence_score").default(70),
  confidenceNotes: text("confidence_notes").default(""),
  behavioralScore: integer("behavioral_score").default(70),
  behavioralAnalysis: jsonb("behavioral_analysis").$type<Record<string, unknown>>().notNull().default({}),
  communicationAnalysis: jsonb("communication_analysis").$type<Record<string, unknown>>().notNull().default({}),
  answerQualityBreakdown: jsonb("answer_quality_breakdown").$type<Record<string, unknown>[]>().notNull().default([]),
  stutterAnalysis: jsonb("stutter_analysis").$type<StutterItem[]>().notNull().default([]),
  skillScores: jsonb("skill_scores").$type<SkillScore[]>().notNull().default([]),
  recommendation: text("recommendation", {
    enum: ["hire", "no_hire", "maybe"],
  }).notNull(),
  feedback: text("feedback").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InterviewReport = typeof interviewReportsTable.$inferSelect;
