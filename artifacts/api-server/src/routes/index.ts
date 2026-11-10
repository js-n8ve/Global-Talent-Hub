import { Router, type IRouter } from "express";
import accountRouter from "./account";
import adminRouter from "./admin";
import applicationsRouter from "./applications";
import healthRouter from "./health";
import jobsRouter from "./jobs";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountRouter);
router.use(jobsRouter);
router.use(applicationsRouter);
router.use(paymentsRouter);
router.use(adminRouter);

export default router;
