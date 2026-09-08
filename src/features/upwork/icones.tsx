import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  Briefcase,
  Check,
  Circle,
  Clapperboard,
  ClipboardCheck,
  FileCheck2,
  FileUp,
  Flame,
  Hash,
  ImagePlay,
  KeyRound,
  Mail,
  MessagesSquare,
  Monitor,
  Rocket,
  Speech,
  UserPlus,
  UserRoundCog,
  Users,
} from "lucide-react";

import type { EtapeTimelineCle, SourceVerite, TimelineCheck } from "./timeline";

export const ICONE_KPI = {
  hm: UserRoundCog,
  createurs: Users,
  jobHm: Briefcase,
  jobCrea: Clapperboard,
} as const;

export const ICONE_PHASE: Record<1 | 2 | 3, LucideIcon> = {
  1: Rocket,
  2: Users,
  3: Speech,
};

export const ICONE_ETAPE: Record<EtapeTimelineCle, LucideIcon> = {
  contacte: Mail,
  pourparlers: MessagesSquare,
  contrat_envoye: FileUp,
  contrat_signe: FileCheck2,
  acces_envoyes: KeyRound,
  integration: ClipboardCheck,
  job_createur_poste: Clapperboard,
  tiktok_cree: AtSign,
  warmup: Flame,
  premier_post: ImagePlay,
};

export const ICONE_CHECK: Record<TimelineCheck["cle"], LucideIcon> = {
  os: Monitor,
  slack: Hash,
  upwork: UserPlus,
};

/** Rappelle d'où vient l'info : OS, Slack MCP, Upwork, ou coche admin. */
export const ICONE_SOURCE: Record<SourceVerite, LucideIcon> = {
  os: Monitor,
  slack: Hash,
  upwork: Briefcase,
  admin: UserPlus,
};

export function IconeEtat({ ok, className }: { ok: boolean; className?: string }) {
  const Icone = ok ? Check : Circle;
  return <Icone className={className} />;
}
