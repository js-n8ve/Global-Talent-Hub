import { clerkClient, getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import {
  db,
  usersTable,
  type TaskAwayRole,
  type User,
} from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      taskAwayUser?: User;
    }
  }
}

export const requireTaskAwayUser: RequestHandler = async (req, res, next) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }

    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId))
      .limit(1);

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const primaryEmail =
        clerkUser.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId,
        ) ?? clerkUser.emailAddresses[0];

      if (
        !primaryEmail?.emailAddress ||
        primaryEmail.verification?.status !== "verified"
      ) {
        res.status(403).json({
          error: "Verify your email address before continuing.",
        });
        return;
      }

      const email = primaryEmail.emailAddress.trim().toLowerCase();
      const configuredAdminEmail = process.env.TASKAWAY_ADMIN_EMAIL
        ?.trim()
        .toLowerCase();
      const name =
        clerkUser.fullName?.trim() ||
        clerkUser.username?.trim() ||
        email.split("@")[0];

      await db
        .insert(usersTable)
        .values({
          clerkId,
          email,
          name,
          role: configuredAdminEmail === email ? "admin" : "candidate",
        })
        .onConflictDoNothing();

      [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.clerkId, clerkId))
        .limit(1);

      if (!user) {
        res.status(500).json({ error: "Unable to create your account." });
        return;
      }
    }

    const configuredAdminEmail = process.env.TASKAWAY_ADMIN_EMAIL
      ?.trim()
      .toLowerCase();
    const shouldBeAdmin =
      Boolean(configuredAdminEmail) &&
      user.email.trim().toLowerCase() === configuredAdminEmail;

    if (
      (shouldBeAdmin && user.role !== "admin") ||
      (!shouldBeAdmin && user.role === "admin")
    ) {
      const nextRole: TaskAwayRole = shouldBeAdmin ? "admin" : "candidate";
      [user] = await db
        .update(usersTable)
        .set({ role: nextRole, updatedAt: new Date() })
        .where(eq(usersTable.clerkId, clerkId))
        .returning();
    }

    req.taskAwayUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

export function requireTaskAwayRole(
  ...allowedRoles: TaskAwayRole[]
): RequestHandler {
  return (req, res, next) => {
    if (!req.taskAwayUser || !allowedRoles.includes(req.taskAwayUser.role)) {
      res.status(403).json({ error: "You do not have access to this action." });
      return;
    }
    next();
  };
}

export function profileFor(user: User) {
  return {
    id: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
