import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/jobs", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const jobs = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.userId, req.user.id));
  res.json(jobs);
});

router.post("/jobs", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { title, role, description, skills } = req.body;
  if (!title || !description) {
    res.status(400).json({ error: "title and description are required" });
    return;
  }
  const [job] = await db
    .insert(jobsTable)
    .values({
      userId: req.user.id,
      title,
      role: role ?? "Software Engineer",
      description,
      skills: skills ?? [],
    })
    .returning();
  res.status(201).json(job);
});

router.get("/jobs/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, id), eq(jobsTable.userId, req.user.id)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.put("/jobs/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);
  const { title, role, description, skills } = req.body;
  const [job] = await db
    .update(jobsTable)
    .set({ title, role: role ?? "Software Engineer", description, skills: skills ?? [] })
    .where(and(eq(jobsTable.id, id), eq(jobsTable.userId, req.user.id)))
    .returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.delete("/jobs/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);
  await db
    .delete(jobsTable)
    .where(and(eq(jobsTable.id, id), eq(jobsTable.userId, req.user.id)));
  res.status(204).send();
});

export default router;
