import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ApplyToJobBody,
  ApplyToJobParams,
  ApplyToJobResponse,
  ListEmployerApplicationsResponse,
  ListMyApplicationsResponse,
  UpdateApplicationStatusBody,
  UpdateApplicationStatusParams,
  UpdateApplicationStatusResponse,
} from "@workspace/api-zod";
import { applicationsTable, db, jobsTable } from "@workspace/db";
import {
  requireTaskAwayRole,
  requireTaskAwayUser,
} from "../middlewares/taskawayAuth";

const router: IRouter = Router();

router.post(
  "/jobs/:id/applications",
  requireTaskAwayUser,
  requireTaskAwayRole("candidate"),
  async (req, res, next) => {
    try {
      const params = ApplyToJobParams.safeParse(req.params);
      const input = ApplyToJobBody.safeParse(req.body);
      if (!params.success || !input.success || input.data.consent !== true) {
        res.status(400).json({ error: "Review the application details and consent." });
        return;
      }

      const [job] = await db
        .select({ id: jobsTable.id })
        .from(jobsTable)
        .where(
          and(
            eq(jobsTable.id, params.data.id),
            eq(jobsTable.status, "published"),
            eq(jobsTable.verified, true),
          ),
        )
        .limit(1);

      if (!job) {
        res.status(404).json({ error: "This role is no longer accepting applications." });
        return;
      }

      let portfolioUrl: string | null = null;
      if (input.data.portfolioUrl) {
        try {
          const portfolio = new URL(input.data.portfolioUrl);
          if (
            portfolio.protocol !== "https:" ||
            portfolio.username ||
            portfolio.password
          ) {
            throw new Error("Invalid portfolio URL");
          }
          portfolioUrl = portfolio.toString();
        } catch {
          res.status(400).json({
            error: "Portfolio links must use a secure HTTPS address.",
          });
          return;
        }
      }

      const candidate = req.taskAwayUser!;
      try {
        const [application] = await db
          .insert(applicationsTable)
          .values({
            id: crypto.randomUUID(),
            jobId: job.id,
            candidateId: candidate.clerkId,
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            coverLetter: input.data.coverLetter.trim(),
            portfolioUrl,
          })
          .returning();

        const [details] = await db
          .select({
            id: applicationsTable.id,
            jobId: applicationsTable.jobId,
            jobTitle: jobsTable.title,
            company: jobsTable.company,
            status: applicationsTable.status,
            coverLetter: applicationsTable.coverLetter,
            portfolioUrl: applicationsTable.portfolioUrl,
            createdAt: applicationsTable.createdAt,
          })
          .from(applicationsTable)
          .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
          .where(eq(applicationsTable.id, application.id))
          .limit(1);

        res.status(201).json(ApplyToJobResponse.parse(details));
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          res.status(409).json({
            error: "You have already applied to this role.",
          });
          return;
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/me/applications",
  requireTaskAwayUser,
  requireTaskAwayRole("candidate"),
  async (req, res, next) => {
    try {
      const applications = await db
        .select({
          id: applicationsTable.id,
          jobId: applicationsTable.jobId,
          jobTitle: jobsTable.title,
          company: jobsTable.company,
          status: applicationsTable.status,
          coverLetter: applicationsTable.coverLetter,
          portfolioUrl: applicationsTable.portfolioUrl,
          createdAt: applicationsTable.createdAt,
        })
        .from(applicationsTable)
        .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
        .where(eq(applicationsTable.candidateId, req.taskAwayUser!.clerkId))
        .orderBy(desc(applicationsTable.createdAt));

      res.json(ListMyApplicationsResponse.parse(applications));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/employer/applications",
  requireTaskAwayUser,
  requireTaskAwayRole("employer"),
  async (req, res, next) => {
    try {
      const applications = await db
        .select({
          id: applicationsTable.id,
          jobId: applicationsTable.jobId,
          jobTitle: jobsTable.title,
          company: jobsTable.company,
          status: applicationsTable.status,
          coverLetter: applicationsTable.coverLetter,
          portfolioUrl: applicationsTable.portfolioUrl,
          createdAt: applicationsTable.createdAt,
          candidateName: applicationsTable.candidateName,
          candidateEmail: applicationsTable.candidateEmail,
        })
        .from(applicationsTable)
        .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
        .where(eq(jobsTable.employerId, req.taskAwayUser!.clerkId))
        .orderBy(desc(applicationsTable.createdAt));

      res.json(ListEmployerApplicationsResponse.parse(applications));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/employer/applications/:id",
  requireTaskAwayUser,
  requireTaskAwayRole("employer"),
  async (req, res, next) => {
    try {
      const params = UpdateApplicationStatusParams.safeParse(req.params);
      const input = UpdateApplicationStatusBody.safeParse(req.body);
      if (!params.success || !input.success) {
        res.status(400).json({ error: "Choose a valid application status." });
        return;
      }

      const [ownedApplication] = await db
        .select({
          id: applicationsTable.id,
          status: applicationsTable.status,
        })
        .from(applicationsTable)
        .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
        .where(
          and(
            eq(applicationsTable.id, params.data.id),
            eq(jobsTable.employerId, req.taskAwayUser!.clerkId),
          ),
        )
        .limit(1);

      if (!ownedApplication) {
        res.status(404).json({ error: "Application not found." });
        return;
      }

      if (
        ownedApplication.status === "rejected" ||
        ownedApplication.status === "withdrawn"
      ) {
        res.status(409).json({
          error: "This application is already closed.",
        });
        return;
      }

      await db
        .update(applicationsTable)
        .set({ status: input.data.status, updatedAt: new Date() })
        .where(eq(applicationsTable.id, ownedApplication.id));

      const [updated] = await db
        .select({
          id: applicationsTable.id,
          jobId: applicationsTable.jobId,
          jobTitle: jobsTable.title,
          company: jobsTable.company,
          status: applicationsTable.status,
          coverLetter: applicationsTable.coverLetter,
          portfolioUrl: applicationsTable.portfolioUrl,
          createdAt: applicationsTable.createdAt,
          candidateName: applicationsTable.candidateName,
          candidateEmail: applicationsTable.candidateEmail,
        })
        .from(applicationsTable)
        .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
        .where(eq(applicationsTable.id, ownedApplication.id))
        .limit(1);

      res.json(UpdateApplicationStatusResponse.parse(updated));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
