import { Text, View } from "react-native";

import type { TrackingType } from "../../domain/exercise";

// Human-readable labels for each tracking type enum value from the backend.
const LABELS: Record<TrackingType, string> = {
  weight_reps:     "Weight & Reps",
  bodyweight_reps: "Bodyweight Reps",
  duration:        "Duration",
  distance:        "Distance",
};

// Each tracking type gets a distinct color so it's easy to identify at a glance.
// weight_reps uses the accent (lime) since it's the most common type.
const STYLES: Record<TrackingType, { bg: string; text: string }> = {
  weight_reps:     { bg: "bg-accent",       text: "text-background" },
  bodyweight_reps: { bg: "bg-blue-500",     text: "text-white" },
  duration:        { bg: "bg-orange-500",   text: "text-white" },
  distance:        { bg: "bg-emerald-500",  text: "text-white" },
};

interface TrackingTypeBadgeProps {
  type: TrackingType;
}

// TrackingTypeBadge renders a small colored pill for the exercise tracking type.
// Used on the detail and create screens where the type needs to stand out.
export function TrackingTypeBadge({ type }: TrackingTypeBadgeProps) {
  const { bg, text } = STYLES[type];
  return (
    <View className={`self-start px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-semibold ${text}`}>{LABELS[type]}</Text>
    </View>
  );
}
