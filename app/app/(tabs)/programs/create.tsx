import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/core";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { SelectField } from "../../../components/ui/SelectField";
import { TargetInputModal } from "../../../components/ui/TargetInputModal";
import { SchemePicker, type SchemeChoice } from "../../../components/program/SchemePicker";
import { PyramidInputModal } from "../../../components/program/PyramidInputModal";
import { FiveThreeOneInputModal } from "../../../components/program/FiveThreeOneInputModal";
import { DropSetInputModal } from "../../../components/program/DropSetInputModal";
import { usePrograms } from "../../../hooks/usePrograms";
import { useCopyProgram } from "../../../hooks/useCopyProgram";
import { useUpdateProgram } from "../../../hooks/useUpdateProgram";
import { useScaffoldProgram } from "../../../hooks/useScaffoldProgram";
import { useExercises } from "../../../hooks/useExercises";
import { useTheme } from "../../../hooks/useTheme";
import { schemeLabel, formatSchemeSummary } from "../../../lib/schemes";
import type { Exercise } from "../../../domain/exercise";
import type { SetScheme } from "../../../domain/program";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Focus options combine common splits and muscle groups.
const FOCUS_OPTIONS = [
  "Push", "Pull", "Legs", "Upper", "Lower", "Full Body",
  "Chest", "Back", "Shoulders", "Arms", "Core",
];

// Section options the user picks once for the whole program.
const SECTION_OPTIONS = [
  { key: "Warmup",    defaultChecked: false },
  { key: "Compound",  defaultChecked: true },
  { key: "Isolation", defaultChecked: true },
  { key: "Burnout",   defaultChecked: false },
  { key: "Cardio",    defaultChecked: false },
];

const DEFAULT_SECTIONS = SECTION_OPTIONS.filter((s) => s.defaultChecked).map((s) => s.key);

// Smart focus defaults based on number of training days.
const FOCUS_DEFAULTS: Record<number, string[]> = {
  1: ["Full Body"],
  2: ["Upper", "Lower"],
  3: ["Push", "Pull", "Legs"],
  4: ["Push", "Pull", "Legs", "Upper"],
  5: ["Push", "Pull", "Legs", "Upper", "Lower"],
  6: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
};

// Default sets × reps per section type. Compound lifts favour heavier,
// lower-rep work (5×5); isolation favours higher reps (3×10).
const SECTION_DEFAULTS: Record<string, { sets: number; reps: number }> = {
  "Compound":  { sets: 5, reps: 5 },
  "Isolation": { sets: 3, reps: 10 },
  "Warmup":    { sets: 2, reps: 10 },
  "Burnout":   { sets: 3, reps: 15 },
  "Cardio":    { sets: 1, reps: 1 },
};

// Maps each focus to relevant muscle groups for exercise suggestions.
// An empty array means "show all exercises" (no filter).
const FOCUS_MUSCLE_GROUPS: Record<string, string[]> = {
  "Push":      ["chest", "shoulders", "triceps"],
  "Pull":      ["back", "biceps"],
  "Legs":      ["legs"],
  "Upper":     ["chest", "back", "shoulders", "biceps", "triceps"],
  "Lower":     ["legs", "core"],
  "Full Body": [],
  "Chest":     ["chest"],
  "Back":      ["back"],
  "Shoulders": ["shoulders"],
  "Arms":      ["biceps", "triceps"],
  "Core":      ["core"],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// An exercise that the user has added to a section in the builder.
// When setScheme is populated, the exercise uses a progression scheme
// (Pyramid, 5/3/1, Drop Set) and sets/reps/weight are derived from it.
interface BuilderExercise {
  exerciseUuid: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number;
  setScheme?: SetScheme;
}

// The create flow is a state machine with these modes:
//   choose    — pick "from scratch" or "copy"
//   name      — enter program name
//   sections  — pick which sections every workout will have
//   days      — pick number of training days
//   configure — configure focus for each day
//   builder   — pick exercises for each section of each day
//   creating  — spinner while the API call runs
//   copy      — copy flow (pick source, then name the copy)
type Mode = "choose" | "name" | "sections" | "days" | "configure" | "builder" | "creating" | "copy";

// ---------------------------------------------------------------------------
// Exercise picker modal — pick an exercise, pre-filtered by muscle groups.
// ---------------------------------------------------------------------------

function BuilderExercisePicker({
  visible,
  muscleGroups,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  muscleGroups: string[];
  onSelect: (exercise: Exercise) => void;
  onCancel: () => void;
}) {
  const { data: exercises = [] } = useExercises();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Apply muscle group filter unless "showAll" is toggled or no filter set.
  const hasFilter = muscleGroups.length > 0 && !showAll;
  const filtered = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (hasFilter) {
      return ex.muscle_group != null && muscleGroups.includes(ex.muscle_group);
    }
    return true;
  });

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

          {/* Filter toggle */}
          {muscleGroups.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowAll((prev) => !prev)}
              className="mx-4 mb-3"
              activeOpacity={0.7}
            >
              <Text className="text-accent text-sm">
                {showAll ? "Show suggested only" : "Show all exercises"}
              </Text>
            </TouchableOpacity>
          )}

          {/* List */}
          <ScrollView style={{ flex: 1 }}>
            {filtered.map((ex) => (
              <TouchableOpacity
                key={ex.uuid}
                onPress={() => {
                  setSearch("");
                  setShowAll(false);
                  onSelect(ex);
                }}
                className="px-4 py-3 border-b border-border"
                activeOpacity={0.7}
              >
                <Text className="text-foreground text-base">{ex.name}</Text>
                <Text className="text-muted text-sm mt-0.5">
                  {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
                </Text>
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <View className="items-center pt-12">
                <Text className="text-muted text-sm">No exercises found</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateProgramScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const navigation = useNavigation();

  // Shared state
  const [mode, setMode] = useState<Mode>("choose");
  const [programName, setProgramName] = useState("");

  // Scratch flow state
  const [selectedSections, setSelectedSections] = useState<string[]>([...DEFAULT_SECTIONS]);
  const [dayFocuses, setDayFocuses] = useState<string[]>([]);

  // Builder state
  const [builderDayIndex, setBuilderDayIndex] = useState(0);
  // Exercises per section, keyed by "dayIndex-sectionIndex".
  const [builderExercises, setBuilderExercises] = useState<Record<string, BuilderExercise[]>>({});
  // Which section the exercise picker is open for (null = closed).
  const [pickerSectionIndex, setPickerSectionIndex] = useState<number | null>(null);
  // Exercise selected in the picker, waiting for scheme choice / target input.
  const [pendingExercise, setPendingExercise] = useState<Exercise | null>(null);
  // Which scheme the user chose (null = scheme picker not yet answered).
  const [schemeChoice, setSchemeChoice] = useState<SchemeChoice | null>(null);

  // Copy flow state
  const [sourceUuid, setSourceUuid] = useState<string | null>(null);

  // Hooks
  const { data: programs = [] } = usePrograms();
  const scaffoldMutation = useScaffoldProgram();
  const copyMutation = useCopyProgram();
  const updateMutation = useUpdateProgram();

  const isCopyPending = copyMutation.isPending || updateMutation.isPending;

  // -- Back gesture / button (iOS + Android) ----------------------------------

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const builderDayIndexRef = useRef(builderDayIndex);
  builderDayIndexRef.current = builderDayIndex;

  const handlePreventedBack = useCallback(
    ({ data }: { data: { action: any } }) => {
      switch (modeRef.current) {
        case "builder":
          if (builderDayIndexRef.current > 0) {
            setBuilderDayIndex((prev) => prev - 1);
          } else {
            setMode("configure");
          }
          break;
        case "configure":
          setMode("days");
          break;
        case "days":
          setMode("sections");
          break;
        case "sections":
          setMode("name");
          break;
        case "name":
          setMode("choose");
          setProgramName("");
          break;
        case "copy":
          if (sourceUuid) {
            setSourceUuid(null);
            setProgramName("");
          } else {
            setMode("choose");
          }
          break;
        default:
          navigation.dispatch(data.action);
      }
    },
    [navigation, sourceUuid]
  );

  usePreventRemove(mode !== "choose", handlePreventedBack);

  // -- Navigation helpers -----------------------------------------------------

  function handleBack() {
    switch (mode) {
      case "builder":
        if (builderDayIndex > 0) {
          setBuilderDayIndex((prev) => prev - 1);
        } else {
          setMode("configure");
        }
        break;
      case "configure":
        setMode("days");
        break;
      case "days":
        setMode("sections");
        break;
      case "sections":
        setMode("name");
        break;
      case "name":
        setMode("choose");
        setProgramName("");
        break;
      case "copy":
        if (sourceUuid) {
          setSourceUuid(null);
          setProgramName("");
        } else {
          setMode("choose");
        }
        break;
      default:
        router.back();
    }
  }

  function headerTitle(): string {
    switch (mode) {
      case "choose":    return "New Program";
      case "name":      return "Create Program";
      case "sections":  return "Sections";
      case "days":      return "Training Days";
      case "configure": return "Configure Days";
      case "builder":   return `Day ${builderDayIndex + 1} of ${dayFocuses.length}`;
      case "creating":  return "Building...";
      case "copy":      return sourceUuid ? "Name Your Copy" : "Choose Program";
      default:          return "New Program";
    }
  }

  // -- Section toggle ---------------------------------------------------------

  function toggleSection(sectionKey: string) {
    setSelectedSections((prev) => {
      const has = prev.includes(sectionKey);
      if (has && prev.length === 1) return prev;
      return has
        ? prev.filter((s) => s !== sectionKey)
        : [...prev, sectionKey];
    });
  }

  // -- Scratch flow handlers --------------------------------------------------

  function handleSelectDayCount(count: number) {
    const defaults = FOCUS_DEFAULTS[count] ?? Array(count).fill("Push");
    setDayFocuses(defaults);
    setMode("configure");
  }

  function updateDayFocus(index: number, focus: string) {
    setDayFocuses((prev) =>
      prev.map((f, i) => (i === index ? focus : f))
    );
  }

  // -- Builder handlers -------------------------------------------------------

  function addBuilderExercise(sectionIndex: number, exercise: BuilderExercise) {
    const key = `${builderDayIndex}-${sectionIndex}`;
    setBuilderExercises((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), exercise],
    }));
  }

  function removeBuilderExercise(sectionIndex: number, exerciseIndex: number) {
    const key = `${builderDayIndex}-${sectionIndex}`;
    setBuilderExercises((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== exerciseIndex),
    }));
  }

  function handleBuilderNext() {
    if (builderDayIndex < dayFocuses.length - 1) {
      setBuilderDayIndex((prev) => prev + 1);
    } else {
      handleCreateProgram();
    }
  }

  // -- Create program ---------------------------------------------------------

  function handleCreateProgram() {
    setMode("creating");
    scaffoldMutation.mutate(
      {
        name: programName.trim(),
        workouts: dayFocuses.map((focus, dayIndex) => ({
          name: `Day ${dayIndex + 1} — ${focus}`,
          day_number: dayIndex + 1,
          sections: selectedSections.map((secName, secIndex) => {
            const key = `${dayIndex}-${secIndex}`;
            const exercises = (builderExercises[key] || []).map((ex) => ({
              exercise_uuid: ex.exerciseUuid,
              target_sets: ex.sets,
              target_reps: ex.reps,
              target_weight: ex.weight || undefined,
              set_scheme: ex.setScheme ?? undefined,
            }));
            return { name: secName, exercises };
          }),
        })),
      },
      {
        onSuccess: (created) => {
          router.replace(`/programs/${created.uuid}`);
        },
        onError: () => {
          setMode("builder");
        },
      }
    );
  }

  // -- Copy flow handlers -----------------------------------------------------

  function handleSelectSource(uuid: string, sourceName: string) {
    setSourceUuid(uuid);
    setProgramName(`${sourceName} (Copy)`);
  }

  function handleCopyAndRename() {
    if (!sourceUuid) return;
    copyMutation.mutate(sourceUuid, {
      onSuccess: (copied) => {
        const trimmed = programName.trim();
        if (trimmed && trimmed !== copied.name) {
          updateMutation.mutate(
            { uuid: copied.uuid, body: { name: trimmed } },
            {
              onSuccess: () => {
                // Reset mode so usePreventRemove allows navigation,
                // then open the copy in edit mode so the user can customise it.
                setMode("choose");
                router.replace(`/programs/${copied.uuid}?edit=true`);
              },
            }
          );
        } else {
          setMode("choose");
          router.replace(`/programs/${copied.uuid}?edit=true`);
        }
      },
    });
  }

  // -- Derived values for builder ---------------------------------------------

  const currentFocus = dayFocuses[builderDayIndex] ?? "Push";
  const currentMuscleGroups = FOCUS_MUSCLE_GROUPS[currentFocus] ?? [];
  // Look up section-specific defaults for the target input modal.
  const pickerSectionName = pickerSectionIndex !== null ? selectedSections[pickerSectionIndex] : "";
  const sectionDefaults = SECTION_DEFAULTS[pickerSectionName] ?? { sets: 3, reps: 5 };

  // -- Render -----------------------------------------------------------------

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={handleBack} activeOpacity={0.7} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-foreground text-xl font-bold">{headerTitle()}</Text>
      </View>

      {/* ================================================================== */}
      {/* Mode: Choose                                                       */}
      {/* ================================================================== */}
      {mode === "choose" && (
        <View className="px-4 pt-6">
          <TouchableOpacity
            onPress={() => setMode("name")}
            className="bg-surface border border-border rounded-xl px-4 py-4 mb-3 flex-row items-center"
            activeOpacity={0.7}
          >
            <Ionicons name="document-outline" size={22} color={colors.accent} />
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold text-base">Start from scratch</Text>
              <Text className="text-muted text-sm mt-0.5">Build your own program</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode("copy")}
            className="bg-surface border border-border rounded-xl px-4 py-4 flex-row items-center"
            activeOpacity={0.7}
          >
            <Ionicons name="copy-outline" size={22} color={colors.accent} />
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold text-base">Copy a program</Text>
              <Text className="text-muted text-sm mt-0.5">Customize an existing one</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      {/* ================================================================== */}
      {/* Mode: Name                                                         */}
      {/* ================================================================== */}
      {mode === "name" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="px-4 pt-6 flex-1">
            <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
              PROGRAM NAME
            </Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-12 text-foreground text-base mb-6"
              placeholder="e.g., Push Pull Legs"
              placeholderTextColor={colors.muted}
              value={programName}
              onChangeText={setProgramName}
              autoCorrect={false}
              autoCapitalize="words"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => {
                if (programName.trim()) setMode("sections");
              }}
            />

            <TouchableOpacity
              onPress={() => setMode("sections")}
              disabled={!programName.trim()}
              className={`h-14 rounded-2xl items-center justify-center ${
                programName.trim() ? "bg-accent" : "bg-surface"
              }`}
              activeOpacity={0.8}
            >
              <Text
                className={`text-base font-bold ${
                  programName.trim() ? "text-background" : "text-muted"
                }`}
              >
                Next
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ================================================================== */}
      {/* Mode: Sections                                                     */}
      {/* ================================================================== */}
      {mode === "sections" && (
        <View className="px-4 pt-6 flex-1">
          <Text className="text-foreground text-lg font-semibold text-center mb-2">
            What sections should each workout have?
          </Text>
          <Text className="text-muted text-sm text-center mb-6">
            These apply to every training day
          </Text>

          <View className="bg-surface border border-border rounded-xl px-4 py-2 mb-6">
            {SECTION_OPTIONS.map((opt) => {
              const isChecked = selectedSections.includes(opt.key);
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => toggleSection(opt.key)}
                  className="flex-row items-center py-3"
                  activeOpacity={0.7}
                >
                  <View
                    className={`w-5 h-5 rounded border-2 items-center justify-center mr-3 ${
                      isChecked ? "bg-accent border-accent" : "border-border"
                    }`}
                  >
                    {isChecked && (
                      <Ionicons name="checkmark" size={14} color="#0F0F0F" />
                    )}
                  </View>
                  <Text className="text-foreground text-base">{opt.key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => setMode("days")}
            className="h-14 rounded-2xl items-center justify-center bg-accent"
            activeOpacity={0.8}
          >
            <Text className="text-base font-bold text-background">Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ================================================================== */}
      {/* Mode: Days                                                         */}
      {/* ================================================================== */}
      {mode === "days" && (
        <View className="pt-8">
          <Text className="text-foreground text-lg font-semibold text-center mb-2 px-4">
            How many training days?
          </Text>
          <Text className="text-muted text-sm text-center mb-8 px-4">
            Choose how many days per week you want to train
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => handleSelectDayCount(n)}
                className="bg-surface border border-border rounded-2xl items-center justify-center"
                style={{ width: 64, height: 64 }}
                activeOpacity={0.7}
              >
                <Text className="text-foreground text-2xl font-bold">{n}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ================================================================== */}
      {/* Mode: Configure (focus only — sections already chosen)             */}
      {/* ================================================================== */}
      {mode === "configure" && (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          >
            {dayFocuses.map((focus, dayIndex) => (
              <View
                key={dayIndex}
                className="bg-surface border border-border rounded-xl mb-3 px-4 py-3"
              >
                <Text className="text-foreground font-semibold text-base mb-2">
                  Day {dayIndex + 1}
                </Text>

                <SelectField
                  label="Focus"
                  options={FOCUS_OPTIONS}
                  value={focus}
                  onChange={(f) => updateDayFocus(dayIndex, f)}
                />
              </View>
            ))}
          </ScrollView>

          {/* Sticky next button */}
          <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-background">
            <TouchableOpacity
              onPress={() => {
                setBuilderDayIndex(0);
                setMode("builder");
              }}
              className="h-14 rounded-2xl items-center justify-center bg-accent"
              activeOpacity={0.8}
            >
              <Text className="text-base font-bold text-background">
                Next
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ================================================================== */}
      {/* Mode: Builder — pick exercises for each section of each day        */}
      {/* ================================================================== */}
      {mode === "builder" && (
        <View style={{ flex: 1 }}>
          {/* Day sub-header */}
          <View className="px-4 pt-4 pb-2">
            <Text className="text-foreground text-lg font-semibold">
              Day {builderDayIndex + 1} — {currentFocus}
            </Text>
            <Text className="text-muted text-sm mt-1">
              Add exercises to each section, or skip to continue
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          >
            {selectedSections.map((secName, secIndex) => {
              const key = `${builderDayIndex}-${secIndex}`;
              const exercises = builderExercises[key] || [];

              return (
                <View
                  key={secName}
                  className="bg-surface border border-border rounded-xl mb-3 px-4 py-3"
                >
                  {/* Section name */}
                  <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
                    {secName.toUpperCase()}
                  </Text>

                  {/* Added exercises */}
                  {exercises.map((ex, exIndex) => (
                    <View
                      key={`${ex.exerciseUuid}-${exIndex}`}
                      className="flex-row items-center py-2 border-b border-border"
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-foreground text-sm flex-shrink" numberOfLines={1}>
                            {ex.exerciseName}
                          </Text>
                          {ex.setScheme && (
                            <View className="ml-2 bg-accent/20 rounded px-1.5 py-0.5">
                              <Text className="text-accent text-[10px] font-semibold">
                                {schemeLabel(ex.setScheme)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-muted text-xs mt-0.5">
                          {ex.setScheme
                            ? formatSchemeSummary(ex.setScheme)
                            : `${ex.sets}×${ex.reps}${ex.weight > 0 ? ` @${ex.weight}kg` : ""}`
                          }
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeBuilderExercise(secIndex, exIndex)}
                        activeOpacity={0.7}
                        className="p-1"
                      >
                        <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add exercise button */}
                  <TouchableOpacity
                    onPress={() => setPickerSectionIndex(secIndex)}
                    className="flex-row items-center py-2 mt-1"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                    <Text className="text-accent text-sm ml-2">Add Exercise</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          {/* Sticky bottom button */}
          <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-background">
            <TouchableOpacity
              onPress={handleBuilderNext}
              className="h-14 rounded-2xl items-center justify-center bg-accent"
              activeOpacity={0.8}
            >
              <Text className="text-base font-bold text-background">
                {builderDayIndex < dayFocuses.length - 1
                  ? "Next Day"
                  : "Create Program"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Exercise picker modal */}
          <BuilderExercisePicker
            visible={pickerSectionIndex !== null && pendingExercise === null}
            muscleGroups={currentMuscleGroups}
            onSelect={(exercise) => setPendingExercise(exercise)}
            onCancel={() => setPickerSectionIndex(null)}
          />

          {/* Scheme picker — shown after exercise is selected */}
          <SchemePicker
            visible={pendingExercise !== null && schemeChoice === null}
            exerciseName={pendingExercise?.name ?? ""}
            onSelect={(choice) => setSchemeChoice(choice)}
            onCancel={() => {
              setPendingExercise(null);
              // Go back to the exercise picker.
            }}
          />

          {/* Straight sets — uses the existing TargetInputModal */}
          <TargetInputModal
            visible={pendingExercise !== null && schemeChoice === "straight"}
            exerciseName={pendingExercise?.name ?? ""}
            initialSets={sectionDefaults.sets}
            initialReps={sectionDefaults.reps}
            onSubmit={(targets) => {
              if (pendingExercise && pickerSectionIndex !== null) {
                addBuilderExercise(pickerSectionIndex, {
                  exerciseUuid: pendingExercise.uuid,
                  exerciseName: pendingExercise.name,
                  ...targets,
                });
              }
              setPendingExercise(null);
              setPickerSectionIndex(null);
              setSchemeChoice(null);
            }}
            onCancel={() => {
              setSchemeChoice(null);
              // Go back to scheme picker.
            }}
          />

          {/* Pyramid modal */}
          <PyramidInputModal
            visible={pendingExercise !== null && schemeChoice === "pyramid"}
            exerciseName={pendingExercise?.name ?? ""}
            onSubmit={(scheme) => {
              if (pendingExercise && pickerSectionIndex !== null) {
                addBuilderExercise(pickerSectionIndex, {
                  exerciseUuid: pendingExercise.uuid,
                  exerciseName: pendingExercise.name,
                  sets: scheme.sets.length,
                  reps: scheme.sets[0]?.reps ?? 1,
                  weight: scheme.sets[0]?.weight ?? 0,
                  setScheme: scheme,
                });
              }
              setPendingExercise(null);
              setPickerSectionIndex(null);
              setSchemeChoice(null);
            }}
            onCancel={() => {
              setSchemeChoice(null);
            }}
          />

          {/* 5/3/1 modal */}
          <FiveThreeOneInputModal
            visible={pendingExercise !== null && schemeChoice === "531"}
            exerciseName={pendingExercise?.name ?? ""}
            onSubmit={(scheme) => {
              if (pendingExercise && pickerSectionIndex !== null) {
                addBuilderExercise(pickerSectionIndex, {
                  exerciseUuid: pendingExercise.uuid,
                  exerciseName: pendingExercise.name,
                  sets: scheme.sets.length,
                  reps: scheme.sets[0]?.reps ?? 1,
                  weight: scheme.one_rep_max ?? scheme.sets[0]?.weight ?? 0,
                  setScheme: scheme,
                });
              }
              setPendingExercise(null);
              setPickerSectionIndex(null);
              setSchemeChoice(null);
            }}
            onCancel={() => {
              setSchemeChoice(null);
            }}
          />

          {/* Drop set modal */}
          <DropSetInputModal
            visible={pendingExercise !== null && schemeChoice === "dropset"}
            exerciseName={pendingExercise?.name ?? ""}
            onSubmit={(scheme) => {
              if (pendingExercise && pickerSectionIndex !== null) {
                addBuilderExercise(pickerSectionIndex, {
                  exerciseUuid: pendingExercise.uuid,
                  exerciseName: pendingExercise.name,
                  sets: scheme.sets.length,
                  reps: scheme.sets[0]?.reps ?? 1,
                  weight: scheme.sets[0]?.weight ?? 0,
                  setScheme: scheme,
                });
              }
              setPendingExercise(null);
              setPickerSectionIndex(null);
              setSchemeChoice(null);
            }}
            onCancel={() => {
              setSchemeChoice(null);
            }}
          />
        </View>
      )}

      {/* ================================================================== */}
      {/* Mode: Creating (loading)                                           */}
      {/* ================================================================== */}
      {mode === "creating" && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text className="text-muted text-sm mt-4">Building your program...</Text>
        </View>
      )}

      {/* ================================================================== */}
      {/* Mode: Copy — step 1: pick source program                           */}
      {/* ================================================================== */}
      {mode === "copy" && !sourceUuid && (
        <FlatList
          style={{ flex: 1, marginTop: 8 }}
          data={programs}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelectSource(item.uuid, item.name)}
              className="px-4 py-3 border-b border-border flex-row items-center"
              activeOpacity={0.7}
            >
              <View className="flex-1">
                <Text className="text-foreground text-base">{item.name}</Text>
                <Text className="text-muted text-sm mt-0.5">
                  {item.workout_count} {item.workout_count === 1 ? "workout" : "workouts"}
                </Text>
              </View>
              {item.is_prebuilt && (
                <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center pt-16">
              <Text className="text-muted text-sm">No programs to copy</Text>
            </View>
          }
        />
      )}

      {/* ================================================================== */}
      {/* Mode: Copy — step 2: name the copy                                 */}
      {/* ================================================================== */}
      {mode === "copy" && sourceUuid && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="px-4 pt-6 flex-1">
            <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
              PROGRAM NAME
            </Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-12 text-foreground text-base mb-6"
              placeholder="Name for your copy"
              placeholderTextColor={colors.muted}
              value={programName}
              onChangeText={setProgramName}
              autoCorrect={false}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
            />

            {(copyMutation.error || updateMutation.error) && (
              <Text className="text-red-400 text-sm mb-4">
                {(copyMutation.error || updateMutation.error)?.message}
              </Text>
            )}

            <TouchableOpacity
              onPress={handleCopyAndRename}
              disabled={!programName.trim() || isCopyPending}
              className={`h-14 rounded-2xl items-center justify-center ${
                programName.trim() && !isCopyPending ? "bg-accent" : "bg-surface"
              }`}
              activeOpacity={0.8}
            >
              <Text
                className={`text-base font-bold ${
                  programName.trim() && !isCopyPending ? "text-background" : "text-muted"
                }`}
              >
                {isCopyPending ? "Creating..." : "Create Copy"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
