import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useTheme } from "../../hooks/useTheme";
import { SessionHeader } from "./SessionHeader";
import { SectionCard } from "./SectionCard";
import { RestTimerBar } from "./RestTimerBar";
import { AdjustSetSheet } from "./AdjustSetSheet";
import { SubstitutionPickerModal } from "./SubstitutionPickerModal";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import {
  type ActiveSession,
  type SessionExercise,
  type SetLogResponse,
} from "../../hooks/useActiveSession";
import { useLogSet } from "../../hooks/useLogSet";
import { useDeleteSetLog } from "../../hooks/useDeleteSetLog";
import { useCompleteSession } from "../../hooks/useCompleteSession";
import { useExercises } from "../../hooks/useExercises";
import { useTimerStore } from "../../store/timer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tracks a substituted exercise for a given section_exercise slot. */
interface Substitution {
  exerciseUuid: string;
  exerciseName: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionViewProps {
  /** The active session data from useActiveSession(). */
  session: ActiveSession;
  /** Called after the session is successfully completed. */
  onCompleted: () => void;
  /** Called when the user taps the back arrow to leave without completing. */
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SessionView renders the full workout UI for an in-progress session.
 *
 * It is rendered inline on the Today tab (not a separate route) so the
 * bottom tab bar stays visible and tab switching preserves the view.
 */
export function SessionView({ session, onCompleted, onBack }: SessionViewProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const logSetMutation = useLogSet();
  const deleteSetLogMutation = useDeleteSetLog();
  const completeMutation = useCompleteSession();
  const timerStart = useTimerStore((s) => s.start);

  // Full exercise list — used to look up muscle_group for substitution filtering.
  const { data: exercises = [] } = useExercises();

  // --- Adjust sheet state ---
  const [adjustSheet, setAdjustSheet] = useState<{
    exercise: SessionExercise;
    setNumber: number;
    existingLog?: SetLogResponse;
    sectionExerciseUUID: string;
  } | null>(null);

  // --- Substitution state ---
  const [substitutions, setSubstitutions] = useState<Map<string, Substitution>>(
    new Map()
  );
  const [substitutionTarget, setSubstitutionTarget] = useState<string | null>(
    null
  );

  // --- Confirm dialog state ---
  const [completeDialogVisible, setCompleteDialogVisible] = useState(false);
  const [swapConfirm, setSwapConfirm] = useState<{
    visible: boolean;
    sectionExerciseUUID: string;
    exerciseName: string;
    setCount: number;
  }>({ visible: false, sectionExerciseUUID: "", exerciseName: "", setCount: 0 });

  // --- Find exercise + its section by section_exercise_uuid ---
  function findExercise(sectionExerciseUUID: string) {
    for (const sec of session.sections) {
      for (const ex of sec.exercises) {
        if (ex.section_exercise_uuid === sectionExerciseUUID) {
          return { exercise: ex, section: sec };
        }
      }
    }
    return null;
  }

  /** Look up a full exercise's muscle_group from the exercises list. */
  function getMuscleGroup(exerciseUuid: string): string | null {
    const ex = exercises.find((e) => e.uuid === exerciseUuid);
    return ex?.muscle_group ?? null;
  }

  // --- Handlers ---

  function handleDone() {
    setCompleteDialogVisible(true);
  }

  function handleConfirmComplete() {
    setCompleteDialogVisible(false);
    completeMutation.mutate(
      {
        cycleUUID: session.cycle_uuid,
        sessionUUID: session.uuid,
      },
      {
        onSuccess: () => onCompleted(),
      }
    );
  }

  function handleDeleteSetLog(sectionExerciseUUID: string, setLogUUID: string) {
    deleteSetLogMutation.mutate({
      cycleUUID: session.cycle_uuid,
      sessionUUID: session.uuid,
      setLogUUID,
      sectionExerciseUUID,
    });
  }

  function handleLogSet(sectionExerciseUUID: string, setNumber: number) {
    const found = findExercise(sectionExerciseUUID);
    if (!found) return;

    const { exercise, section } = found;
    const weight = exercise.computed_target_weight ?? exercise.static_target_weight;
    const sub = substitutions.get(sectionExerciseUUID);

    logSetMutation.mutate(
      {
        cycleUUID: session.cycle_uuid,
        sessionUUID: session.uuid,
        body: {
          section_exercise_uuid: sectionExerciseUUID,
          exercise_uuid: sub?.exerciseUuid,
          set_number: setNumber,
          target_reps: exercise.target_reps ?? undefined,
          actual_reps: exercise.target_reps ?? undefined,
          weight: weight ?? undefined,
          duration: exercise.target_duration ?? undefined,
          distance: exercise.target_distance ?? undefined,
        },
      },
      {
        onSuccess: () => {
          const restSeconds = section.rest_seconds ?? 90;
          timerStart(restSeconds);
        },
      }
    );
  }

  function handleAdjustSet(
    sectionExerciseUUID: string,
    setNumber: number,
    existingLog?: SetLogResponse
  ) {
    const found = findExercise(sectionExerciseUUID);
    if (!found) return;

    setAdjustSheet({
      exercise: found.exercise,
      setNumber,
      existingLog,
      sectionExerciseUUID,
    });
  }

  function handleAdjustedLog(values: {
    setNumber: number;
    actualReps?: number;
    weight?: number;
    duration?: number;
    distance?: number;
  }) {
    if (!adjustSheet) return;

    const found = findExercise(adjustSheet.sectionExerciseUUID);
    if (!found) return;

    const { section } = found;
    const sub = substitutions.get(adjustSheet.sectionExerciseUUID);

    logSetMutation.mutate(
      {
        cycleUUID: session.cycle_uuid,
        sessionUUID: session.uuid,
        body: {
          section_exercise_uuid: adjustSheet.sectionExerciseUUID,
          exercise_uuid: sub?.exerciseUuid,
          set_number: values.setNumber,
          target_reps: adjustSheet.exercise.target_reps ?? undefined,
          actual_reps: values.actualReps,
          weight: values.weight,
          duration: values.duration,
          distance: values.distance,
        },
      },
      {
        onSuccess: () => {
          const restSeconds = section.rest_seconds ?? 90;
          timerStart(restSeconds);
        },
      }
    );
  }

  function handleSubstitute(sectionExerciseUUID: string) {
    const found = findExercise(sectionExerciseUUID);
    if (!found) return;

    const { exercise } = found;
    const hasLoggedSets = exercise.set_logs.length > 0;

    if (hasLoggedSets) {
      setSwapConfirm({
        visible: true,
        sectionExerciseUUID,
        exerciseName: exercise.exercise_name,
        setCount: exercise.set_logs.length,
      });
    } else {
      setSubstitutionTarget(sectionExerciseUUID);
    }
  }

  function handleConfirmSwap() {
    const { sectionExerciseUUID } = swapConfirm;
    setSwapConfirm((prev) => ({ ...prev, visible: false }));

    const found = findExercise(sectionExerciseUUID);
    if (!found) return;

    // Delete all logged sets for this exercise before showing the picker.
    for (const log of found.exercise.set_logs) {
      deleteSetLogMutation.mutate({
        cycleUUID: session.cycle_uuid,
        sessionUUID: session.uuid,
        setLogUUID: log.uuid,
        sectionExerciseUUID,
      });
    }
    setSubstitutionTarget(sectionExerciseUUID);
  }

  function handleSubstitutionSelected(selected: { uuid: string; name: string }) {
    if (!substitutionTarget) return;

    setSubstitutions((prev) => {
      const next = new Map(prev);
      next.set(substitutionTarget, {
        exerciseUuid: selected.uuid,
        exerciseName: selected.name,
      });
      return next;
    });
    setSubstitutionTarget(null);
  }

  // Build a Map<sectionExerciseUUID, displayName> for SectionCard.
  const substitutionNames = new Map<string, string>();
  for (const [key, sub] of substitutions) {
    substitutionNames.set(key, sub.exerciseName);
  }

  // Look up the muscle group for the exercise being substituted.
  const targetExercise = substitutionTarget
    ? findExercise(substitutionTarget)?.exercise
    : null;
  const targetMuscleGroup = targetExercise
    ? getMuscleGroup(targetExercise.exercise_uuid)
    : null;

  // --- Render ---

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SessionHeader
        workoutName={session.workout_name}
        onDone={handleDone}
        onBack={onBack}
      />
      <ScrollView className="flex-1">
        {session.sections.map((sec) => (
          <SectionCard
            key={sec.uuid}
            section={sec}
            onLogSet={handleLogSet}
            onDeleteSetLog={handleDeleteSetLog}
            onAdjustSet={handleAdjustSet}
            onExercisePress={(uuid) => router.push(`/library/exercise/${uuid}`)}
            onSubstitute={handleSubstitute}
            substitutions={substitutionNames}
          />
        ))}
      </ScrollView>
      <RestTimerBar />

      {/* Adjust set bottom sheet */}
      {adjustSheet && (
        <AdjustSetSheet
          visible={true}
          exercise={adjustSheet.exercise}
          setNumber={adjustSheet.setNumber}
          existingLog={adjustSheet.existingLog}
          onLog={handleAdjustedLog}
          onClose={() => setAdjustSheet(null)}
        />
      )}

      {/* Substitution picker modal */}
      <SubstitutionPickerModal
        visible={substitutionTarget !== null}
        currentExerciseName={targetExercise?.exercise_name ?? ""}
        muscleGroup={targetMuscleGroup}
        onSelect={(ex) => handleSubstitutionSelected({ uuid: ex.uuid, name: ex.name })}
        onCancel={() => setSubstitutionTarget(null)}
      />

      {/* Complete session confirmation — dark themed */}
      <ConfirmDialog
        visible={completeDialogVisible}
        title="Complete session?"
        message="This will mark the session as done."
        confirmLabel="Complete"
        onConfirm={handleConfirmComplete}
        onCancel={() => setCompleteDialogVisible(false)}
      />

      {/* Swap exercise confirmation — dark themed */}
      <ConfirmDialog
        visible={swapConfirm.visible}
        title="Swap exercise?"
        message={`${swapConfirm.exerciseName} has ${swapConfirm.setCount} logged set(s). They will be removed if you swap.`}
        confirmLabel="Swap"
        onConfirm={handleConfirmSwap}
        onCancel={() => setSwapConfirm((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}
