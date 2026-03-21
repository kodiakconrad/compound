import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createProgram,
  type CreateProgramInput,
} from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

// useCreateProgram writes a new program to local SQLite.
// Returns the full program detail (with empty workouts).
export function useCreateProgram() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, CreateProgramInput>({
    mutationFn: async (input) => createProgram(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
