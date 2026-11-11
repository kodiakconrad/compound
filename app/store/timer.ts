import { create } from "zustand";

import {
  scheduleRestEndNotification,
  cancelRestEndNotification,
} from "../lib/restTimerNotifications";

// Timer store manages the rest timer countdown shown at the bottom of the
// session screen after a set is logged.
//
// The countdown is anchored to `endsAt` (a Date.now() timestamp) rather than
// decremented by a tick counter. A plain tick counter drifts or outright
// freezes while the app is backgrounded (RN suspends JS timers), so on
// return it would show a stale "paused" value. Anchoring to a timestamp
// means `tick()` always recomputes the true remaining time from the clock,
// so the displayed countdown is correct the instant the app is foregrounded
// again, with no catch-up needed.
//
// A local notification is also scheduled alongside the in-app countdown
// (see lib/restTimerNotifications.ts) so the alert still fires with sound
// if the phone is locked or backgrounded when the rest period ends.
//
// Usage:
//   const { secondsRemaining, isRunning, start, stop } = useTimerStore();
//
//   // Start a 3-minute timer after logging a set:
//   start(180);
//
//   // In the rest timer component, call tick() every second via setInterval:
//   useEffect(() => {
//     if (!isRunning) return;
//     const id = setInterval(() => tick(), 1000);
//     return () => clearInterval(id);
//   }, [isRunning]);

interface TimerState {
  secondsRemaining: number;
  isRunning: boolean;
  endsAt: number | null;
  notificationId: string | null;
  start: (seconds: number) => void;
  stop: () => void;
  tick: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  secondsRemaining: 0,
  isRunning: false,
  endsAt: null,
  notificationId: null,

  start: (seconds) => {
    if (seconds <= 0) {
      set({ secondsRemaining: 0, isRunning: false, endsAt: null, notificationId: null });
      return;
    }

    const endsAt = Date.now() + seconds * 1000;
    set({ secondsRemaining: seconds, isRunning: true, endsAt, notificationId: null });

    scheduleRestEndNotification(seconds)
      .then((id) => {
        // The user may have skipped or started a new rest period before this
        // resolved — only keep the id if we're still waiting on this timer.
        if (get().endsAt === endsAt) {
          set({ notificationId: id });
        } else {
          cancelRestEndNotification(id);
        }
      })
      .catch(() => {
        // Notification permission denied or scheduling failed — the in-app
        // countdown still works, it just won't alert while backgrounded.
      });
  },

  stop: () => {
    const { notificationId } = get();
    if (notificationId) {
      cancelRestEndNotification(notificationId);
    }
    set({ secondsRemaining: 0, isRunning: false, endsAt: null, notificationId: null });
  },

  tick: () =>
    set((state) => {
      if (state.endsAt == null) return state;
      const next = Math.max(0, Math.round((state.endsAt - Date.now()) / 1000));
      if (next <= 0) {
        return { secondsRemaining: 0, isRunning: false, endsAt: null, notificationId: null };
      }
      return { secondsRemaining: next };
    }),
}));
