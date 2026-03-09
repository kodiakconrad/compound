import { create } from "zustand";

// Timer store manages the rest timer countdown shown at the bottom of the
// session screen after a set is logged.
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
  start: (seconds: number) => void;
  stop: () => void;
  tick: () => void;
}

export const useTimerStore = create<TimerState>((set) => ({
  secondsRemaining: 0,
  isRunning: false,

  start: (seconds) =>
    set({ secondsRemaining: seconds, isRunning: seconds > 0 }),

  stop: () => set({ secondsRemaining: 0, isRunning: false }),

  tick: () =>
    set((state) => {
      const next = state.secondsRemaining - 1;
      if (next <= 0) {
        return { secondsRemaining: 0, isRunning: false };
      }
      return { secondsRemaining: next };
    }),
}));
