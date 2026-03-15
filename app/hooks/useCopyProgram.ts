import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ProgramDetail } from "../lib/types";

// useCopyProgram wraps POST /api/v1/programs/{uuid}/copy.
//
// The backend performs a deep copy — new UUIDs, fresh timestamps, independent
// from the source. The response is a full ProgramTreeResponse (ProgramDetail).
//
// The mutation argument is the source program's uuid.
export function useCopyProgram() {
  const queryClient = useQueryClient();

  return useMutation<ProgramDetail, Error, string>({
    mutationFn: (sourceUuid) =>
      api.post<ProgramDetail>(`/api/v1/programs/${sourceUuid}/copy`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
