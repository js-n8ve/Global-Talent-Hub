import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetMyProfileResponse,
  SetMyRoleBody,
  SetMyRoleResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { profileFor, requireTaskAwayUser } from "../middlewares/taskawayAuth";

const router: IRouter = Router();

router.get("/me", requireTaskAwayUser, (req, res) => {
  res.json(GetMyProfileResponse.parse(profileFor(req.taskAwayUser!)));
});

router.patch("/me/role", requireTaskAwayUser, async (req, res, next) => {
  try {
    const input = SetMyRoleBody.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Choose a valid account type." });
      return;
    }

    const user = req.taskAwayUser!;
    if (user.role === "admin") {
      res.json(SetMyRoleResponse.parse(profileFor(user)));
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ role: input.data.role, updatedAt: new Date() })
      .where(and(eq(usersTable.clerkId, user.clerkId), eq(usersTable.role, user.role)))
      .returning();

    res.json(SetMyRoleResponse.parse(profileFor(updated ?? user)));
  } catch (error) {
    next(error);
  }
});

export default router;
