import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateSection } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

export interface UpdateSectionBody {
  name?: string;
  rest_seconds?: number;
}

interface UpdateSectionArgs {
  programUuid: string;
  workoutUuid: string;
  sectionUuid: string;
  body: UpdateSectionBody;
}

// useUpdateSection updates a section in local SQLite.
export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, UpdateSectionArgs>({
    mutationFn: async ({ programUuid, sectionUuid, body }) =>
      updateSection(programUuid, sectionUuid, body),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
