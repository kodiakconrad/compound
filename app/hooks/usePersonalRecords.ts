import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { PersonalRecordEntry } from "../lib/types";

// usePersonalRecords fetches the heaviest eligible set for every exercise
// from GET /api/v1/progress/records. Returns an array of PR entries sorted
// by exercise name.
export function usePersonalRecords() {
  return useQuery<PersonalRecordEntry[]>({
    queryKey: ["progress", "records"],
    queryFn: () => api.get<PersonalRecordEntry[]>("/api/v1/progress/records"),
  });
}
