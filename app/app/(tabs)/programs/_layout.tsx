import { Stack } from "expo-router";

import { useTheme } from "../../../hooks/useTheme";

// Nested Stack navigator for the Programs tab.
// This keeps all program screens (list, detail, create) within the same tab,
// so the bottom tab bar stays visible and push/back navigation works normally.
export default function ProgramsLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
