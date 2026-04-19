import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import jobsRouter from "./jobs";
import interviewsRouter from "./interviews";
import scheduledInterviewsRouter from "./scheduled-interviews";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(jobsRouter);
router.use(interviewsRouter);
router.use(scheduledInterviewsRouter);
router.use(profileRouter);

export default router;
