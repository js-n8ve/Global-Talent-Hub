import { ArrowUpRight, BriefcaseBusiness, Compass, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { UserButton } from "@clerk/react";
import { useTaskAwayProfile } from "../App";

export function SiteHeader() {
  const { profile, isSignedIn } = useTaskAwayProfile();
  const [location] = useLocation();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/" aria-label="TaskAway home">
          <span className="brand-mark">
            <ArrowUpRight size={18} strokeWidth={2.5} />
          </span>
          TaskAway
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          <Link
            className={location === "/" ? "nav-current" : ""}
            href="/"
            data-testid="nav-discover"
          >
            <Compass size={14} />
            Find roles
          </Link>
          {isSignedIn && profile?.role === "candidate" && (
            <Link
              className={location === "/candidate" ? "nav-current" : ""}
              href="/candidate"
              data-testid="nav-candidate"
            >
              My applications
            </Link>
          )}
          {isSignedIn && profile?.role === "admin" && (
            <Link
              className={location === "/admin" ? "nav-current" : ""}
              href="/admin"
              data-testid="nav-admin"
            >
              Review queue
            </Link>
          )}
          <Link
            className="nav-post"
            href="/employer"
            data-testid="nav-employer"
          >
            For employers <span className="nav-price">$9 / post</span>
          </Link>
          {isSignedIn ? (
            <span className="user-menu" data-testid="user-menu">
              {profile?.name && (
                <span className="user-name">{profile.name.split(" ")[0]}</span>
              )}
              <UserButton />
            </span>
          ) : (
            <span className="nav-auth">
              <Link href="/sign-in" data-testid="nav-sign-in">
                Sign in
              </Link>
              <Link
                className="nav-sign"
                href="/sign-up"
                data-testid="nav-sign-up"
              >
                Join free
              </Link>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div>
        <strong>TaskAway</strong>
        <div>Global work, made more accessible.</div>
      </div>
      <span>Built for African professionals and international teams.</span>
    </footer>
  );
}

export function LoadingState({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <div className="state-card" role="status" data-testid="loading-state">
      <span className="loading-mark" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-card error-state" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-outline" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <div className="empty-icon">
        <BriefcaseBusiness size={19} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function AccessNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="access-note">
      <UserRound size={15} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
