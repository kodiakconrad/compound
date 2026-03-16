import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";
import { ExerciseCard } from "./ExerciseCard";
import type { SessionSection, SetLogResponse } from "../../hooks/useActiveSession";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SectionCardProps {
  section: SessionSection;
  /** Starts expanded by default. */
  defaultExpanded?: boolean;
  /** Called when the user taps an unlogged set button. */
  onLogSet: (sectionExerciseUUID: string, setNumber: number) => void;
  /** Called when the user taps a logged set button to un-log it. */
  onDeleteSetLog?: (sectionExerciseUUID: string, setLogUUID: string) => void;
  /** Called when the user long-presses a set button. */
  onAdjustSet?: (
    sectionExerciseUUID: string,
    setNumber: number,
    existingLog?: SetLogResponse
  ) => void;
  /** Called when the user taps an exercise name to view its detail page. */
  onExercisePress?: (exerciseUUID: string) => void;
  /** Called when the user long-presses an exercise name to swap it out. */
  onSubstitute?: (sectionExerciseUUID: string) => void;
  /** Map of sectionExerciseUUID → substituted exercise name. */
  substitutions?: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SectionCard renders a collapsible section within the session screen.
 * Contains a section header (name, chevron) and a list of ExerciseCards.
 */
export function SectionCard({
  section,
  defaultExpanded = true,
  onLogSet,
  onDeleteSetLog,
  onAdjustSet,
  onExercisePress,
  onSubstitute,
  substitutions,
}: SectionCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View className="mb-2">
      {/* Section header */}
      <TouchableOpacity
        onPress={() => setExpanded((prev) => !prev)}
        className="flex-row items-center py-2 px-4"
        activeOpacity={0.7}
      >
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={14}
          color={colors.muted}
        />
        <Text className="text-muted text-xs font-semibold uppercase tracking-wider ml-2 flex-1">
          {section.name}
        </Text>
      </TouchableOpacity>

      {/* Exercises */}
      {expanded && (
        <View>
          {section.exercises.map((ex) => (
            <ExerciseCard
              key={ex.section_exercise_uuid}
              exercise={ex}
              onLogSet={(setNum) => onLogSet(ex.section_exercise_uuid, setNum)}
              onDeleteSetLog={
                onDeleteSetLog
                  ? (setLogUUID) =>
                      onDeleteSetLog(ex.section_exercise_uuid, setLogUUID)
                  : undefined
              }
              onAdjustSet={
                onAdjustSet
                  ? (setNum, log) =>
                      onAdjustSet(ex.section_exercise_uuid, setNum, log)
                  : undefined
              }
              onExercisePress={onExercisePress}
              onSubstitute={
                onSubstitute
                  ? () => onSubstitute(ex.section_exercise_uuid)
                  : undefined
              }
              substitutedName={substitutions?.get(ex.section_exercise_uuid)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
