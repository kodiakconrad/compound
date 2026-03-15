import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "../lib/queryClient";

// Custom dark theme — sets the native navigation container background to our
// app's dark color. This prevents the white flash that otherwise appears
// behind screens during swipe-back animations in Native Stack navigators.
const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0F0F0F",
    card: "#0F0F0F",
  },
};

// RootLayout wraps the entire app in QueryClientProvider so any screen can
// use TanStack Query hooks (useQuery, useMutation, etc.) to fetch data.
//
// GestureHandlerRootView is required by react-native-gesture-handler to
// enable gestures like swipe-to-delete throughout the app. It replaces the
// plain <View> wrapper and provides the same flex:1 + dark background.
//
// ThemeProvider with our custom dark theme sets the native background behind
// all navigation containers, preventing white flashes during transitions.
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={appTheme}>
        <StatusBar style="light" />
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0F0F0F" }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0F0F0F" } }} />
        </GestureHandlerRootView>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
