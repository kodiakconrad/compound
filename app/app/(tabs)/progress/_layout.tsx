import { Stack } from "expo-router";

import { useTheme } from "../../../hooks/useTheme";

// Nested Stack navigator for the Progress tab.
// Contains the progress summary screen and a per-exercise chart screen.
// The Stack preserves navigation state when switching tabs.
export default function ProgressLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
