import { useSetMyRole, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTaskAwayProfile } from "../App";
import {
  ErrorState,
  LoadingState,
  SiteFooter,
  SiteHeader,
} from "./SiteChrome";

type AccountRole = "candidate" | "employer" | "admin";

export default function RoleGate({
  role,
  children,
}: {
  role: AccountRole;
  children: React.ReactNode;
}) {
  const { profile, profileLoading, profileError, isSignedIn } =
    useTaskAwayProfile();
  const queryClient = useQueryClient();
  const updateRole = useSetMyRole();

  const switchRole = async (nextRole: "candidate" | "employer") => {
    await updateRole.mutateAsync({ data: { role: nextRole } });
    await queryClient.invalidateQueries({
      queryKey: getGetMyProfileQueryKey(),
    });
  };

  if (!isSignedIn) {
    return (
      <>
        <SiteHeader />
        <main className="page-wrap">
          <div className="state-card">
            <h3>Sign in to continue</h3>
            <p>
              Your TaskAway workspace keeps your applications and employer
              listings tied to your account.
            </p>
            <div className="inline-actions center-actions">
              <Link className="btn btn-accent" href="/sign-in">
                Sign in
              </Link>
              <Link className="btn btn-outline" href="/sign-up">
                Create a free account
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (profileLoading) {
    return (
      <>
        <SiteHeader />
        <main className="page-wrap">
          <LoadingState />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (profileError || !profile) {
    return (
      <>
        <SiteHeader />
        <main className="page-wrap">
          <ErrorState
            title="We couldn’t load your account"
            message="Refresh the page and try again. Your account data has not been changed."
            onRetry={() =>
              queryClient.invalidateQueries({
                queryKey: getGetMyProfileQueryKey(),
              })
            }
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (profile.role !== role) {
    const isAdminRoute = role === "admin";
    const nextRole = role === "admin" ? undefined : role;
    return (
      <>
        <SiteHeader />
        <main className="page-wrap">
          <div className="state-card">
            <p className="section-kicker">
              {isAdminRoute ? "Restricted area" : "Choose your workspace"}
            </p>
            <h3>
              {isAdminRoute
                ? "Administrator access only"
                : `Switch to a ${role} account?`}
            </h3>
            <p>
              {isAdminRoute
                ? "This page is reserved for TaskAway administrators."
                : `Your account is currently set to ${profile.role}. You can switch back whenever you need.`}
            </p>
            {nextRole && (
              <button
                className="btn btn-accent"
                type="button"
                disabled={updateRole.isPending}
                onClick={() => switchRole(nextRole)}
              >
                {updateRole.isPending
                  ? "Updating account…"
                  : `Continue as ${nextRole}`}
              </button>
            )}
            {updateRole.isError && (
              <p className="form-error" role="alert">
                We couldn’t change your account type. Please try again.
              </p>
            )}
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return <>{children}</>;
}
