import { Text, View } from "react-native";

// Today tab — placeholder until Step 5 implements the full session flow.
// States: no active program / upcoming session / session in progress.
export default function TodayScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <Text className="text-white text-xl font-bold">Today</Text>
      <Text className="text-muted mt-2">Coming in Step 5</Text>
    </View>
  );
}
