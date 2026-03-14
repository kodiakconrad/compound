import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { TrackingTypeBadge } from "../../components/exercise/TrackingTypeBadge";
import { useExercise } from "../../hooks/useExercise";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// useLocalSearchParams reads the dynamic URL segment.
// For the route /exercise/[uuid], navigating to /exercise/abc gives { uuid: "abc" }.
export default function ExerciseDetailScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const router = useRouter();

  const { data: exercise, isLoading, isError } = useExercise(uuid ?? "");

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#E8FF47" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !exercise) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold flex-1">Exercise not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Build a readable metadata string from whichever fields are present.
  // muscle_group and equipment are optional (NULL in the database → absent in JSON).
  const metaParts = [exercise.muscle_group, exercise.equipment]
    .filter(Boolean)
    .map((s) => capitalize(s as string));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold flex-1" numberOfLines={1}>
          {exercise.name}
        </Text>
      </View>

      <ScrollView>
        {/* Metadata — muscle group, equipment, tracking type */}
        <View className="px-4 py-4 border-b border-border">
          {metaParts.length > 0 && (
            <Text className="text-muted text-sm mb-3">{metaParts.join(" · ")}</Text>
          )}
          <TrackingTypeBadge type={exercise.tracking_type} />
        </View>

        {/* Last logged session for this exercise.
            TODO Step 7: replace with a real endpoint when set_log history is exposed. */}
        <View className="px-4 py-4 border-b border-border">
          <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
            LAST LOGGED
          </Text>
          <Text className="text-muted text-sm">No sessions logged yet</Text>
        </View>

        {/* Programs that include this exercise.
            TODO Step 7: replace with a real endpoint when section_exercise lookup is exposed. */}
        <View className="px-4 py-4">
          <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
            USED IN
          </Text>
          <Text className="text-muted text-sm">Not used in any program</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
