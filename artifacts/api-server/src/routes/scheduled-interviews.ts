import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  scheduledInterviewsTable,
  interviewCandidatesTable,
  interviewsTable,
  interviewReportsTable,
  jobsTable,
  usersTable,
} from "@workspace/db";
import ExcelJS from "exceljs";

const router: IRouter = Router();

router.get("/scheduled-interviews", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const list = await db.select().from(scheduledInterviewsTable)
    .where(eq(scheduledInterviewsTable.employerId, req.user.id));

  const withCounts = await Promise.all(list.map(async (si) => {
    const candidates = await db.select().from(interviewCandidatesTable)
      .where(eq(interviewCandidatesTable.scheduledInterviewId, si.id));
    const attempts = await db.select().from(interviewsTable)
      .where(eq(interviewsTable.scheduledInterviewId, si.id));
    let jobTitle: string | null = null;
    if (si.jobId) {
      const [j] = await db.select().from(jobsTable).where(eq(jobsTable.id, si.jobId));
      jobTitle = j?.title ?? null;
    }
    return { ...si, jobTitle, candidateCount: candidates.length, attemptCount: attempts.length };
  }));

  res.json(withCounts);
});

router.post("/scheduled-interviews", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { jobId, title, startTime, deadlineTime, codingQuestionsCount, role, difficulty, interviewStyle } = req.body;
  if (!title || !startTime || !deadlineTime) {
    res.status(400).json({ error: "title, startTime, deadlineTime are required" }); return;
  }
  const [si] = await db.insert(scheduledInterviewsTable).values({
    employerId: req.user.id,
    jobId: jobId ?? null,
    title,
    startTime: new Date(startTime),
    deadlineTime: new Date(deadlineTime),
    codingQuestionsCount: codingQuestionsCount ?? 0,
    role: role ?? "Software Engineer",
    difficulty: difficulty ?? "Medium",
    interviewStyle: interviewStyle ?? "Friendly",
  }).returning();
  res.status(201).json(si);
});

router.get("/scheduled-interviews/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [si] = await db.select().from(scheduledInterviewsTable)
    .where(and(eq(scheduledInterviewsTable.id, id), eq(scheduledInterviewsTable.employerId, req.user.id)));
  if (!si) { res.status(404).json({ error: "Not found" }); return; }

  const candidates = await db.select().from(interviewCandidatesTable)
    .where(eq(interviewCandidatesTable.scheduledInterviewId, id));
  let jobTitle: string | null = null;
  if (si.jobId) {
    const [j] = await db.select().from(jobsTable).where(eq(jobsTable.id, si.jobId));
    jobTitle = j?.title ?? null;
  }
  res.json({ ...si, jobTitle, candidates });
});

router.delete("/scheduled-interviews/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [si] = await db.select().from(scheduledInterviewsTable)
    .where(and(eq(scheduledInterviewsTable.id, id), eq(scheduledInterviewsTable.employerId, req.user.id)));
  if (!si) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(scheduledInterviewsTable).where(eq(scheduledInterviewsTable.id, id));
  res.json({ success: true });
});

router.post("/scheduled-interviews/:id/candidates", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [si] = await db.select().from(scheduledInterviewsTable)
    .where(and(eq(scheduledInterviewsTable.id, id), eq(scheduledInterviewsTable.employerId, req.user.id)));
  if (!si) { res.status(404).json({ error: "Not found" }); return; }

  const { emails } = req.body as { emails: string[] };
  if (!emails || !Array.isArray(emails)) { res.status(400).json({ error: "emails array required" }); return; }

  const existing = await db.select({ email: interviewCandidatesTable.email })
    .from(interviewCandidatesTable)
    .where(eq(interviewCandidatesTable.scheduledInterviewId, id));
  const existingSet = new Set(existing.map(e => e.email.toLowerCase()));
  const toAdd = [...new Set(emails.map(e => e.toLowerCase().trim()).filter(e => e && /\S+@\S+\.\S+/.test(e)))].filter(e => !existingSet.has(e));

  if (toAdd.length > 0) {
    await db.insert(interviewCandidatesTable).values(
      toAdd.map(email => ({ scheduledInterviewId: id, email }))
    );
  }
  const all = await db.select().from(interviewCandidatesTable)
    .where(eq(interviewCandidatesTable.scheduledInterviewId, id));
  res.json({ added: toAdd.length, candidates: all });
});

router.delete("/scheduled-interviews/:id/candidates", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [si] = await db.select().from(scheduledInterviewsTable)
    .where(and(eq(scheduledInterviewsTable.id, id), eq(scheduledInterviewsTable.employerId, req.user.id)));
  if (!si) { res.status(404).json({ error: "Not found" }); return; }

  const { email } = req.body as { email: string };
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  await db.delete(interviewCandidatesTable).where(
    and(
      eq(interviewCandidatesTable.scheduledInterviewId, id),
      eq(interviewCandidatesTable.email, email.toLowerCase().trim())
    )
  );
  const remaining = await db.select().from(interviewCandidatesTable)
    .where(eq(interviewCandidatesTable.scheduledInterviewId, id));
  res.json({ candidates: remaining });
});

router.get("/scheduled-interviews/:id/results", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [si] = await db.select().from(scheduledInterviewsTable)
    .where(and(eq(scheduledInterviewsTable.id, id), eq(scheduledInterviewsTable.employerId, req.user.id)));
  if (!si) { res.status(404).json({ error: "Not found" }); return; }

  if (new Date() < new Date(si.startTime)) {
    res.status(403).json({ error: "Results not available until interview start time" }); return;
  }

  const candidates = await db.select().from(interviewCandidatesTable)
    .where(eq(interviewCandidatesTable.scheduledInterviewId, id));

  const attempts = await db.select().from(interviewsTable)
    .where(eq(interviewsTable.scheduledInterviewId, id));

  const results = await Promise.all(attempts.map(async (iv) => {
    const [report] = await db.select().from(interviewReportsTable)
      .where(eq(interviewReportsTable.interviewId, iv.id));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, iv.userId));
    return {
      interviewId: iv.id,
      candidateName: iv.candidateName ?? user?.firstName ?? "Unknown",
      email: user?.email ?? "",
      status: iv.status,
      report: report ?? null,
      overallScore: report?.overallScore ?? null,
      recommendation: report?.recommendation ?? null,
      skillScores: report?.skillScores ?? [],
      englishScore: report?.englishScore ?? null,
      behavioralScore: report?.behavioralScore ?? null,
      confidenceScore: report?.confidenceScore ?? null,
    };
  }));

  const attemptedEmails = new Set(results.map(r => r.email.toLowerCase()));
  const notAttempted = candidates
    .filter(c => !attemptedEmails.has(c.email.toLowerCase()))
    .map(c => ({ email: c.email, candidateName: null, status: "not_attempted", report: null }));

  res.json({ scheduledInterview: si, attempted: results, notAttempted });
});

router.get("/scheduled-interviews/:id/results/export", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [si] = await db.select().from(scheduledInterviewsTable)
    .where(and(eq(scheduledInterviewsTable.id, id), eq(scheduledInterviewsTable.employerId, req.user.id)));
  if (!si) { res.status(404).json({ error: "Not found" }); return; }

  const candidates = await db.select().from(interviewCandidatesTable)
    .where(eq(interviewCandidatesTable.scheduledInterviewId, id));
  const attempts = await db.select().from(interviewsTable)
    .where(eq(interviewsTable.scheduledInterviewId, id));

  const results = await Promise.all(attempts.map(async (iv) => {
    const [report] = await db.select().from(interviewReportsTable)
      .where(eq(interviewReportsTable.interviewId, iv.id));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, iv.userId));
    return {
      candidateName: iv.candidateName ?? user?.firstName ?? "Unknown",
      email: user?.email ?? "",
      overallScore: report?.overallScore ?? null,
      englishScore: report?.englishScore ?? null,
      behavioralScore: report?.behavioralScore ?? null,
      confidenceScore: report?.confidenceScore ?? null,
      skillScores: report?.skillScores ?? [],
      recommendation: report?.recommendation ?? null,
      feedback: report?.feedback ?? "",
    };
  }));

  const attemptedEmails = new Set(results.map(r => r.email.toLowerCase()));
  const notAttempted = candidates
    .filter(c => !attemptedEmails.has(c.email.toLowerCase()))
    .map(c => ({ candidateName: "", email: c.email, overallScore: null, englishScore: null, behavioralScore: null, confidenceScore: null, skillScores: [], recommendation: null, feedback: "" }));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vocalize.ai";

  const baseHeaders = ["Name", "Email", "Overall Score", "English Score", "Behavioral Score", "Confidence Score"];

  const allSkillNames = [...new Set(results.flatMap(r => r.skillScores.map((s: any) => s.skill)))];
  const skillHeaders = allSkillNames.map(s => `Skill: ${s}`);
  const headers = [...baseHeaders, ...skillHeaders, "Recommendation", "Feedback"];

  const makeRow = (r: typeof results[0]) => {
    const base = [r.candidateName, r.email, r.overallScore, r.englishScore, r.behavioralScore, r.confidenceScore];
    const skills = allSkillNames.map(sn => {
      const found = r.skillScores.find((s: any) => s.skill === sn);
      return found ? (found as any).score : "";
    });
    return [...base, ...skills, r.recommendation, r.feedback];
  };

  const makeNotAttemptedRow = (r: typeof notAttempted[0]) => {
    return [r.candidateName, r.email, ...Array(headers.length - 2).fill("")];
  };

  const strongly = results.filter(r => r.recommendation === "hire" && (r.overallScore ?? 0) >= 80);
  const hire = results.filter(r => r.recommendation === "hire" && (r.overallScore ?? 0) < 80);
  const maybe = results.filter(r => r.recommendation === "maybe");
  const noHire = results.filter(r => r.recommendation === "no_hire");

  const sheets: { name: string; rows: any[][] }[] = [
    { name: "Strongly Hire", rows: strongly.map(makeRow) },
    { name: "Hire", rows: [...hire, ...maybe].map(makeRow) },
    { name: "Do Not Hire", rows: noHire.map(makeRow) },
    { name: "Not Attempted", rows: notAttempted.map(makeNotAttemptedRow) },
  ];

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    const notAttemptedHeaders = ["Name", "Email"];
    ws.addRow(sheet.name === "Not Attempted" ? notAttemptedHeaders : headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const row of sheet.rows) ws.addRow(row);
    ws.columns.forEach(col => { col.width = 18; });
  }

  const buf = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Disposition", `attachment; filename="results-${id}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buf);
});

router.post("/scheduled-interviews/validate-access", async (req, res) => {
  const { scheduledInterviewId, email } = req.body;
  if (!scheduledInterviewId || !email) {
    res.status(400).json({ error: "scheduledInterviewId and email required" }); return;
  }
  const [si] = await db.select().from(scheduledInterviewsTable)
    .where(eq(scheduledInterviewsTable.id, parseInt(scheduledInterviewId)));
  if (!si) { res.status(404).json({ allowed: false, reason: "Interview not found" }); return; }

  const now = new Date();
  if (now < new Date(si.startTime)) {
    res.json({ allowed: false, reason: "Interview has not started yet", startTime: si.startTime }); return;
  }
  if (now > new Date(si.deadlineTime)) {
    res.json({ allowed: false, reason: "Interview deadline has passed" }); return;
  }

  const [candidate] = await db.select().from(interviewCandidatesTable)
    .where(and(
      eq(interviewCandidatesTable.scheduledInterviewId, parseInt(scheduledInterviewId)),
      eq(interviewCandidatesTable.email, email.toLowerCase().trim())
    ));

  if (!candidate) {
    res.json({ allowed: false, reason: "You are not registered for this interview" }); return;
  }

  res.json({ allowed: true, scheduledInterview: si });
});

export default router;
