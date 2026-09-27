import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";

import { flush, refreshPendingCount } from "../lib/offlineQueue";
import { useOfflineQueueStore } from "../store/offlineQueue";

// useOfflineQueue subscribes to network connectivity changes and automatically
// flushes the offline queue when the device reconnects. Pending count lives in
// a Zustand store (lib/offlineQueue.ts updates it directly on enqueue/flush),
// so this hook just needs to trigger the flush — any screen can read
// pendingCount via useOfflineQueueStore without mounting this hook itself.
//
// This hook is intended to be mounted once at the root layout level so the
// flush listener is always active.
export function useOfflineQueue() {
  const pendingCount = useOfflineQueueStore((s) => s.pendingCount);

  // On startup, pick up any rows left over from a previous session (e.g. the
  // app was killed while offline before it could sync).
  useEffect(() => {
    refreshPendingCount();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && state.isInternetReachable) {
        await flush();
      }
    });
    return unsubscribe;
  }, []);

  return { pendingCount };
}
