import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteSection } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

interface DeleteSectionArgs {
  programUuid: string;
  workoutUuid: string;
  sectionUuid: string;
}

// useDeleteSection deletes a section from local SQLite.
export function useDeleteSection() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, DeleteSectionArgs>({
    mutationFn: async ({ programUuid, sectionUuid }) =>
      deleteSection(programUuid, sectionUuid),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
