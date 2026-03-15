import { Stack } from "expo-router";

import { useTheme } from "../../../hooks/useTheme";

// Nested Stack navigator for the Settings tab.
// Follows the same directory-based pattern as Today, Programs, and Library.
export default function SettingsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
