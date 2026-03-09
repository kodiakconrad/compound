import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { queryClient } from "../lib/queryClient";

// RootLayout wraps the entire app in QueryClientProvider so any screen can
// use TanStack Query hooks (useQuery, useMutation, etc.) to fetch data.
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
