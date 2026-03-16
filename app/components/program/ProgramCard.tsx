import { useRef } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";

interface ProgramCardProps {
  name: string;
  workoutCount: number;
  isPrebuilt: boolean;
  hasActiveCycle?: boolean;
  onPress: () => void;
  /** Called when the user taps the delete action. The parent should show a
   *  confirmation dialog and then actually delete if confirmed. */
  onDeleteRequest?: () => void;
}

// ProgramCard renders one program in the programs list.
//
// Layout:
//   Row 1: program name (left)   lock icon if prebuilt (right)
//   Row 2: "4 workouts" in muted text
//
// Swipe left to reveal a red delete action. Prebuilt programs don't show
// the delete action because they can't be deleted.
export function ProgramCard({ name, workoutCount, isPrebuilt, hasActiveCycle, onPress, onDeleteRequest }: ProgramCardProps) {
  const { colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  /** Close the swipeable programmatically (e.g. after cancel). */
  function close() {
    swipeableRef.current?.close();
  }

  // Renders the red delete button that appears behind the card on swipe-left.
  function renderRightActions(
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) {
    // Scale the icon up as the user drags further.
    const scale = dragX.interpolate({
      inputRange: [-100, -50],
      outputRange: [1, 0.8],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        onPress={() => onDeleteRequest?.()}
        activeOpacity={0.8}
        className="items-center justify-center rounded-xl mr-4 mb-3"
        style={{ width: 72, backgroundColor: "#EF4444" }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={22} color={colors.foreground} />
        </Animated.View>
      </TouchableOpacity>
    );
  }

  const card = (
    <TouchableOpacity
      onPress={onPress}
      className="mx-4 mb-3 bg-surface border border-border rounded-xl px-4 py-3"
      activeOpacity={0.7}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground font-semibold text-base flex-1 mr-2" numberOfLines={1}>
          {name}
        </Text>
        {isPrebuilt && (
          <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
        )}
      </View>
      <View className="flex-row items-center mt-0.5">
        <Text className="text-muted text-sm">
          {workoutCount} {workoutCount === 1 ? "workout" : "workouts"}
        </Text>
        {hasActiveCycle && (
          <Text className="text-accent text-sm font-semibold ml-2">· Active</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Prebuilt programs can't be deleted, so skip the swipeable wrapper.
  if (isPrebuilt || !onDeleteRequest) return card;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {card}
    </Swipeable>
  );
}

// Re-export the close helper type so the parent can call it via ref if needed.
export type { ProgramCardProps };
