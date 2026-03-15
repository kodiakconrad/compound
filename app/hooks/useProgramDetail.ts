import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ProgramDetail } from "../lib/types";

// useProgramDetail fetches the full program tree (workouts -> sections ->
// exercises) from GET /api/v1/programs/{uuid}.
//
// The query is disabled when uuid is falsy so you can safely call this hook
// before the uuid is available (e.g., during initial render).
export function useProgramDetail(uuid: string) {
  return useQuery<ProgramDetail>({
    queryKey: ["program", uuid],
    queryFn: () => api.get<ProgramDetail>(`/api/v1/programs/${uuid}`),
    enabled: !!uuid,
  });
}
