import { useMutation, useQueryClient } from "@tanstack/react-query";

import { softDeleteProgram } from "../db/repositories/program_repository";
import type { ProgramListItem } from "../domain/program";

// useDeleteProgram soft-deletes a program in local SQLite.
// Optimistic update removes it from the list immediately.
export function useDeleteProgram() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, { previous?: ProgramListItem[] }>({
    mutationFn: async (uuid) => softDeleteProgram(uuid),

    onMutate: async (uuid) => {
      await queryClient.cancelQueries({ queryKey: ["programs"] });
      const previous = queryClient.getQueryData<ProgramListItem[]>(["programs"]);
      queryClient.setQueryData<ProgramListItem[]>(["programs"], (old) =>
        old ? old.filter((p) => p.uuid !== uuid) : [],
      );
      return { previous };
    },

    onError: (_err, _uuid, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["programs"], context.previous);
      }
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
