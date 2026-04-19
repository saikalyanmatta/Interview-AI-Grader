import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/Layout";
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
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center gap-4 text-center max-w-md mx-auto">
        <h2 className="text-2xl font-bold font-display">Authentication Required</h2>
        <p className="text-muted-foreground">Please sign in to access this page.</p>
        <button
          onClick={login}
          className="mt-4 px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          Sign In
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
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Layout>
          <Router />
        </Layout>
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
