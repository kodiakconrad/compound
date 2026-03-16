import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";
import { ExerciseAnimation } from "../exercise/ExerciseAnimation";
import type {
  ActiveSession,
  SessionSection,
  SessionExercise,
  SetLogResponse,
} from "../../hooks/useActiveSession";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format "3×5 @ 102.5kg" from an exercise's targets. */
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
  if (weight != null) parts.push(`@ ${weight}kg`);
  if (ex.target_duration != null) parts.push(`${ex.target_duration}s`);
  if (ex.target_distance != null) parts.push(`${ex.target_distance}m`);

  return parts.join(" ");
}

/** Format a single set log line like "Set 1: 5 reps @ 60kg". */
function formatSetLog(log: SetLogResponse): string {
  const parts: string[] = [`Set ${log.set_number}`];

  if (log.actual_reps != null) parts.push(`${log.actual_reps} reps`);
  if (log.weight != null) parts.push(`@ ${log.weight}kg`);
  if (log.duration != null) parts.push(`${log.duration}s`);
  if (log.distance != null) parts.push(`${log.distance}m`);

  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReadOnlyExercise({ exercise }: { exercise: SessionExercise }) {
  const { colors } = useTheme();
  const target = formatTarget(exercise);
  const sortedLogs = [...exercise.set_logs].sort(
    (a, b) => a.set_number - b.set_number
  );

  return (
    <View className="py-3 px-4">
      {/* Name + target */}
      <View className="flex-row items-center mb-1">
        <ExerciseAnimation exerciseName={exercise.exercise_name} size={28} />
        <View className="flex-1 ml-2">
          <Text className="text-foreground text-sm font-medium">
            {exercise.exercise_name}
          </Text>
          {target.length > 0 && (
            <Text className="text-muted text-xs">{target}</Text>
          )}
        </View>
      </View>

      {/* Logged sets */}
      {sortedLogs.length > 0 ? (
        <View className="ml-10 mt-1">
          {sortedLogs.map((log) => (
            <View key={log.uuid} className="flex-row items-center py-0.5">
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.accent}
                style={{ marginRight: 6 }}
              />
              <Text className="text-foreground text-xs">
                {formatSetLog(log)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="ml-10 mt-1">
          <Text className="text-muted text-xs italic">No sets logged</Text>
        </View>
      )}
    </View>
  );
}

function ReadOnlySection({ section }: { section: SessionSection }) {
  const { colors } = useTheme();

  return (
    <View className="mb-2">
      <View className="flex-row items-center py-2 px-4">
        <Ionicons name="chevron-down" size={14} color={colors.muted} />
        <Text className="text-muted text-xs font-semibold uppercase tracking-wider ml-2 flex-1">
          {section.name}
        </Text>
      </View>
      {section.exercises.map((ex) => (
        <ReadOnlyExercise
          key={ex.section_exercise_uuid}
          exercise={ex}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CompletedSessionDetailProps {
  session: ActiveSession | undefined;
  isLoading: boolean;
}

/**
 * CompletedSessionDetail renders a read-only view of a completed session.
 * Shows each section and exercise with their logged sets — no interactive
 * buttons since the session is already done.
 */
export function CompletedSessionDetail({
  session,
  isLoading,
}: CompletedSessionDetailProps) {
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-muted text-sm text-center">
          Session not found
        </Text>
      </View>
    );
  }

  // Format the completion date for the subtitle.
  const completedDate = session.completed_at
    ? new Date(session.completed_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  // Count total logged sets across all exercises.
  const totalSets = session.sections.reduce(
    (sum, sec) =>
      sum + sec.exercises.reduce((s, ex) => s + ex.set_logs.length, 0),
    0
  );

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Summary header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-foreground text-xl font-bold">
          {session.workout_name}
        </Text>
        <View className="flex-row items-center mt-1">
          {session.status === "completed" ? (
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={colors.accent}
              style={{ marginRight: 4 }}
            />
          ) : (
            <Ionicons
              name="close-circle"
              size={14}
              color={colors.muted}
              style={{ marginRight: 4 }}
            />
          )}
          <Text className="text-muted text-xs">
            {session.status === "completed" ? "Completed" : "Skipped"}
            {completedDate ? ` · ${completedDate}` : ""}
            {` · ${totalSets} set${totalSets !== 1 ? "s" : ""} logged`}
          </Text>
        </View>
      </View>

      {/* Sections */}
      {session.sections.map((sec) => (
        <ReadOnlySection key={sec.uuid} section={sec} />
      ))}
    </ScrollView>
  );
}
