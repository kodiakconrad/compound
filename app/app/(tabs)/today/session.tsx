import { View, Text } from "react-native";
import { useRouter } from "expo-router";

import { SessionView } from "../../../components/session/SessionView";
import { useActiveSession } from "../../../hooks/useActiveSession";

/**
 * SessionScreen is a pushed Stack screen within the Today tab.
 *
 * Because it lives in a Stack navigator, the iOS swipe-back gesture works
 * natively — swiping right pops this screen and returns to the Today homepage.
 *
 * The session stays in_progress on the backend so the user can resume later.
 */
export default function SessionScreen() {
  const router = useRouter();
  const { data: activeSession } = useActiveSession();

  if (!activeSession) {
    // Session was completed or doesn't exist — go back to Today homepage.
    // This can happen if the session is completed while on this screen.
    return (
      <View style={{ flex: 1, backgroundColor: "#0F0F0F", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#6B7280", fontSize: 14 }}>No active session</Text>
      </View>
    );
  }

  return (
    <SessionView
      session={activeSession}
      onCompleted={() => {
        // After completing, navigate back to the Today homepage.
        // The activeSession query will return null and the homepage
        // will show the next upcoming session.
        router.back();
      }}
      onBack={() => router.back()}
    />
  );
}
