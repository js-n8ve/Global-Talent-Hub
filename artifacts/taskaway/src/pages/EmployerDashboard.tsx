import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  getListEmployerApplicationsQueryKey,
  getListEmployerJobsQueryKey,
  useCreateJob,
  useListEmployerApplications,
  useListEmployerJobs,
  useStartJobCheckout,
  useUpdateApplicationStatus,
  useVerifyJobPayment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import RoleGate from "../components/RoleGate";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SiteFooter,
  SiteHeader,
} from "../components/SiteChrome";

type JobRecord = {
  id: string;
  title: string;
  company: string;
  category: string;
  location: string;
  workMode: string;
  employmentType: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  salaryPeriod: string;
  status: string;
  verified: boolean;
  createdAt: string | Date;
  publishedAt: string | Date | null;
  reviewNote: string | null;
};
type EmployerApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: "submitted" | "in_review" | "shortlisted" | "rejected" | "withdrawn";
  coverLetter: string;
  portfolioUrl: string | null;
  createdAt: string | Date;
  candidateName: string;
  candidateEmail: string;
};

const categories = [
  "Engineering",
  "Design & Product",
  "Operations",
  "Finance",
  "Sales & Marketing",
  "Customer Success",
  "People & HR",
  "Other",
];

const initialForm = {
  title: "",
  company: "",
  companyWebsite: "",
  category: "Engineering",
  location: "",
  workMode: "Remote",
  employmentType: "Full-time",
  salaryMin: "",
  salaryMax: "",
  currency: "USD",
  salaryPeriod: "year",
  timezone: "Any timezone",
  description: "",
  requirements: "",
};

function isWhopCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "whop.com" || url.hostname.endsWith(".whop.com"))
    );
  } catch {
    return false;
  }
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently created"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function formatSalary(job: JobRecord) {
  const compact = (value: number) =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : value.toLocaleString();
  const period =
    job.salaryPeriod === "year"
      ? "yr"
      : job.salaryPeriod === "month"
        ? "mo"
        : "hr";
  return `${job.currency} ${compact(job.salaryMin)}–${compact(job.salaryMax)} / ${period}`;
}

function readableStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function EmployerDashboard() {
  const [form, setForm] = useState(initialForm);
  const [activeTab, setActiveTab] = useState<"listings" | "applications">(
    "listings",
  );
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const returnHandled = useRef(false);

  const jobsQuery = useListEmployerJobs({
    query: { enabled: activeTab === "listings", retry: false },
  });
  const applicationsQuery = useListEmployerApplications({
    query: { enabled: activeTab === "applications", retry: false },
  });
  const createJob = useCreateJob();
  const startCheckout = useStartJobCheckout();
  const verifyPayment = useVerifyJobPayment();
  const updateApplication = useUpdateApplicationStatus();
  const jobs = (jobsQuery.data ?? []) as JobRecord[];
  const applications = (applicationsQuery.data ?? []) as EmployerApplication[];
  const publishedCount = useMemo(
    () => jobs.filter((job) => job.status === "published").length,
    [jobs],
  );
  const pendingCount = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status === "pending_payment" || job.status === "pending_review",
      ).length,
    [jobs],
  );
  const returnParams = new URLSearchParams(window.location.search);
  const returnJobId =
    returnParams.get("payment") === "return"
      ? returnParams.get("jobId")
      : null;

  useEffect(() => {
    if (!returnJobId || returnHandled.current) return;
    returnHandled.current = true;
    setActiveTab("listings");
    setNotice("Checking your payment with Whop…");
    setNoticeError(false);
    void verifyPayment
      .mutateAsync({ id: returnJobId })
      .then((result) => {
        setNotice(result.message);
        setNoticeError(!result.paid);
        return queryClient.invalidateQueries({
          queryKey: getListEmployerJobsQueryKey(),
        });
      })
      .catch(() => {
        setNotice(
          "We could not confirm the payment yet. Check again in a moment.",
        );
        setNoticeError(true);
      });
  }, [returnJobId, verifyPayment.mutateAsync, queryClient]);

  const invalidateEmployerData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListEmployerJobsQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListEmployerApplicationsQueryKey(),
      }),
    ]);
  };

  const beginCheckout = async (jobId: string) => {
    setNotice("");
    setNoticeError(false);
    try {
      const checkout = await startCheckout.mutateAsync({ id: jobId });
      if (!isWhopCheckoutUrl(checkout.checkoutUrl)) {
        setNotice("The payment provider returned an invalid checkout address.");
        setNoticeError(true);
        return;
      }
      window.location.assign(checkout.checkoutUrl);
    } catch {
      setNotice(
        "This listing is saved, but checkout is not available yet. Please try again after payment setup is complete.",
      );
      setNoticeError(true);
      await invalidateEmployerData();
    }
  };

  const submitListing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    setNoticeError(false);
    const minimum = Number(form.salaryMin);
    const maximum = Number(form.salaryMax);
    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum < minimum
    ) {
      setNotice("Enter a valid salary range.");
      setNoticeError(true);
      return;
    }

    const requirements = form.requirements
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!requirements.length) {
      setNotice("Add at least one role requirement.");
      setNoticeError(true);
      return;
    }

    setSubmitting(true);
    try {
      const job = await createJob.mutateAsync({
        data: {
          title: form.title.trim(),
          company: form.company.trim(),
          companyWebsite: form.companyWebsite.trim() || null,
          category: form.category,
          location: form.location.trim(),
          workMode: form.workMode as "Remote" | "Hybrid" | "On-site",
          employmentType: form.employmentType as
            | "Full-time"
            | "Contract"
            | "Part-time",
          salaryMin: minimum,
          salaryMax: maximum,
          currency: form.currency,
          salaryPeriod: form.salaryPeriod as "year" | "month" | "hour",
          timezone: form.timezone.trim() || "Any timezone",
          description: form.description.trim(),
          requirements,
        },
      });
      await invalidateEmployerData();
      setForm(initialForm);
      await beginCheckout(job.id);
    } catch {
      setNotice(
        "We couldn’t save this listing. Check the required details and try again.",
      );
      setNoticeError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const checkPayment = async (jobId: string) => {
    setNotice("");
    setNoticeError(false);
    try {
      const result = await verifyPayment.mutateAsync({ id: jobId });
      setNotice(result.message);
      setNoticeError(!result.paid);
      await invalidateEmployerData();
    } catch {
      setNotice("We couldn’t check the payment status. Please try again.");
      setNoticeError(true);
    }
  };

  const changeApplicationStatus = async (
    applicationId: string,
    status: "in_review" | "shortlisted" | "rejected",
  ) => {
    try {
      await updateApplication.mutateAsync({
        id: applicationId,
        data: { status },
      });
      setNotice("Application status updated.");
      setNoticeError(false);
      await invalidateEmployerData();
    } catch {
      setNotice("We couldn’t update this application. Please try again.");
      setNoticeError(true);
    }
  };

  return (
    <RoleGate role="employer">
      <SiteHeader />
      <main className="page-wrap">
        <div className="page-heading">
          <div>
            <p className="section-kicker">Employer workspace</p>
            <h1>Build your team across borders.</h1>
            <p>
              Publish clear roles, review candidate applications and keep your
              hiring moving.
            </p>
          </div>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => void invalidateEmployerData()}
          >
            <RotateCcw size={13} /> Refresh
          </button>
        </div>

        <div className="metrics">
          <div className="metric">
            <small>Live roles</small>
            <strong>{publishedCount}</strong>
          </div>
          <div className="metric">
            <small>In progress</small>
            <strong>{pendingCount}</strong>
          </div>
          <div className="metric">
            <small>Applications</small>
            <strong>{applications.length}</strong>
          </div>
        </div>

        <div className="workspace employer-workspace">
          <nav className="workspace-nav" aria-label="Employer sections">
            <button
              className={activeTab === "listings" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("listings")}
              data-testid="tab-employer-listings"
            >
              <BriefcaseBusiness size={14} /> My listings
            </button>
            <button
              className={activeTab === "applications" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("applications")}
              data-testid="tab-employer-applications"
            >
              <CircleDollarSign size={14} /> Applications
              <span className="tab-count">{applications.length}</span>
            </button>
          </nav>

          <section className="workspace-main">
            {notice && (
              <div
                className={`notice ${noticeError ? "error" : ""}`}
                role={noticeError ? "alert" : "status"}
                data-testid="employer-notice"
              >
                {notice}
              </div>
            )}

            {activeTab === "listings" ? (
              <>
                <div className="panel-card pricing-panel">
                  <div className="pricing-symbol">
                    <CircleDollarSign size={18} />
                  </div>
                  <div>
                    <strong>$9 USD per listing</strong>
                    <p>One-time fee. No charge for candidates to apply.</p>
                  </div>
                  <span className="pricing-note">
                    Payment confirmed before review
                  </span>
                </div>

                <form
                  className="post-form employer-form"
                  onSubmit={submitListing}
                  data-testid="form-submit-role"
                >
                  <div>
                    <p className="section-kicker">Create a listing</p>
                    <h2>Make the role clear.</h2>
                    <p>
                      Paid listings enter review before they appear on the
                      public board.
                    </p>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="post-title">Role title</label>
                      <input
                        id="post-title"
                        required
                        maxLength={100}
                        value={form.title}
                        onChange={(event) =>
                          setForm({ ...form, title: event.target.value })
                        }
                        placeholder="e.g. Regional Finance Manager"
                        data-testid="input-role-title"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="post-company">Company</label>
                      <input
                        id="post-company"
                        required
                        maxLength={100}
                        value={form.company}
                        onChange={(event) =>
                          setForm({ ...form, company: event.target.value })
                        }
                        placeholder="Your organization"
                        data-testid="input-role-company"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="post-company-site">
                        Company website (optional)
                      </label>
                      <input
                        id="post-company-site"
                        type="url"
                        value={form.companyWebsite}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            companyWebsite: event.target.value,
                          })
                        }
                        placeholder="https://company.com"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="post-category">Job family</label>
                      <select
                        id="post-category"
                        value={form.category}
                        onChange={(event) =>
                          setForm({ ...form, category: event.target.value })
                        }
                      >
                        {categories.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="post-location">Location</label>
                      <input
                        id="post-location"
                        required
                        maxLength={100}
                        value={form.location}
                        onChange={(event) =>
                          setForm({ ...form, location: event.target.value })
                        }
                        placeholder="City, country or region"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="post-mode">Work style</label>
                      <select
                        id="post-mode"
                        value={form.workMode}
                        onChange={(event) =>
                          setForm({ ...form, workMode: event.target.value })
                        }
                      >
                        <option>Remote</option>
                        <option>Hybrid</option>
                        <option>On-site</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="post-type">Employment type</label>
                      <select
                        id="post-type"
                        value={form.employmentType}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            employmentType: event.target.value,
                          })
                        }
                      >
                        <option>Full-time</option>
                        <option>Contract</option>
                        <option>Part-time</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="post-min">Salary from</label>
                      <input
                        id="post-min"
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={form.salaryMin}
                        onChange={(event) =>
                          setForm({ ...form, salaryMin: event.target.value })
                        }
                        placeholder="65000"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="post-max">Salary to</label>
                      <input
                        id="post-max"
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={form.salaryMax}
                        onChange={(event) =>
                          setForm({ ...form, salaryMax: event.target.value })
                        }
                        placeholder="85000"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="post-currency">Salary currency</label>
                      <select
                        id="post-currency"
                        value={form.currency}
                        onChange={(event) =>
                          setForm({ ...form, currency: event.target.value })
                        }
                      >
                        <option>USD</option>
                        <option>EUR</option>
                        <option>GBP</option>
                        <option>NGN</option>
                        <option>KES</option>
                        <option>ZAR</option>
                        <option>GHS</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="post-period">Pay period</label>
                      <select
                        id="post-period"
                        value={form.salaryPeriod}
                        onChange={(event) =>
                          setForm({ ...form, salaryPeriod: event.target.value })
                        }
                      >
                        <option value="year">Per year</option>
                        <option value="month">Per month</option>
                        <option value="hour">Per hour</option>
                      </select>
                    </div>
                    <div className="field full-field">
                      <label htmlFor="post-timezone">
                        Team timezone or overlap
                      </label>
                      <input
                        id="post-timezone"
                        maxLength={80}
                        value={form.timezone}
                        onChange={(event) =>
                          setForm({ ...form, timezone: event.target.value })
                        }
                        placeholder="e.g. UTC−5 to UTC+3"
                      />
                    </div>
                    <div className="field full-field">
                      <label htmlFor="post-description">Role description</label>
                      <textarea
                        id="post-description"
                        required
                        minLength={20}
                        maxLength={5000}
                        rows={5}
                        value={form.description}
                        onChange={(event) =>
                          setForm({ ...form, description: event.target.value })
                        }
                        placeholder="Describe the work, team and impact."
                        data-testid="textarea-role-description"
                      />
                    </div>
                    <div className="field full-field">
                      <label htmlFor="post-requirements">
                        Requirements (one per line)
                      </label>
                      <textarea
                        id="post-requirements"
                        required
                        rows={4}
                        value={form.requirements}
                        onChange={(event) =>
                          setForm({ ...form, requirements: event.target.value })
                        }
                        placeholder={
                          "Relevant experience\nKey skills\nTimezone or work authorization details"
                        }
                      />
                    </div>
                  </div>
                  <div className="listing-submit-row">
                    <p>
                      <Check size={13} /> $9 USD one-time listing fee
                    </p>
                    <button
                      className="btn btn-accent"
                      type="submit"
                      disabled={
                        submitting ||
                        createJob.isPending ||
                        startCheckout.isPending
                      }
                      data-testid="button-submit-role"
                    >
                      {submitting || createJob.isPending
                        ? "Saving listing…"
                        : "Continue to checkout"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </form>

                <div className="panel-head">
                  <div>
                    <h2>Your listings</h2>
                    <p>Payment and review status for roles you created.</p>
                  </div>
                  <span className="head-count">{jobs.length} total</span>
                </div>
                {jobsQuery.isLoading ? (
                  <LoadingState label="Loading your listings…" />
                ) : jobsQuery.isError ? (
                  <ErrorState
                    title="Listings are temporarily unavailable"
                    message="Your listings are still saved. Refresh to try again."
                    onRetry={() => void jobsQuery.refetch()}
                  />
                ) : jobs.length ? (
                  <div className="panel-card">
                    {jobs.map((job) => (
                      <article
                        className="item-row"
                        key={job.id}
                        data-testid={`employer-job-${job.id}`}
                      >
                        <div className="item-primary">
                          <strong>{job.title}</strong>
                          <p>
                            {job.company} · {job.location} · {formatSalary(job)}
                          </p>
                          <p>
                            Created {formatDate(job.createdAt)}
                            {job.publishedAt
                              ? ` · Live since ${formatDate(job.publishedAt)}`
                              : ""}
                          </p>
                          {job.reviewNote && (
                            <p className="review-note">{job.reviewNote}</p>
                          )}
                          {job.status === "pending_payment" && (
                            <div className="inline-actions">
                              <button
                                className="btn btn-accent"
                                type="button"
                                disabled={startCheckout.isPending}
                                onClick={() => void beginCheckout(job.id)}
                              >
                                Pay $9 and continue <ArrowUpRight size={12} />
                              </button>
                              <button
                                className="btn btn-outline"
                                type="button"
                                onClick={() => void checkPayment(job.id)}
                              >
                                Check payment
                              </button>
                            </div>
                          )}
                        </div>
                        <span className={`status-pill ${job.status}`}>
                          {readableStatus(job.status)}
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No listings yet."
                    message="Create a role above. It becomes public only after payment is confirmed and TaskAway approves it."
                  />
                )}
              </>
            ) : (
              <>
                <div className="panel-head">
                  <div>
                    <h2>Candidate applications</h2>
                    <p>
                      Review applicants and update their status from your
                      workspace.
                    </p>
                  </div>
                  <span className="head-count">
                    {applications.length} total
                  </span>
                </div>
                {applicationsQuery.isLoading ? (
                  <LoadingState label="Loading candidate applications…" />
                ) : applicationsQuery.isError ? (
                  <ErrorState
                    title="Applications are temporarily unavailable"
                    message="Refresh to try again."
                    onRetry={() =>
                      void queryClient.invalidateQueries({
                        queryKey: getListEmployerApplicationsQueryKey(),
                      })
                    }
                  />
                ) : applications.length ? (
                  <div className="panel-card">
                    {applications.map((application) => (
                      <article
                        className="employer-application"
                        key={application.id}
                        data-testid={`employer-application-${application.id}`}
                      >
                        <div className="item-row">
                          <div className="item-primary">
                            <strong>{application.candidateName}</strong>
                            <p>
                              {application.jobTitle} ·{" "}
                              {formatDate(application.createdAt)}
                            </p>
                            <a
                              className="candidate-email"
                              href={`mailto:${application.candidateEmail}`}
                            >
                              {application.candidateEmail}
                              <ExternalLink size={11} />
                            </a>
                          </div>
                          <span
                            className={`status-pill ${application.status}`}
                          >
                            {readableStatus(application.status)}
                          </span>
                        </div>
                        <p className="application-message">
                          {application.coverLetter}
                        </p>
                        {application.portfolioUrl && (
                          <a
                            className="portfolio-link"
                            href={application.portfolioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Portfolio or profile <ArrowUpRight size={12} />
                          </a>
                        )}
                        {application.status !== "rejected" &&
                          application.status !== "withdrawn" && (
                            <div className="inline-actions">
                              {application.status === "submitted" && (
                                <button
                                  className="btn btn-outline"
                                  type="button"
                                  disabled={updateApplication.isPending}
                                  onClick={() =>
                                    void changeApplicationStatus(
                                      application.id,
                                      "in_review",
                                    )
                                  }
                                >
                                  Mark in review
                                </button>
                              )}
                              {application.status !== "shortlisted" && (
                                <button
                                  className="btn btn-accent"
                                  type="button"
                                  disabled={updateApplication.isPending}
                                  onClick={() =>
                                    void changeApplicationStatus(
                                      application.id,
                                      "shortlisted",
                                    )
                                  }
                                >
                                  Shortlist
                                </button>
                              )}
                              <button
                                className="btn btn-danger"
                                type="button"
                                disabled={updateApplication.isPending}
                                onClick={() =>
                                  void changeApplicationStatus(
                                    application.id,
                                    "rejected",
                                  )
                                }
                              >
                                Close application
                              </button>
                            </div>
                          )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No applications yet."
                    message="Candidate applications to your published roles will appear here."
                  />
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </RoleGate>
  );
}
