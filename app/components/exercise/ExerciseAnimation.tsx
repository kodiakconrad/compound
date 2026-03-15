import { useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import LottieView from "lottie-react-native";
import { Ionicons } from "@expo/vector-icons";

import { getAnimationForExercise } from "../../assets/animations";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExerciseAnimationProps {
  /** Exercise name — used to look up the bundled Lottie asset. */
  exerciseName: string;
  /** Thumbnail size in pixels (width & height). Default 40. */
  size?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ExerciseAnimation renders a small looping Lottie thumbnail for an exercise.
 * Tapping the thumbnail opens a larger expanded view in a modal.
 *
 * If no animation is available for the exercise, renders a static dumbbell
 * icon as a fallback. The fallback still supports the tap-to-expand gesture
 * but shows a "no animation available" message in the expanded view.
 */
export function ExerciseAnimation({ exerciseName, size = 40 }: ExerciseAnimationProps) {
  const [expanded, setExpanded] = useState(false);
  const animationSource = getAnimationForExercise(exerciseName);

  return (
    <>
      {/* Inline thumbnail */}
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        activeOpacity={0.7}
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-lg bg-surface border border-border overflow-hidden"
      >
        {animationSource ? (
          <LottieView
            source={animationSource}
            autoPlay
            loop
            style={{ width: size - 4, height: size - 4 }}
          />
        ) : (
          <Ionicons name="barbell-outline" size={size * 0.5} color="#6B7280" />
        )}
      </TouchableOpacity>

      {/* Expanded detail modal */}
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <Pressable
          onPress={() => setExpanded(false)}
          className="flex-1 bg-black/80 items-center justify-center"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl p-6 mx-8 items-center"
          >
            {/* Close button */}
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              className="absolute top-3 right-3 z-10"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>

            {/* Exercise name */}
            <Text className="text-white text-lg font-semibold mb-4">
              {exerciseName}
            </Text>

            {/* Large animation or fallback */}
            {animationSource ? (
              <View
                className="items-center justify-center rounded-xl bg-black/40 overflow-hidden"
                style={{ width: 200, height: 200 }}
              >
                <LottieView
                  source={animationSource}
                  autoPlay
                  loop
                  style={{ width: 192, height: 192 }}
                />
              </View>
            ) : (
              <View
                className="items-center justify-center rounded-xl bg-black/40"
                style={{ width: 200, height: 200 }}
              >
                <Ionicons name="barbell-outline" size={64} color="#6B7280" />
                <Text className="text-muted text-sm mt-3">
                  Animation coming soon
                </Text>
              </View>
            )}

            {/* Hint text */}
            <Text className="text-muted text-xs mt-4">
              Tap outside to close
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
