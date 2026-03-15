import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";

import { useTheme } from "../../hooks/useTheme";

// (tabs) is a "route group" in expo-router — the parentheses mean it doesn't
// appear in the URL. This _layout.tsx renders the bottom tab bar that's visible
// on all screens.
//
// Each tab with sub-screens uses a directory with its own _layout.tsx (Stack),
// so push/back navigation works within the tab and state is preserved when
// switching between tabs.
//
// Tapping the already-active tab resets its Stack to the root screen (e.g.,
// tapping "Programs" while on a program detail screen goes back to the list).
export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" color={color} size={size} />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const isActive = state.routes[state.index]?.name === route.name;
            if (isActive) {
              e.preventDefault();
              navigation.dispatch(
                CommonActions.navigate({ name: route.name, params: { screen: "index" } })
              );
            }
          },
        })}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: "Programs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={color} size={size} />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const isActive = state.routes[state.index]?.name === route.name;
            if (isActive) {
              e.preventDefault();
              navigation.dispatch(
                CommonActions.navigate({ name: route.name, params: { screen: "index" } })
              );
            }
          },
        })}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" color={color} size={size} />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const isActive = state.routes[state.index]?.name === route.name;
            if (isActive) {
              e.preventDefault();
              navigation.dispatch(
                CommonActions.navigate({ name: route.name, params: { screen: "index" } })
              );
            }
          },
        })}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
