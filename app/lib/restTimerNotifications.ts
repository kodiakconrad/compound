import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Schedules the "rest over" alert as a local notification instead of a plain
// in-app timer tick. A local notification is delivered by the OS, so it still
// fires with sound when the phone is locked or the app is backgrounded —
// a JS setInterval would not.

// Shown while the app is in the foreground too, so the alert is consistent
// whether you're looking at the screen or not.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Request notification permission. Call once at app startup. */
export async function requestRestTimerPermissions(): Promise<void> {
  const settings = await Notifications.getPermissionsAsync();
  if (!settings.granted) {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("rest-timer", {
      name: "Rest timer",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }
}

/** Schedule the rest-over alert `seconds` from now. Returns the notification id. */
export async function scheduleRestEndNotification(seconds: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Rest over",
      body: "Time for your next set",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: Platform.OS === "android" ? "rest-timer" : undefined,
    },
  });
}

/** Cancel a previously scheduled rest-over alert, e.g. when the user skips rest. */
export async function cancelRestEndNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired or already cancelled — nothing to do.
  }
}
