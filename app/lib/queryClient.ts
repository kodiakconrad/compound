import { QueryClient } from "@tanstack/react-query";

// queryClient is the single shared instance for the whole app. It is passed
// to <QueryClientProvider> in the root layout so all screens can use
// TanStack Query hooks.
//
// staleTime: 5 minutes — data fetched from the server is considered "fresh"
// for 5 minutes. After that, the next time the screen is focused or mounted,
// TanStack Query will re-fetch in the background. This avoids hitting the API
// on every navigation while still staying reasonably up to date.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
