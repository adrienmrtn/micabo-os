import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addFrame,
  assignSlideshow,
  correctVariant,
  createManualSlideshow,
  deleteFrame,
  getPosterSlideshow,
  listFrames,
  listMySlideshows,
  listMySlideshowsForDate,
  listSlideshows,
  listVariants,
  markAsPosted,
  retryPipeline,
  today,
  updateFrameText,
} from "./api";
import type { PipelineStatus } from "./types";

export const slideshowKeys = {
  all: ["slideshows"] as const,
  list: (status?: PipelineStatus) => ["slideshows", "list", status] as const,
  frames: (slideshowId: string) => ["slideshows", "frames", slideshowId] as const,
  variants: (slideshowId: string) => ["slideshows", "variants", slideshowId] as const,
  mine: (posterId: string) => ["slideshows", "mine", posterId] as const,
  today: (posterId: string, date: string) =>
    ["slideshows", "today", posterId, date] as const,
  one: (id: string) => ["slideshows", "one", id] as const,
};

export function useSlideshows(status?: PipelineStatus) {
  return useQuery({
    queryKey: slideshowKeys.list(status),
    queryFn: () => listSlideshows(status),
  });
}

export function useFrames(slideshowId: string | undefined) {
  return useQuery({
    queryKey: slideshowKeys.frames(slideshowId ?? ""),
    queryFn: () => listFrames(slideshowId!),
    enabled: Boolean(slideshowId),
  });
}

export function useVariants(slideshowId: string | undefined) {
  return useQuery({
    queryKey: slideshowKeys.variants(slideshowId ?? ""),
    queryFn: () => listVariants(slideshowId!),
    enabled: Boolean(slideshowId),
  });
}

export function useMySlideshowsToday(posterId: string | undefined) {
  const date = today();
  return useQuery({
    queryKey: slideshowKeys.today(posterId ?? "", date),
    queryFn: () => listMySlideshowsForDate(posterId!, date),
    enabled: Boolean(posterId),
  });
}

export function useMySlideshows(posterId: string | undefined) {
  return useQuery({
    queryKey: slideshowKeys.mine(posterId ?? ""),
    queryFn: () => listMySlideshows(posterId!),
    enabled: Boolean(posterId),
  });
}

export function usePosterSlideshow(id: string | undefined) {
  return useQuery({
    queryKey: slideshowKeys.one(id ?? ""),
    queryFn: () => getPosterSlideshow(id!),
    enabled: Boolean(id),
  });
}

export function useCreateManualSlideshow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createManualSlideshow,
    onSuccess: () => qc.invalidateQueries({ queryKey: slideshowKeys.all }),
  });
}

export function useRetryPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retryPipeline,
    onSuccess: () => qc.invalidateQueries({ queryKey: slideshowKeys.all }),
  });
}

export function useAssignSlideshow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assignSlideshow,
    onSuccess: () => qc.invalidateQueries({ queryKey: slideshowKeys.all }),
  });
}

export function useAddFrame(slideshowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { position: number; originalUrl: string; translatedText: string }) =>
      addFrame({ slideshowId, ...input }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: slideshowKeys.frames(slideshowId) }),
  });
}

export function useUpdateFrameText(slideshowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { frameId: string; translatedText: string }) =>
      updateFrameText(input.frameId, input.translatedText),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: slideshowKeys.frames(slideshowId) }),
  });
}

export function useDeleteFrame(slideshowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteFrame,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: slideshowKeys.frames(slideshowId) }),
  });
}

export function useCorrectVariant(slideshowId: string, adminId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      variantId: string;
      frameId: string | null;
      originalText: string;
      correctedText: string;
    }) => correctVariant({ ...input, slideshowId, adminId: adminId! }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: slideshowKeys.variants(slideshowId) }),
  });
}

export function useMarkAsPosted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAsPosted,
    onSuccess: () => qc.invalidateQueries({ queryKey: slideshowKeys.all }),
  });
}
