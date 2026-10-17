import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider } from "./context/AuthContext";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ResidentDetailPage } from "./pages/ResidentDetailPage";
import { ResidentsPage } from "./pages/ResidentsPage";
import { SignInPage } from "./pages/SignInPage";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />

            {/* Everything below requires a session. */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/residents" replace />} />
                <Route path="residents" element={<ResidentsPage />} />
                <Route path="residents/:residentId" element={<ResidentDetailPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
