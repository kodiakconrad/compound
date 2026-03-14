import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { queryClient } from "../lib/queryClient";

// RootLayout wraps the entire app in QueryClientProvider so any screen can
// use TanStack Query hooks (useQuery, useMutation, etc.) to fetch data.
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      {/* The View behind the Stack ensures the navigator's own background is dark.
          Without it, the slide-in animation briefly exposes white on the trailing edge
          as the incoming screen hasn't yet covered the full width. */}
      <View style={{ flex: 1, backgroundColor: "#0F0F0F" }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0F0F0F" } }} />
      </View>
    </QueryClientProvider>
  );
}
