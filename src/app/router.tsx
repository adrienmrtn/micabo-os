import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "@/features/auth/LoginPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { PublicOnlyRoute } from "@/features/auth/PublicOnlyRoute";
import { RoleGate } from "@/features/auth/RoleGate";
import { useAuth } from "@/features/auth/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PosterLayout } from "@/components/layout/PosterLayout";
import { AdminPilotagePage } from "@/pages/admin/AdminPilotagePage";
import { AdminSourcesPage } from "@/pages/admin/AdminSourcesPage";
import { AdminComptesPage } from "@/pages/admin/AdminComptesPage";
import { AdminPostersPage } from "@/pages/admin/AdminPostersPage";
import { AdminBibliothequePage } from "@/pages/admin/AdminBibliothequePage";
import { AdminReglagesPage } from "@/pages/admin/AdminReglagesPage";
import { AdminPromptsPage } from "@/pages/admin/AdminPromptsPage";
import { AdminAnalyticsPage } from "@/pages/admin/AdminAnalyticsPage";
import { AdminPostsPage } from "@/pages/admin/AdminPostsPage";
import { AdminCalendrierPage } from "@/pages/admin/AdminCalendrierPage";
import { AdminPostDetailPage } from "@/pages/admin/AdminPostDetailPage";
import { AdminTestNettoyagePage } from "@/pages/admin/AdminTestNettoyagePage";
import { PosterCalendrierPage } from "@/pages/poster/PosterCalendrierPage";
import { PosterPostPage } from "@/pages/poster/PosterPostPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function Accueil() {
  const { role } = useAuth();
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "poster") return <Navigate to="/calendrier" replace />;
  return <Navigate to="/login" replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Accueil />} />

        <Route element={<RoleGate allow={["admin"]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminPilotagePage />} />
            <Route path="/admin/calendrier" element={<AdminCalendrierPage />} />
            <Route path="/admin/posts/:id" element={<AdminPostDetailPage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            <Route path="/admin/posts" element={<AdminPostsPage />} />
            <Route path="/admin/sources" element={<AdminSourcesPage />} />
            <Route path="/admin/comptes" element={<AdminComptesPage />} />
            <Route path="/admin/posters" element={<AdminPostersPage />} />
            <Route path="/admin/bibliotheque" element={<AdminBibliothequePage />} />
            <Route path="/admin/test-nettoyage" element={<AdminTestNettoyagePage />} />
            <Route path="/admin/reglages" element={<AdminReglagesPage />} />
            <Route path="/admin/prompts" element={<AdminPromptsPage />} />
          </Route>
        </Route>

        <Route element={<RoleGate allow={["poster"]} />}>
          <Route element={<PosterLayout />}>
            <Route path="/calendrier" element={<PosterCalendrierPage />} />
          </Route>
        </Route>

        {/* L'admin doit pouvoir relire un post qu'il vient de tester. */}
        <Route element={<RoleGate allow={["poster", "admin"]} />}>
          <Route element={<PosterLayout />}>
            <Route path="/posts/:id" element={<PosterPostPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
