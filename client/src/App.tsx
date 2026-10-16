import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StatusPage from "./pages/StatusPage";
import LandingPage from "./pages/LandingPage";
import IncidentsPage from "./pages/IncidentsPage";
import IncidentDetailPage from "./pages/IncidentDetailPage";
import DocsPage from "./pages/DocsPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import { getAuthToken } from "./lib/api";
import { ToastProvider } from "./lib/ToastContext";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Root & Status Routes */}
          <Route path="/" element={<StatusPage />} />
          <Route path="/status" element={<Navigate to="/" replace />} />
          <Route path="/overview" element={<LandingPage />} />
          <Route path="/about" element={<Navigate to="/overview" replace />} />

          {/* Public Service & Telemetry Diagnostics Route */}
          <Route path="/service/:id" element={<ServiceDetailPage />} />
          <Route path="/status/service/:id" element={<ServiceDetailPage />} />

          {/* Public Incidents Ledger & Detail Routes */}
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />

          {/* Internal Documentation (Operator only; unauthenticated redirected to /) */}
          <Route 
            path="/docs" 
            element={getAuthToken() ? <DocsPage /> : <Navigate to="/" replace />} 
          />
          <Route path="/api-docs" element={<Navigate to="/" replace />} />

          {/* Operator Authentication Gate */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Operator Command Deck Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Meaningful 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
