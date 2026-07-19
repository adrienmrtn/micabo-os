import { TodayCard } from "@/features/slideshows/TodayCard";
import { AccountSetupCard } from "@/features/onboarding/AccountSetupCard";

export function PosterDashboardPage() {
  return (
    <div className="space-y-6">
      <AccountSetupCard />
      <TodayCard />
    </div>
  );
}
