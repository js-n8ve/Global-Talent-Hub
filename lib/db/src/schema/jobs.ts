import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type JobWorkMode = "Remote" | "Hybrid" | "On-site";
export type JobEmploymentType = "Full-time" | "Contract" | "Part-time";
export type JobSalaryPeriod = "year" | "month" | "hour";
export type JobStatus =
  | "pending_payment"
  | "pending_review"
  | "published"
  | "rejected"
  | "expired";

export const jobsTable = pgTable(
  "taskaway_jobs",
  {
    id: text("id").primaryKey(),
    employerId: text("employer_id")
      .notNull()
      .references(() => usersTable.clerkId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    company: text("company").notNull(),
    companyWebsite: text("company_website"),
    category: text("category").notNull(),
    location: text("location").notNull(),
    workMode: text("work_mode").$type<JobWorkMode>().notNull(),
    employmentType: text("employment_type")
      .$type<JobEmploymentType>()
      .notNull(),
    salaryMin: numeric("salary_min", { precision: 14, scale: 2, mode: "number" })
      .notNull(),
    salaryMax: numeric("salary_max", { precision: 14, scale: 2, mode: "number" })
      .notNull(),
    currency: text("currency").notNull(),
    salaryPeriod: text("salary_period").$type<JobSalaryPeriod>().notNull(),
    timezone: text("timezone").notNull(),
    description: text("description").notNull(),
    requirements: jsonb("requirements")
      .$type<string[]>()
      .notNull()
      .default([]),
    status: text("status").$type<JobStatus>().notNull().default("pending_payment"),
    verified: boolean("verified").notNull().default(false),
    reviewNote: text("review_note"),
    whopCheckoutConfigId: text("whop_checkout_config_id"),
    whopPaymentId: text("whop_payment_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("taskaway_jobs_status_created_idx").on(table.status, table.createdAt),
    index("taskaway_jobs_employer_created_idx").on(
      table.employerId,
      table.createdAt,
    ),
  ],
);

export type Job = typeof jobsTable.$inferSelect;
