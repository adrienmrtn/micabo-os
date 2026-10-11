import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/AuthContext";
import {
  langueDemenagement,
  MOT_DE_PASSE_SOPHIA,
  SOPHIA_OS_URL,
  TEXTES_DEMENAGEMENT,
} from "./demenagement";

/**
 * Pop-up du déménagement vers l'OS Sophia (voir `demenagement.ts`). Il revient
 * à chaque chargement de l'OS : « Fermer » ne le masque que jusqu'au prochain.
 */
export function DemenagementPopup({ identifiant }: { identifiant: string }) {
  const { i18n } = useTranslation();
  const { profil } = useAuth();
  const [ferme, setFerme] = React.useState(false);
  if (ferme) return null;

  const t = TEXTES_DEMENAGEMENT[langueDemenagement(profil?.langues, i18n.language)];
  const lien = `${SOPHIA_OS_URL}/login`;

  return (
    <Dialog open disablePointerDismissal>
      <DialogPopup showCloseButton={false} className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Truck className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base">{t.titre}</DialogTitle>
              <DialogDescription>{t.intro}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogPanel className="space-y-3 text-sm">
          <a href={lien} className="block break-all font-medium text-primary underline underline-offset-2">
            {SOPHIA_OS_URL.replace(/^https:\/\//, "")}
          </a>
          <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
            <p className="text-muted-foreground">{t.connexion}</p>
            <p>
              {t.email} : <code className="rounded bg-background px-1.5 py-0.5">{identifiant}</code>
            </p>
            <p>
              {t.motDePasse} :{" "}
              <code className="rounded bg-background px-1.5 py-0.5">{MOT_DE_PASSE_SOPHIA}</code>
            </p>
            <p className="text-xs text-muted-foreground">{t.motDePasseAide}</p>
          </div>
          <p className="font-medium">{t.seulement}</p>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFerme(true)}>
            {t.fermer}
          </Button>
          <Button render={<a href={lien} />}>
            {t.aller}
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
