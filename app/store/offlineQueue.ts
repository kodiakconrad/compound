import { create } from "zustand";

// offlineQueue.ts (lib) owns the actual SQLite-backed queue. This store just
// mirrors its pendingCount so any component can read it without polling —
// enqueue()/flush() update it directly whenever the count changes, and the
// OfflineBanner (or any other screen) subscribes to get instant updates.

interface OfflineQueueState {
  pendingCount: number;
  setPendingCount: (n: number) => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  pendingCount: 0,
  setPendingCount: (n) => set({ pendingCount: n }),
}));
