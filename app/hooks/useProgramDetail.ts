import { useQuery } from "@tanstack/react-query";

import { getProgramDetail } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

// useProgramDetail loads the full program tree from local SQLite.
// Disabled when uuid is falsy.
export function useProgramDetail(uuid: string) {
  return useQuery<Program>({
    queryKey: ["program", uuid],
    queryFn: () => getProgramDetail(uuid),
    enabled: !!uuid,
  });
}
