import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { vars } from "nativewind";

import { queryClient } from "../lib/queryClient";
import { useTheme } from "../hooks/useTheme";

// ---------------------------------------------------------------------------
// Inner layout — uses the theme hook (must be inside providers)
// ---------------------------------------------------------------------------

/**
 * InnerLayout reads the user's theme preferences and applies them:
 *
 * 1. **React Navigation ThemeProvider** — sets the native navigation container
 *    background (prevents white flash during swipe-back animations).
 * 2. **NativeWind `vars`** — CSS custom properties on the root View make every
 *    Tailwind class that references `var(--color-xxx)` resolve to the right
 *    color for the current mode and accent.
 * 3. **StatusBar** — light icons on dark background, dark icons on light.
 */
function InnerLayout() {
  const { colors, vars: themeVars, colorMode } = useTheme();

  // Build a React Navigation theme from the resolved colors. This controls the
  // background behind all navigation containers (Stack, Tab, etc.).
  const navTheme = {
    ...(colorMode === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(colorMode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.background,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        {/* NativeWind CSS variables must live on a patched RN View so they
            propagate to all descendants. GestureHandlerRootView is a third-
            party component that NativeWind doesn't patch, so putting vars()
            on it had no effect — Tailwind classes fell back to hardcoded
            defaults. This inner View fixes that. */}
        <View style={[{ flex: 1 }, vars(themeVars)]}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </View>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Root layout — wraps everything in QueryClientProvider
// ---------------------------------------------------------------------------

/**
 * RootLayout is the outermost component. QueryClientProvider must be above
 * InnerLayout because useTheme (Zustand) doesn't depend on it, but other hooks
 * throughout the app do. Keeping it at the top ensures every screen has access.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <InnerLayout />
    </QueryClientProvider>
  );
}
