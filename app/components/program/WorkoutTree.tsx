import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Workout, Section, SectionExercise } from "../../lib/types";
import { schemeLabel, formatSchemeSummary } from "../../lib/schemes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorkoutTreeProps {
  workouts: Workout[];
  // Edit mode props — wired in sub-step 9. When isEditMode is false (default),
  // all callbacks are ignored and the tree renders read-only.
  isEditMode?: boolean;
  onAddWorkout?: () => void;
  onAddSection?: (workoutUuid: string) => void;
  onAddExercise?: (workoutUuid: string, sectionUuid: string) => void;
  onDeleteWorkout?: (workoutUuid: string) => void;
  onDeleteSection?: (workoutUuid: string, sectionUuid: string) => void;
  onDeleteExercise?: (workoutUuid: string, sectionUuid: string, exerciseUuid: string) => void;
  onRenameWorkout?: (workoutUuid: string, currentName: string) => void;
  onRenameSection?: (workoutUuid: string, sectionUuid: string, currentName: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// formatTarget builds a human-readable target string like "3x5 @80kg".
// If the exercise has a set_scheme, it returns the scheme summary instead
// (e.g., "12×60 → 10×70 → 8×80" for pyramid). Handles missing values
// gracefully — bodyweight exercises show just "3x12".
function formatTarget(ex: SectionExercise): string {
  // If the exercise has a set scheme, show the per-set summary instead of
  // flat targets. The scheme summary is more informative (e.g., "5×55 → 5×62.5 → 5×72.5").
  if (ex.set_scheme) {
    return formatSchemeSummary(ex.set_scheme);
  }

  const parts: string[] = [];

  if (ex.target_sets != null && ex.target_reps != null) {
    parts.push(`${ex.target_sets}x${ex.target_reps}`);
  } else if (ex.target_sets != null) {
    parts.push(`${ex.target_sets} sets`);
  } else if (ex.target_reps != null) {
    parts.push(`${ex.target_reps} reps`);
  }

  if (ex.target_weight != null) {
    parts.push(`@${ex.target_weight}kg`);
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
// Sub-components
// ---------------------------------------------------------------------------

function ExerciseItem({
  exercise,
  isEditMode,
  onDelete,
}: {
  exercise: SectionExercise;
  isEditMode: boolean;
  onDelete?: () => void;
}) {
  const target = formatTarget(exercise);

  return (
    <View className="flex-row items-center justify-between py-2 pl-12 pr-4">
      <View className="flex-1 mr-2">
        <View className="flex-row items-center">
          <Text className="text-white text-sm">{exercise.exercise_name}</Text>
          {exercise.set_scheme && (
            <Text className="text-accent text-xs font-semibold ml-2">
              {schemeLabel(exercise.set_scheme)}
            </Text>
          )}
        </View>
        {target.length > 0 && (
          <Text className="text-muted text-xs mt-0.5">{target}</Text>
        )}
      </View>
      {isEditMode && onDelete && (
        <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={16} color="#6B7280" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function SectionItem({
  section,
  workoutUuid,
  isExpanded,
  onToggle,
  isEditMode,
  onAddExercise,
  onDeleteSection,
  onDeleteExercise,
  onRenameSection,
}: {
  section: Section;
  workoutUuid: string;
  isExpanded: boolean;
  onToggle: () => void;
  isEditMode: boolean;
  onAddExercise?: () => void;
  onDeleteSection?: () => void;
  onDeleteExercise?: (exerciseUuid: string) => void;
  onRenameSection?: () => void;
}) {
  return (
    <View>
      {/* Section header */}
      <TouchableOpacity
        onPress={onToggle}
        className="flex-row items-center py-2 pl-8 pr-4"
        activeOpacity={0.7}
      >
        <Ionicons
          name={isExpanded ? "chevron-down" : "chevron-forward"}
          size={14}
          color="#6B7280"
        />
        <Text className="text-muted text-xs font-semibold uppercase tracking-wider ml-2 flex-1">
          {section.name}
        </Text>
        {isEditMode && (
          <View className="flex-row items-center">
            {onRenameSection && (
              <TouchableOpacity onPress={onRenameSection} className="ml-3" activeOpacity={0.7}>
                <Ionicons name="pencil-outline" size={14} color="#6B7280" />
              </TouchableOpacity>
            )}
            {onDeleteSection && (
              <TouchableOpacity onPress={onDeleteSection} className="ml-3" activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={14} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Exercises — only visible when section is expanded */}
      {isExpanded && (
        <View>
          {section.exercises.map((ex) => (
            <ExerciseItem
              key={ex.uuid}
              exercise={ex}
              isEditMode={isEditMode}
              onDelete={
                onDeleteExercise ? () => onDeleteExercise(ex.uuid) : undefined
              }
            />
          ))}
          {isEditMode && onAddExercise && (
            <TouchableOpacity
              onPress={onAddExercise}
              className="py-2 pl-12 pr-4"
              activeOpacity={0.7}
            >
              <Text className="text-accent text-xs font-medium">+ Add Exercise</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function WorkoutItem({
  workout,
  isExpanded,
  onToggle,
  expandedSections,
  onToggleSection,
  isEditMode,
  onAddSection,
  onAddExercise,
  onDeleteWorkout,
  onDeleteSection,
  onDeleteExercise,
  onRenameWorkout,
  onRenameSection,
}: {
  workout: Workout;
  isExpanded: boolean;
  onToggle: () => void;
  expandedSections: Set<string>;
  onToggleSection: (uuid: string) => void;
  isEditMode: boolean;
  onAddSection?: () => void;
  onAddExercise?: (sectionUuid: string) => void;
  onDeleteWorkout?: () => void;
  onDeleteSection?: (sectionUuid: string) => void;
  onDeleteExercise?: (sectionUuid: string, exerciseUuid: string) => void;
  onRenameWorkout?: () => void;
  onRenameSection?: (sectionUuid: string) => void;
}) {
  return (
    <View className="mb-2">
      {/* Workout header */}
      <TouchableOpacity
        onPress={onToggle}
        className="flex-row items-center py-3 px-4 bg-surface border-b border-border"
        activeOpacity={0.7}
      >
        <Ionicons
          name={isExpanded ? "chevron-down" : "chevron-forward"}
          size={18}
          color="#E8FF47"
        />
        <Text className="text-white font-semibold text-sm ml-2 flex-1">
          {workout.name}
        </Text>
        {isEditMode && (
          <View className="flex-row items-center">
            {onRenameWorkout && (
              <TouchableOpacity onPress={onRenameWorkout} className="ml-3" activeOpacity={0.7}>
                <Ionicons name="pencil-outline" size={16} color="#6B7280" />
              </TouchableOpacity>
            )}
            {onDeleteWorkout && (
              <TouchableOpacity onPress={onDeleteWorkout} className="ml-3" activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={16} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Sections — only visible when workout is expanded */}
      {isExpanded && (
        <View className="bg-surface">
          {workout.sections.map((sec) => (
            <SectionItem
              key={sec.uuid}
              section={sec}
              workoutUuid={workout.uuid}
              isExpanded={expandedSections.has(sec.uuid)}
              onToggle={() => onToggleSection(sec.uuid)}
              isEditMode={isEditMode}
              onAddExercise={
                onAddExercise ? () => onAddExercise(sec.uuid) : undefined
              }
              onDeleteSection={
                onDeleteSection ? () => onDeleteSection(sec.uuid) : undefined
              }
              onDeleteExercise={
                onDeleteExercise
                  ? (exUuid) => onDeleteExercise(sec.uuid, exUuid)
                  : undefined
              }
              onRenameSection={
                onRenameSection ? () => onRenameSection(sec.uuid) : undefined
              }
            />
          ))}
          {isEditMode && onAddSection && (
            <TouchableOpacity
              onPress={onAddSection}
              className="py-2 pl-8 pr-4"
              activeOpacity={0.7}
            >
              <Text className="text-accent text-xs font-medium">+ Add Section</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// WorkoutTree renders the collapsible workout → section → exercise tree
// for a program detail screen. By default it is read-only; pass
// isEditMode={true} to show add/delete/rename controls.
export function WorkoutTree({
  workouts,
  isEditMode = false,
  onAddWorkout,
  onAddSection,
  onAddExercise,
  onDeleteWorkout,
  onDeleteSection,
  onDeleteExercise,
  onRenameWorkout,
  onRenameSection,
}: WorkoutTreeProps) {
  // Track which workouts and sections are expanded. Default: first workout
  // expanded with all its sections expanded.
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (workouts.length > 0) {
      initial.add(workouts[0].uuid);
    }
    return initial;
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (workouts.length > 0) {
      for (const sec of workouts[0].sections) {
        initial.add(sec.uuid);
      }
    }
    return initial;
  });

  function toggleWorkout(uuid: string) {
    setExpandedWorkouts((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  }

  function toggleSection(uuid: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  }

  return (
    <View>
      {workouts.map((w) => (
        <WorkoutItem
          key={w.uuid}
          workout={w}
          isExpanded={expandedWorkouts.has(w.uuid)}
          onToggle={() => toggleWorkout(w.uuid)}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
          isEditMode={isEditMode}
          onAddSection={
            onAddSection ? () => onAddSection(w.uuid) : undefined
          }
          onAddExercise={
            onAddExercise
              ? (secUuid) => onAddExercise(w.uuid, secUuid)
              : undefined
          }
          onDeleteWorkout={
            onDeleteWorkout ? () => onDeleteWorkout(w.uuid) : undefined
          }
          onDeleteSection={
            onDeleteSection
              ? (secUuid) => onDeleteSection(w.uuid, secUuid)
              : undefined
          }
          onDeleteExercise={
            onDeleteExercise
              ? (secUuid, exUuid) => onDeleteExercise(w.uuid, secUuid, exUuid)
              : undefined
          }
          onRenameWorkout={
            onRenameWorkout ? () => onRenameWorkout(w.uuid, w.name) : undefined
          }
          onRenameSection={
            onRenameSection
              ? (secUuid) => {
                  const sec = w.sections.find((s) => s.uuid === secUuid);
                  if (sec) onRenameSection(w.uuid, secUuid, sec.name);
                }
              : undefined
          }
        />
      ))}
      {isEditMode && onAddWorkout && (
        <TouchableOpacity
          onPress={onAddWorkout}
          className="py-3 px-4"
          activeOpacity={0.7}
        >
          <Text className="text-accent text-sm font-medium">+ Add Workout</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
