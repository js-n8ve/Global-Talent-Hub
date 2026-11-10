import { useState } from "react";
import {
  getListJobsForReviewQueryKey,
  useListJobsForReview,
  useReviewJob,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, RotateCcw, X } from "lucide-react";
import RoleGate from "../components/RoleGate";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SiteFooter,
  SiteHeader,
} from "../components/SiteChrome";

type ReviewJob = {
  id: string;
  title: string;
  company: string;
  companyWebsite: string | null;
  category: string;
  location: string;
  workMode: string;
  employmentType: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  salaryPeriod: string;
  timezone: string;
  description: string;
  requirements: string[];
  createdAt: string | Date;
  status: string;
  reviewNote: string | null;
};

function salaryRange(job: ReviewJob) {
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

export default function AdminDashboard() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const queryClient = useQueryClient();
  const jobsQuery = useListJobsForReview({
    query: { retry: false },
  });
  const reviewMutation = useReviewJob();
  const jobs = (jobsQuery.data ?? []) as ReviewJob[];

  const review = async (id: string, decision: "approve" | "reject") => {
    setNotice("");
    setError(false);
    if (decision === "reject" && !notes[id]?.trim()) {
      setNotice("Add a short reason before rejecting this listing.");
      setError(true);
      return;
    }
    try {
      await reviewMutation.mutateAsync({
        id,
        data: {
          decision,
          note: notes[id]?.trim() || undefined,
        },
      });
      setNotice(
        decision === "approve"
          ? "Listing approved and published."
          : "Listing rejected. The employer can see the review note.",
      );
      await queryClient.invalidateQueries({
        queryKey: getListJobsForReviewQueryKey(),
      });
    } catch {
      setNotice("We couldn’t save the review decision. Please try again.");
      setError(true);
    }
  };

  return (
    <RoleGate role="admin">
      <SiteHeader />
      <main className="page-wrap">
        <div className="page-heading">
          <div>
            <p className="section-kicker">TaskAway administration</p>
            <h1>Review paid listings.</h1>
            <p>
              Confirm role details before they become visible to candidates.
              Only verified paid listings appear on the public board.
            </p>
          </div>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: getListJobsForReviewQueryKey(),
              })
            }
          >
            <RotateCcw size={13} /> Refresh queue
          </button>
        </div>
        <div className="metrics">
          <div className="metric">
            <small>Awaiting review</small>
            <strong>{jobs.length}</strong>
          </div>
          <div className="metric">
            <small>Required before publish</small>
            <strong>Paid + reviewed</strong>
          </div>
          <div className="metric">
            <small>Employer fee</small>
            <strong>$9 USD</strong>
          </div>
        </div>

        {notice && (
          <div
            className={`notice admin-notice ${error ? "error" : ""}`}
            role={error ? "alert" : "status"}
          >
            {notice}
          </div>
        )}

        <section className="workspace-main admin-review-list">
          {jobsQuery.isLoading ? (
            <LoadingState label="Loading paid listings…" />
          ) : jobsQuery.isError ? (
            <ErrorState
              title="Review queue is unavailable"
              message="Refresh to try again."
              onRetry={() =>
                queryClient.invalidateQueries({
                  queryKey: getListJobsForReviewQueryKey(),
                })
              }
            />
          ) : jobs.length ? (
            jobs.map((job) => (
              <article
                className="panel-card review-card"
                key={job.id}
                data-testid={`review-job-${job.id}`}
              >
                <div className="review-card-head">
                  <div>
                    <p className="section-kicker">{job.category}</p>
                    <h2>{job.title}</h2>
                    <p className="review-byline">
                      {job.company} · {job.location}
                      {job.companyWebsite && (
                        <>
                          {" · "}
                          <a
                            href={job.companyWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Company website
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="status-pill pending_review">
                    Paid · needs review
                  </span>
                </div>
                <div className="job-meta">
                  <span>{salaryRange(job)}</span>
                  <span>{job.workMode}</span>
                  <span>{job.employmentType}</span>
                  <span>{job.timezone}</span>
                </div>
                <section className="detail-panel review-description">
                  <h3>Role description</h3>
                  <p>{job.description}</p>
                  <h3>Requirements</h3>
                  <ul>
                    {job.requirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <div className="review-controls">
                  <div className="field">
                    <label htmlFor={`review-note-${job.id}`}>
                      Review note (required to reject)
                    </label>
                    <textarea
                      id={`review-note-${job.id}`}
                      rows={2}
                      maxLength={1000}
                      value={notes[job.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [job.id]: event.target.value,
                        }))
                      }
                      placeholder="Explain any changes the employer needs to make."
                    />
                  </div>
                  <div className="inline-actions">
                    <button
                      className="btn btn-accent"
                      type="button"
                      disabled={reviewMutation.isPending}
                      onClick={() => void review(job.id, "approve")}
                      data-testid={`button-approve-${job.id}`}
                    >
                      <Check size={13} /> Approve and publish
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      disabled={reviewMutation.isPending}
                      onClick={() => void review(job.id, "reject")}
                      data-testid={`button-reject-${job.id}`}
                    >
                      <X size={13} /> Reject listing
                    </button>
                  </div>
                </div>
                <p className="review-trust">
                  <BadgeCheck size={13} /> Checkout is confirmed by a signed
                  Whop payment event before this listing reaches the queue.
                </p>
              </article>
            ))
          ) : (
            <EmptyState
              title="No paid listings need review."
              message="New employer listings will appear here after payment is verified."
            />
          )}
        </section>
      </main>
      <SiteFooter />
    </RoleGate>
  );
}
