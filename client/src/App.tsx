import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import NewProject from "./pages/NewProject";
import ProjectView from "./pages/ProjectView";
import TrackView from "./pages/TrackView";
import ReviewView from "./pages/ReviewView";
import VersionDiff from "./pages/VersionDiff";
import Usage from "./pages/Usage";
import Analytics from "./pages/Analytics";
import SharedReview from "./pages/SharedReview";
import Pricing from "./pages/Pricing";
import Settings from "./pages/Settings";
import DashboardLayout from "./components/DashboardLayout";
import CompareReviews from "./pages/CompareReviews";
import QuickReview from "./pages/QuickReview";
import Templates from "./pages/Templates";
import AcceptInvite from "./pages/AcceptInvite";
import GenreBenchmarks from "./pages/GenreBenchmarks";
import { CommandPalette } from "./components/CommandPalette";

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
        <Route path="/projects/:id/quick-review">
          {(params) => {
            const id = safeParseId(params.id);
            return id ? <QuickReview /> : <NotFound />;
          }}
        </Route>
        <Route path="/templates" component={Templates} />
        <Route path="/benchmarks" component={GenreBenchmarks} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/usage" component={Usage} />
        <Route path="/settings" component={Settings} />
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
      <Route path="/invite/:token" component={AcceptInvite} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
