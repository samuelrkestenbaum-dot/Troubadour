import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { CommandPalette } from "./components/CommandPalette";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";
import { GlobalKeyboardShortcuts } from "./components/GlobalKeyboardShortcuts";
import { OnboardingTour } from "./components/OnboardingTour";

// ── Lazy-loaded pages (code-split per route) ──
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewProject = lazy(() => import("./pages/NewProject"));
const ProjectView = lazy(() => import("./pages/ProjectView"));
const TrackView = lazy(() => import("./pages/TrackView"));
const ReviewView = lazy(() => import("./pages/ReviewView"));
const VersionDiff = lazy(() => import("./pages/VersionDiff"));
const Insights = lazy(() => import("./pages/Insights"));
const SharedReview = lazy(() => import("./pages/SharedReview"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Settings = lazy(() => import("./pages/Settings"));
const CompareReviews = lazy(() => import("./pages/CompareReviews"));
const Templates = lazy(() => import("./pages/Templates"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const GenreBenchmarks = lazy(() => import("./pages/GenreBenchmarks"));
const TemplatesGallery = lazy(() => import("./pages/TemplatesGallery"));
const Digest = lazy(() => import("./pages/Digest"));
const TagManager = lazy(() => import("./pages/TagManager"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Support = lazy(() => import("./pages/Support"));
const Changelog = lazy(() => import("./pages/Changelog"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Route-level loading spinner */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

/** Safely parse a route param as a positive integer, returning null if invalid */
function safeParseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/projects" component={Dashboard} />
        <Route path="/projects/new" component={NewProject} />
        <Route path="/projects/:id">
          {(params) => {
            const id = safeParseId(params.id);
            return id ? <ProjectView id={id} /> : <NotFound />;
          }}
        </Route>
        <Route path="/tracks/:id">
          {(params) => {
            const id = safeParseId(params.id);
            return id ? <TrackView id={id} /> : <NotFound />;
          }}
        </Route>
        <Route path="/reviews/:id">
          {(params) => {
            const id = safeParseId(params.id);
            return id ? <ReviewView id={id} /> : <NotFound />;
          }}
        </Route>
        <Route path="/tracks/:id/diff">
          {(params) => {
            const id = safeParseId(params.id);
            return id ? <VersionDiff trackId={id} /> : <NotFound />;
          }}
        </Route>
        <Route path="/projects/:id/compare">
          {(params) => {
            const id = safeParseId(params.id);
            return id ? <CompareReviews projectId={id} /> : <NotFound />;
          }}
        </Route>
        <Route path="/templates" component={Templates} />
        <Route path="/templates/gallery" component={TemplatesGallery} />
        <Route path="/benchmarks" component={GenreBenchmarks} />
        <Route path="/insights" component={Insights} />
        <Route path="/tags" component={TagManager} />
        <Route path="/digest" component={Digest} />
        <Route path="/settings" component={Settings} />
        {/* Redirects for removed pages */}
        <Route path="/analytics">{() => { window.location.replace("/insights"); return null; }}</Route>
        <Route path="/usage">{() => { window.location.replace("/settings"); return null; }}</Route>
        <Route path="/skill-progression">{() => { window.location.replace("/insights"); return null; }}</Route>
        <Route path="/competitive-benchmarks">{() => { window.location.replace("/insights"); return null; }}</Route>
        <Route path="/release-readiness">{() => { window.location.replace("/insights"); return null; }}</Route>
        <Route path="/streak">{() => { window.location.replace("/insights"); return null; }}</Route>
        <Route path="/artist-dna">{() => { window.location.replace("/insights"); return null; }}</Route>
        <Route path="/flywheel">{() => { window.location.replace("/insights"); return null; }}</Route>
        <Route path="/admin" component={AdminDashboard} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shared/:token">
        {(params) => <SharedReview token={params.token} />}
      </Route>
      <Route path="/pricing" component={Pricing} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/support" component={Support} />
      <Route path="/changelog" component={Changelog} />
      <Route path="/invite/:token" component={AcceptInvite} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/404" component={NotFound} />
      <Route>
        <DashboardRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <CommandPalette />
          <KeyboardShortcutsDialog />
          <GlobalKeyboardShortcuts />
          <OnboardingTour />
          <Suspense fallback={<PageLoader />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
