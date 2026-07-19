import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAssignment,
  createTikTokAccount,
  deleteAssignment,
  deleteTikTokAccount,
  listAssignments,
  listPosters,
  listTikTokAccounts,
  listUsers,
  setUserActive,
  setUserRole,
  updateTikTokAccount,
} from "./api";
import type { TikTokAccount } from "./types";

export const accountKeys = {
  accounts: ["tiktok-accounts"] as const,
  assignments: ["assignments"] as const,
  users: ["users"] as const,
  posters: ["posters"] as const,
};

export function useTikTokAccounts() {
  return useQuery({ queryKey: accountKeys.accounts, queryFn: listTikTokAccounts });
}

export function useAssignments() {
  return useQuery({ queryKey: accountKeys.assignments, queryFn: listAssignments });
}

export function useUsers() {
  return useQuery({ queryKey: accountKeys.users, queryFn: listUsers });
}

export function usePosters() {
  return useQuery({ queryKey: accountKeys.posters, queryFn: listPosters });
}

export function useCreateTikTokAccount(adminId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      handle: string;
      niche: string;
      suggestedCreatorHandle: string;
      profileUrl: string;
      notes: string;
    }) => createTikTokAccount({ ...input, createdBy: adminId! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.accounts }),
  });
}

export function useUpdateTikTokAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Partial<TikTokAccount> }) =>
      updateTikTokAccount(input.id, input.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.accounts }),
  });
}

export function useDeleteTikTokAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTikTokAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.accounts });
      qc.invalidateQueries({ queryKey: accountKeys.assignments });
    },
  });
}

export function useCreateAssignment(adminId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { posterId: string; tiktokAccountId: string }) =>
      createAssignment({ ...input, assignedBy: adminId! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.assignments }),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.assignments }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "poster" }) =>
      setUserRole(input.userId, input.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.users });
      qc.invalidateQueries({ queryKey: accountKeys.posters });
    },
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; isActive: boolean }) =>
      setUserActive(input.userId, input.isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.users }),
  });
}
