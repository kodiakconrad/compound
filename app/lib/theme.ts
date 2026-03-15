// ---------------------------------------------------------------------------
// Theme constants — color palettes, accent options, and CSS variable builder
// ---------------------------------------------------------------------------
//
// This file is pure data — no React, no hooks. It defines the two color modes
// (dark / light), the preset accent colors the user can choose from, and a
// helper that builds the NativeWind `vars` object so Tailwind CSS-variable–
// based color tokens resolve to the right values at runtime.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The two appearance modes the user can toggle between. */
export type ColorMode = "dark" | "light";

/** Preset accent color names. */
export type AccentName =
  | "lime"
  | "blue"
  | "red"
  | "purple"
  | "orange"
  | "teal"
  | "pink";

// ---------------------------------------------------------------------------
// Accent options
// ---------------------------------------------------------------------------

/** Each accent option has a hex color and a human-readable label. */
export interface AccentOption {
  hex: string;
  label: string;
}

/**
 * ACCENT_OPTIONS lists every accent the user can pick in Settings.
 * The order here is the order they appear in the picker UI.
 */
export const ACCENT_OPTIONS: Record<AccentName, AccentOption> = {
  lime:   { hex: "#E8FF47", label: "Lime" },
  blue:   { hex: "#60A5FA", label: "Blue" },
  red:    { hex: "#F87171", label: "Red" },
  purple: { hex: "#A78BFA", label: "Purple" },
  orange: { hex: "#FB923C", label: "Orange" },
  teal:   { hex: "#2DD4BF", label: "Teal" },
  pink:   { hex: "#F472B6", label: "Pink" },
};

/** Ordered list of accent names — used when rendering the picker row. */
export const ACCENT_NAMES: AccentName[] = [
  "lime",
  "blue",
  "red",
  "purple",
  "orange",
  "teal",
  "pink",
];

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

/** Semantic color palette for one color mode (excludes accent — that's independent). */
export interface Palette {
  background: string;
  surface: string;
  border: string;
  foreground: string; // primary text color
  muted: string;      // secondary / dimmed text
}

/**
 * PALETTES defines the two appearance modes.
 *
 * "foreground" replaces the old `text-white` usage — in dark mode it's white,
 * in light mode it's near-black, and Tailwind classes like `text-foreground`
 * automatically resolve via the CSS variable.
 */
export const PALETTES: Record<ColorMode, Palette> = {
  dark: {
    background: "#0F0F0F",
    surface:    "#1A1A1A",
    border:     "#2A2A2A",
    foreground: "#FFFFFF",
    muted:      "#6B7280",
  },
  light: {
    background: "#F5F5F5",
    surface:    "#FFFFFF",
    border:     "#E5E5E5",
    foreground: "#1A1A1A",
    muted:      "#6B7280",
  },
};

// ---------------------------------------------------------------------------
// CSS variable builder
// ---------------------------------------------------------------------------

/**
 * Resolved theme — everything a component might need from the current theme.
 */
export interface ResolvedTheme {
  colors: Palette & { accent: string };
  /** The NativeWind `vars` object to set on the root View. Keys are CSS custom
   *  property names (with `--` prefix), values are the resolved hex strings. */
  vars: Record<string, string>;
}

/**
 * resolveTheme takes the user's choices and returns the full resolved palette
 * plus the `vars` map for NativeWind's CSS variable injection.
 *
 * Usage in the root layout:
 * ```tsx
 * const { colors, vars } = resolveTheme("dark", "lime");
 * <View style={{ flex: 1, ...vars }}>
 * ```
 *
 * NativeWind v4 reads CSS custom properties from ancestor `style` props, so
 * setting `--color-accent: "#60A5FA"` on the root makes every `bg-accent`,
 * `text-accent`, `border-accent` Tailwind class use that value.
 */
export function resolveTheme(
  mode: ColorMode,
  accentName: AccentName
): ResolvedTheme {
  const palette = PALETTES[mode];
  const accentHex = ACCENT_OPTIONS[accentName].hex;

  return {
    colors: { ...palette, accent: accentHex },
    vars: {
      "--color-background": palette.background,
      "--color-surface":    palette.surface,
      "--color-border":     palette.border,
      "--color-foreground": palette.foreground,
      "--color-accent":     accentHex,
    },
  };
}
