import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";
import type { SessionSection } from "../../hooks/useActiveSession";

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

/** Build a short target string like "3×5 @ 100kg" for the preview. */
function formatPreviewTarget(ex: {
  target_sets?: number | null;
  target_reps?: number | null;
  computed_target_weight?: number | null;
  static_target_weight?: number | null;
}): string {
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

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UpcomingSession shows a preview of the next session to start.
 * Displays workout name, first 2 exercises, and a "Start Session" button.
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

  // Flatten all exercises across sections for the preview.
  const allExercises = sections.flatMap((sec) => sec.exercises);
  const previewExercises = allExercises.slice(0, 2);
  const remaining = allExercises.length - previewExercises.length;
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
        <Text className="text-muted text-xs mb-4">
          {total} exercise{total !== 1 ? "s" : ""}
        </Text>

        {/* Exercise previews */}
        {previewExercises.map((ex, i) => {
          const target = formatPreviewTarget(ex);
          return (
            <View
              key={ex.section_exercise_uuid}
              className={`flex-row items-center justify-between py-2.5 ${
                i < previewExercises.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <Text className="text-foreground text-sm flex-1" numberOfLines={1}>
                {ex.exercise_name}
              </Text>
              {target.length > 0 && (
                <Text className="text-muted text-sm ml-3">{target}</Text>
              )}
            </View>
          );
        })}

        {/* Remaining count */}
        {remaining > 0 && (
          <Text className="text-muted text-xs mt-2">
            + {remaining} more exercise{remaining !== 1 ? "s" : ""}
          </Text>
        )}

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
