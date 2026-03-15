import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { TargetInputModal } from "../../../components/ui/TargetInputModal";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { usePreventRemove } from "@react-navigation/core";
import { Ionicons } from "@expo/vector-icons";

import { WorkoutTree } from "../../../components/program/WorkoutTree";
import { useProgramDetail } from "../../../hooks/useProgramDetail";
import { useCopyProgram } from "../../../hooks/useCopyProgram";
import { useStartCycle } from "../../../hooks/useStartCycle";
import { useAddWorkout } from "../../../hooks/useAddWorkout";
import { useAddSection } from "../../../hooks/useAddSection";
import { useAddSectionExercise } from "../../../hooks/useAddSectionExercise";
import { useDeleteWorkout } from "../../../hooks/useDeleteWorkout";
import { useDeleteSection } from "../../../hooks/useDeleteSection";
import { useDeleteSectionExercise } from "../../../hooks/useDeleteSectionExercise";
import { useUpdateWorkout } from "../../../hooks/useUpdateWorkout";
import { useUpdateSection } from "../../../hooks/useUpdateSection";
import { useExercises } from "../../../hooks/useExercises";
import { useTheme } from "../../../hooks/useTheme";
import { ApiError } from "../../../lib/api";
import type { Exercise } from "../../../lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Prompt modal — a reusable modal with a TextInput for naming things.
// ---------------------------------------------------------------------------

function NamePromptModal({
  visible,
  title,
  placeholder,
  initialValue,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  initialValue: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const { colors } = useTheme();

  // Reset the local value when the modal opens with a new initialValue.
  // We use a key on the modal content to force a fresh mount.
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
        activeOpacity={1}
        onPress={onCancel}
      >
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
          <TouchableOpacity activeOpacity={1}>
            <View className="bg-surface border border-border rounded-2xl p-4">
              <Text className="text-foreground font-semibold text-base mb-3">{title}</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 h-12 text-foreground text-base mb-4"
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                defaultValue={initialValue}
                onChangeText={setValue}
                autoFocus
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (value.trim()) onSubmit(value.trim());
                }}
              />
              <View className="flex-row justify-end">
                <TouchableOpacity onPress={onCancel} className="px-4 py-2 mr-2" activeOpacity={0.7}>
                  <Text className="text-muted text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (value.trim()) onSubmit(value.trim());
                  }}
                  disabled={!value.trim()}
                  className="bg-accent rounded-lg px-4 py-2"
                  activeOpacity={0.7}
                >
                  <Text className="text-background text-sm font-semibold">{submitLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Exercise picker modal — select an exercise to add to a section.
// ---------------------------------------------------------------------------

function ExercisePickerModal({
  visible,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  onSelect: (exercise: Exercise) => void;
  onCancel: () => void;
}) {
  const { data: exercises = [] } = useExercises();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");

  const filtered = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.background, marginTop: 60 }}>
        <SafeAreaView edges={[]} style={{ flex: 1 }}>
          {/* Header */}
          <View className="flex-row items-center px-4 py-3 border-b border-border">
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7} className="mr-3">
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-foreground text-lg font-bold flex-1">Pick Exercise</Text>
          </View>

          {/* Search */}
          <View className="mx-4 my-3 flex-row items-center bg-surface border border-border rounded-xl px-3 h-10">
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              className="flex-1 ml-2 text-foreground text-sm"
              placeholder="Search exercises..."
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {/* List */}
          <ScrollView style={{ flex: 1 }}>
            {filtered.map((ex) => (
              <TouchableOpacity
                key={ex.uuid}
                onPress={() => onSelect(ex)}
                className="px-4 py-3 border-b border-border"
                activeOpacity={0.7}
              >
                <Text className="text-foreground text-base">{ex.name}</Text>
                <Text className="text-muted text-sm mt-0.5">
                  {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProgramDetailScreen() {
  const { uuid, edit } = useLocalSearchParams<{ uuid: string; edit?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const programUuid = uuid ?? "";

  const { data: program, isLoading, isError } = useProgramDetail(programUuid);
  const copyMutation = useCopyProgram();
  const startCycleMutation = useStartCycle();
  const addWorkoutMutation = useAddWorkout();
  const addSectionMutation = useAddSection();
  const addExerciseMutation = useAddSectionExercise();
  const deleteWorkoutMutation = useDeleteWorkout();
  const deleteSectionMutation = useDeleteSection();
  const deleteExerciseMutation = useDeleteSectionExercise();
  const updateWorkoutMutation = useUpdateWorkout();
  const updateSectionMutation = useUpdateSection();

  // -- Edit mode state --------------------------------------------------------

  // If the user just copied a prebuilt program, we navigate here with
  // ?edit=true so they land directly in edit mode and can customise the copy.
  const [isEditMode, setIsEditMode] = useState(edit === "true");

  // -- Back gesture / button — cancel edit mode on swipe-back ----------------
  // We use a ref so the usePreventRemove callback always reads the latest
  // value without re-creating the callback (avoids stale closures).

  const isEditModeRef = useRef(isEditMode);
  isEditModeRef.current = isEditMode;

  const handlePreventedBack = useCallback(
    ({ data }: { data: { action: any } }) => {
      if (isEditModeRef.current) {
        // Exit edit mode instead of navigating away.
        setIsEditMode(false);
      } else {
        // Not in edit mode — allow normal back navigation.
        navigation.dispatch(data.action);
      }
    },
    [navigation],
  );

  usePreventRemove(isEditMode, handlePreventedBack);

  // Name prompt modal state
  const [namePrompt, setNamePrompt] = useState<{
    visible: boolean;
    title: string;
    placeholder: string;
    initialValue: string;
    submitLabel: string;
    onSubmit: (value: string) => void;
  }>({ visible: false, title: "", placeholder: "", initialValue: "", submitLabel: "Save", onSubmit: () => {} });

  // Exercise picker state
  const [exercisePicker, setExercisePicker] = useState<{
    visible: boolean;
    workoutUuid: string;
    sectionUuid: string;
  }>({ visible: false, workoutUuid: "", sectionUuid: "" });

  // Target input state (shown after picking an exercise)
  const [targetInput, setTargetInput] = useState<{
    visible: boolean;
    exerciseUuid: string;
    exerciseName: string;
    workoutUuid: string;
    sectionUuid: string;
  }>({ visible: false, exerciseUuid: "", exerciseName: "", workoutUuid: "", sectionUuid: "" });

  // Confirmation dialog states
  const [startCycleDialog, setStartCycleDialog] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false, title: "", message: "",
  });
  const [deleteWorkoutDialog, setDeleteWorkoutDialog] = useState<{
    visible: boolean; workoutUuid: string;
  }>({ visible: false, workoutUuid: "" });
  const [deleteSectionDialog, setDeleteSectionDialog] = useState<{
    visible: boolean; workoutUuid: string; sectionUuid: string;
  }>({ visible: false, workoutUuid: "", sectionUuid: "" });

  // -- Actions ----------------------------------------------------------------

  function handleCopy() {
    if (!program) return;
    copyMutation.mutate(program.uuid, {
      onSuccess: (copied) => {
        // Navigate to the copy with edit mode on so the user can customise it.
        router.replace(`/programs/${copied.uuid}?edit=true`);
      },
      onError: () => {
        setErrorDialog({ visible: true, title: "Error", message: "Failed to copy program. Please try again." });
      },
    });
  }

  function handleStartCycle() {
    if (!program) return;
    setStartCycleDialog(true);
  }

  function handleConfirmStartCycle() {
    if (!program) return;
    setStartCycleDialog(false);
    startCycleMutation.mutate(program.uuid, {
      onSuccess: () => {
        router.replace("/(tabs)/");
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === "conflict") {
          setErrorDialog({ visible: true, title: "Already Active", message: "This program already has an active cycle." });
        } else {
          setErrorDialog({ visible: true, title: "Error", message: "Failed to start cycle. Please try again." });
        }
      },
    });
  }

  // -- Edit mode callbacks ----------------------------------------------------

  function handleAddWorkout() {
    if (!program) return;
    const nextDay = program.workouts.length + 1;
    setNamePrompt({
      visible: true,
      title: "Add Workout",
      placeholder: `e.g., Day ${nextDay} — Push`,
      initialValue: "",
      submitLabel: "Add",
      onSubmit: (name) => {
        setNamePrompt((p) => ({ ...p, visible: false }));
        addWorkoutMutation.mutate({
          programUuid,
          body: { name, day_number: nextDay },
        });
      },
    });
  }

  function handleAddSection(workoutUuid: string) {
    setNamePrompt({
      visible: true,
      title: "Add Section",
      placeholder: "e.g., Compound",
      initialValue: "",
      submitLabel: "Add",
      onSubmit: (name) => {
        setNamePrompt((p) => ({ ...p, visible: false }));
        addSectionMutation.mutate({
          programUuid,
          workoutUuid,
          body: { name },
        });
      },
    });
  }

  function handleAddExercise(workoutUuid: string, sectionUuid: string) {
    setExercisePicker({ visible: true, workoutUuid, sectionUuid });
  }

  function handleExerciseSelected(exercise: Exercise) {
    const { workoutUuid, sectionUuid } = exercisePicker;
    setExercisePicker({ visible: false, workoutUuid: "", sectionUuid: "" });
    setTargetInput({
      visible: true,
      exerciseUuid: exercise.uuid,
      exerciseName: exercise.name,
      workoutUuid,
      sectionUuid,
    });
  }

  function handleTargetSubmit(targets: { sets: number; reps: number; weight: number }) {
    const { exerciseUuid, workoutUuid, sectionUuid } = targetInput;
    setTargetInput({ visible: false, exerciseUuid: "", exerciseName: "", workoutUuid: "", sectionUuid: "" });
    addExerciseMutation.mutate({
      programUuid,
      workoutUuid,
      sectionUuid,
      body: {
        exercise_uuid: exerciseUuid,
        target_sets: targets.sets,
        target_reps: targets.reps,
        target_weight: targets.weight > 0 ? targets.weight : undefined,
      },
    });
  }

  function handleDeleteWorkout(workoutUuid: string) {
    setDeleteWorkoutDialog({ visible: true, workoutUuid });
  }

  function handleConfirmDeleteWorkout() {
    const { workoutUuid } = deleteWorkoutDialog;
    setDeleteWorkoutDialog({ visible: false, workoutUuid: "" });
    deleteWorkoutMutation.mutate({ programUuid, workoutUuid });
  }

  function handleDeleteSection(workoutUuid: string, sectionUuid: string) {
    setDeleteSectionDialog({ visible: true, workoutUuid, sectionUuid });
  }

  function handleConfirmDeleteSection() {
    const { workoutUuid, sectionUuid } = deleteSectionDialog;
    setDeleteSectionDialog({ visible: false, workoutUuid: "", sectionUuid: "" });
    deleteSectionMutation.mutate({ programUuid, workoutUuid, sectionUuid });
  }

  function handleDeleteExercise(workoutUuid: string, sectionUuid: string, exerciseUuid: string) {
    deleteExerciseMutation.mutate({ programUuid, workoutUuid, sectionUuid, exerciseUuid });
  }

  function handleRenameWorkout(workoutUuid: string, currentName: string) {
    setNamePrompt({
      visible: true,
      title: "Rename Workout",
      placeholder: "Workout name",
      initialValue: currentName,
      submitLabel: "Save",
      onSubmit: (name) => {
        setNamePrompt((p) => ({ ...p, visible: false }));
        updateWorkoutMutation.mutate({
          programUuid,
          workoutUuid,
          body: { name },
        });
      },
    });
  }

  function handleRenameSection(workoutUuid: string, sectionUuid: string, currentName: string) {
    setNamePrompt({
      visible: true,
      title: "Rename Section",
      placeholder: "Section name",
      initialValue: currentName,
      submitLabel: "Save",
      onSubmit: (name) => {
        setNamePrompt((p) => ({ ...p, visible: false }));
        updateSectionMutation.mutate({
          programUuid,
          workoutUuid,
          sectionUuid,
          body: { name },
        });
      },
    });
  }

  // -- Render -----------------------------------------------------------------

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !program) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="mr-3">
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-foreground text-xl font-bold flex-1">Program not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const workoutLabel = program.workouts.length === 1 ? "workout" : "workouts";
  const isBusy = copyMutation.isPending || startCycleMutation.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="mr-3">
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-foreground text-xl font-bold flex-1" numberOfLines={1}>
            {program.name}
          </Text>
          {program.is_prebuilt && (
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
          )}
        </View>

        {/* Metadata + action buttons */}
        <View className="px-4 pb-3">
          <Text className="text-muted text-sm mb-3">
            {program.workouts.length} {workoutLabel} · Created {formatDate(program.created_at)}
          </Text>

          {program.has_active_cycle ? (
            <View className="flex-row items-center bg-surface border border-border rounded-lg px-4 py-2">
              <Ionicons name="lock-closed" size={14} color={colors.muted} />
              <Text className="text-muted text-sm ml-2">Locked — active cycle in progress</Text>
            </View>
          ) : (
            <View className="flex-row">
              {program.is_prebuilt ? (
                <TouchableOpacity
                  onPress={handleCopy}
                  disabled={isBusy}
                  className="flex-row items-center bg-surface border border-border rounded-lg px-4 py-2 mr-2"
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.accent} />
                  <Text className="text-accent text-sm font-medium ml-2">
                    {copyMutation.isPending ? "Copying..." : "Copy to My Programs"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsEditMode(!isEditMode)}
                  className="flex-row items-center bg-surface border border-border rounded-lg px-4 py-2 mr-2"
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isEditMode ? "checkmark" : "pencil-outline"}
                    size={16}
                    color={colors.accent}
                  />
                  <Text className="text-accent text-sm font-medium ml-2">
                    {isEditMode ? "Done" : "Edit"}
                  </Text>
                </TouchableOpacity>
              )}

              {!isEditMode && (
                <TouchableOpacity
                  onPress={handleStartCycle}
                  disabled={isBusy}
                  className="flex-row items-center bg-accent rounded-lg px-4 py-2"
                  activeOpacity={0.7}
                >
                  <Ionicons name="play" size={16} color="#0F0F0F" />
                  <Text className="text-background text-sm font-semibold ml-2">
                    {startCycleMutation.isPending ? "Starting..." : "Start Cycle"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Workout tree — scrollable */}
      <ScrollView style={{ flex: 1 }}>
        {program.workouts.length === 0 && !isEditMode ? (
          <View className="items-center justify-center pt-16 px-8">
            <Text className="text-muted text-sm text-center">
              This program has no workouts yet. Tap Edit to start building.
            </Text>
          </View>
        ) : (
          <WorkoutTree
            workouts={program.workouts}
            isEditMode={isEditMode}
            onAddWorkout={handleAddWorkout}
            onAddSection={handleAddSection}
            onAddExercise={handleAddExercise}
            onDeleteWorkout={handleDeleteWorkout}
            onDeleteSection={handleDeleteSection}
            onDeleteExercise={handleDeleteExercise}
            onRenameWorkout={handleRenameWorkout}
            onRenameSection={handleRenameSection}
          />
        )}
      </ScrollView>

      {/* Modals */}
      <NamePromptModal
        visible={namePrompt.visible}
        title={namePrompt.title}
        placeholder={namePrompt.placeholder}
        initialValue={namePrompt.initialValue}
        submitLabel={namePrompt.submitLabel}
        onSubmit={namePrompt.onSubmit}
        onCancel={() => setNamePrompt((p) => ({ ...p, visible: false }))}
      />
      <ExercisePickerModal
        visible={exercisePicker.visible}
        onSelect={handleExerciseSelected}
        onCancel={() => setExercisePicker({ visible: false, workoutUuid: "", sectionUuid: "" })}
      />
      <TargetInputModal
        visible={targetInput.visible}
        exerciseName={targetInput.exerciseName}
        onSubmit={handleTargetSubmit}
        onCancel={() => setTargetInput({ visible: false, exerciseUuid: "", exerciseName: "", workoutUuid: "", sectionUuid: "" })}
      />

      {/* Start cycle confirmation */}
      <ConfirmDialog
        visible={startCycleDialog}
        title="Start Cycle"
        message={`This will create sessions for all ${program?.workouts.length ?? 0} workouts. Ready to begin?`}
        confirmLabel="Start"
        onConfirm={handleConfirmStartCycle}
        onCancel={() => setStartCycleDialog(false)}
      />

      {/* Delete workout confirmation */}
      <ConfirmDialog
        visible={deleteWorkoutDialog.visible}
        title="Delete Workout"
        message="Are you sure? This will delete all sections and exercises in this workout."
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteWorkout}
        onCancel={() => setDeleteWorkoutDialog({ visible: false, workoutUuid: "" })}
      />

      {/* Delete section confirmation */}
      <ConfirmDialog
        visible={deleteSectionDialog.visible}
        title="Delete Section"
        message="This will also delete all exercises in this section."
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteSection}
        onCancel={() => setDeleteSectionDialog({ visible: false, workoutUuid: "", sectionUuid: "" })}
      />

      {/* Error dialog (single OK button) */}
      <ConfirmDialog
        visible={errorDialog.visible}
        title={errorDialog.title}
        message={errorDialog.message}
        confirmLabel="OK"
        onConfirm={() => setErrorDialog({ visible: false, title: "", message: "" })}
        onCancel={() => setErrorDialog({ visible: false, title: "", message: "" })}
      />
    </View>
  );
}
