import { Text, View } from "react-native";

interface SummaryCardProps {
  totalSessions: number;
  weeksTrained: number;
  currentStreak: number;
}

// SummaryCard renders three stat boxes in a row:
//
//   ┌─────────┐ ┌──────┐ ┌──────┐
//   │   47    │ │  8   │ │  3   │
//   │ sessions│ │weeks │ │streak│
//   └─────────┘ └──────┘ └──────┘
//
// Each box shows a large number on top with a muted label below.
export function SummaryCard({ totalSessions, weeksTrained, currentStreak }: SummaryCardProps) {
  return (
    <View className="flex-row mx-4 mt-4" style={{ gap: 10 }}>
      <StatBox value={totalSessions} label="sessions" />
      <StatBox value={weeksTrained} label="weeks" />
      <StatBox value={currentStreak} label="streak" suffix="🔥" />
    </View>
  );
}

interface StatBoxProps {
  value: number;
  label: string;
  suffix?: string;
}

// StatBox is one stat tile within the summary row.
function StatBox({ value, label, suffix }: StatBoxProps) {
  return (
    <View className="flex-1 bg-surface border border-border rounded-xl py-3 items-center">
      <Text className="text-foreground text-2xl font-bold">
        {value}{suffix ?? ""}
      </Text>
      <Text className="text-muted text-xs mt-0.5">{label}</Text>
    </View>
  );
}
