import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  scaffoldProgram,
  type ScaffoldInput,
} from "../db/repositories/program_repository";
import type { Program, SetScheme } from "../domain/program";

// Re-export scaffold types for component use.
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

// useScaffoldProgram creates a full program tree in local SQLite.
export function useScaffoldProgram() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, ScaffoldProgramBody>({
    mutationFn: async (body) => {
      // Map scaffold body to repository input format.
      const input: ScaffoldInput = {
        name: body.name,
        workouts: body.workouts.map((w) => ({
          name: w.name,
          day_number: w.day_number,
          sections: w.sections.map((s) => ({
            name: s.name,
            exercises: (s.exercises ?? []).map((e) => ({
              exercise_uuid: e.exercise_uuid,
              target_sets: e.target_sets,
              target_reps: e.target_reps,
              target_weight: e.target_weight,
              set_scheme: e.set_scheme,
            })),
          })),
        })),
      };
      return scaffoldProgram(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
