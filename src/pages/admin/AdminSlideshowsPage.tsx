import { ManualImportPanel } from "@/features/slideshows/ManualImportPanel";
import { PipelineControlPanel } from "@/features/slideshows/PipelineControlPanel";
import { SlideshowsOverview } from "@/features/slideshows/SlideshowsOverview";
import { TestTikTokCard } from "@/features/slideshows/TestTikTokCard";

export function AdminSlideshowsPage() {
  return (
    <div className="space-y-6">
      <TestTikTokCard />
      <PipelineControlPanel />
      <SlideshowsOverview />
      <ManualImportPanel />
    </div>
  );
}
