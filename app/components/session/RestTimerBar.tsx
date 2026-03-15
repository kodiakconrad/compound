import { useEffect, useRef } from "react";
import { Text, TouchableOpacity, Vibration, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTimerStore } from "../../store/timer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds as MM:SS. */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RestTimerBar renders a persistent bottom bar during the rest countdown.
 *
 * Hidden when not running. Shows the countdown, a play/pause icon, and a
 * "Skip" button. Vibrates when the timer reaches zero.
 *
 * The timer state lives in the Zustand `useTimerStore`. This component
 * drives the `tick()` function via a `setInterval`.
 */
export function RestTimerBar() {
  const { secondsRemaining, isRunning, stop, tick } = useTimerStore();

  // Track previous isRunning to detect when timer completes (transitions
  // from running → not running while component is mounted).
  const wasRunning = useRef(isRunning);

  // Drive the countdown.
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [isRunning, tick]);

  // Vibrate when timer completes (transitions from running → not running).
  useEffect(() => {
    if (wasRunning.current && !isRunning && secondsRemaining === 0) {
      Vibration.vibrate(500);
    }
    wasRunning.current = isRunning;
  }, [isRunning, secondsRemaining]);

  // Hidden when not running and no remaining time.
  if (!isRunning && secondsRemaining === 0) {
    return null;
  }

  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-surface border-t border-border">
      {/* Timer icon + time */}
      <View className="flex-row items-center">
        <Ionicons name="timer-outline" size={18} color="#E8FF47" />
        <Text className="text-white font-bold text-base ml-2">
          REST
        </Text>
        <Text className="text-accent font-bold text-base ml-3">
          {formatTime(secondsRemaining)}
        </Text>
      </View>

      {/* Skip button */}
      <TouchableOpacity
        onPress={stop}
        className="px-3 py-1.5 rounded-lg border border-border"
        activeOpacity={0.7}
      >
        <Text className="text-muted text-sm font-medium">Skip</Text>
      </TouchableOpacity>
    </View>
  );
}
