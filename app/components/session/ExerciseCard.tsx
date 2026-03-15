import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ExerciseAnimation } from "../exercise/ExerciseAnimation";
import { SetButton } from "./SetButton";
import type { SessionExercise, SetLogResponse } from "../../hooks/useActiveSession";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a human-readable target string like "3×5 @ 102.5kg".
 * Prefers computed_target_weight (progression-adjusted); falls back to static.
 */
function formatTarget(ex: SessionExercise): string {
  const parts: string[] = [];

  if (ex.target_sets != null && ex.target_reps != null) {
    parts.push(`${ex.target_sets}×${ex.target_reps}`);
  } else if (ex.target_sets != null) {
    parts.push(`${ex.target_sets} sets`);
  } else if (ex.target_reps != null) {
    parts.push(`${ex.target_reps} reps`);
  }

  const weight = ex.computed_target_weight ?? ex.static_target_weight;
  if (weight != null) {
    parts.push(`@ ${weight}kg`);
  }
  if (ex.target_duration != null) {
    parts.push(`${ex.target_duration}s`);
  }
  if (ex.target_distance != null) {
    parts.push(`${ex.target_distance}m`);
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExerciseCardProps {
  exercise: SessionExercise;
  /** Called when the user taps an unlogged set button (log at target). */
  onLogSet: (setNumber: number) => void;
  /** Called when the user taps a logged set button (un-log it). */
  onDeleteSetLog?: (setLogUUID: string) => void;
  /** Called when the user long-presses a set button (open adjust sheet). */
  onAdjustSet?: (setNumber: number, existingLog?: SetLogResponse) => void;
  /** Called when the user taps the exercise name to view its detail page. */
  onExercisePress?: (exerciseUUID: string) => void;
  /** Called when the user long-presses the exercise name to swap it out. */
  onSubstitute?: () => void;
  /** If this exercise has been substituted, the new exercise's name. */
  substitutedName?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ExerciseCard renders one exercise within the session screen.
 * Shows: animation thumbnail + name + target line + row of set buttons + "+" button.
 *
 * The "+" button appends extra set slots beyond the program's target_sets,
 * so the user can log more sets than prescribed. Fewer sets are handled by
 * simply not logging them before completing the session.
 */
export function ExerciseCard({ exercise, onLogSet, onDeleteSetLog, onAdjustSet, onExercisePress, onSubstitute, substitutedName }: ExerciseCardProps) {
  // Use substituted name if the exercise has been swapped, otherwise the original.
  const displayName = substitutedName ?? exercise.exercise_name;
  const target = formatTarget(exercise);
  const programSets = exercise.target_sets ?? 0;

  // Track how many extra slots the user has added via the "+" button.
  const [extraSlots, setExtraSlots] = useState(0);

  // Build set button data. set_logs are keyed by set_number.
  const logsBySetNumber = new Map<number, SetLogResponse>();
  for (const log of exercise.set_logs) {
    logsBySetNumber.set(log.set_number, log);
  }

  // The highest logged set_number might exceed programSets (e.g. if the user
  // added extra sets in a previous visit). Account for that too.
  const highestLoggedSet = exercise.set_logs.reduce(
    (max, log) => Math.max(max, log.set_number),
    0
  );

  // Total visible slots = max of (program target, highest logged, program + extras added).
  const displayedSets = Math.max(programSets, highestLoggedSet, programSets + extraSlots);

  // The next set to log is the first unlogged set number within displayedSets.
  const nextSetNumber = (() => {
    for (let i = 1; i <= displayedSets; i++) {
      if (!logsBySetNumber.has(i)) return i;
    }
    return null; // all displayed sets logged
  })();

  function handleAddSet() {
    setExtraSlots((prev) => prev + 1);
  }

  return (
    <View className="py-3 px-4">
      {/* Name + target row — tap to view detail, long-press to swap */}
      <TouchableOpacity
        className="flex-row items-center mb-2"
        activeOpacity={0.7}
        onPress={() => onExercisePress?.(exercise.exercise_uuid)}
        onLongPress={() => onSubstitute?.()}
      >
        <ExerciseAnimation exerciseName={displayName} size={32} />
        <View className="flex-1 ml-2">
          <Text className="text-white text-sm font-medium">
            {displayName}
          </Text>
          {substitutedName && (
            <Text className="text-accent text-xs mt-0.5">
              Swapped from {exercise.exercise_name}
            </Text>
          )}
          {target.length > 0 && !substitutedName && (
            <Text className="text-muted text-xs mt-0.5">{target}</Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Set buttons row + add button */}
      <View className="flex-row flex-wrap items-center mt-1 ml-10">
        {Array.from({ length: displayedSets }, (_, i) => {
          const setNum = i + 1;
          const log = logsBySetNumber.get(setNum);
          const isLogged = log !== undefined;
          const isNext = setNum === nextSetNumber;

          return (
            <SetButton
              key={setNum}
              setNumber={setNum}
              isLogged={isLogged}
              actualReps={log?.actual_reps ?? undefined}
              isNext={isNext}
              onPress={() => {
                if (isLogged) {
                  if (log && onDeleteSetLog) {
                    onDeleteSetLog(log.uuid);
                  }
                } else {
                  onLogSet(setNum);
                }
              }}
              onLongPress={() => onAdjustSet?.(setNum, log)}
            />
          );
        })}

        {/* "+" button to add an extra set slot */}
        <TouchableOpacity
          onPress={handleAddSet}
          activeOpacity={0.7}
          className="w-10 h-10 rounded-lg border border-dashed border-border items-center justify-center mx-1"
        >
          <Ionicons name="add" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
