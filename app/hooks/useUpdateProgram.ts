import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateProgram } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

interface UpdateProgramArgs {
  uuid: string;
  body: { name?: string; description?: string | null };
}

// useUpdateProgram updates a program in local SQLite.
export function useUpdateProgram() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, UpdateProgramArgs>({
    mutationFn: async ({ uuid, body }) => updateProgram(uuid, body),
    onSuccess: (_data, { uuid }) => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["program", uuid] });
    },
  });
}
