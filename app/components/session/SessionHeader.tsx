import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionHeaderProps {
  /** Workout name displayed on the left. */
  workoutName: string;
  /** Called when the user taps the Done button. */
  onDone: () => void;
  /** Called when the user taps the back arrow to leave the session (without completing). */
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SessionHeader renders the session header bar:
 * ← back arrow | workout name | [Done] button
 *
 * The back arrow lets the user return to the Today homepage without
 * completing the session. Their logged sets are preserved and they can
 * resume later.
 *
 * Uses SafeAreaView to respect the top notch/status bar.
 */
export function SessionHeader({ workoutName, onDone, onBack }: SessionHeaderProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        {/* Back arrow */}
        {onBack && (
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} className="mr-3">
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        )}

        {/* Workout name */}
        <Text
          className="text-foreground font-semibold text-base flex-1 mr-3"
          numberOfLines={1}
        >
          {workoutName}
        </Text>

        {/* Done button */}
        <TouchableOpacity
          onPress={onDone}
          className="px-3 py-1.5 bg-accent rounded-lg"
          activeOpacity={0.7}
        >
          <Text className="text-black font-bold text-sm">Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
