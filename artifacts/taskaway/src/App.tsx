import { createContext, useContext, useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  UserButton,
  useClerk,
  useUser,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Route,
  Router as WouterRouter,
  Switch,
  useLocation,
} from "wouter";
import { useGetMyProfile } from "@workspace/api-client-react";
import { queryClient } from "./lib/queryClient";
import AdminDashboard from "./pages/AdminDashboard";
import CandidateDashboard from "./pages/CandidateDashboard";
import EmployerDashboard from "./pages/EmployerDashboard";
import JobBoard from "./pages/JobBoard";

type Profile = NonNullable<ReturnType<typeof useGetMyProfile>["data"]>;
type ProfileContextValue = {
  profile?: Profile;
  profileLoading: boolean;
  profileError: boolean;
  isSignedIn: boolean;
};

const ProfileContext = createContext<ProfileContextValue>({
  profileLoading: false,
  profileError: false,
  isSignedIn: false,
});

export function useTaskAwayProfile() {
  return useContext(ProfileContext);
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
// Optional: only needed when proxying Clerk through your own domain (production instances).
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#d9f24f",
    colorForeground: "#173d2f",
    colorMutedForeground: "#647369",
    colorDanger: "#a43b32",
    colorBackground: "#fcfbf6",
    colorInput: "#f7f6ef",
    colorInputForeground: "#173d2f",
    colorNeutral: "#173d2f",
    fontFamily: "DM Sans, sans-serif",
    borderRadius: "0.9rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-[#fcfbf6] rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-display text-[#173d2f]",
    headerSubtitle: "text-[#647369]",
    formButtonPrimary:
      "bg-[#173d2f] hover:bg-[#245642] text-[#f4f1e8] shadow-none",
    formFieldInput:
      "bg-[#f7f6ef] border-[#d6ded4] text-[#173d2f] focus:border-[#71915e]",
    footerActionLink: "text-[#34513e] hover:text-[#173d2f]",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        previousUserId.current !== undefined &&
        previousUserId.current !== userId
      ) {
        client.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);

  return null;
}

function SignInPage() {
  return (
    <main className="auth-frame">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="auth-frame">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </main>
  );
}

function NotFound() {
  return (
    <main className="not-found">
      <p className="section-kicker">Page not found</p>
      <h1 className="font-display">This page has moved on.</h1>
      <p>Return to the roles board to find your next opportunity.</p>
      <Link className="btn btn-accent" href="/">
        Explore roles
      </Link>
    </main>
  );
}

function AppRoutes() {
  const { isLoaded, isSignedIn } = useUser();
  const profileQuery = useGetMyProfile({
    query: { enabled: Boolean(isSignedIn), retry: false },
  });
  const profileState: ProfileContextValue = {
    profile: profileQuery.data,
    profileLoading: Boolean(isSignedIn) && profileQuery.isLoading,
    profileError: Boolean(isSignedIn) && profileQuery.isError,
    isSignedIn: Boolean(isSignedIn),
  };

  if (!isLoaded) {
    return <div className="loading-screen">Loading TaskAway…</div>;
  }

  return (
    <ProfileContext.Provider value={profileState}>
      <div className="app-shell grain">
        <Switch>
          <Route path="/" component={JobBoard} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/candidate" component={CandidateDashboard} />
          <Route path="/employer" component={EmployerDashboard} />
          <Route path="/admin" component={AdminDashboard} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </ProfileContext.Provider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to manage your TaskAway account",
          },
        },
        signUp: {
          start: {
            title: "Create your TaskAway account",
            subtitle: "Your next opportunity starts here",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <AppRoutes />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
