import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "../lib/queryClient";

// RootLayout wraps the entire app in QueryClientProvider so any screen can
// use TanStack Query hooks (useQuery, useMutation, etc.) to fetch data.
//
// GestureHandlerRootView is required by react-native-gesture-handler to
// enable gestures like swipe-to-delete throughout the app. It replaces the
// plain <View> wrapper and provides the same flex:1 + dark background.
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0F0F0F" }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0F0F0F" } }} />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
