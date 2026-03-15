import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ProgramResponse } from "../lib/types";

// The body sent to POST /api/v1/programs.
export interface CreateProgramBody {
  name: string;
  description?: string;
}

// useCreateProgram wraps POST /api/v1/programs.
//
// The backend returns a flat ProgramResponse (no tree) because the new
// program has zero workouts. The caller typically only needs the uuid
// to navigate to the detail screen.
//
// On success it invalidates ["programs"] so the list reflects the new entry.
export function useCreateProgram() {
  const queryClient = useQueryClient();

  return useMutation<ProgramResponse, Error, CreateProgramBody>({
    mutationFn: (body) => api.post<ProgramResponse>("/api/v1/programs", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
