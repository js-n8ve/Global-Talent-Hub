import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ListJobsForReviewResponse,
  ReviewJobBody,
  ReviewJobParams,
  ReviewJobResponse,
} from "@workspace/api-zod";
import { db, jobsTable } from "@workspace/db";
import {
  requireTaskAwayRole,
  requireTaskAwayUser,
} from "../middlewares/taskawayAuth";
import { jobForApi } from "./jobs";

const router: IRouter = Router();

router.get(
  "/admin/jobs",
  requireTaskAwayUser,
  requireTaskAwayRole("admin"),
  async (_req, res, next) => {
    try {
      const jobs = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.status, "pending_review"))
        .orderBy(desc(jobsTable.createdAt));
      res.json(ListJobsForReviewResponse.parse(jobs.map(jobForApi)));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/admin/jobs/:id/review",
  requireTaskAwayUser,
  requireTaskAwayRole("admin"),
  async (req, res, next) => {
    try {
      const params = ReviewJobParams.safeParse(req.params);
      const input = ReviewJobBody.safeParse(req.body);
      if (!params.success || !input.success) {
        res.status(400).json({ error: "Choose a valid review decision." });
        return;
      }

      const note = input.data.note?.trim() || null;
      const [job] = await db
        .update(jobsTable)
        .set(
          input.data.decision === "approve"
            ? {
                status: "published",
                verified: true,
                publishedAt: new Date(),
                reviewNote: null,
                updatedAt: new Date(),
              }
            : {
                status: "rejected",
                verified: false,
                publishedAt: null,
                reviewNote: note,
                updatedAt: new Date(),
              },
        )
        .where(
          and(
            eq(jobsTable.id, params.data.id),
            eq(jobsTable.status, "pending_review"),
            isNotNull(jobsTable.paidAt),
          ),
        )
        .returning();

      if (!job) {
        res.status(404).json({
          error: "Paid listing not found or already reviewed.",
        });
        return;
      }

      res.json(ReviewJobResponse.parse(jobForApi(job)));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
