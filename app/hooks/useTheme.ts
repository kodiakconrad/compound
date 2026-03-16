import { useMemo } from "react";

import { resolveTheme } from "../lib/theme";
import type { AccentName, ColorMode, ResolvedTheme } from "../lib/theme";
import { useThemeStore } from "../store/theme";

// ---------------------------------------------------------------------------
// useTheme — the single hook components call to get dynamic colors
// ---------------------------------------------------------------------------
//
// Returns the resolved color palette, the NativeWind `vars` object (for the
// root layout), and the setters so the Settings screen can update preferences.
//
// Components use this in two ways:
//
// 1. **Tailwind classes** (`bg-background`, `text-accent`, etc.) — these work
//    automatically because the root layout applies `vars` to set CSS custom
//    properties that Tailwind references.
//
// 2. **Inline `style` props** and Ionicons `color` — use `colors.accent`,
//    `colors.background`, etc. from this hook.

interface UseThemeResult extends ResolvedTheme {
  colorMode: ColorMode;
  accentName: AccentName;
  setColorMode: (mode: ColorMode) => void;
  setAccentName: (name: AccentName) => void;
}

export function useTheme(): UseThemeResult {
  const colorMode = useThemeStore((s) => s.colorMode);
  const accentName = useThemeStore((s) => s.accentName);
  const setColorMode = useThemeStore((s) => s.setColorMode);
  const setAccentName = useThemeStore((s) => s.setAccentName);

  // Memoize the resolved theme so we only recompute when mode or accent changes.
  const resolved = useMemo(
    () => resolveTheme(colorMode, accentName),
    [colorMode, accentName]
  );

  return {
    ...resolved,
    colorMode,
    accentName,
    setColorMode,
    setAccentName,
  };
}
