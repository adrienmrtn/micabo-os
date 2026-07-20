import { CreatePosterPanel } from "@/features/accounts/CreatePosterPanel";
import { UsersPanel } from "@/features/accounts/UsersPanel";

export function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <CreatePosterPanel />
      <UsersPanel />
    </div>
  );
}
