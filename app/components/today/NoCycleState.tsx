import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NoCycleStateProps {
  /** Called when the user taps "Browse Programs →". */
  onBrowsePrograms: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NoCycleState is the Today tab empty state shown when no active cycle exists.
 * It displays a friendly message and a button to navigate to the Programs tab.
 */
export function NoCycleState({ onBrowsePrograms }: NoCycleStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      {/* Icon */}
      <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-6">
        <Ionicons name="barbell-outline" size={32} color="#6B7280" />
      </View>

      {/* Message */}
      <Text className="text-white text-lg font-semibold text-center mb-2">
        No active program
      </Text>
      <Text className="text-muted text-sm text-center mb-8">
        Start one to begin tracking workouts.
      </Text>

      {/* CTA button */}
      <TouchableOpacity
        onPress={onBrowsePrograms}
        className="flex-row items-center bg-accent px-6 py-3 rounded-lg"
        activeOpacity={0.7}
      >
        <Text className="text-black font-semibold text-sm">Browse Programs</Text>
        <Ionicons name="arrow-forward" size={16} color="#000000" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );
}
