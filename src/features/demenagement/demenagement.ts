/**
 * Déménagement vers l'OS Sophia (octobre 2026).
 *
 * Les créateurs micabo publient désormais depuis l'OS Sophia : leurs logins y
 * ont été recopiés (`x@micabo.app` → `x@sophia.com`, même mot de passe ; les 4
 * qui avaient déjà un login Sophia le gardent, sous le même préfixe), et leurs
 * comptes TikTok y reçoivent leurs posts depuis la nuit du 11 au 12/10.
 *
 * Ici, à chaque connexion d'un créateur à partir du 12/10, un pop-up lui donne
 * l'adresse du nouvel OS et ses identifiants. Aucune liste de logins n'est
 * embarquée (ce dépôt est public) : l'identifiant Sophia se déduit de l'e-mail
 * de la session. Eva (compte vidéo AI UGC) reste sur micabo-os : pas de pop-up.
 */

export const SOPHIA_OS_URL = "https://sophia-marketing-orga.vercel.app";

/** 12/10/2026 à 0 h, heure de Paris (UTC+2). */
export const DEMENAGEMENT_DEBUT = Date.parse("2026-10-11T22:00:00.000Z");

/** Mot de passe initial des logins Sophia. */
export const MOT_DE_PASSE_SOPHIA = "12345678";

/** Créateurs qui restent sur micabo-os. */
const RESTENT_SUR_MICABO = new Set(["eva@micabo.app"]);

/** Identifiant Sophia d'un login micabo, ou null s'il ne déménage pas. */
export function identifiantSophia(emailMicabo: string | null | undefined): string | null {
  const email = (emailMicabo ?? "").trim().toLowerCase();
  if (RESTENT_SUR_MICABO.has(email)) return null;
  const m = /^([^@\s]+)@micabo\.app$/.exec(email);
  return m ? `${m[1]}@sophia.com` : null;
}

export function demenagementCommence(maintenant: number = Date.now()): boolean {
  return maintenant >= DEMENAGEMENT_DEBUT;
}

export type LangueDemenagement = "fr" | "en" | "tr" | "de" | "es";
const LANGUES: readonly LangueDemenagement[] = ["fr", "en", "tr", "de", "es"];

/**
 * La langue du message : celle du créateur (`profiles.langues`), sinon celle de
 * l'interface, sinon l'anglais. L'OS n'a que fr / en ; les créateurs turcs,
 * allemands et espagnols lisent ce message dans leur langue.
 */
export function langueDemenagement(
  langues: readonly string[] | null | undefined,
  langueInterface: string | null | undefined,
): LangueDemenagement {
  for (const l of [...(langues ?? []), langueInterface ?? ""]) {
    const code = l.trim().toLowerCase().slice(0, 2) as LangueDemenagement;
    if (LANGUES.includes(code)) return code;
  }
  return "en";
}

export interface TextesDemenagement {
  titre: string;
  intro: string;
  connexion: string;
  email: string;
  motDePasse: string;
  motDePasseAide: string;
  seulement: string;
  aller: string;
  fermer: string;
}

export const TEXTES_DEMENAGEMENT: Record<LangueDemenagement, TextesDemenagement> = {
  fr: {
    titre: "micabo OS a déménagé",
    intro: "Ton espace créateur est maintenant sur le nouvel OS :",
    connexion: "Connecte-toi avec :",
    email: "Email",
    motDePasse: "Mot de passe",
    motDePasseAide: "Si tu avais changé ton mot de passe, garde le tien.",
    seulement: "Tes posts sont désormais uniquement sur le nouvel OS.",
    aller: "Aller sur le nouvel OS",
    fermer: "Fermer",
  },
  en: {
    titre: "micabo OS has moved",
    intro: "Your creator space is now on the new OS:",
    connexion: "Log in with:",
    email: "Email",
    motDePasse: "Password",
    motDePasseAide: "If you had changed your password, keep yours.",
    seulement: "Your posts are now only on the new OS.",
    aller: "Go to the new OS",
    fermer: "Close",
  },
  tr: {
    titre: "micabo OS taşındı",
    intro: "İçerik üretici alanın artık yeni OS'ta:",
    connexion: "Giriş bilgilerin:",
    email: "E-posta",
    motDePasse: "Şifre",
    motDePasseAide: "Şifreni değiştirdiysen kendi şifreni kullan.",
    seulement: "Paylaşımların artık sadece yeni OS'ta.",
    aller: "Yeni OS'a git",
    fermer: "Kapat",
  },
  de: {
    titre: "micabo OS ist umgezogen",
    intro: "Dein Creator-Bereich ist jetzt im neuen OS:",
    connexion: "Melde dich an mit:",
    email: "E-Mail",
    motDePasse: "Passwort",
    motDePasseAide: "Falls du dein Passwort geändert hattest, nutze deins.",
    seulement: "Deine Posts gibt es ab jetzt nur noch im neuen OS.",
    aller: "Zum neuen OS",
    fermer: "Schließen",
  },
  es: {
    titre: "micabo OS se ha mudado",
    intro: "Tu espacio de creador está ahora en el nuevo OS:",
    connexion: "Inicia sesión con:",
    email: "Email",
    motDePasse: "Contraseña",
    motDePasseAide: "Si habías cambiado tu contraseña, usa la tuya.",
    seulement: "Tus posts ahora están solo en el nuevo OS.",
    aller: "Ir al nuevo OS",
    fermer: "Cerrar",
  },
};
