import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  Clock3,
  Globe2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  getListMyApplicationsQueryKey,
  useApplyToJob,
  useGetJob,
  useListJobs,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useTaskAwayProfile } from "../App";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SiteFooter,
  SiteHeader,
} from "../components/SiteChrome";

type WorkMode = "Remote" | "Hybrid" | "On-site";
type EmploymentType = "Full-time" | "Contract" | "Part-time";
type Role = {
  id: string;
  title: string;
  company: string;
  companyWebsite: string | null;
  category: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  salaryPeriod: "year" | "month" | "hour";
  timezone: string;
  description: string;
  requirements: string[];
  status: string;
  verified: boolean;
  createdAt: string | Date;
  publishedAt: string | Date | null;
  reviewNote: string | null;
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
const workModes: WorkMode[] = ["Remote", "Hybrid", "On-site"];
const employmentTypes: EmploymentType[] = [
  "Full-time",
  "Contract",
  "Part-time",
];

function money(role: Role) {
  const format = (value: number) =>
    value >= 1000
      ? `${Math.round(value / 1000)}k`
      : value.toLocaleString();
  const period =
    role.salaryPeriod === "year"
      ? "yr"
      : role.salaryPeriod === "month"
        ? "mo"
        : "hr";
  return `${role.currency} ${format(role.salaryMin)}–${format(role.salaryMax)} / ${period}`;
}

function postedDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently posted";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function initials(company: string) {
  return company
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function loadSavedIds(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem("taskaway-saved-roles") ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export default function JobBoard() {
  const { isSignedIn, profile } = useTaskAwayProfile();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [workMode, setWorkMode] = useState<"all" | WorkMode>("all");
  const [employmentType, setEmploymentType] = useState<
    "all" | EmploymentType
  >("all");
  const [sort, setSort] = useState<"newest" | "salary">("newest");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(loadSavedIds);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applyMode, setApplyMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const initialRoleHandled = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    localStorage.setItem("taskaway-saved-roles", JSON.stringify(savedIds));
  }, [savedIds]);

  useEffect(() => {
    if (initialRoleHandled.current) return;
    initialRoleHandled.current = true;
    const roleId = new URLSearchParams(window.location.search).get("role");
    if (roleId) {
      setSelectedJobId(roleId);
    }
  }, []);

  const jobsQuery = useListJobs({
    q: debouncedSearch || undefined,
    category: category || undefined,
    workMode: workMode === "all" ? undefined : workMode,
    employmentType: employmentType === "all" ? undefined : employmentType,
  });
  const detailQuery = useGetJob(selectedJobId ?? "", {
    query: { enabled: Boolean(selectedJobId) },
  });
  const applyMutation = useApplyToJob();

  const roles = useMemo(() => {
    const result = (jobsQuery.data ?? []) as Role[];
    const filtered = result.filter(
      (role) => !savedOnly || savedIds.includes(role.id),
    );
    return [...filtered].sort((a, b) => {
      if (sort === "salary") return b.salaryMax - a.salaryMax;
      return new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime();
    });
  }, [jobsQuery.data, savedOnly, savedIds, sort]);

  const toggleSaved = (roleId: string) => {
    setSavedIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [roleId, ...current],
    );
  };

  const openRole = (roleId: string, shouldApply = false) => {
    setSelectedJobId(roleId);
    setApplyMode(shouldApply);
    setNotice("");
    setCoverLetter("");
    setPortfolioUrl("");
    setConsent(false);
  };

  const closeRole = () => {
    setSelectedJobId(null);
    setNotice("");
    setApplyMode(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("role");
    window.history.replaceState({}, "", url);
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedJobId) return;
    if (!isSignedIn) {
      setLocation("/sign-in");
      return;
    }
    if (profile?.role !== "candidate") {
      setNotice("Switch to a candidate account before applying.");
      return;
    }
    try {
      await applyMutation.mutateAsync({
        id: selectedJobId,
        data: {
          coverLetter: coverLetter.trim(),
          portfolioUrl: portfolioUrl.trim() || null,
          consent: true,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getListMyApplicationsQueryKey(),
      });
      setNotice("Application sent to the employer.");
    } catch (error) {
      const status = (error as { status?: number })?.status;
      setNotice(
        status === 409
          ? "You have already applied to this role."
          : "We couldn’t submit your application. Check your details and try again.",
      );
    }
  };

  const selectedRole = (detailQuery.data as Role | undefined) ?? null;

  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="hero-wrap">
          <div className="hero">
            <div className="rise">
              <div className="eyebrow">
                <span className="eyebrow-dot" /> A wider world of work
              </div>
              <h1>
                Your next chapter has <em>no borders.</em>
              </h1>
              <p className="hero-copy">
                A more considered way to find good work with global teams.
                Explore roles across every field, with pay and work style out in
                the open.
              </p>
              <ul className="hero-proof">
                <li>
                  <Check size={14} /> Pay ranges up front
                </li>
                <li>
                  <Globe2 size={14} /> Remote, hybrid and on-site
                </li>
                <li>
                  <BriefcaseBusiness size={14} /> Every career field
                </li>
              </ul>
            </div>
            <aside className="hero-side rise" aria-label="TaskAway promise">
              <div className="side-top">
                <span>Built for global opportunity</span>
                <BadgeCheck size={16} />
              </div>
              <div className="side-number">Good work, clearer.</div>
              <p className="side-desc">
                Search roles from international teams looking for African
                talent.
              </p>
              <div className="side-roles promise-list">
                <div className="side-role">
                  <span className="mini-logo">
                    <CircleDollarSign size={15} />
                  </span>
                  <strong>Salary shown up front</strong>
                </div>
                <div className="side-role">
                  <span className="mini-logo">
                    <Globe2 size={15} />
                  </span>
                  <strong>Flexible work styles</strong>
                </div>
                <div className="side-role">
                  <span className="mini-logo">
                    <BadgeCheck size={15} />
                  </span>
                  <strong>Reviewed before publishing</strong>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="main-content" id="roles">
          <div className="section-head">
            <div>
              <p className="section-kicker">
                {savedOnly ? "Kept close for later" : "Find work that fits"}
              </p>
              <h2 className="section-title">
                {savedOnly ? "Your saved roles" : "Opportunities with room to grow"}
              </h2>
            </div>
            <div className="head-count" aria-live="polite">
              {jobsQuery.isFetching
                ? "Refreshing roles…"
                : `${roles.length} ${roles.length === 1 ? "role" : "roles"} to explore`}
            </div>
          </div>

          <div className="search-row">
            <label className="search-box">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                aria-label="Search roles"
                placeholder="Search title, company, field or location"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                data-testid="input-job-search"
              />
            </label>
            <select
              className="select-control"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "newest" | "salary")
              }
              aria-label="Sort roles"
            >
              <option value="newest">Newest first</option>
              <option value="salary">Highest pay</option>
            </select>
            <button
              className={`select-control saved-toggle ${savedOnly ? "active" : ""}`}
              type="button"
              onClick={() => setSavedOnly((current) => !current)}
              aria-pressed={savedOnly}
              data-testid="button-saved-roles"
            >
              {savedOnly ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              Saved roles ({savedIds.length})
            </button>
          </div>

          <div className="filter-bar" aria-label="Role filters">
            <span className="filter-label">
              <BriefcaseBusiness size={14} /> Field
            </span>
            <button
              type="button"
              className={`filter-chip ${category === "" ? "active" : ""}`}
              onClick={() => setCategory("")}
            >
              All fields
            </button>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={`filter-chip ${category === item ? "active" : ""}`}
                onClick={() => setCategory(category === item ? "" : item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="filter-bar filter-bar-secondary">
            <span className="filter-label">
              <Globe2 size={14} /> Work style
            </span>
            {workModes.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`filter-chip ${workMode === mode ? "active" : ""}`}
                onClick={() =>
                  setWorkMode(workMode === mode ? "all" : mode)
                }
              >
                {mode}
              </button>
            ))}
            <span className="filter-label">
              <Clock3 size={14} /> Commitment
            </span>
            {employmentTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`filter-chip ${employmentType === type ? "active" : ""}`}
                onClick={() =>
                  setEmploymentType(employmentType === type ? "all" : type)
                }
              >
                {type}
              </button>
            ))}
            {(search ||
              category ||
              workMode !== "all" ||
              employmentType !== "all" ||
              savedOnly) && (
              <button
                className="clear-filters"
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("");
                  setWorkMode("all");
                  setEmploymentType("all");
                  setSavedOnly(false);
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="job-list" aria-live="polite" data-testid="list-jobs">
            {jobsQuery.isLoading ? (
              <LoadingState label="Finding current opportunities…" />
            ) : jobsQuery.isError ? (
              <ErrorState
                title="Roles are temporarily unavailable"
                message="The job board could not refresh. Try again in a moment."
                onRetry={() => void jobsQuery.refetch()}
              />
            ) : roles.length ? (
              roles.map((role, index) => (
                <article
                  className="job-card rise"
                  key={role.id}
                  style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
                  data-testid={`card-job-${role.id}`}
                >
                  <div className="job-top">
                    <div className="company-line">
                      <div className="company-logo" aria-hidden="true">
                        {initials(role.company)}
                      </div>
                      <div>
                        <p className="company-name">{role.company}</p>
                        <h3 className="job-title">{role.title}</h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`bookmark-btn ${savedIds.includes(role.id) ? "saved" : ""}`}
                      onClick={() => toggleSaved(role.id)}
                      aria-label={
                        savedIds.includes(role.id)
                          ? `Remove ${role.title} from saved roles`
                          : `Save ${role.title}`
                      }
                      aria-pressed={savedIds.includes(role.id)}
                    >
                      {savedIds.includes(role.id) ? (
                        <BookmarkCheck size={17} />
                      ) : (
                        <Bookmark size={17} />
                      )}
                    </button>
                  </div>
                  <div className="job-meta">
                    <span className="category-tag">{role.category}</span>
                    <span className="compensation">
                      <CircleDollarSign size={13} />
                      {money(role)}
                    </span>
                    <span>
                      <MapPin size={13} />
                      {role.location}
                    </span>
                    <span>
                      <Globe2 size={13} />
                      {role.workMode}
                    </span>
                    <span>
                      <BriefcaseBusiness size={13} />
                      {role.employmentType}
                    </span>
                    <span>
                      <Clock3 size={13} />
                      {postedDate(role.publishedAt ?? role.createdAt)}
                    </span>
                  </div>
                  <p className="job-summary">{role.description}</p>
                  <div className="job-bottom">
                    <span className="trust-label">
                      <BadgeCheck size={13} /> Reviewed listing
                    </span>
                    <div className="card-actions">
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => openRole(role.id)}
                        data-testid={`button-details-${role.id}`}
                      >
                        View role
                      </button>
                      <button
                        className="btn btn-accent"
                        type="button"
                        onClick={() => openRole(role.id, true)}
                        data-testid={`button-apply-${role.id}`}
                      >
                        Apply <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                title={
                  savedOnly && !savedIds.length
                    ? "Your shortlist starts here."
                    : "No live roles match those filters."
                }
                message={
                  savedOnly && !savedIds.length
                    ? "Save a role that interests you and it will stay here on this device."
                    : "Try broadening your search. New roles appear after an employer posts and TaskAway reviews them."
                }
                action={
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCategory("");
                      setWorkMode("all");
                      setEmploymentType("all");
                      setSavedOnly(false);
                    }}
                  >
                    Reset search
                  </button>
                }
              />
            )}
          </div>
        </section>

        <section className="employer-band" id="employers">
          <div className="employer-inner">
            <div className="employer-copy">
              <div className="eyebrow">
                <span className="eyebrow-dot" /> For international teams
              </div>
              <h2>Meet the people who move work forward.</h2>
              <p>
                Share a clear salary range, the way your team works and the
                impact someone can make. Each listing is reviewed before it
                reaches candidates.
              </p>
              <ul className="employer-points">
                <li>
                  <Check size={15} /> Reach professionals across Africa
                </li>
                <li>
                  <Check size={15} /> One-time $9 USD listing fee
                </li>
                <li>
                  <Check size={15} /> Free access for candidates
                </li>
              </ul>
            </div>
            <div className="employer-cta-card">
              <p className="section-kicker">Make your next hire count</p>
              <h3>Post one role. Reach a wider world.</h3>
              <p>
                Listings stay in review until the employer payment is confirmed
                and TaskAway approves the role.
              </p>
              <Link className="btn btn-accent" href="/employer">
                Post a role for $9 <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />

      {selectedJobId && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRole();
          }}
        >
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            data-testid="dialog-job"
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Close role details"
              onClick={closeRole}
            >
              <X size={17} />
            </button>
            {detailQuery.isLoading || !selectedRole ? (
              detailQuery.isError ? (
                <ErrorState
                  title="This role is unavailable"
                  message="It may have been closed or removed."
                />
              ) : (
                <LoadingState label="Loading role details…" />
              )
            ) : (
              <>
                <div className="eyebrow dialog-eyebrow">
                  <span className="eyebrow-dot" />
                  {applyMode ? "Apply through TaskAway" : "Opportunity details"}
                </div>
                <h2 id="dialog-title" data-testid="text-dialog-job-title">
                  {selectedRole.title}
                </h2>
                <div className="dialog-company">
                  <div className="company-logo">{initials(selectedRole.company)}</div>
                  <div>
                    <strong>{selectedRole.company}</strong>
                    <p>{selectedRole.location}</p>
                  </div>
                  {selectedRole.companyWebsite && (
                    <a
                      className="company-site"
                      href={selectedRole.companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Company site <ArrowUpRight size={12} />
                    </a>
                  )}
                </div>
                <div className="job-meta detail-meta">
                  <span className="category-tag">{selectedRole.category}</span>
                  <span className="compensation">
                    <CircleDollarSign size={13} />
                    {money(selectedRole)}
                  </span>
                  <span>
                    <Globe2 size={13} />
                    {selectedRole.workMode}
                  </span>
                  <span>{selectedRole.employmentType}</span>
                </div>
                {!applyMode ? (
                  <div className="detail-layout">
                    <div className="detail-main">
                      <section className="detail-panel">
                        <h2>About the role</h2>
                        <p>{selectedRole.description}</p>
                      </section>
                      <section className="detail-panel">
                        <h2>What you’ll bring</h2>
                        <ul>
                          {selectedRole.requirements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    </div>
                    <aside className="checkout-box">
                      <strong>{money(selectedRole)}</strong>
                      <p>
                        {selectedRole.timezone} · {selectedRole.workMode}
                      </p>
                      <button
                        className="btn btn-accent full-width"
                        type="button"
                        onClick={() => setApplyMode(true)}
                      >
                        Apply now <ArrowUpRight size={13} />
                      </button>
                      <p className="privacy-caption">
                        Your application goes to this employer through
                        TaskAway. No application fee.
                      </p>
                    </aside>
                  </div>
                ) : notice === "Application sent to the employer." ? (
                  <div className="application-success" role="status">
                    <div className="success-mark">
                      <Check size={20} />
                    </div>
                    <h3>Application sent</h3>
                    <p>
                      The employer has your application. Track updates in your
                      candidate workspace.
                    </p>
                    <div className="inline-actions center-actions">
                      <Link
                        className="btn btn-accent"
                        href="/candidate"
                        onClick={closeRole}
                      >
                        View applications
                      </Link>
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={closeRole}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : !isSignedIn ? (
                  <div className="apply-signin">
                    <p>
                      Sign in or create a free candidate account to apply
                      directly to {selectedRole.company}.
                    </p>
                    <div className="inline-actions">
                      <Link className="btn btn-accent" href="/sign-in">
                        Sign in to apply
                      </Link>
                      <Link className="btn btn-outline" href="/sign-up">
                        Join free
                      </Link>
                    </div>
                  </div>
                ) : profile?.role !== "candidate" ? (
                  <div className="apply-signin">
                    <p>
                      Switch to a candidate account to submit this application.
                    </p>
                    <Link className="btn btn-accent" href="/candidate">
                      Continue as a candidate
                    </Link>
                  </div>
                ) : (
                  <form
                    className="application-form"
                    onSubmit={submitApplication}
                    data-testid="form-apply"
                  >
                    <div className="form-grid">
                      <div className="field full-field">
                        <label htmlFor="application-cover">
                          Message to the employer
                        </label>
                        <textarea
                          id="application-cover"
                          rows={5}
                          required
                          minLength={20}
                          maxLength={5000}
                          value={coverLetter}
                          onChange={(event) => setCoverLetter(event.target.value)}
                          placeholder="Share why this role fits your experience and what you would bring."
                          data-testid="textarea-cover-letter"
                        />
                      </div>
                      <div className="field full-field">
                        <label htmlFor="application-portfolio">
                          Portfolio or professional profile (optional)
                        </label>
                        <input
                          id="application-portfolio"
                          type="url"
                          inputMode="url"
                          value={portfolioUrl}
                          onChange={(event) => setPortfolioUrl(event.target.value)}
                          placeholder="https://"
                          data-testid="input-portfolio-url"
                        />
                      </div>
                      <label className="consent-row full-field">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(event) => setConsent(event.target.checked)}
                          required
                          data-testid="checkbox-application-consent"
                        />
                        <span>
                          I agree to share my application details with{" "}
                          {selectedRole.company} for this role.
                        </span>
                      </label>
                    </div>
                    {notice && (
                      <div className="notice error" role="alert">
                        {notice}
                      </div>
                    )}
                    {applyMutation.isError && !notice && (
                      <div className="notice error" role="alert">
                        We couldn’t submit your application. Please try again.
                      </div>
                    )}
                    <div className="inline-actions">
                      <button
                        className="btn btn-accent"
                        type="submit"
                        disabled={applyMutation.isPending || !consent}
                      >
                        {applyMutation.isPending
                          ? "Sending application…"
                          : "Submit application"}
                        <ArrowRight size={14} />
                      </button>
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => setApplyMode(false)}
                      >
                        Back to details
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
