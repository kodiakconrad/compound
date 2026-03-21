import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addSection } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

export interface AddSectionBody {
  name: string;
  rest_seconds?: number;
}

interface AddSectionArgs {
  programUuid: string;
  workoutUuid: string;
  body: AddSectionBody;
}

// useAddSection creates a section in local SQLite.
export function useAddSection() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, AddSectionArgs>({
    mutationFn: async ({ programUuid, workoutUuid, body }) =>
      addSection(programUuid, workoutUuid, body),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
