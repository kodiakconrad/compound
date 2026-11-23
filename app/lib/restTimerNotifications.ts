import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Schedules the "rest over" alert as a local notification instead of a plain
// in-app timer tick. A local notification is delivered by the OS, so it still
// fires with sound when the phone is locked or the app is backgrounded —
// a JS setInterval would not.
//
// iOS silences notification sounds when the phone is on mute, and only
// Apple-approved "critical alert" apps can override that. So while the app
// is in the foreground we play the bell ourselves through the audio session
// (configured to ignore the mute switch) instead of the notification's sound.
// When locked/backgrounded the notification sound is all we get, and it
// still respects mute — that part is an iOS limitation.

// Created lazily on the first bell so the audio file isn't loaded at startup.
let bellPlayer: AudioPlayer | null = null;

function playRestBell(): void {
  bellPlayer ??= createAudioPlayer(require("../assets/sounds/rest-bell.wav"));
  // Rewind first — a player that already finished stays at its end.
  bellPlayer.seekTo(0);
  bellPlayer.play();
}

// Called only while the app is in the foreground. The banner still shows so
// the alert looks the same either way; the sound comes from playRestBell.
Notifications.setNotificationHandler({
  handleNotification: async () => {
    playRestBell();
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

/** Request notification permission. Call once at app startup. */
export async function requestRestTimerPermissions(): Promise<void> {
  // playsInSilentMode lets the in-app bell ignore the mute switch;
  // mixWithOthers plays it over your music instead of pausing it.
  // A failure here only costs the bell on mute, so it mustn't block the
  // permission request below.
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(
    () => {}
  );

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
