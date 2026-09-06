import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePageAccess } from "@/hooks/usePageAccess";
import { MfaGate } from "@/components/auth/MfaGate";

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
  pageKey?: string;
}

export const ProtectedRoute = ({ children, requireAdmin, pageKey }: Props) => {
  const { user, isAdmin, loading, adminLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = usePageAccess(pageKey ?? "");

  if (loading || (requireAdmin && adminLoading) || (pageKey && !!user && accessLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  if (pageKey && !hasAccess) return <Navigate to="/" replace />;

  // O segundo fator envolve TODAS as rotas protegidas — inclusive as que forem
  // criadas depois. Colocar a verificação dentro de cada tela seria garantir que
  // uma tela nova nasça desprotegida.
  return <MfaGate>{children}</MfaGate>;
};
