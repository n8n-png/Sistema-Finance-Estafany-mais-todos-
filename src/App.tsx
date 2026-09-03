import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { initCDI } from "@/utils/cdi";
import { lazyRetry, clearChunkReloadFlag } from "@/utils/lazyWithReload";

clearChunkReloadFlag();

// Painel admin carrega a lib xlsx (pesada) — só baixa quando um admin acessa a rota.
const AdminLimites = lazy(lazyRetry(() => import("./pages/AdminLimites")));

const Ativos = lazy(lazyRetry(() => import("./pages/Ativos")));
const CentralDocumentos = lazy(lazyRetry(() => import("./pages/CentralDocumentos")));
const OperacoesValora = lazy(lazyRetry(() => import("./pages/OperacoesValora")));

initCDI();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const Fallback = () => (
  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Index />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ativos"
              element={
                <ProtectedRoute pageKey="ativos">
                  <AppLayout>
                    <Suspense fallback={<Fallback />}>
                      <Ativos />
                    </Suspense>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/central-documentos"
              element={
                <ProtectedRoute pageKey="central_documentos">
                  <AppLayout>
                    <Suspense fallback={<Fallback />}>
                      <CentralDocumentos />
                    </Suspense>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operacoes-valora"
              element={
                <ProtectedRoute pageKey="operacoes_valora">
                  <AppLayout>
                    <Suspense fallback={<Fallback />}>
                      <OperacoesValora />
                    </Suspense>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/limites"
              element={
                <ProtectedRoute requireAdmin>
                  <AppLayout>
                    <Suspense fallback={<Fallback />}>
                      <AdminLimites />
                    </Suspense>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
