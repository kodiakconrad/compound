import { Stack } from "expo-router";

// Nested Stack navigator for the Programs tab.
// This keeps all program screens (list, detail, create) within the same tab,
// so the bottom tab bar stays visible and push/back navigation works normally.
export default function ProgramsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0F0F0F" } }} />
  );
}
