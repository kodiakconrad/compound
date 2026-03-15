import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ProgramResponse } from "../lib/types";

// The body sent to PUT /api/v1/programs/{uuid}.
// Both fields are optional — only provided fields are updated.
export interface UpdateProgramBody {
  name?: string;
  description?: string;
}

// Mutation argument bundles the target uuid with the update body.
interface UpdateProgramArgs {
  uuid: string;
  body: UpdateProgramBody;
}

// useUpdateProgram wraps PUT /api/v1/programs/{uuid}.
//
// On success it invalidates both the list and the individual detail cache
// so the UI reflects the changes everywhere.
export function useUpdateProgram() {
  const queryClient = useQueryClient();

  return useMutation<ProgramResponse, Error, UpdateProgramArgs>({
    mutationFn: ({ uuid, body }) =>
      api.put<ProgramResponse>(`/api/v1/programs/${uuid}`, body),
    onSuccess: (_data, { uuid }) => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["program", uuid] });
    },
  });
}
