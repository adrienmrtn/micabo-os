import { supabase } from "@/lib/supabase/client";
import type { Role } from "@/features/auth/AuthContext";

import { QUESTION_MAX, type AudienceSnippet, type ChatLocale, type TourChat } from "./prompt";

export interface ChatbotContexte {
  id: string;
  titre: string;
  contenu: string;
  audience: AudienceSnippet;
  created_at: string;
  updated_at: string;
}

export interface ChatbotQuestion {
  id: string;
  user_id: string | null;
  role: Role;
  question: string;
  reponse: string | null;
  created_at: string;
  profiles: { prenom: string | null; nom: string | null; email: string | null } | null;
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const corps = (await ctx.json()) as { error?: string; message?: string };
        if (corps?.error) message = corps.error;
        else if (corps?.message) message = corps.message;
      }
    } catch {
      /* garder le message générique */
    }
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export async function poserQuestionChatbot(
  question: string,
  locale: ChatLocale,
  historique: TourChat[],
): Promise<string> {
  const texte = question.trim();
  if (!texte) throw new Error("Question vide");
  if (texte.length > QUESTION_MAX) {
    throw new Error(`Question trop longue (${QUESTION_MAX} caractères max)`);
  }
  const data = await invoke<{ reponse: string }>("chatbot", {
    question: texte,
    locale,
    historique,
  });
  return data.reponse;
}

export async function listerChatbotContexte(): Promise<ChatbotContexte[]> {
  const { data, error } = await supabase
    .from("chatbot_contexte")
    .select("id, titre, contenu, audience, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((ligne) => ({
    ...(ligne as ChatbotContexte),
    audience: ((ligne as ChatbotContexte).audience ?? "all") as AudienceSnippet,
  }));
}

export async function creerChatbotContexte(
  titre: string,
  contenu: string,
  audience: AudienceSnippet = "all",
): Promise<void> {
  const { error } = await supabase.from("chatbot_contexte").insert({
    titre: titre.trim() || "Sans titre",
    contenu: contenu.trim(),
    audience,
  });
  if (error) throw error;
}

export async function majChatbotContexte(
  id: string,
  patch: { titre: string; contenu: string; audience: AudienceSnippet },
): Promise<void> {
  const { error } = await supabase
    .from("chatbot_contexte")
    .update({
      titre: patch.titre.trim() || "Sans titre",
      contenu: patch.contenu.trim(),
      audience: patch.audience,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function supprimerChatbotContexte(id: string): Promise<void> {
  const { error } = await supabase.from("chatbot_contexte").delete().eq("id", id);
  if (error) throw error;
}

export async function listerChatbotQuestions(): Promise<ChatbotQuestion[]> {
  const { data, error } = await supabase
    .from("chatbot_questions")
    .select("id, user_id, role, question, reponse, created_at, profiles(prenom, nom, email)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((ligne) => {
    const raw = ligne as ChatbotQuestion & {
      profiles: ChatbotQuestion["profiles"] | ChatbotQuestion["profiles"][];
    };
    const profil = Array.isArray(raw.profiles) ? (raw.profiles[0] ?? null) : raw.profiles;
    return { ...raw, profiles: profil };
  });
}
