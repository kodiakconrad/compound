import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOfflineQueueStore } from "../../store/offlineQueue";

// ---------------------------------------------------------------------------
// OfflineBanner — small pill shown when set logs / session completions are
// queued locally, waiting to sync.
//
// Mounted once in the root layout as an absolutely-positioned overlay (not
// inside any screen's own SafeAreaView/ScrollView), so per
// docs/frontend-patterns.md it never touches a screen's own layout — it just
// floats on top of whatever is currently on screen.
// ---------------------------------------------------------------------------

export function OfflineBanner() {
  const pendingCount = useOfflineQueueStore((s) => s.pendingCount);
  const insets = useSafeAreaInsets();

  if (pendingCount === 0) return null;

  const label = pendingCount === 1 ? "1 set queued" : `${pendingCount} sets queued`;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 50,
      }}
    >
      <View className="bg-accent rounded-full px-4 py-1.5 mt-2">
        <Text className="text-white text-xs font-semibold">
          {label} — will sync when online
        </Text>
      </View>
    </View>
  );
}
