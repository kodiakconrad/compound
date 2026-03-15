import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { NoCycleState } from "../../../components/today/NoCycleState";
import { CycleCard } from "../../../components/today/CycleCard";
import { useActiveSession } from "../../../hooks/useActiveSession";
import { useActiveCycles } from "../../../hooks/useCycles";
import { useStartSession } from "../../../hooks/useSession";
import { useTheme } from "../../../hooks/useTheme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format the current date like "Mar 15". */
function formatTodayDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * TodayScreen is the home tab. It shows:
 *
 * 1. **No active cycle** — prompt to browse programs
 * 2. **One or more active cycles** — stacked "Up Next" cards, one per cycle
 * 3. **Active session** — resume banner at top + cycle cards below
 *
 * Each cycle gets its own `CycleCard` component that internally fetches
 * the cycle detail and session preview. This avoids the "hooks in a loop"
 * problem and keeps each card self-contained.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  // --- Data fetching ---

  // 1. Check for an already in-progress session.
  const {
    data: activeSession,
    isLoading: isLoadingActive,
  } = useActiveSession();

  // 2. Fetch all active cycles.
  const {
    data: activeCycles = [],
    isLoading: isLoadingCycles,
  } = useActiveCycles();

  // --- Start session mutation ---
  const startMutation = useStartSession();

  function handleStartSession(cycleUUID: string, sessionUUID: string) {
    startMutation.mutate(
      { cycleUUID, sessionUUID },
      {
        onSuccess: () => {
          router.push("/today/session");
        },
      }
    );
  }

  function handleResumeSession() {
    router.push("/today/session");
  }

  // --- Loading state ---
  const isLoading = isLoadingActive || isLoadingCycles;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-foreground text-2xl font-bold">Today</Text>
            <Text className="text-muted text-sm">{formatTodayDate()}</Text>
          </View>
        </SafeAreaView>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  // --- No active cycles and no active session ---
  if (activeCycles.length === 0 && !activeSession) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-foreground text-2xl font-bold">Today</Text>
            <Text className="text-muted text-sm">{formatTodayDate()}</Text>
          </View>
        </SafeAreaView>
        <NoCycleState onBrowsePrograms={() => router.push("/(tabs)/programs")} />
      </View>
    );
  }

  // --- Homepage with resume banner + stacked cycle cards ---
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-foreground text-2xl font-bold">Today</Text>
          <Text className="text-muted text-sm">{formatTodayDate()}</Text>
        </View>
      </SafeAreaView>

      {/* Resume session banner — shown when a session is in progress */}
      {activeSession && (
        <TouchableOpacity
          onPress={handleResumeSession}
          style={{ backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 1 }}
          className="mx-4 mt-2 rounded-xl px-4 py-3 flex-row items-center"
          activeOpacity={0.7}
        >
          <Ionicons name="barbell-outline" size={20} color={colors.accent} />
          <View className="flex-1 ml-3">
            <Text className="text-foreground font-semibold text-sm">
              {activeSession.workout_name}
            </Text>
            <Text className="text-muted text-xs mt-0.5">Session in progress</Text>
          </View>
          <Text className="text-accent text-sm font-semibold">Resume</Text>
        </TouchableOpacity>
      )}

      {/* Stacked cycle cards — one per active cycle */}
      <ScrollView className="flex-1">
        {activeCycles.map((cycle) => (
          <CycleCard
            key={cycle.uuid}
            cycleUUID={cycle.uuid}
            programName={cycle.program_name}
            onStartSession={handleStartSession}
            isStarting={startMutation.isPending}
          />
        ))}
      </ScrollView>
    </View>
  );
}
