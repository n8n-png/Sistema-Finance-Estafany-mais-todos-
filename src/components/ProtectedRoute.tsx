import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePageAccess } from "@/hooks/usePageAccess";

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

  return <>{children}</>;
};
