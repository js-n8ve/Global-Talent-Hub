import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type TaskAwayRole = "candidate" | "employer" | "admin";

export const usersTable = pgTable("taskaway_users", {
  clerkId: text("clerk_id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").$type<TaskAwayRole>().notNull().default("candidate"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof usersTable.$inferSelect;
