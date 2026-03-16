import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { SummaryCard } from "../../../components/progress/SummaryCard";
import { PRList } from "../../../components/progress/PRList";
import { RecentSessions } from "../../../components/progress/RecentSessions";
import { useProgressSummary } from "../../../hooks/useProgressSummary";
import { usePersonalRecords } from "../../../hooks/usePersonalRecords";
import { useRecentSessions } from "../../../hooks/useRecentSessions";
import { useTheme } from "../../../hooks/useTheme";

// ProgressScreen is the root screen for the Progress tab.
//
// Layout (top to bottom):
//   1. Header — "Progress" title
//   2. SummaryCard — three stat boxes (sessions, weeks, streak)
//   3. RecentSessions — last 5 completed/skipped sessions
//   4. PRList — personal records for each exercise (tap to see chart)
export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const { data: summary, isLoading: summaryLoading } = useProgressSummary();
  const { data: records = [], isLoading: recordsLoading } = usePersonalRecords();
  const { data: recentSessions = [], isLoading: recentLoading } = useRecentSessions();

  const isLoading = summaryLoading || recordsLoading || recentLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
        <View className="px-4 py-3">
          <Text className="text-foreground text-2xl font-bold">Progress</Text>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Summary stats */}
          <SummaryCard
            totalSessions={summary?.total_sessions ?? 0}
            weeksTrained={summary?.weeks_trained ?? 0}
            currentStreak={summary?.current_streak ?? 0}
          />

          {/* Recent activity */}
          <RecentSessions sessions={recentSessions} />

          {/* Personal records — tap a row to see the exercise chart */}
          <PRList
            records={records}
            onPressExercise={(uuid) => router.push(`/progress/exercise/${uuid}`)}
          />
        </ScrollView>
      )}
    </View>
  );
}
