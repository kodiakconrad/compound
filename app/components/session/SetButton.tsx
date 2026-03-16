import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SetButtonProps {
  /** 1-based set number. */
  setNumber: number;
  /** Whether this set has been logged. */
  isLogged: boolean;
  /** The actual reps recorded (shown on the button when logged). */
  actualReps?: number;
  /** Whether this is the next set to log (subtle highlight). */
  isNext?: boolean;
  /** Tap to log at target values. */
  onPress: () => void;
  /** Long press to open the adjust sheet. */
  onLongPress?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SetButton renders one set slot within an exercise card.
 *
 * Three visual states:
 * - **Empty** `[   ]` — muted border, set number label
 * - **Logged** `[✓ 5]` — accent border + background, checkmark + actual reps
 * - **Next** — slightly brighter border to indicate "this is the next one to log"
 */
export function SetButton({
  setNumber,
  isLogged,
  actualReps,
  isNext = false,
  onPress,
  onLongPress,
}: SetButtonProps) {
  const { colors } = useTheme();

  if (isLogged) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
        className="w-12 h-10 rounded-lg border border-accent bg-accent/10 items-center justify-center mx-1"
      >
        <View className="flex-row items-center">
          <Ionicons name="checkmark" size={12} color={colors.accent} />
          <Text className="text-accent text-xs font-bold ml-0.5">
            {actualReps ?? "✓"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.7}
      className={`w-12 h-10 rounded-lg border items-center justify-center mx-1 ${
        isNext ? "border-white/30" : "border-border"
      }`}
    >
      <Text className={`text-xs ${isNext ? "text-white/50" : "text-muted"}`}>
        {setNumber}
      </Text>
    </TouchableOpacity>
  );
}
