import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
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

router.get("/interviews", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const interviews = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.userId, req.user.id));

  const withCounts = await Promise.all(
    interviews.map(async (iv) => {
      const questions = await db
        .select()
        .from(interviewQuestionsTable)
        .where(eq(interviewQuestionsTable.interviewId, iv.id));
      const answers = await db
        .select()
        .from(interviewAnswersTable)
        .where(eq(interviewAnswersTable.interviewId, iv.id));

      let jobTitle: string | null = null;
      if (iv.jobId) {
        const [job] = await db
          .select()
          .from(jobsTable)
          .where(eq(jobsTable.id, iv.jobId));
        jobTitle = job?.title ?? null;
      }

      return {
        ...iv,
        jobTitle,
        totalQuestions: questions.length,
        answeredQuestions: answers.length,
      };
    }),
  );

  res.json(withCounts);
});

router.post("/interviews", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { jobId } = req.body;
  const [interview] = await db
    .insert(interviewsTable)
    .values({
      userId: req.user.id,
      jobId: jobId ?? null,
      status: "pending",
    })
    .returning();
  res.status(201).json({
    ...interview,
    jobTitle: null,
    totalQuestions: 0,
    answeredQuestions: 0,
  });
});

router.get("/interviews/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);
  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(
      and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)),
    );
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const questions = await db
    .select()
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.interviewId, id));

  const answers = await db
    .select()
    .from(interviewAnswersTable)
    .where(eq(interviewAnswersTable.interviewId, id));

  const [report] = await db
    .select()
    .from(interviewReportsTable)
    .where(eq(interviewReportsTable.interviewId, id));

  let jobTitle: string | null = null;
  if (interview.jobId) {
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, interview.jobId));
    jobTitle = job?.title ?? null;
  }

  res.json({
    ...interview,
    jobTitle,
    questions,
    answers,
    report: report ?? null,
  });
});

router.post("/interviews/:id/resume", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);
  const { resumeText, candidateName } = req.body;

  if (!resumeText) {
    res.status(400).json({ error: "resumeText is required" });
    return;
  }

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(
      and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)),
    );
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const extractResp = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content:
          "Extract a list of skills, technologies, and subjects from the resume. Return only a JSON array of strings, no explanation. Example: [\"JavaScript\", \"React\", \"Python\", \"SQL\"]",
      },
      { role: "user", content: resumeText },
    ],
  });

  let skills: string[] = [];
  try {
    const raw = extractResp.choices[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    skills = JSON.parse(cleaned);
  } catch {
    skills = [];
  }

  await db
    .update(interviewsTable)
    .set({ resumeText, candidateName: candidateName ?? null })
    .where(eq(interviewsTable.id, id));

  res.json({ success: true, skills });
});

router.post("/interviews/:id/start", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(
      and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)),
    );
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  let jobContext = "";
  let skillsList: string[] = [];
  if (interview.jobId) {
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, interview.jobId));
    if (job) {
      jobContext = `The position is: ${job.title}. ${job.description}`;
      skillsList = job.skills.map((s) => `${s.name} (level ${s.requiredLevel}/10)`);
    }
  }

  const systemPrompt = `You are an AI interviewer. Generate exactly 8 interview questions for a candidate based on their resume${jobContext ? " and the job requirements" : ""}.

Questions should cover:
- 2 questions about English communication/soft skills (label category: "english")
- 4 technical questions about specific skills mentioned in the resume (label category: "technical") 
- 2 behavioral questions (label category: "behavioral")

${jobContext ? `Job context: ${jobContext}` : ""}
${skillsList.length > 0 ? `Required skills: ${skillsList.join(", ")}` : ""}
${interview.resumeText ? `Resume: ${interview.resumeText}` : "No resume provided, ask general questions."}

Return ONLY a JSON array with this exact structure:
[
  {"questionText": "...", "category": "english|technical|behavioral", "skill": "skill name or null"},
  ...
]`;

  const resp = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: systemPrompt }],
  });

  let questions: Array<{
    questionText: string;
    category: string;
    skill: string | null;
  }> = [];
  try {
    const raw = resp.choices[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    questions = JSON.parse(cleaned);
  } catch {
    questions = [
      {
        questionText: "Tell me about yourself and your background.",
        category: "english",
        skill: null,
      },
    ];
  }

  await db
    .delete(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.interviewId, id));

  const inserted = await db
    .insert(interviewQuestionsTable)
    .values(
      questions.map((q, i) => ({
        interviewId: id,
        questionText: q.questionText,
        questionIndex: i,
        category: q.category,
        skill: q.skill ?? null,
      })),
    )
    .returning();

  await db
    .update(interviewsTable)
    .set({ status: "in_progress" })
    .where(eq(interviewsTable.id, id));

  res.json({ questions: inserted });
});

router.get("/interviews/:id/questions/:questionId/audio", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const questionId = parseInt(req.params.questionId);

  const [question] = await db
    .select()
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.id, questionId));

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  const audioBuffer = await textToSpeech(question.questionText, "alloy", "mp3");
  const base64 = audioBuffer.toString("base64");

  res.json({ audio: base64, format: "mp3" });
});

router.post("/interviews/:id/answers", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);
  const { questionId, audio } = req.body;

  if (!questionId || !audio) {
    res.status(400).json({ error: "questionId and audio are required" });
    return;
  }

  const audioBuffer = Buffer.from(audio, "base64");
  const transcript = await speechToText(audioBuffer, "webm");

  const [answer] = await db
    .insert(interviewAnswersTable)
    .values({
      interviewId: id,
      questionId,
      transcript,
    })
    .returning();

  res.json({ transcript, answerId: answer.id });
});

router.post("/interviews/:id/complete", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(
      and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)),
    );
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const questions = await db
    .select()
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.interviewId, id));

  const answers = await db
    .select()
    .from(interviewAnswersTable)
    .where(eq(interviewAnswersTable.interviewId, id));

  let jobSkills: Array<{ name: string; requiredLevel: number }> = [];
  if (interview.jobId) {
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, interview.jobId));
    jobSkills = job?.skills ?? [];
  }

  const qa = questions
    .map((q) => {
      const answer = answers.find((a) => a.questionId === q.id);
      return `Q (${q.category}${q.skill ? ` - ${q.skill}` : ""}): ${q.questionText}\nA: ${answer?.transcript ?? "(no answer provided)"}`;
    })
    .join("\n\n");

  const gradingPrompt = `You are an expert interview evaluator. Analyze this interview and provide a detailed grading report.

Interview transcript:
${qa}

${jobSkills.length > 0 ? `Required job skills: ${jobSkills.map((s) => `${s.name} (required level: ${s.requiredLevel}/10)`).join(", ")}` : ""}

Evaluate the candidate and return ONLY a JSON object with this exact structure:
{
  "englishScore": <0-100 score for English speaking ability, grammar, fluency, articulation>,
  "englishFeedback": "<specific feedback on communication style>",
  "skillScores": [
    {"skill": "<skill name>", "score": <0-100>, "feedback": "<specific feedback>", "meetRequirement": <true|false|null>}
  ],
  "overallScore": <0-100 weighted average>,
  "recommendation": "hire|no_hire|maybe",
  "feedback": "<2-3 sentence overall summary with strengths and areas for improvement>"
}

Be specific and fair. Base the recommendation on whether the candidate's skills meet the job requirements.`;

  const gradingResp = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: gradingPrompt }],
  });

  let grading: {
    englishScore: number;
    englishFeedback: string;
    skillScores: Array<{
      skill: string;
      score: number;
      feedback: string;
      meetRequirement: boolean | null;
    }>;
    overallScore: number;
    recommendation: "hire" | "no_hire" | "maybe";
    feedback: string;
  };

  try {
    const raw = gradingResp.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    grading = JSON.parse(cleaned);
  } catch {
    grading = {
      englishScore: 70,
      englishFeedback: "Unable to evaluate - please try again.",
      skillScores: [],
      overallScore: 70,
      recommendation: "maybe",
      feedback: "Evaluation could not be completed. Please contact support.",
    };
  }

  await db
    .delete(interviewReportsTable)
    .where(eq(interviewReportsTable.interviewId, id));

  const [report] = await db
    .insert(interviewReportsTable)
    .values({
      interviewId: id,
      englishScore: grading.englishScore,
      englishFeedback: grading.englishFeedback,
      overallScore: grading.overallScore,
      skillScores: grading.skillScores,
      recommendation: grading.recommendation,
      feedback: grading.feedback,
    })
    .returning();

  await db
    .update(interviewsTable)
    .set({ status: "completed" })
    .where(eq(interviewsTable.id, id));

  res.json(report);
});

router.get("/interviews/:id/report", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(
      and(eq(interviewsTable.id, id), eq(interviewsTable.userId, req.user.id)),
    );
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const [report] = await db
    .select()
    .from(interviewReportsTable)
    .where(eq(interviewReportsTable.interviewId, id));

  if (!report) {
    res.status(404).json({ error: "Report not available yet" });
    return;
  }

  res.json(report);
});

export default router;
