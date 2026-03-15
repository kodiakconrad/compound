import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../../hooks/useTheme";
import { ACCENT_NAMES, ACCENT_OPTIONS } from "../../../lib/theme";
import type { AccentName } from "../../../lib/theme";

// ---------------------------------------------------------------------------
// Settings screen
// ---------------------------------------------------------------------------
//
// Two sections:
//
// 1. **Appearance** — dark mode toggle + accent color picker.
//    The accent picker is a row of circular swatches; the selected one gets a
//    checkmark overlay and a ring border.
//
// 2. **About** — placeholder for app version (future).

export default function SettingsScreen() {
  const { colors, colorMode, accentName, setColorMode, setAccentName } =
    useTheme();

  const isDark = colorMode === "dark";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
        <View className="px-4 py-3">
          <Text style={{ color: colors.foreground }} className="text-2xl font-bold">
            Settings
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1 px-4">
        {/* ---- Appearance section ---- */}
        <Text className="text-muted text-xs uppercase tracking-wider mb-3 mt-4">
          Appearance
        </Text>

        {/* Dark mode toggle */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="rounded-xl border px-4 py-3 flex-row items-center justify-between mb-4"
        >
          <View className="flex-row items-center">
            <Ionicons
              name={isDark ? "moon" : "sunny"}
              size={20}
              color={colors.accent}
            />
            <Text
              style={{ color: colors.foreground }}
              className="text-base font-medium ml-3"
            >
              Dark Mode
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(v) => setColorMode(v ? "dark" : "light")}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Accent color picker */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="rounded-xl border px-4 py-4 mb-4"
        >
          <Text
            style={{ color: colors.foreground }}
            className="text-base font-medium mb-4"
          >
            Accent Color
          </Text>

          <View className="flex-row justify-between">
            {ACCENT_NAMES.map((name: AccentName) => {
              const option = ACCENT_OPTIONS[name];
              const isSelected = name === accentName;

              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => setAccentName(name)}
                  activeOpacity={0.7}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: option.hex,
                    borderWidth: isSelected ? 3 : 0,
                    borderColor: colors.foreground,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color="#000000" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected label */}
          <Text className="text-muted text-xs text-center mt-3">
            {ACCENT_OPTIONS[accentName].label}
          </Text>
        </View>

        {/* ---- About section ---- */}
        <Text className="text-muted text-xs uppercase tracking-wider mb-3 mt-4">
          About
        </Text>

        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="rounded-xl border px-4 py-3 flex-row items-center justify-between mb-8"
        >
          <Text style={{ color: colors.foreground }} className="text-base">
            Version
          </Text>
          <Text className="text-muted text-sm">1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
