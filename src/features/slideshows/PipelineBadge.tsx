import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { PipelineStatus } from "./types";

const VARIANT_BY_STATUS = {
  pending: "secondary",
  running: "warning",
  done: "success",
  failed: "destructive",
} as const;

export function PipelineBadge({ status }: { status: PipelineStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={VARIANT_BY_STATUS[status]}>{t(`pipeline.status.${status}`)}</Badge>
  );
}
