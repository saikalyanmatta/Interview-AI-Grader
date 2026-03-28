import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import multer from "multer";
import {
  db,
  interviewsTable,
  interviewQuestionsTable,
  interviewAnswersTable,
  interviewReportsTable,
  jobsTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { speechToText, textToSpeech } from "@workspace/integrations-openai-ai-server/audio";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function analyzeStutter(transcript: string): { stutterScore: number; stutterNotes: string } {
  if (!transcript || transcript.trim().length === 0) {
    return { stutterScore: 0, stutterNotes: "No speech detected" };
  }
  const clean = transcript.toLowerCase().replace(/[.,?!;:'"]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { stutterScore: 0, stutterNotes: "No speech detected" };

  const fillerSet = new Set(["um", "uh", "er", "ah", "hmm", "like", "basically", "literally", "actually", "right", "so", "okay"]);
  let fillerCount = 0;
  for (const w of words) if (fillerSet.has(w)) fillerCount++;

  const phraseFillers = (transcript.toLowerCase().match(/\b(you know|i mean|kind of|sort of|you see)\b/g) || []).length;
  fillerCount += phraseFillers;

  let repetitions = 0;
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === words[i + 1] && words[i].length > 1) repetitions++;
  }

  const fillerRate = fillerCount / words.length;
  const score = Math.round(Math.min(100, fillerRate * 160 + repetitions * 12));
  const notes: string[] = [];
  if (fillerCount > 3) notes.push(`${fillerCount} filler words (um/uh/like)`);
  if (repetitions > 0) notes.push(`${repetitions} word repetition(s)`);
  if (words.length < 8) notes.push("Very short answer");
  if (score === 0 && words.length >= 8) notes.push("Fluent, no issues detected");

  return { stutterScore: score, stutterNotes: notes.join("; ") || "Speech patterns normal" };
}

async function analyzeFacialFrames(
  frames: string[]
): Promise<{ confidenceScore: number; confidenceNotes: string }> {
  if (!frames || frames.length === 0) {
    return { confidenceScore: 70, confidenceNotes: "No facial data collected" };
  }
  const toAnalyze = frames.slice(0, 3);
  const results = await Promise.allSettled(
    toAnalyze.map(async (frame) => {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${frame}`, detail: "low" },
              },
              {
                type: "text",
                text: 'Analyze this interview candidate. Score their confidence 0-100 based on eye contact, expression, posture. Return ONLY JSON: {"score":75,"notes":"brief observation","alert":null}. alert can be null, "looking_away", "distracted", or "other_person".',
              },
            ],
          },
        ],
      });
      const raw = resp.choices[0]?.message?.content ?? '{"score":70,"notes":"Unable to analyze","alert":null}';
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    })
  );

  const parsed = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value);

  if (parsed.length === 0) return { confidenceScore: 70, confidenceNotes: "Analysis unavailable" };

  const avgScore = Math.round(parsed.reduce((s, a) => s + (Number(a.score) || 70), 0) / parsed.length);
  const alerts = parsed.map((a) => a.alert).filter(Boolean);
  const notes = parsed.map((a) => a.notes).filter(Boolean).join(". ");
  const alertNote = alerts.length > 0 ? ` Alerts: ${alerts.join(", ")}.` : "";

  return { confidenceScore: avgScore, confidenceNotes: notes + alertNote };
}

router.get("/interviews", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const interviews = await db.select().from(interviewsTable).where(eq(interviewsTable.userId, req.user.id));
  const withCounts = await Promise.all(
    interviews.map(async (iv) => {
      const questions = await db.select().from(interviewQuestionsTable).where(eq(interviewQuestionsTable.interviewId, iv.id));
      const answers = await db.select().from(interviewAnswersTable).where(eq(interviewAnswersTable.interviewId, iv.id));
      let jobTitle: string | null = null;
      if (iv.jobId) {
        const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, iv.jobId));
        jobTitle = job?.title ?? null;
      }
      return { ...iv, jobTitle, totalQuestions: questions.length, answeredQuestions: answers.length };
    })
  );
  res.json(withCounts);
});

router.post("/interviews", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { jobId } = req.body;
  const [interview] = await db.insert(interviewsTable).values({
    userId: req.user.id, jobId: jobId ?? null, status: "pending",
  }).returning();
  res.status(201).json({ ...interview, jobTitle: null, totalQuestions: 0, answeredQuestions: 0 });
});

router.get("/interviews/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [interview] = await db.select().from(interviewsTable)
    .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }

  const questions = await db.select().from(interviewQuestionsTable).where(eq(interviewQuestionsTable.interviewId, id));
  const answers = await db.select().from(interviewAnswersTable).where(eq(interviewAnswersTable.interviewId, id));
  const [report] = await db.select().from(interviewReportsTable).where(eq(interviewReportsTable.interviewId, id));
  let jobTitle: string | null = null;
  if (interview.jobId) {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, interview.jobId));
    jobTitle = job?.title ?? null;
  }
  res.json({ ...interview, jobTitle, questions, answers, report: report ?? null });
});

router.post("/interviews/:id/resume", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { resumeText, candidateName } = req.body;
  if (!resumeText) { res.status(400).json({ error: "resumeText is required" }); return; }

  const [interview] = await db.select().from(interviewsTable)
    .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }

  const extractResp = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    messages: [
      { role: "system", content: 'Extract a list of technical skills, technologies, and subjects from the resume. Return ONLY a JSON array of strings. Example: ["JavaScript","React","Python","SQL"]' },
      { role: "user", content: resumeText },
    ],
  });

  let skills: string[] = [];
  try {
    const raw = extractResp.choices[0]?.message?.content ?? "[]";
    skills = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch { skills = []; }

  await db.update(interviewsTable).set({ resumeText, candidateName: candidateName ?? null }).where(eq(interviewsTable.id, id));
  res.json({ success: true, skills });
});

router.post(
  "/interviews/:id/resume/upload",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (err) { res.status(400).json({ error: err.message }); return; }
      next();
    });
  },
  async (req, res) => {
    if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = parseInt(req.params.id);
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const [interview] = await db.select().from(interviewsTable)
      .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
    if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }

    let resumeText = "";
    const mime = req.file.mimetype;
    const filename = req.file.originalname.toLowerCase();

    if (mime === "application/pdf" || filename.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(req.file.buffer);
      resumeText = data.text;
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      resumeText = result.value;
    } else if (mime === "text/plain" || filename.endsWith(".txt")) {
      resumeText = req.file.buffer.toString("utf-8");
    } else {
      res.status(400).json({ error: "Unsupported file type. Please upload PDF, DOCX, or TXT." });
      return;
    }

    if (!resumeText.trim()) {
      res.status(400).json({ error: "Could not extract text from file. Please paste your resume instead." });
      return;
    }

    const candidateName = req.body.candidateName || null;
    const extractResp = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        { role: "system", content: 'Extract a list of technical skills, technologies, and subjects from the resume. Return ONLY a JSON array of strings. Example: ["JavaScript","React","Python","SQL"]' },
        { role: "user", content: resumeText.slice(0, 6000) },
      ],
    });

    let skills: string[] = [];
    try {
      const raw = extractResp.choices[0]?.message?.content ?? "[]";
      skills = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch { skills = []; }

    await db.update(interviewsTable).set({ resumeText, candidateName }).where(eq(interviewsTable.id, id));
    res.json({ success: true, skills, resumeText: resumeText.slice(0, 300) + (resumeText.length > 300 ? "..." : "") });
  }
);

router.post("/interviews/:id/next-question", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);

  const [interview] = await db.select().from(interviewsTable)
    .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }

  if (interview.status === "pending") {
    await db.update(interviewsTable).set({ status: "in_progress" }).where(eq(interviewsTable.id, id));
  }

  const questions = await db.select().from(interviewQuestionsTable).where(eq(interviewQuestionsTable.interviewId, id));
  const answers = await db.select().from(interviewAnswersTable).where(eq(interviewAnswersTable.interviewId, id));

  let jobContext = "";
  let jobSkillsList: string[] = [];
  if (interview.jobId) {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, interview.jobId));
    if (job) {
      jobContext = `Target position: ${job.title}. ${job.description}`;
      jobSkillsList = job.skills.map((s) => `${s.name} (required: ${s.requiredLevel}/10)`);
    }
  }

  const historyLines = questions.map((q) => {
    const ans = answers.find((a) => a.questionId === q.id);
    const stutterInfo = ans ? ` [Stutter score: ${ans.stutterScore ?? 0}/100]` : "";
    return `Q${q.questionIndex + 1} [${q.category}${q.skill ? ` - ${q.skill}` : ""}]: ${q.questionText}\nA: ${ans?.transcript ?? "(unanswered)"}${stutterInfo}`;
  }).join("\n\n");

  const prompt = `You are an adaptive AI interviewer. Decide the NEXT interview question or whether to end the interview.

Candidate resume:
${interview.resumeText ?? "No resume provided"}

${jobContext ? `Job context: ${jobContext}` : ""}
${jobSkillsList.length > 0 ? `Required skills: ${jobSkillsList.join(", ")}` : ""}

Interview history so far (${questions.length} questions asked):
${historyLines || "(None yet — this is the first question)"}

Rules for adaptive interviewing:
- Cover English/communication fluency (minimum 2 questions, labeled category: "english")
- Cover behavioral scenarios (minimum 2 questions, labeled category: "behavioral")  
- Cover EACH major technical skill from the resume with at least 2-3 questions (category: "technical")
- Ask follow-up questions when answers show high stutter score (>50) OR the answer is very short/off-topic
- Maximum 20 questions total
- Minimum 6 questions before completing
- Complete when: all major skills covered, both English and behavioral minimums met, and no critical gaps remain

Return ONLY valid JSON in one of these two formats:
{"isComplete":false,"question":{"questionText":"...","category":"english|technical|behavioral","skill":"skill name or null"}}
OR
{"isComplete":true,"question":null}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  let result: { isComplete: boolean; question: { questionText: string; category: string; skill: string | null } | null };
  try {
    const raw = resp.choices[0]?.message?.content ?? '{"isComplete":false,"question":{"questionText":"Tell me about yourself.","category":"english","skill":null}}';
    result = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    result = { isComplete: false, question: { questionText: "Tell me about yourself and your background.", category: "english", skill: null } };
  }

  if (result.isComplete || !result.question) {
    res.json({ isComplete: true, question: null });
    return;
  }

  const [inserted] = await db.insert(interviewQuestionsTable).values({
    interviewId: id,
    questionText: result.question.questionText,
    questionIndex: questions.length,
    category: result.question.category,
    skill: result.question.skill ?? null,
  }).returning();

  res.json({ isComplete: false, question: inserted });
});

router.get("/interviews/:id/questions/:questionId/audio", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const questionId = parseInt(req.params.questionId);
  const [question] = await db.select().from(interviewQuestionsTable).where(eq(interviewQuestionsTable.id, questionId));
  if (!question) { res.status(404).json({ error: "Question not found" }); return; }

  const audioBuffer = await textToSpeech(question.questionText, "alloy", "mp3");
  const base64 = audioBuffer.toString("base64");
  res.json({ audio: base64, format: "mp3" });
});

router.post("/interviews/:id/answers", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { questionId, audio, facialFrames } = req.body;

  if (!questionId || !audio) { res.status(400).json({ error: "questionId and audio are required" }); return; }

  const audioBuffer = Buffer.from(audio, "base64");

  let transcript = "";
  try {
    transcript = await speechToText(audioBuffer, "webm");
  } catch (e: any) {
    try {
      transcript = await speechToText(audioBuffer, "mp4");
    } catch {
      transcript = "(transcription failed)";
    }
  }

  const { stutterScore, stutterNotes } = analyzeStutter(transcript);

  let confidenceScore: number | null = null;
  let confidenceNotes = "";
  if (Array.isArray(facialFrames) && facialFrames.length > 0) {
    try {
      const facial = await analyzeFacialFrames(facialFrames);
      confidenceScore = facial.confidenceScore;
      confidenceNotes = facial.confidenceNotes;
    } catch { }
  }

  const [answer] = await db.insert(interviewAnswersTable).values({
    interviewId: id,
    questionId: Number(questionId),
    transcript,
    stutterScore,
    stutterNotes,
    confidenceScore,
    confidenceNotes,
  }).returning();

  res.json({ transcript, answerId: answer.id, stutterScore, stutterNotes, confidenceScore });
});

router.post("/interviews/:id/start", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  await db.update(interviewsTable).set({ status: "in_progress" }).where(eq(interviewsTable.id, id));
  res.json({ success: true });
});

router.post("/interviews/:id/complete", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);

  const [interview] = await db.select().from(interviewsTable)
    .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }

  const questions = await db.select().from(interviewQuestionsTable).where(eq(interviewQuestionsTable.interviewId, id));
  const answers = await db.select().from(interviewAnswersTable).where(eq(interviewAnswersTable.interviewId, id));

  let jobSkills: Array<{ name: string; requiredLevel: number }> = [];
  if (interview.jobId) {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, interview.jobId));
    jobSkills = job?.skills ?? [];
  }

  const qa = questions.map((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    const stutterInfo = answer ? ` [Stutter score: ${answer.stutterScore ?? 0}/100${answer.stutterNotes ? ` — ${answer.stutterNotes}` : ""}]` : "";
    return `Q (${q.category}${q.skill ? ` - ${q.skill}` : ""}): ${q.questionText}\nA: ${answer?.transcript ?? "(no answer provided)"}${stutterInfo}`;
  }).join("\n\n");

  const confidenceScores = answers.map((a) => a.confidenceScore).filter((s): s is number => s !== null && s !== undefined);
  const avgConfidence = confidenceScores.length > 0
    ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
    : 70;
  const confidenceNotes = answers.map((a) => a.confidenceNotes).filter(Boolean).join(". ");

  const skillGroups: Record<string, number[]> = {};
  for (const q of questions) {
    const skill = q.skill ?? q.category;
    const ans = answers.find((a) => a.questionId === q.id);
    if (ans && ans.stutterScore !== null && ans.stutterScore !== undefined) {
      if (!skillGroups[skill]) skillGroups[skill] = [];
      skillGroups[skill].push(ans.stutterScore);
    }
  }
  const stutterAnalysis = Object.entries(skillGroups).map(([skill, scores]) => ({
    skill,
    avgStutterScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    questionsAsked: scores.length,
    notes: scores.reduce((a, b) => a + b, 0) / scores.length > 50
      ? `High disfluency detected on ${skill} topic`
      : `Adequate fluency on ${skill} topic`,
  }));

  const gradingPrompt = `You are an expert interview evaluator. Analyze this complete interview and grade the candidate.

Interview transcript with fluency metrics:
${qa}

${jobSkills.length > 0 ? `Required job skills: ${jobSkills.map((s) => `${s.name} (required: ${s.requiredLevel}/10)`).join(", ")}` : ""}

Candidate confidence score from facial analysis: ${avgConfidence}/100
${confidenceNotes ? `Confidence observations: ${confidenceNotes}` : ""}

Evaluate the candidate and return ONLY a JSON object:
{
  "englishScore": <0-100 for English fluency, grammar, articulation>,
  "englishFeedback": "<specific feedback including stutter patterns if any>",
  "skillScores": [
    {"skill": "<skill>", "score": <0-100>, "feedback": "<specific feedback noting any fluency issues during this topic>", "meetRequirement": <true|false|null>}
  ],
  "overallScore": <0-100 weighted average>,
  "recommendation": "hire|no_hire|maybe",
  "feedback": "<3-4 sentence executive summary: strengths, fluency patterns, confidence, and concrete improvement areas>"
}`;

  const gradingResp = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 3000,
    messages: [{ role: "user", content: gradingPrompt }],
  });

  let grading: any;
  try {
    const raw = gradingResp.choices[0]?.message?.content ?? "{}";
    grading = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    grading = {
      englishScore: 70, englishFeedback: "Unable to evaluate.",
      skillScores: [], overallScore: 70, recommendation: "maybe",
      feedback: "Evaluation could not be completed.",
    };
  }

  await db.delete(interviewReportsTable).where(eq(interviewReportsTable.interviewId, id));

  const [report] = await db.insert(interviewReportsTable).values({
    interviewId: id,
    englishScore: grading.englishScore,
    englishFeedback: grading.englishFeedback,
    overallScore: grading.overallScore,
    confidenceScore: avgConfidence,
    confidenceNotes: confidenceNotes || grading.feedback,
    stutterAnalysis,
    skillScores: grading.skillScores,
    recommendation: grading.recommendation,
    feedback: grading.feedback,
  }).returning();

  await db.update(interviewsTable).set({ status: "completed" }).where(eq(interviewsTable.id, id));
  res.json(report);
});

router.get("/interviews/:id/report", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [interview] = await db.select().from(interviewsTable)
    .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }
  const [report] = await db.select().from(interviewReportsTable).where(eq(interviewReportsTable.interviewId, id));
  if (!report) { res.status(404).json({ error: "Report not available yet" }); return; }
  res.json(report);
});

export default router;
