import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { db, jobsTable } from "@workspace/db";

type WhopPaymentWebhook = {
  type: string;
  account_id?: string;
  company_id?: string;
  data: {
    id?: string;
    account_id?: string;
    company_id?: string;
    checkout_configuration_id?: string | null;
    amount?: string | number;
    currency?: string;
    status?: string;
  };
};

const router: IRouter = Router();

router.post("/", async (req, res) => {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    res.status(503).send("Webhook is not configured.");
    return;
  }
  if (!Buffer.isBuffer(req.body)) {
    res.status(400).send("Expected the raw webhook body.");
    return;
  }

  try {
    const event = unwrapWebhook<WhopPaymentWebhook>(req.body.toString("utf8"), {
      headers: {
        "webhook-id": req.get("webhook-id") ?? "",
        "webhook-timestamp": req.get("webhook-timestamp") ?? "",
        "webhook-signature": req.get("webhook-signature") ?? "",
        "content-type": req.get("content-type") ?? "",
      },
      key: secret,
    });

    if (event.type !== "payment.succeeded") {
      res.sendStatus(204);
      return;
    }

    const payment = event.data;
    const expectedAccountId = process.env.WHOP_COMPANY_ID?.trim();
    const accountId =
      payment.account_id ??
      payment.company_id ??
      event.account_id ??
      event.company_id;
    const amount = Number(payment.amount);

    if (
      !expectedAccountId ||
      !accountId ||
      accountId !== expectedAccountId ||
      !payment.id ||
      !payment.checkout_configuration_id ||
      !Number.isFinite(amount) ||
      amount.toFixed(2) !== JOB_LISTING_PRICE.toFixed(2) ||
      payment.currency?.toLowerCase() !== "usd" ||
      (payment.status && payment.status !== "succeeded")
    ) {
      req.log.warn(
        {
          paymentId: payment.id,
          checkoutConfigurationId: payment.checkout_configuration_id,
        },
        "Ignoring Whop payment that does not match the TaskAway listing charge",
      );
      res.sendStatus(204);
      return;
    }

    const [job] = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.whopCheckoutConfigId, payment.checkout_configuration_id),
          eq(jobsTable.status, "pending_payment"),
        ),
      )
      .limit(1);

    if (job) {
      await db
        .update(jobsTable)
        .set({
          status: "pending_review",
          verified: false,
          whopPaymentId: payment.id,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobsTable.id, job.id),
            eq(jobsTable.whopCheckoutConfigId, payment.checkout_configuration_id),
            eq(jobsTable.status, "pending_payment"),
          ),
        );
    }

    res.sendStatus(204);
  } catch (error) {
    req.log.warn({ err: error }, "Rejected invalid Whop webhook");
    res.status(400).send("Invalid webhook signature or payload.");
  }
});

const JOB_LISTING_PRICE = 9;

export default router;
