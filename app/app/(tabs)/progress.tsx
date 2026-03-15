import { Text, View } from "react-native";

// Progress tab — placeholder until Step 6 implements summary stats and charts.
export default function ProgressScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <Text className="text-foreground text-xl font-bold">Progress</Text>
      <Text className="text-muted mt-2">Coming in Step 6</Text>
    </View>
  );
}
