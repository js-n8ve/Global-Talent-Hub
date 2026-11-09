import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { usersTable } from "./users";

export type ApplicationStatus =
  | "submitted"
  | "in_review"
  | "shortlisted"
  | "rejected"
  | "withdrawn";

export const applicationsTable = pgTable(
  "taskaway_applications",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => usersTable.clerkId, { onDelete: "cascade" }),
    candidateName: text("candidate_name").notNull(),
    candidateEmail: text("candidate_email").notNull(),
    coverLetter: text("cover_letter").notNull().default(""),
    portfolioUrl: text("portfolio_url"),
    status: text("status")
      .$type<ApplicationStatus>()
      .notNull()
      .default("submitted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("taskaway_applications_job_candidate_unique").on(
      table.jobId,
      table.candidateId,
    ),
    index("taskaway_applications_candidate_created_idx").on(
      table.candidateId,
      table.createdAt,
    ),
  ],
);

export type Application = typeof applicationsTable.$inferSelect;
