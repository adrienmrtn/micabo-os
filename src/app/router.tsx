import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "@/features/auth/LoginPage";
import { SignupPage } from "@/features/auth/SignupPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { PublicOnlyRoute } from "@/features/auth/PublicOnlyRoute";
import { RoleGate } from "@/features/auth/RoleGate";
import { useAuth } from "@/features/auth/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PosterLayout } from "@/components/layout/PosterLayout";
import { AdminSlideshowsPage } from "@/pages/admin/AdminSlideshowsPage";
import { AdminSlideshowDetailPage } from "@/pages/admin/AdminSlideshowDetailPage";
import { AdminAccountsPage } from "@/pages/admin/AdminAccountsPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { AdminPromptsPage } from "@/pages/admin/AdminPromptsPage";
import { PosterDashboardPage } from "@/pages/poster/PosterDashboardPage";
import { PosterDeliveryPage } from "@/pages/poster/PosterDeliveryPage";
import { PosterHistoryPage } from "@/pages/poster/PosterHistoryPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function RoleHome() {
  const { role } = useAuth();
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "poster") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<RoleHome />} />

        <Route element={<RoleGate allow={["admin"]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminSlideshowsPage />} />
            <Route path="/admin/slideshows/:id" element={<AdminSlideshowDetailPage />} />
            <Route path="/admin/accounts" element={<AdminAccountsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/prompts" element={<AdminPromptsPage />} />
          </Route>
        </Route>

        <Route element={<RoleGate allow={["poster"]} />}>
          <Route element={<PosterLayout />}>
            <Route path="/dashboard" element={<PosterDashboardPage />} />
            <Route path="/history" element={<PosterHistoryPage />} />
            <Route path="/slideshows/:id" element={<PosterDeliveryPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
