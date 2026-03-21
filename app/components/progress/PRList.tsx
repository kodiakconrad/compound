import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";
import type { PersonalRecordListEntry as PersonalRecordEntry } from "../../domain/progress";

interface PRListProps {
  records: PersonalRecordEntry[];
  onPressExercise: (uuid: string) => void;
}

// PRList renders a "PERSONAL RECORDS" section with one row per exercise.
//
//   PERSONAL RECORDS
//   Bench Press         100 kg × 5
//   Squat               140 kg × 3
//   Deadlift            180 kg × 1
//
// Each row is tappable — navigates to the per-exercise chart screen.
export function PRList({ records, onPressExercise }: PRListProps) {
  const { colors } = useTheme();

  if (records.length === 0) {
    return (
      <View className="mx-4 mt-6">
        <Text className="text-muted text-xs font-bold tracking-wider mb-2">PERSONAL RECORDS</Text>
        <Text className="text-muted text-sm">No records yet — complete a session to see PRs</Text>
      </View>
    );
  }

  return (
    <View className="mx-4 mt-6">
      <Text className="text-muted text-xs font-bold tracking-wider mb-2">PERSONAL RECORDS</Text>
      <View className="bg-surface border border-border rounded-xl overflow-hidden">
        {records.map((record, index) => (
          <TouchableOpacity
            key={record.exercise_uuid}
            onPress={() => onPressExercise(record.exercise_uuid)}
            className="flex-row items-center justify-between px-4 py-3"
            style={index < records.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
            activeOpacity={0.7}
          >
            <Text className="text-foreground text-sm font-medium flex-1 mr-2" numberOfLines={1}>
              {record.exercise_name}
            </Text>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Text className="text-accent text-sm font-semibold">
                {record.weight} kg{record.actual_reps != null ? ` × ${record.actual_reps}` : ""}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.muted} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
