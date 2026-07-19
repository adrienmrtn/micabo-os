import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { fr } from "./fr";

/**
 * Une seule langue pour l'instant. Pour en ajouter une : créer `en.ts` sur le
 * modèle de `fr.ts`, l'importer, et l'ajouter aux deux constantes ci-dessous —
 * le sélecteur de langue de l'AppShell apparaît automatiquement dès qu'il y a
 * plus d'une entrée.
 */
export const SUPPORTED_LANGUAGES = ["fr"] as const;

const resources = { fr };

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    interpolation: { escapeValue: false },
  });

export default i18next;
