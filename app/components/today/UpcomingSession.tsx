import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";
import { formatSchemeSummary } from "../../lib/schemes";
import type { SessionSection, SessionExercise } from "../../hooks/useActiveSession";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UpcomingSessionProps {
  /** Program name shown as a muted subtitle (e.g., "PPL Program"). */
  programName?: string;
  /** Name of the workout (e.g., "Push — Day A"). */
  workoutName: string;
  /** "Session 3 of 12" style label. */
  sessionLabel: string;
  /** Sections with exercises for the preview. */
  sections: SessionSection[];
  /** Called when the user taps "Start Session". */
  onStart: () => void;
  /** Whether the start mutation is loading. */
  isStarting?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count total exercises across all sections. */
function totalExerciseCount(sections: SessionSection[]): number {
  return sections.reduce((sum, sec) => sum + sec.exercises.length, 0);
}

/**
 * Build a short target string for the preview, e.g. "3×5 @ 100kg" for a flat
 * target, or "12×40 → 10×50 → 8×60 → 6×70" for a scheme-based exercise
 * (pyramid, 5/3/1, dropset) where each set has its own reps/weight.
 */
function formatPreviewTarget(ex: SessionExercise): string {
  if (ex.set_scheme) {
    return formatSchemeSummary(ex.set_scheme);
  }

  const parts: string[] = [];

  if (ex.target_sets != null && ex.target_reps != null) {
    parts.push(`${ex.target_sets}×${ex.target_reps}`);
  } else if (ex.target_sets != null) {
    parts.push(`${ex.target_sets} sets`);
  } else if (ex.target_reps != null) {
    parts.push(`${ex.target_reps} reps`);
  }

  // Prefer computed (progression-adjusted) weight; fall back to static.
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
// Component
// ---------------------------------------------------------------------------

/**
 * UpcomingSession shows a preview of the next session to start.
 * Displays workout name, every exercise grouped by section, and a
 * "Start Session" button — the full session, so there's nothing to discover
 * for the first time only after pressing Start.
 */
export function UpcomingSession({
  programName,
  workoutName,
  sessionLabel,
  sections,
  onStart,
  isStarting = false,
}: UpcomingSessionProps) {
  const { colors } = useTheme();
  const total = totalExerciseCount(sections);

  return (
    <View className="px-4 pt-4">
      {/* Session label */}
      <Text className="text-muted text-xs uppercase tracking-wider mb-3">
        {sessionLabel}
      </Text>

      {/* Card */}
      <View className="bg-surface rounded-xl border border-border p-4">
        {/* Header row */}
        <View className="flex-row items-center mb-1">
          <Text className="text-accent text-xs font-semibold uppercase tracking-wider">
            Up Next
          </Text>
        </View>

        {/* Program name (when multiple cycles are active) */}
        {programName && (
          <Text className="text-muted text-xs mb-0.5">{programName}</Text>
        )}

        {/* Workout name */}
        <Text className="text-foreground text-lg font-bold mb-1">
          {workoutName}
        </Text>

        {/* Exercise count */}
        <Text className="text-muted text-xs mb-3">
          {total} exercise{total !== 1 ? "s" : ""}
        </Text>

        {/* Every exercise, grouped by section (Compound/Isolation/Burnout) */}
        {sections.map((sec) => (
          <View key={sec.uuid} className="mb-3">
            <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-1.5">
              {sec.name}
            </Text>
            {sec.exercises.map((ex, i) => {
              const target = formatPreviewTarget(ex);
              return (
                <View
                  key={ex.section_exercise_uuid}
                  className={`flex-row items-center justify-between py-2 ${
                    i < sec.exercises.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <Text className="text-foreground text-sm flex-1 mr-3" numberOfLines={1}>
                    {ex.exercise_name}
                  </Text>
                  {target.length > 0 && (
                    <Text className="text-muted text-xs" numberOfLines={1}>
                      {target}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Start button */}
        <TouchableOpacity
          onPress={onStart}
          disabled={isStarting}
          className={`mt-4 py-3 rounded-lg items-center ${
            isStarting ? "bg-accent/50" : "bg-accent"
          }`}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <Ionicons
              name="play"
              size={16}
              color="#000000"
              style={{ marginRight: 6 }}
            />
            <Text className="text-black font-bold text-sm">
              {isStarting ? "Starting…" : "Start Session"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
