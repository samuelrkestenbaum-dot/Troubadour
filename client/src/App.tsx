import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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
import DashboardLayout from "./components/DashboardLayout";

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/projects" component={Dashboard} />
        <Route path="/projects/new" component={NewProject} />
        <Route path="/projects/:id">
          {(params) => <ProjectView id={parseInt(params.id)} />}
        </Route>
        <Route path="/tracks/:id">
          {(params) => <TrackView id={parseInt(params.id)} />}
        </Route>
        <Route path="/reviews/:id">
          {(params) => <ReviewView id={parseInt(params.id)} />}
        </Route>
        <Route path="/tracks/:id/diff">
          {(params) => <VersionDiff trackId={parseInt(params.id)} />}
        </Route>
        <Route path="/analytics" component={Analytics} />
        <Route path="/usage" component={Usage} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
