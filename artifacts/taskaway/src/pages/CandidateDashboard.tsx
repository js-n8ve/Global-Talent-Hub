import { useMemo, useState } from "react";
import {
  getListMyApplicationsQueryKey,
  useListJobs,
  useListMyApplications,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BookmarkCheck, BriefcaseBusiness, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import RoleGate from "../components/RoleGate";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SiteFooter,
  SiteHeader,
} from "../components/SiteChrome";
import { useTaskAwayProfile } from "../App";

type CandidateApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: string;
  coverLetter: string;
  portfolioUrl: string | null;
  createdAt: string | Date;
};
type SavedRole = {
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
};

function readSavedIds() {
  try {
    const value = JSON.parse(
      localStorage.getItem("taskaway-saved-roles") ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently submitted"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function formatSalary(role: SavedRole) {
  const compact = (value: number) =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : value.toLocaleString();
  const period =
    role.salaryPeriod === "year"
      ? "yr"
      : role.salaryPeriod === "month"
        ? "mo"
        : "hr";
  return `${role.currency} ${compact(role.salaryMin)}–${compact(role.salaryMax)} / ${period}`;
}

export default function CandidateDashboard() {
  const { isSignedIn } = useTaskAwayProfile();
  const [tab, setTab] = useState<"applications" | "saved">("applications");
  const [savedIds, setSavedIds] = useState<string[]>(readSavedIds);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const applicationsQuery = useListMyApplications({
    query: { enabled: isSignedIn, retry: false },
  });
  const savedJobsQuery = useListJobs({
    query: { enabled: tab === "saved" && savedIds.length > 0 },
  });

  const applications = (applicationsQuery.data ?? []) as CandidateApplication[];
  const savedRoles = useMemo(() => {
    const live = (savedJobsQuery.data ?? []) as SavedRole[];
    return live.filter((role) => savedIds.includes(role.id));
  }, [savedJobsQuery.data, savedIds]);

  const removeSavedRole = (id: string) => {
    const next = savedIds.filter((savedId) => savedId !== id);
    setSavedIds(next);
    localStorage.setItem("taskaway-saved-roles", JSON.stringify(next));
  };

  const refreshApplications = () =>
    queryClient.invalidateQueries({
      queryKey: getListMyApplicationsQueryKey(),
    });

  return (
    <RoleGate role="candidate">
      <SiteHeader />
      <main className="page-wrap">
        <div className="page-heading">
          <div>
            <p className="section-kicker">Candidate workspace</p>
            <h1>Your next move, in view.</h1>
            <p>
              Track applications you sent through TaskAway and keep good roles
              close.
            </p>
          </div>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              void refreshApplications();
              void savedJobsQuery.refetch();
            }}
          >
            <RotateCcw size={13} /> Refresh
          </button>
        </div>

        <div className="workspace candidate-workspace">
          <nav className="workspace-nav" aria-label="Candidate sections">
            <button
              type="button"
              className={tab === "applications" ? "active" : ""}
              onClick={() => setTab("applications")}
              data-testid="tab-applications"
            >
              <BriefcaseBusiness size={14} /> Applications
            </button>
            <button
              type="button"
              className={tab === "saved" ? "active" : ""}
              onClick={() => setTab("saved")}
              data-testid="tab-saved"
            >
              <BookmarkCheck size={14} /> Saved roles
              <span className="tab-count">{savedIds.length}</span>
            </button>
          </nav>

          <section className="workspace-main" aria-live="polite">
            {tab === "applications" ? (
              <>
                <div className="panel-head">
                  <div>
                    <h2>Applications you’ve submitted</h2>
                    <p>Employers receive your details directly in their workspace.</p>
                  </div>
                  <span className="head-count">
                    {applications.length} total
                  </span>
                </div>
                {applicationsQuery.isLoading ? (
                  <LoadingState label="Loading your applications…" />
                ) : applicationsQuery.isError ? (
                  <ErrorState
                    title="Applications are temporarily unavailable"
                    message="Your submissions are still saved. Refresh to try again."
                    onRetry={() => void refreshApplications()}
                  />
                ) : applications.length ? (
                  <div className="panel-card">
                    {applications.map((application) => (
                      <article
                        className="item-row application-row"
                        key={application.id}
                        data-testid={`application-${application.id}`}
                      >
                        <div className="item-primary">
                          <strong>{application.jobTitle}</strong>
                          <p>
                            {application.company} · Sent{" "}
                            {formatDate(application.createdAt)}
                          </p>
                          <p className="application-excerpt">
                            {application.coverLetter}
                          </p>
                        </div>
                        <span
                          className={`status-pill ${application.status}`}
                          data-testid={`status-${application.id}`}
                        >
                          {application.status.replace("_", " ")}
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Your applications will appear here."
                    message="Apply to a published role through TaskAway to track it from this workspace."
                    action={
                      <button
                        className="btn btn-accent"
                        type="button"
                        onClick={() => setLocation("/")}
                      >
                        Explore roles <ArrowUpRight size={13} />
                      </button>
                    }
                  />
                )}
              </>
            ) : (
              <>
                <div className="panel-head">
                  <div>
                    <h2>Roles you’ve saved</h2>
                    <p>Saved role IDs stay on this device, not in your profile.</p>
                  </div>
                  <span className="head-count">{savedIds.length} saved</span>
                </div>
                {savedJobsQuery.isLoading ? (
                  <LoadingState label="Loading saved roles…" />
                ) : savedJobsQuery.isError ? (
                  <ErrorState
                    title="Saved roles are temporarily unavailable"
                    message="Refresh to try again."
                    onRetry={() => void savedJobsQuery.refetch()}
                  />
                ) : savedRoles.length ? (
                  <div className="job-list">
                    {savedRoles.map((role) => (
                      <article className="job-card saved-role-card" key={role.id}>
                        <div className="job-top">
                          <div>
                            <p className="company-name">{role.company}</p>
                            <h3 className="job-title">{role.title}</h3>
                          </div>
                          <span className="category-tag">{role.category}</span>
                        </div>
                        <div className="job-meta">
                          <span>{formatSalary(role)}</span>
                          <span>{role.location}</span>
                          <span>{role.workMode}</span>
                          <span>{role.employmentType}</span>
                        </div>
                        <div className="inline-actions">
                          <button
                            className="btn btn-accent"
                            type="button"
                            onClick={() => setLocation(`/?role=${encodeURIComponent(role.id)}`)}
                          >
                            View role <ArrowUpRight size={13} />
                          </button>
                          <button
                            className="btn btn-outline"
                            type="button"
                            onClick={() => removeSavedRole(role.id)}
                          >
                            Remove saved role
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No active saved roles."
                    message="Roles that are no longer published are removed from this view. Save a live listing to see it here."
                    action={
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => setLocation("/")}
                      >
                        Browse live roles
                      </button>
                    }
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
