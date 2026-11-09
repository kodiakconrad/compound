import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";
import type { RecentSession } from "../../domain/progress";

interface RecentSessionsProps {
  sessions: RecentSession[];
}

// RecentSessions renders a "RECENT ACTIVITY" section showing the last few
// completed/skipped sessions with workout name, program name, and date.
//
//   RECENT ACTIVITY
//   ✓ Day A — Starting Strength         Feb 21
//   ✓ Day B — Starting Strength         Feb 18
//   ✗ Day A — Starting Strength         Feb 15
export function RecentSessions({ sessions }: RecentSessionsProps) {
  const { colors } = useTheme();
  const router = useRouter();

  if (sessions.length === 0) {
    return (
      <View className="mx-4 mt-6">
        <Text className="text-muted text-xs font-bold tracking-wider mb-2">RECENT ACTIVITY</Text>
        <Text className="text-muted text-sm">No sessions yet</Text>
      </View>
    );
  }

  return (
    <View className="mx-4 mt-6">
      <Text className="text-muted text-xs font-bold tracking-wider mb-2">RECENT ACTIVITY</Text>
      <View className="bg-surface border border-border rounded-xl overflow-hidden">
        {sessions.map((session, index) => {
          const isCompleted = session.status === "completed";
          return (
            <TouchableOpacity
              key={session.uuid}
              className="flex-row items-center px-4 py-3"
              style={index < sessions.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
              activeOpacity={0.7}
              onPress={() =>
                router.push(
                  `/progress/session/${session.uuid}?cycleUUID=${session.cycle_uuid}`
                )
              }
            >
              <Ionicons
                name={isCompleted ? "checkmark-circle" : "close-circle"}
                size={18}
                color={isCompleted ? colors.accent : colors.muted}
                style={{ marginRight: 10 }}
              />
              <View className="flex-1 mr-2">
                <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
                  {session.workout_name}
                </Text>
                <Text className="text-muted text-xs" numberOfLines={1}>
                  {session.program_name}
                </Text>
              </View>
              <Text className="text-muted text-xs mr-1">
                {session.completed_at ? formatShortDate(session.completed_at) : "—"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// formatShortDate converts "2026-02-21T04:55:27Z" to "Feb 21".
function formatShortDate(isoDate: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(isoDate);
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
