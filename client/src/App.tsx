import { Route, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "./pages/Home";
import OpportunityDetail from "./pages/OpportunityDetail";
import Predictions from "./pages/Predictions";

function RouterComponent() {
  return (
    <>
      <Route path="/" component={Home} />
      <Route path="/opportunity/:slug" component={OpportunityDetail} />
      <Route path="/predictions" component={Predictions} />
      <Route path="*" component={NotFound} />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router>
          <RouterComponent />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
