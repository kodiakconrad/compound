import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ProgramListItem } from "../lib/types";

// useDeleteProgram wraps DELETE /api/v1/programs/{uuid}.
//
// Uses an optimistic update so the program disappears from the list
// immediately, without waiting for the server round-trip. If the delete
// fails the previous list is restored automatically.
export function useDeleteProgram() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, { previous?: ProgramListItem[] }>({
    mutationFn: (uuid) => api.delete(`/api/v1/programs/${uuid}`),

    // Optimistically remove the program from the cached list before the
    // server responds. This makes the UI feel instant.
    onMutate: async (uuid) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic
      // update with stale data.
      await queryClient.cancelQueries({ queryKey: ["programs"] });

      // Snapshot the current list so we can restore it on error.
      const previous = queryClient.getQueryData<ProgramListItem[]>(["programs"]);

      // Remove the deleted program from the cache.
      queryClient.setQueryData<ProgramListItem[]>(["programs"], (old) =>
        old ? old.filter((p) => p.uuid !== uuid) : [],
      );

      return { previous };
    },

    // If the mutation fails, roll back to the snapshot and re-fetch so the
    // list is accurate.
    onError: (_err, _uuid, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["programs"], context.previous);
      }
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
