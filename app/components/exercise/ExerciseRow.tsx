import { Text, TouchableOpacity, View } from "react-native";

import type { TrackingType } from "../../lib/staticData";
import { ExerciseAnimation } from "./ExerciseAnimation";

// Short inline labels for tracking types — used in the metadata line of the row.
// (TrackingTypeBadge uses the full labels; these are abbreviated for tight rows.)
const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps:     "Wt & Reps",
  bodyweight_reps: "Bodyweight",
  duration:        "Duration",
  distance:        "Distance",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ExerciseRowProps {
  name: string;
  muscleGroup: string | undefined;
  equipment: string | undefined;
  trackingType: TrackingType;
  onPress: () => void;
}

// ExerciseRow renders one exercise in the Library list.
// Layout matches the UI spec: name on the first line, metadata on the second.
export function ExerciseRow({ name, muscleGroup, equipment, trackingType, onPress }: ExerciseRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-4 py-3 border-b border-border flex-row items-center"
      activeOpacity={0.7}
    >
      {/* Lottie animation thumbnail — tappable independently to expand */}
      <ExerciseAnimation exerciseName={name} size={40} />
      <View className="flex-1 ml-3">
        <Text className="text-white font-medium text-base">{name}</Text>
        <Text className="text-muted text-sm mt-0.5">
          {[muscleGroup, equipment].filter(Boolean).map((s) => capitalize(s as string)).join(" · ")} · {TRACKING_LABELS[trackingType]}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
