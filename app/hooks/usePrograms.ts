import { useQuery } from "@tanstack/react-query";

import { listPrograms } from "../db/repositories/program_repository";
import type { ProgramListItem } from "../domain/program";

// usePrograms loads the full program list from local SQLite.
export function usePrograms() {
  return useQuery<ProgramListItem[]>({
    queryKey: ["programs"],
    queryFn: () => listPrograms(),
  });
}
