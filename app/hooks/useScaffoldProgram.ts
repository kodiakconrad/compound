import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ProgramDetail, SetScheme } from "../lib/types";

// The body sent to POST /api/v1/programs/scaffold.
// Creates a program with workouts, sections, and optionally exercises in a
// single request.

export interface ScaffoldExercise {
  exercise_uuid: string;
  target_sets?: number;
  target_reps?: number;
  target_weight?: number;
  set_scheme?: SetScheme;
}

export interface ScaffoldSection {
  name: string;
  exercises?: ScaffoldExercise[];
}

export interface ScaffoldWorkout {
  name: string;
  day_number: number;
  sections: ScaffoldSection[];
}

export interface ScaffoldProgramBody {
  name: string;
  workouts: ScaffoldWorkout[];
}

// useScaffoldProgram wraps POST /api/v1/programs/scaffold.
//
// The backend creates the program, all workouts, all sections, and all
// exercises atomically in a single transaction. Returns the full ProgramDetail
// tree.
export function useScaffoldProgram() {
  const queryClient = useQueryClient();

  return useMutation<ProgramDetail, Error, ScaffoldProgramBody>({
    mutationFn: (body) =>
      api.post<ProgramDetail>("/api/v1/programs/scaffold", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
