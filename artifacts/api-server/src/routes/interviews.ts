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
  scheduledInterviewsTable,
  interviewCandidatesTable,
  usersTable,
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

function analyzeCommunication(transcripts: string[]) {
  const joined = transcripts.join(" ").trim();
  const clean = joined.toLowerCase().replace(/[.,?!;:'"]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);
  const fillerWords = ["um", "uh", "er", "ah", "hmm", "like", "basically", "literally", "actually", "right", "so", "okay"];
  const fillerCounts = fillerWords.reduce<Record<string, number>>((acc, word) => {
    const count = words.filter((w) => w === word).length;
    if (count > 0) acc[word] = count;
    return acc;
  }, {});
  const totalFillers = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const sentences = joined.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const averageSentenceLength = sentences.length > 0 ? Math.round(words.length / sentences.length) : 0;
  const fillerRate = words.length > 0 ? totalFillers / words.length : 0;
  const clarityScore = Math.max(35, Math.min(100, Math.round(92 - fillerRate * 250 - Math.max(0, averageSentenceLength - 28) * 1.5)));
  const sentenceStructureScore = Math.max(35, Math.min(100, Math.round(88 - Math.abs(averageSentenceLength - 18) * 1.4)));
  return {
    clarityScore,
    fillerWords: fillerCounts,
    totalFillers,
    sentenceStructureScore,
    averageSentenceLength,
    summary: totalFillers > 8
      ? "Reduce filler words and pause deliberately before answering."
      : "Communication is generally clear; keep answers concise and structured.",
  };
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
  const { jobId, role, difficulty, interviewStyle, scheduledInterviewId, codingLanguage } = req.body;

  let resolvedRole = role ?? "Software Engineer";
  let resolvedDifficulty = difficulty ?? "Medium";
  let resolvedInterviewStyle = interviewStyle ?? "Friendly";
  let resolvedJobId = jobId ?? null;
  let resolvedScheduledId = scheduledInterviewId ?? null;

  if (scheduledInterviewId) {
    const [si] = await db.select().from(scheduledInterviewsTable).where(eq(scheduledInterviewsTable.id, parseInt(scheduledInterviewId)));
    if (!si) { res.status(404).json({ error: "Scheduled interview not found" }); return; }
    const now = new Date();
    if (now < new Date(si.startTime)) { res.status(403).json({ error: "Interview has not started yet" }); return; }
    if (now > new Date(si.deadlineTime)) { res.status(403).json({ error: "Interview deadline has passed" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
    const userEmail = user?.email?.toLowerCase()?.trim() ?? "";
    if (userEmail) {
      const [candidate] = await db.select().from(interviewCandidatesTable).where(
        and(eq(interviewCandidatesTable.scheduledInterviewId, si.id), eq(interviewCandidatesTable.email, userEmail))
      );
      if (!candidate) { res.status(403).json({ error: "You are not registered for this interview" }); return; }
    }

    resolvedRole = si.role;
    resolvedDifficulty = si.difficulty;
    resolvedInterviewStyle = si.interviewStyle;
    resolvedJobId = si.jobId;
    resolvedScheduledId = si.id;
  }

  const [interview] = await db.insert(interviewsTable).values({
    userId: req.user.id,
    jobId: resolvedJobId,
    scheduledInterviewId: resolvedScheduledId,
    role: resolvedRole,
    difficulty: resolvedDifficulty,
    interviewStyle: resolvedInterviewStyle,
    codingLanguage: codingLanguage ?? null,
    status: "pending",
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

router.delete("/interviews/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [interview] = await db.select().from(interviewsTable)
    .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }
  await db.delete(interviewsTable).where(eq(interviewsTable.id, id));
  res.json({ success: true });
});

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

  if (questions.length === 0) {
    const name = interview.candidateName ? `, ${interview.candidateName}` : "";
    const introText = `Welcome to your interview${name}! Please take a moment to introduce yourself — tell me a bit about your background, what you've been working on recently, and what brings you here today.`;
    const [introQ] = await db.insert(interviewQuestionsTable).values({
      interviewId: id,
      questionText: introText,
      questionIndex: 0,
      category: "english",
      skill: null,
    }).returning();
    res.json({ isComplete: false, question: introQ });
    return;
  }

  let jobContext = "";
  let jobSkillsList: string[] = [];
  let employerRole = "";
  if (interview.jobId) {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, interview.jobId));
    if (job) {
      employerRole = job.role;
      jobContext = `Target position: ${job.title}. Role family: ${job.role}. ${job.description}`;
      jobSkillsList = job.skills.map((s) => `${s.name} (required: ${s.requiredLevel}/10, weight: ${s.weight ?? 50}%)`);
    }
  }

  const historyLines = questions.map((q) => {
    const ans = answers.find((a) => a.questionId === q.id);
    const stutterInfo = ans ? ` [Stutter score: ${ans.stutterScore ?? 0}/100]` : "";
    return `Q${q.questionIndex + 1} [${q.category}${q.skill ? ` - ${q.skill}` : ""}]: ${q.questionText}\nA: ${ans?.transcript ?? "(unanswered)"}${stutterInfo}`;
  }).join("\n\n");

  const role = employerRole || interview.role || "Software Engineer";
  const difficulty = interview.difficulty || "Medium";
  const style = interview.interviewStyle || "Friendly";
  const styleGuidance = {
    Friendly: "warm, encouraging, conversational, with supportive clarifying prompts",
    Strict: "direct, high-standard, concise, and probing when answers are vague",
    "Technical Deep Dive": "deeply technical, precise, and willing to ask detailed implementation follow-ups",
  }[style] ?? "warm and professional";
  const roleGuidance = {
    "Software Engineer": "coding, debugging, system design, DSA, architecture tradeoffs, and implementation clarity",
    "Product Manager": "product sense, prioritization, metrics, stakeholder tradeoffs, experimentation, and launch judgment",
    "HR Interview": "behavioral judgment, collaboration, conflict resolution, ownership, communication, and culture fit",
  }[role] ?? "role-relevant skills";
  const maxQuestions = difficulty === "Hard" ? 20 : difficulty === "Easy" ? 10 : 15;

  const prompt = `You are an adaptive AI interviewer. Decide the NEXT interview question or whether to end the interview.

Candidate resume:
${interview.resumeText ?? "No resume provided"}

Interview configuration:
- Role: ${role}
- Difficulty: ${difficulty}
- Interview style: ${style} (${styleGuidance})
- Role focus: ${roleGuidance}

${jobContext ? `Job context: ${jobContext}` : ""}
${jobSkillsList.length > 0 ? `Required skills: ${jobSkillsList.join(", ")}` : ""}

Interview history so far (${questions.length} questions asked):
${historyLines || "(None yet — this is the first question)"}

Rules for adaptive interviewing:
- Cover English/communication fluency (minimum 2 questions, labeled category: "english")
- Cover behavioral and situational scenarios with STAR method prompts: Situation, Task, Action, Result (minimum 2 questions, labeled category: "behavioral")
- For Software Engineer, include coding, DSA, system design, and technical tradeoff questions
- For Product Manager, include product thinking, prioritization, metrics, and stakeholder scenarios
- For HR Interview, emphasize behavioral scenarios, emotional intelligence, conflict resolution, and culture fit
- Reference previous answers directly when useful, and ask clarifying follow-up questions such as "Can you elaborate on that?" when answers are incomplete
- Ask follow-up questions when answers show high stutter score (>50), miss STAR elements, are very short, vague, or off-topic
- Maximum ${maxQuestions} questions total
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

  let jobSkills: Array<{ name: string; requiredLevel: number; weight?: number }> = [];
  let jobRole: string | null = null;
  if (interview.jobId) {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, interview.jobId));
    jobSkills = job?.skills ?? [];
    jobRole = job?.role ?? null;
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
  const communicationAnalysis = analyzeCommunication(answers.map((a) => a.transcript));

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

  const role = jobRole || interview.role || "Software Engineer";
  const difficulty = interview.difficulty || "Medium";
  const style = interview.interviewStyle || "Friendly";

  const gradingPrompt = `You are an expert interview evaluator. Analyze this complete interview and grade the candidate.

Interview transcript with fluency metrics:
${qa}

Interview configuration: ${role} role, ${difficulty} difficulty, ${style} interviewer style.
${jobSkills.length > 0 ? `Required job skills: ${jobSkills.map((s) => `${s.name} (required: ${s.requiredLevel}/10, weight: ${s.weight ?? 50}%)`).join(", ")}` : ""}

Candidate confidence score from facial analysis: ${avgConfidence}/100
${confidenceNotes ? `Confidence observations: ${confidenceNotes}` : ""}

Measured communication metrics:
${JSON.stringify(communicationAnalysis)}

Evaluate the candidate and return ONLY a JSON object:
{
  "englishScore": <0-100 for English fluency, grammar, articulation>,
  "englishFeedback": "<specific feedback including stutter patterns if any>",
  "behavioralScore": <0-100 for STAR completeness, problem solving, emotional intelligence>,
  "behavioralAnalysis": {"starCompleteness":"<specific assessment>", "missingElements":["Situation|Task|Action|Result"], "problemSolving":"<assessment>", "emotionalIntelligence":"<assessment>", "suggestions":["<specific improvement>"]},
  "communicationAnalysis": {"clarityScore": <0-100>, "fillerWords": {"um": 0}, "sentenceStructureScore": <0-100>, "summary": "<clear explanation>"},
  "skillScores": [
    {"skill": "<skill>", "score": <0-100>, "feedback": "<specific feedback noting any fluency issues during this topic>", "meetRequirement": <true|false|null>}
  ],
  "answerQualityBreakdown": [
    {"question": "<question>", "yourAnswer": "<candidate answer>", "rating": <0-100>, "suggestedBetterAnswer": "<improved concise answer using role-appropriate structure>"}
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
      behavioralScore: 70,
      behavioralAnalysis: { missingElements: [], suggestions: ["Use Situation, Task, Action, Result in behavioral answers."] },
      communicationAnalysis,
      answerQualityBreakdown: [],
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
    behavioralScore: grading.behavioralScore ?? 70,
    behavioralAnalysis: grading.behavioralAnalysis ?? {},
    communicationAnalysis: { ...communicationAnalysis, ...(grading.communicationAnalysis ?? {}) },
    answerQualityBreakdown: grading.answerQualityBreakdown ?? [],
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

router.get("/interviews/:id/coding-questions", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [interview] = await db.select().from(interviewsTable)
    .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }

  let codingQuestionsCount = 1;
  if (interview.scheduledInterviewId) {
    const [si] = await db.select().from(scheduledInterviewsTable).where(eq(scheduledInterviewsTable.id, interview.scheduledInterviewId));
    codingQuestionsCount = si?.codingQuestionsCount ?? 1;
  }
  if (codingQuestionsCount === 0) { res.json({ questions: [] }); return; }

  const language = interview.codingLanguage || "Python";
  const role = interview.role || "Software Engineer";
  const difficulty = interview.difficulty || "Medium";

  const prompt = `Generate ${codingQuestionsCount} coding interview question(s) for a ${role} candidate at ${difficulty} difficulty level, to be answered in ${language}.
Each question should be practical and appropriate for the role.
Return ONLY a JSON array of objects with fields: "title" (string), "description" (string, 2-4 sentences describing the problem clearly), "examples" (string, 1-2 input/output examples).
Example: [{"title":"Two Sum","description":"Given an array of integers and a target, return indices of the two numbers that sum to the target. You may assume that each input has exactly one solution.","examples":"Input: nums=[2,7,11,15], target=9 → Output: [0,1]"}]`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  let questions: any[] = [];
  try {
    const raw = resp.choices[0]?.message?.content ?? "[]";
    questions = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch { questions = []; }

  res.json({ questions, language });
});

router.post("/interviews/:id/coding-submit", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [interview] = await db.select().from(interviewsTable)
    .where(and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)));
  if (!interview) { res.status(404).json({ error: "Interview not found" }); return; }

  const { answers } = req.body as { answers: { questionText: string; code: string }[] };
  if (!answers || !Array.isArray(answers)) { res.status(400).json({ error: "answers array required" }); return; }

  const language = interview.codingLanguage || "Python";
  const codingAnswers = answers.map(a => ({ questionText: a.questionText, language, code: a.code }));
  await db.update(interviewsTable).set({ codingAnswers } as any).where(eq(interviewsTable.id, id));
  res.json({ success: true });
});

export default router;
