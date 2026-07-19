import { ManualImportPanel } from "@/features/slideshows/ManualImportPanel";
import { PipelineControlPanel } from "@/features/slideshows/PipelineControlPanel";
import { SlideshowsOverview } from "@/features/slideshows/SlideshowsOverview";

export function AdminSlideshowsPage() {
  return (
    <div className="space-y-6">
      <PipelineControlPanel />
      <SlideshowsOverview />
      <ManualImportPanel />
    </div>
  );
}
