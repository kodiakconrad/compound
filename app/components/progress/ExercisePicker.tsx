import { useState } from "react";
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";

interface ExerciseOption {
  uuid: string;
  name: string;
}

interface ExercisePickerProps {
  exercises: ExerciseOption[];
  selectedUUID: string | null;
  onSelect: (uuid: string) => void;
}

// ExercisePicker shows a dropdown-style button that opens a searchable modal
// for selecting an exercise. Used in the Progress tab to choose which exercise
// to display on the history chart.
//
// Layout:
//   [ Bench Press ▾ ]   ← tappable, opens modal
//
// Modal:
//   Search bar
//   Scrollable list of exercises with checkmark on the selected one
export function ExercisePicker({ exercises, selectedUUID, onSelect }: ExercisePickerProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedName = exercises.find((e) => e.uuid === selectedUUID)?.name ?? "Select exercise";

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View className="mx-4 mt-6">
      <Text className="text-muted text-xs font-bold tracking-wider mb-2">EXERCISE HISTORY</Text>

      {/* Trigger button */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between bg-surface border border-border rounded-xl px-4 py-3"
        activeOpacity={0.7}
      >
        <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
          {selectedName}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </TouchableOpacity>

      {/* Modal picker */}
      <Modal visible={open} transparent animationType="slide">
        <View style={{ flex: 1 }}>
          {/* Backdrop */}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
            activeOpacity={1}
            onPress={() => { setOpen(false); setSearch(""); }}
          />

          {/* Sheet */}
          <View className="bg-surface rounded-t-2xl pb-8" style={{ maxHeight: "60%" }}>
            <View className="items-center pt-3 pb-4">
              <View className="w-10 h-1 bg-border rounded-full" />
            </View>

            <Text className="text-foreground font-bold text-base px-4 mb-2">Select exercise</Text>

            {/* Search bar */}
            <View className="mx-4 mb-3 flex-row items-center bg-background border border-border rounded-xl px-3 h-10">
              <Ionicons name="search-outline" size={16} color={colors.muted} />
              <TextInput
                className="flex-1 ml-2 text-foreground text-sm"
                placeholder="Search..."
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.uuid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onSelect(item.uuid);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex-row items-center justify-between px-4 py-3 border-b border-border"
                  activeOpacity={0.7}
                >
                  <Text className="text-foreground text-base">{item.name}</Text>
                  {item.uuid === selectedUUID && (
                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="items-center py-6">
                  <Text className="text-muted text-sm">No exercises found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
