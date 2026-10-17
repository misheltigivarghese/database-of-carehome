import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingPanel } from "./ui/Spinner";

/**
 * UI-level gate only. The real enforcement is Row Level Security on every
 * table and the storage bucket — a signed-out visitor calling the REST API
 * directly gets nothing back, with or without this component.
 */
export function ProtectedRoute() {
  const { session, initialising } = useAuth();
  const location = useLocation();

  if (initialising) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingPanel label="Checking your session…" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
