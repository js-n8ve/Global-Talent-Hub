import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  StartJobCheckoutResponse,
  VerifyJobPaymentResponse,
  StartJobCheckoutParams,
  VerifyJobPaymentParams,
} from "@workspace/api-zod";
import { db, jobsTable } from "@workspace/db";
import {
  requireTaskAwayRole,
  requireTaskAwayUser,
} from "../middlewares/taskawayAuth";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { getWhopClient } from "../lib/whopClient";

const JOB_LISTING_PRICE = 9;
const JOB_LISTING_CURRENCY = "USD";

const router: IRouter = Router();

function configuredPaymentSettings() {
  return Boolean(
    process.env.WHOP_COMPANY_ID?.trim() &&
      process.env.WHOP_PLAN_ID?.trim() &&
      process.env.WHOP_WEBHOOK_SECRET?.trim(),
  );
}

function createReturnUrl(
  req: Request,
  jobId: string,
) {
  const host = getClerkProxyHost(req) ?? req.get("host");
  const forwardedProtocol = req
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol =
    forwardedProtocol === "https" || forwardedProtocol === "http"
      ? forwardedProtocol
      : req.protocol;

  if (!host || (protocol !== "https" && protocol !== "http")) {
    throw new Error("Could not determine the TaskAway return address.");
  }

  const origin = req.get("origin");
  const returnOrigin = origin ? new URL(origin) : new URL(`${protocol}://${host}`);
  if (
    returnOrigin.host.toLowerCase() !== host.toLowerCase() ||
    (returnOrigin.protocol !== "https:" && protocol === "https")
  ) {
    throw new Error("Checkout return address did not match the current app.");
  }

  const returnUrl = new URL("/employer", returnOrigin.origin);
  returnUrl.searchParams.set("payment", "return");
  returnUrl.searchParams.set("jobId", jobId);
  return returnUrl.toString();
}

router.post(
  "/employer/jobs/:id/checkout",
  requireTaskAwayUser,
  requireTaskAwayRole("employer"),
  async (req, res, next) => {
    try {
      const params = StartJobCheckoutParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: "Role not found." });
        return;
      }
      if (!configuredPaymentSettings()) {
        res.status(503).json({
          error: "Employer checkout is not ready yet. Please try again later.",
        });
        return;
      }

      const [job] = await db
        .select()
        .from(jobsTable)
        .where(
          and(
            eq(jobsTable.id, params.data.id),
            eq(jobsTable.employerId, req.taskAwayUser!.clerkId),
          ),
        )
        .limit(1);

      if (!job) {
        res.status(404).json({ error: "Role not found." });
        return;
      }
      if (job.status !== "pending_payment") {
        res.status(409).json({
          error: "This listing is no longer waiting for payment.",
        });
        return;
      }

      if (job.whopCheckoutUrl && job.whopCheckoutConfigId) {
        res.json(
          StartJobCheckoutResponse.parse({
            jobId: job.id,
            checkoutUrl: job.whopCheckoutUrl,
            status: "pending",
            price: JOB_LISTING_PRICE,
            currency: JOB_LISTING_CURRENCY,
          }),
        );
        return;
      }

      const client = await getWhopClient();
      const returnUrl = createReturnUrl(req, job.id);
      const checkout = await client.checkoutConfigurations.create({
        account_id: process.env.WHOP_COMPANY_ID!.trim(),
        variant_id: process.env.WHOP_PLAN_ID!.trim(),
        redirect_url: returnUrl,
        metadata: {
          taskaway_job_id: job.id,
          taskaway_employer_id: job.employerId,
        },
      });

      if (!checkout.id || !checkout.purchase_url) {
        req.log.error(
          { jobId: job.id },
          "Whop did not return a complete checkout configuration",
        );
        res.status(502).json({ error: "Unable to start checkout right now." });
        return;
      }

      const [updated] = await db
        .update(jobsTable)
        .set({
          whopCheckoutConfigId: checkout.id,
          whopCheckoutUrl: checkout.purchase_url,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobsTable.id, job.id),
            eq(jobsTable.employerId, req.taskAwayUser!.clerkId),
            eq(jobsTable.status, "pending_payment"),
          ),
        )
        .returning();

      if (!updated) {
        res.status(409).json({
          error: "This listing changed while checkout was starting.",
        });
        return;
      }

      res.json(
        StartJobCheckoutResponse.parse({
          jobId: job.id,
          checkoutUrl: checkout.purchase_url,
          status: "pending",
          price: JOB_LISTING_PRICE,
          currency: JOB_LISTING_CURRENCY,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Unable to start employer checkout");
      next(error);
    }
  },
);

router.post(
  "/employer/jobs/:id/verify-payment",
  requireTaskAwayUser,
  requireTaskAwayRole("employer"),
  async (req, res, next) => {
    try {
      const params = VerifyJobPaymentParams.safeParse(req.params);
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
            eq(jobsTable.employerId, req.taskAwayUser!.clerkId),
          ),
        )
        .limit(1);

      if (!job) {
        res.status(404).json({ error: "Role not found." });
        return;
      }

      const paid = Boolean(job.paidAt && job.whopPaymentId);
      res.json(
        VerifyJobPaymentResponse.parse({
          paid,
          jobStatus: job.status,
          message: paid
            ? job.status === "pending_review"
              ? "Payment confirmed. Your listing is waiting for review."
              : "Payment confirmed for this listing."
            : "Payment confirmation is still processing. Check again shortly.",
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
