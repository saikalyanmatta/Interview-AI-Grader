import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, interviewsTable, interviewReportsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/profile/me", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.patch("/profile/me", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { firstName, lastName, bio, publicResume, customProfileImage, phone } = req.body;
  const updates: Record<string, any> = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (bio !== undefined) updates.bio = bio;
  if (publicResume !== undefined) updates.publicResume = publicResume;
  if (customProfileImage !== undefined) updates.customProfileImage = customProfileImage;
  if (phone !== undefined) updates.phone = phone;

  const [updated] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user.id))
    .returning();
  res.json(updated);
});

router.get("/profile/:userId/public", async (req, res) => {
  const [user] = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    profileImageUrl: usersTable.profileImageUrl,
    customProfileImage: usersTable.customProfileImage,
    bio: usersTable.bio,
    publicResume: usersTable.publicResume,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, req.params.userId));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const interviews = await db.select().from(interviewsTable).where(eq(interviewsTable.userId, req.params.userId));
  const completed = interviews.filter(i => i.status === "completed");
  const reports = await Promise.all(
    completed.slice(-5).map(iv =>
      db.select().from(interviewReportsTable).where(eq(interviewReportsTable.interviewId, iv.id))
        .then(([r]) => r)
    )
  );
  const validReports = reports.filter(Boolean);
  const avgScore = validReports.length > 0
    ? Math.round(validReports.reduce((s, r) => s + r!.overallScore, 0) / validReports.length)
    : null;

  res.json({ ...user, completedInterviews: completed.length, avgScore });
});

export default router;
