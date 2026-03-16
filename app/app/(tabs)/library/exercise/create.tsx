import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { SelectField } from "../../../../components/ui/SelectField";
import { useExerciseFilters } from "../../../../hooks/useExerciseFilters";
import { useCreateExercise } from "../../../../hooks/useCreateExercise";
import { useTheme } from "../../../../hooks/useTheme";
import type { TrackingType } from "../../../../lib/staticData";

// The 4 tracking types with labels and example descriptions shown next to each radio button.
const TRACKING_OPTIONS: { type: TrackingType; label: string; description: string }[] = [
  { type: "weight_reps",     label: "Weight & Reps",   description: "e.g., 3×5 @ 80 kg" },
  { type: "bodyweight_reps", label: "Bodyweight Reps", description: "e.g., 3×12 pull-ups" },
  { type: "duration",        label: "Duration",         description: "e.g., 3 min plank" },
  { type: "distance",        label: "Distance",         description: "e.g., 5 km run" },
];

// Fallback options shown while the filters API call is loading.
const FALLBACK_MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Full Body"];
const FALLBACK_EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CreateExerciseScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  // Form state — all inputs are "controlled", meaning React owns the value.
  // Every keystroke calls setName/setTrackingType/etc., and the input always
  // renders whatever is in state. This makes it easy to validate before submitting.
  const [name, setName] = useState("");
  const [trackingType, setTrackingType] = useState<TrackingType>("weight_reps");
  const [muscleGroup, setMuscleGroup] = useState("Chest");
  const [equipment, setEquipment] = useState("Barbell");

  // useExerciseFilters provides the real enum values from the backend.
  // Falls back to hardcoded lists while loading (staleTime is 1 day, so this
  // only hits the network once per app session).
  const { data: filters } = useExerciseFilters();
  const muscleGroupOptions = filters
    ? filters.muscle_groups.map(capitalize)
    : FALLBACK_MUSCLE_GROUPS;
  const equipmentOptions = filters
    ? filters.equipment.map(capitalize)
    : FALLBACK_EQUIPMENT;

  // useCreateExercise wraps POST /api/v1/exercises.
  // isPending is true while the request is in-flight — we disable the button during this time.
  const { mutate: createExercise, isPending, error } = useCreateExercise();

  // The submit button is disabled until the user has entered a name (and not while submitting).
  const canSubmit = name.trim().length > 0 && !isPending;

  function handleSubmit() {
    createExercise(
      {
        name: name.trim(),
        // The backend expects lowercase enum values ("chest", "barbell", etc.).
        // SelectField shows capitalized labels so we lowercase before sending.
        muscle_group: muscleGroup.toLowerCase(),
        equipment: equipment.toLowerCase(),
        tracking_type: trackingType,
      },
      {
        onSuccess: () => router.back(),
      }
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-foreground text-xl font-bold">New Exercise</Text>
      </View>

      {/* KeyboardAvoidingView shifts the content up when the keyboard appears,
          keeping the active input field visible. "padding" mode works best on iOS. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Name field */}
          <Text className="text-muted text-xs font-semibold tracking-widest mb-2">NAME</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 h-12 text-foreground text-base mb-6"
            placeholder="e.g., Incline Bench Press"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="done"
          />

          {/* Tracking type — radio button group */}
          <Text className="text-muted text-xs font-semibold tracking-widest mb-3">
            TRACKING TYPE
          </Text>
          <View className="mb-6">
            {TRACKING_OPTIONS.map((opt) => {
              const isSelected = trackingType === opt.type;
              return (
                <TouchableOpacity
                  key={opt.type}
                  onPress={() => setTrackingType(opt.type)}
                  className="flex-row items-center py-3 border-b border-border"
                  activeOpacity={0.7}
                >
                  {/* Radio circle: outer ring + filled center dot when selected */}
                  <View
                    className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${
                      isSelected ? "border-accent" : "border-border"
                    }`}
                  >
                    {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-accent" />}
                  </View>
                  <View>
                    <Text className="text-foreground text-base">{opt.label}</Text>
                    <Text className="text-muted text-xs">{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Muscle group + equipment dropdowns */}
          <Text className="text-muted text-xs font-semibold tracking-widest mb-2">DETAILS</Text>
          <View className="mb-6">
            <SelectField
              label="Muscle group"
              options={muscleGroupOptions}
              value={muscleGroup}
              onChange={setMuscleGroup}
            />
            <SelectField
              label="Equipment"
              options={equipmentOptions}
              value={equipment}
              onChange={setEquipment}
            />
          </View>

          {/* API error — shown below the dropdowns when the create request fails */}
          {error && (
            <Text className="text-red-400 text-sm mb-4">{error.message}</Text>
          )}

          {/* Submit button — accent when ready, muted when name is empty or submitting */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`h-14 rounded-2xl items-center justify-center ${
              canSubmit ? "bg-accent" : "bg-surface"
            }`}
            activeOpacity={0.8}
          >
            <Text className={`text-base font-bold ${canSubmit ? "text-background" : "text-muted"}`}>
              {isPending ? "Creating…" : "Create Exercise"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
