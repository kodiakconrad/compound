import { Stack } from "expo-router";

// Nested Stack navigator for the Today tab.
// The session screen is pushed on top of the homepage, giving it native
// swipe-back gesture support. The bottom tab bar stays visible.
//
// cardStyle sets the background of each screen's card container, and
// contentStyle sets the inner content area. Both must be dark to prevent
// white flashes during the swipe-back animation.
export default function TodayLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F0F0F" },
              }}
    />
  );
}
