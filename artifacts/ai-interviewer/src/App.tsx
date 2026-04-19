import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "@/pages/Landing";
import CandidateDashboard from "@/pages/CandidateDashboard";
import InterviewSetup from "@/pages/InterviewSetup";
import ActiveInterview from "@/pages/ActiveInterview";
import InterviewReport from "@/pages/InterviewReport";
import EmployerDashboard from "@/pages/EmployerDashboard";
import CreateJob from "@/pages/CreateJob";
import ScheduleInterview from "@/pages/ScheduleInterview";
import ScheduledInterviewCandidates from "@/pages/ScheduledInterviewCandidates";
import ScheduledInterviewResults from "@/pages/ScheduledInterviewResults";
import InterviewAccess from "@/pages/InterviewAccess";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-[70vh] items-center justify-center gap-6 text-center px-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/25">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground max-w-sm">Sign in to access this page and start your AI-powered interview journey.</p>
        </div>
        <button
          onClick={login}
          className="px-8 py-3 rounded-xl font-semibold btn-gradient flex items-center gap-2 text-sm"
        >
          Sign In to Continue
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard"><ProtectedRoute component={CandidateDashboard} /></Route>
      <Route path="/setup"><ProtectedRoute component={InterviewSetup} /></Route>
      <Route path="/interview/:id"><ProtectedRoute component={ActiveInterview} /></Route>
      <Route path="/interview/:id/report"><ProtectedRoute component={InterviewReport} /></Route>
      <Route path="/employer"><ProtectedRoute component={EmployerDashboard} /></Route>
      <Route path="/employer/jobs/new"><ProtectedRoute component={CreateJob} /></Route>
      <Route path="/employer/schedule"><ProtectedRoute component={ScheduleInterview} /></Route>
      <Route path="/employer/scheduled/:id/candidates"><ProtectedRoute component={ScheduledInterviewCandidates} /></Route>
      <Route path="/employer/scheduled/:id/results"><ProtectedRoute component={ScheduledInterviewResults} /></Route>
      <Route path="/interview-access/:id" component={InterviewAccess} />
      <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </Layout>
          </WouterRouter>
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
