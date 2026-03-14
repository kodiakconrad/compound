import { ScrollView, Text, TouchableOpacity } from "react-native";

interface FilterChipsProps {
  chips: string[];
  selected: string;
  onSelect: (chip: string) => void;
}

// FilterChips renders a horizontal scrollable row of filter pills.
// The selected chip uses the accent (lime) color; unselected chips use a muted border.
export function FilterChips({ chips, selected, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Explicit height prevents the ScrollView from stretching vertically beyond the chips.
      // paddingTop(4) + chipHeight(30) + paddingBottom(8) = 42px.
      style={{ height: 42 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 }}
    >
      {chips.map((chip) => {
        const isActive = chip === selected;
        return (
          <TouchableOpacity
            key={chip}
            onPress={() => onSelect(chip)}
            // Fixed height + justifyContent ensures all chips are the same size
            // regardless of font scaling or platform differences.
            style={{ height: 30, justifyContent: "center", paddingHorizontal: 12 }}
            className={`rounded-full border ${
              isActive ? "bg-accent border-accent" : "bg-transparent border-border"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-medium ${isActive ? "text-background" : "text-muted"}`}
            >
              {chip}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
