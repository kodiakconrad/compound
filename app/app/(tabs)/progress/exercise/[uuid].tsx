import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { WeightHistoryChart } from "../../../../components/progress/WeightHistoryChart";
import { useExerciseHistory } from "../../../../hooks/useExerciseHistory";
import { useExercises } from "../../../../hooks/useExercises";
import { useTheme } from "../../../../hooks/useTheme";

// ExerciseChartScreen shows a full-size chart for a single exercise.
// Reached by tapping a row in the PRList on the main progress screen.
//
// Layout:
//   ← Exercise Name          (header with back button)
//   [WeightHistoryChart]     (full-width chart)
export default function ExerciseChartScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const { data: chartData = [], isLoading } = useExerciseHistory(uuid ?? null);
  const { data: exercises = [] } = useExercises();

  // Look up the exercise name from the cached exercise list.
  const exerciseName = exercises.find((e) => e.uuid === uuid)?.name ?? "Exercise";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
        {/* Header with back button */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-8 h-8 items-center justify-center mr-2"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-foreground text-lg font-bold flex-1" numberOfLines={1}>
            {exerciseName}
          </Text>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <WeightHistoryChart data={chartData} />
      )}
    </View>
  );
}
