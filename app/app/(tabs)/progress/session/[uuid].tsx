import { TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../../../hooks/useTheme";
import { useSessionDetail } from "../../../../hooks/useSession";
import { CompletedSessionDetail } from "../../../../components/progress/CompletedSessionDetail";

/**
 * Completed session detail screen — reached by tapping a row in
 * RecentSessions on the Progress tab.
 *
 * Route: /progress/session/[uuid]?cycleUUID=...
 *
 * Uses the existing `useSessionDetail` hook to fetch the full session
 * from GET /api/v1/cycles/{cycleUUID}/sessions/{uuid}.
 */
export default function CompletedSessionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    uuid: string;
    cycleUUID: string;
  }>();

  // useLocalSearchParams can return string | string[] — coerce to string.
  const uuid = Array.isArray(params.uuid) ? params.uuid[0] : params.uuid;
  const cycleUUID = Array.isArray(params.cycleUUID)
    ? params.cycleUUID[0]
    : params.cycleUUID;

  const { data: session, isLoading } = useSessionDetail(cycleUUID, uuid);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Simple back header */}
      <View className="flex-row items-center px-4 pt-14 pb-2">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <CompletedSessionDetail session={session} isLoading={isLoading} />
    </View>
  );
}
