import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { AccentName, ColorMode } from "../lib/theme";

// ---------------------------------------------------------------------------
// Theme store — persisted to AsyncStorage
// ---------------------------------------------------------------------------
//
// This Zustand store holds the user's theme preferences (dark/light mode and
// accent color). It uses the `persist` middleware so the choices survive app
// restarts — Zustand automatically saves to and loads from AsyncStorage.
//
// `hydrated` starts as `false` and flips to `true` once AsyncStorage has been
// read. The root layout can check this to avoid a flash of the wrong theme on
// cold start (though we default to dark + lime which matches the existing look,
// so the flash is barely noticeable even without checking).

interface ThemeState {
  colorMode: ColorMode;
  accentName: AccentName;
  hydrated: boolean;

  setColorMode: (mode: ColorMode) => void;
  setAccentName: (name: AccentName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorMode: "dark",
      accentName: "lime",
      hydrated: false,

      setColorMode: (mode) => set({ colorMode: mode }),
      setAccentName: (name) => set({ accentName: name }),
    }),
    {
      name: "compound-theme",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the user's choices — not the `hydrated` flag or setters.
      partialize: (state) => ({
        colorMode: state.colorMode,
        accentName: state.accentName,
      }),
      onRehydrateStorage: () => {
        // Called after AsyncStorage values have been read and merged.
        return (state) => {
          if (state) {
            state.hydrated = true;
          }
        };
      },
    }
  )
);
