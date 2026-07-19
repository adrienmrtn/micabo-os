import { TikTokAccountsPanel } from "@/features/accounts/TikTokAccountsPanel";
import { AssignmentsPanel } from "@/features/accounts/AssignmentsPanel";
import { ImageLibraryPanel } from "@/features/accounts/ImageLibraryPanel";

export function AdminAccountsPage() {
  return (
    <div className="space-y-6">
      <TikTokAccountsPanel />
      <AssignmentsPanel />
      <ImageLibraryPanel />
    </div>
  );
}
