import { useState } from "react";
import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-chart-kit";

import { useTheme } from "../../hooks/useTheme";
import type { ExerciseChartPoint } from "../../domain/progress";

type ChartMode = "weight" | "volume";

interface WeightHistoryChartProps {
  data: ExerciseChartPoint[];
}

// WeightHistoryChart renders a line chart of exercise progress over time.
//
// The chart has two modes toggled by buttons below it:
//   - "Weight" — plots the heaviest eligible set weight per session
//   - "Volume" — plots weight × reps per session
//
// Uses react-native-chart-kit (SVG-based) which works in Expo Go without
// a dev build. The chart auto-sizes to the container width.
export function WeightHistoryChart({ data }: WeightHistoryChartProps) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<ChartMode>("weight");

  if (data.length === 0) {
    return (
      <View className="mx-4 mt-4 bg-surface border border-border rounded-xl py-8 items-center">
        <Text className="text-muted text-sm">No data yet for this exercise</Text>
      </View>
    );
  }

  // Build the dataset for react-native-chart-kit.
  // X-axis labels: short date strings (e.g., "Mar 1").
  // Y-axis data: weight or volume values depending on the active mode.
  const values = data.map((d) => (mode === "weight" ? d.weight : d.volume));

  // Show a limited number of x-axis labels to avoid crowding.
  // Pick evenly-spaced indices to label.
  const maxLabels = 5;
  const step = Math.max(1, Math.floor(data.length / maxLabels));
  const labels = data.map((d, i) => {
    if (i % step === 0 || i === data.length - 1) {
      return formatShortDate(d.date);
    }
    return "";
  });

  // Chart width = screen width minus horizontal padding (mx-4 = 16px each side).
  const chartWidth = Dimensions.get("window").width - 32;

  return (
    <View className="mx-4 mt-4">
      <View className="bg-surface border border-border rounded-xl overflow-hidden">
        <View style={{ paddingTop: 16, paddingBottom: 8 }}>
          <LineChart
            data={{
              labels,
              datasets: [{ data: values }],
            }}
            width={chartWidth}
            height={200}
            withDots={data.length <= 20}
            withInnerLines={false}
            withOuterLines={false}
            chartConfig={{
              backgroundColor: "transparent",
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              decimalPlaces: 1,
              color: () => colors.accent,
              labelColor: () => colors.muted,
              propsForDots: {
                r: "3",
                strokeWidth: "1",
                stroke: colors.accent,
              },
              propsForLabels: {
                fontSize: 10,
              },
            }}
            bezier
            style={{ borderRadius: 12 }}
          />
        </View>

        {/* Mode toggle — Weight vs Volume */}
        <View className="flex-row mx-3 mb-3 mt-1" style={{ gap: 8 }}>
          <ModeButton
            label="Weight"
            active={mode === "weight"}
            onPress={() => setMode("weight")}
            accentColor={colors.accent}
            mutedColor={colors.muted}
            borderColor={colors.border}
          />
          <ModeButton
            label="Volume"
            active={mode === "volume"}
            onPress={() => setMode("volume")}
            accentColor={colors.accent}
            mutedColor={colors.muted}
            borderColor={colors.border}
          />
        </View>
      </View>
    </View>
  );
}

// formatShortDate converts "2026-03-01" to "Mar 1".
function formatShortDate(isoDate: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parts = isoDate.split("-");
  if (parts.length < 3) return isoDate;
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${months[monthIndex]} ${day}`;
}

interface ModeButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  accentColor: string;
  mutedColor: string;
  borderColor: string;
}

// ModeButton is a toggle button for switching between chart modes.
function ModeButton({ label, active, onPress, accentColor, mutedColor, borderColor }: ModeButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-1 items-center py-1.5 rounded-lg"
      style={{
        backgroundColor: active ? accentColor + "20" : "transparent",
        borderWidth: 1,
        borderColor: active ? accentColor : borderColor,
      }}
    >
      <Text style={{ color: active ? accentColor : mutedColor, fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
