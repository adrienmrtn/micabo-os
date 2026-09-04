import type { LucideIcon } from "lucide-react";
import {
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

import type { EtapeTimelineCle, TimelineCheck } from "./timeline";

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
  onboarding_envoi: KeyRound,
  onboarding_rejoint: ClipboardCheck,
  job_createur_poste: Clapperboard,
  warmup: Flame,
  premier_post: ImagePlay,
};

export const ICONE_CHECK: Record<TimelineCheck["cle"], LucideIcon> = {
  os: Monitor,
  slack: Hash,
  upwork: UserPlus,
};

export function IconeEtat({ ok, className }: { ok: boolean; className?: string }) {
  const Icone = ok ? Check : Circle;
  return <Icone className={className} />;
}
