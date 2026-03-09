import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

import { flush, pendingCount } from "../lib/offlineQueue";

// useOfflineQueue subscribes to network connectivity changes and automatically
// flushes the offline queue when the device reconnects. It also exposes
// pendingCount so UI can show a "3 sets queued" banner when offline.
//
// This hook is intended to be mounted once at the root layout level so the
// flush listener is always active.
export function useOfflineQueue() {
  const [pending, setPending] = useState(0);

  // Refresh the pending count periodically
  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const count = await pendingCount();
      if (mounted) setPending(count);
    }

    refresh();
    const id = setInterval(refresh, 10_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Flush the queue whenever the device comes back online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && state.isInternetReachable) {
        await flush();
        const count = await pendingCount();
        setPending(count);
      }
    });
    return unsubscribe;
  }, []);

  return { pendingCount: pending };
}
