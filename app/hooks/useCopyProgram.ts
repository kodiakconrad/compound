import { useMutation, useQueryClient } from "@tanstack/react-query";

import { copyProgram } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

// useCopyProgram deep-copies a program in local SQLite.
// Returns the full new program tree.
export function useCopyProgram() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, string>({
    mutationFn: async (sourceUuid) => copyProgram(sourceUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
