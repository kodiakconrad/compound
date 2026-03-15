import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ProgramListItem } from "../lib/types";

// usePrograms fetches the full program list from GET /api/v1/programs.
// Like useExercises, we request a large page (limit=500) and keep everything
// in memory — a personal workout app won't have hundreds of programs.
export function usePrograms() {
  return useQuery<ProgramListItem[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<ProgramListItem[]>("/api/v1/programs?limit=500"),
  });
}
