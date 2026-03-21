import { useQuery } from "@tanstack/react-query";

import { getAllPersonalRecords } from "../db/repositories/progress_repository";
import type { PersonalRecordListEntry } from "../domain/progress";

// usePersonalRecords loads all PRs from local SQLite.
export function usePersonalRecords() {
  return useQuery<PersonalRecordListEntry[]>({
    queryKey: ["progress", "records"],
    queryFn: () => getAllPersonalRecords(),
  });
}
