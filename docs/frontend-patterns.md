# Frontend Patterns — React Native (Phase 2+)

Binding conventions for the `/app` React Native codebase. Follow these exactly; they were discovered through real cross-platform testing.

---

## Screen Layout — SafeAreaView + Scroll Views

**Problem:** On Android, placing a `FlatList` or `ScrollView` inside a `SafeAreaView` causes the safe area inset context to leak into the scroll view's content positioning. This creates a large phantom gap before the list content — the list appears to start partway down the screen rather than at the top.

**Rule:** `SafeAreaView` wraps only the static, non-scrollable header content. Scroll views are siblings of `SafeAreaView`, not children.

```tsx
// CORRECT
<View style={{ flex: 1, backgroundColor: "#0F0F0F" }}>
  <SafeAreaView edges={["top"]} style={{ backgroundColor: "#0F0F0F" }}>
    {/* Header, search bar, filter chips — static content only */}
  </SafeAreaView>

  <FlatList style={{ flex: 1 }} ... />
</View>

// WRONG — FlatList inside SafeAreaView causes content offset bug on Android
<SafeAreaView className="flex-1 bg-background" edges={["top"]}>
  {/* ... header ... */}
  <FlatList style={{ flex: 1 }} ... />
</SafeAreaView>
```

**Why it works on both platforms:**
- iOS: The safe area context is scoped to the `SafeAreaView` block and doesn't propagate to the sibling `FlatList`.
- Android: Avoids the Android window inset system interacting with the scroll view's content positioning.
- Tab bar bottom inset: Handled by expo-router's tab navigator itself, so no `edges={["bottom"]}` is needed.

---

## FlatList Must Have `flex: 1`

Without `style={{ flex: 1 }}`, a `FlatList` in a flex-column container collapses to height 0 on Android. Content overflows unpredictably.

```tsx
<FlatList style={{ flex: 1 }} ... />
```

---

## Horizontal ScrollView (Filter Chips) — Fixed Height

A horizontal `ScrollView` used as a chip row will stretch vertically beyond its content in certain layout conditions. Always set an explicit `style={{ height: N }}` where `N = paddingTop + chipHeight + paddingBottom`.

```tsx
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={{ height: 42 }}  // paddingTop(4) + chipHeight(30) + paddingBottom(8)
  contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 }}
>
  ...
</ScrollView>
```

Individual chips use a fixed height + `justifyContent: "center"` via inline style (not NativeWind padding classes) to guarantee consistent height across platforms:

```tsx
<TouchableOpacity
  style={{ height: 30, justifyContent: "center", paddingHorizontal: 12 }}
  ...
>
```

---

## Modal Picker (SelectField)

React Native has no built-in cross-platform dropdown. Use a `Modal` with a slide-up sheet and a `FlatList` of options. The backdrop is a `TouchableOpacity` with `flex: 1` that fills space above the sheet — tapping it dismisses.

```tsx
<Modal visible={open} transparent animationType="slide">
  <View style={{ flex: 1 }}>
    {/* Backdrop fills space above the sheet; tapping dismisses */}
    <TouchableOpacity
      style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
      activeOpacity={1}
      onPress={() => setOpen(false)}
    />
    {/* Sheet — below the backdrop in the flex column */}
    <View className="bg-surface rounded-t-2xl pb-8">
      ...
    </View>
  </View>
</Modal>
```

See `components/ui/SelectField.tsx` for the full implementation.

---

## NativeWind vs Inline Styles

Use NativeWind (`className`) for most styles. Use inline `style` prop for:
- **Sizing that must be exact** — fixed heights on scroll views, chips (prevents platform layout differences)
- **Dynamic values** — values computed from JS variables
- **`contentContainerStyle`** on ScrollView/FlatList (NativeWind's `contentContainerClassName` is not reliable)
- **Modal backdrop** `backgroundColor` with opacity (e.g., `rgba(0,0,0,0.6)`)

Never mix a NativeWind class and an inline style for the same property on the same element — the inline style wins, which can cause confusion.

---

## Controlled Form Inputs

All form fields use controlled inputs: React state owns the value, every keystroke updates state, the input renders from state. This makes validation straightforward.

```tsx
const [name, setName] = useState("");
<TextInput value={name} onChangeText={setName} />
```

Disable submit buttons based on state (not DOM validity) to keep logic in one place:

```tsx
const canSubmit = name.trim().length > 0;
<TouchableOpacity disabled={!canSubmit} onPress={handleSubmit} ...>
```
