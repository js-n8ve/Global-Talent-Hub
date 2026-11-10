import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateJobBody,
  CreateJobResponse,
  GetJobParams,
  GetJobResponse,
  ListEmployerJobsResponse,
  ListJobsQueryParams,
  ListJobsResponse,
} from "@workspace/api-zod";
import { db, jobsTable } from "@workspace/db";
import { requireTaskAwayRole, requireTaskAwayUser } from "../middlewares/taskawayAuth";

const router: IRouter = Router();

function jobForApi(job: typeof jobsTable.$inferSelect) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    companyWebsite: job.companyWebsite,
    category: job.category,
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    salaryPeriod: job.salaryPeriod,
    timezone: job.timezone,
    description: job.description,
    requirements: job.requirements,
    status: job.status,
    verified: job.verified,
    createdAt: job.createdAt,
    publishedAt: job.publishedAt,
    reviewNote: job.reviewNote,
  };
}

router.get("/jobs", async (req, res, next) => {
  try {
    const parsed = ListJobsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Search filters are not valid." });
      return;
    }

    const filters: SQL[] = [
      eq(jobsTable.status, "published"),
      eq(jobsTable.verified, true),
    ];
    const { q, category, workMode, employmentType } = parsed.data;

    if (category) filters.push(eq(jobsTable.category, category));
    if (workMode) filters.push(eq(jobsTable.workMode, workMode));
    if (employmentType) {
      filters.push(eq(jobsTable.employmentType, employmentType));
    }
    if (q?.trim()) {
      const pattern = `%${q.trim().slice(0, 100)}%`;
      filters.push(
        or(
          ilike(jobsTable.title, pattern),
          ilike(jobsTable.company, pattern),
          ilike(jobsTable.category, pattern),
          ilike(jobsTable.location, pattern),
        )!,
      );
    }

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(and(...filters))
      .orderBy(desc(jobsTable.publishedAt), desc(jobsTable.createdAt))
      .limit(100);

    res.json(ListJobsResponse.parse(jobs.map(jobForApi)));
  } catch (error) {
    next(error);
  }
});

router.get(
  "/employer/jobs",
  requireTaskAwayUser,
  requireTaskAwayRole("employer"),
  async (req, res, next) => {
    try {
      const jobs = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.employerId, req.taskAwayUser!.clerkId))
        .orderBy(desc(jobsTable.createdAt));
      res.json(ListEmployerJobsResponse.parse(jobs.map(jobForApi)));
    } catch (error) {
      next(error);
    }
  },
);

router.get("/jobs/:id", async (req, res, next) => {
  try {
    const params = GetJobParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Role not found." });
      return;
    }

    const [job] = await db
      .select()
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
      res.status(404).json({ error: "Role not found." });
      return;
    }

    res.json(GetJobResponse.parse(jobForApi(job)));
  } catch (error) {
    next(error);
  }
});

router.post(
  "/jobs",
  requireTaskAwayUser,
  requireTaskAwayRole("employer"),
  async (req, res, next) => {
    try {
      const parsed = CreateJobBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Review the listing details and try again." });
        return;
      }

      const input = parsed.data;
      if (input.salaryMax < input.salaryMin) {
        res.status(400).json({ error: "The maximum salary must exceed the minimum." });
        return;
      }

      let companyWebsite: string | null = null;
      if (input.companyWebsite) {
        try {
          const website = new URL(input.companyWebsite);
          if (
            website.protocol !== "https:" ||
            website.username ||
            website.password
          ) {
            throw new Error("Invalid company website");
          }
          companyWebsite = website.toString();
        } catch {
          res.status(400).json({
            error: "Company websites must use a secure HTTPS address.",
          });
          return;
        }
      }

      const [job] = await db
        .insert(jobsTable)
        .values({
          id: crypto.randomUUID(),
          employerId: req.taskAwayUser!.clerkId,
          title: input.title.trim(),
          company: input.company.trim(),
          companyWebsite,
          category: input.category.trim(),
          location: input.location.trim(),
          workMode: input.workMode,
          employmentType: input.employmentType,
          salaryMin: input.salaryMin,
          salaryMax: input.salaryMax,
          currency: input.currency.toUpperCase(),
          salaryPeriod: input.salaryPeriod,
          timezone: input.timezone.trim() || "Any timezone",
          description: input.description.trim(),
          requirements: input.requirements.map((item) => item.trim()),
        })
        .returning();

      res.status(201).json(CreateJobResponse.parse(jobForApi(job)));
    } catch (error) {
      next(error);
    }
  },
);

export { jobForApi };
export default router;
