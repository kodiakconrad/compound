import { Stack } from "expo-router";

import { useTheme } from "../../../hooks/useTheme";

// Nested Stack navigator for the Library tab.
// Contains the exercise list, exercise detail, and create exercise screens.
// The Stack preserves navigation state when switching tabs — so if the user
// is viewing an exercise detail and switches to another tab, coming back
// to Library shows the same detail screen.
export default function LibraryLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
