import { useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ExerciseRow } from "../../../components/exercise/ExerciseRow";
import { FilterChips } from "../../../components/exercise/FilterChips";
import { useExercises } from "../../../hooks/useExercises";
import { useExerciseFilters } from "../../../hooks/useExerciseFilters";

// Fallback chip labels shown while the filters API call is loading.
// Once loaded, the real muscle group values from the backend replace this list.
const FALLBACK_CHIPS = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function LibraryScreen() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");

  const { data: exercises = [], isLoading } = useExercises();
  const { data: filters } = useExerciseFilters();

  // Build chip labels from the backend's muscle_group enum values.
  // The backend returns lowercase strings ("chest", "back", ...) so we capitalize
  // for display. selectedFilter stays as a capitalized label, and when filtering
  // we lowercase both sides for a case-insensitive match.
  const chipLabels = filters
    ? ["All", ...filters.muscle_groups.map(capitalize)]
    : FALLBACK_CHIPS;

  const filtered = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      selectedFilter === "All" ||
      (ex.muscle_group ?? "").toLowerCase() === selectedFilter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  return (
    // Outer View owns flex:1 so the screen fills the tab area.
    // SafeAreaView only wraps the static header content (title, search, chips) so
    // its top-edge inset padding doesn't leak into the FlatList's scroll context —
    // which on Android causes the content to appear offset from the top of the list.
    <View style={{ flex: 1, backgroundColor: "#0F0F0F" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#0F0F0F" }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-white text-2xl font-bold">Library</Text>
          <TouchableOpacity
            onPress={() => router.push("/library/exercise/create")}
            className="w-8 h-8 items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={26} color="#E8FF47" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="mx-4 mb-3 flex-row items-center bg-surface border border-border rounded-xl px-3 h-10">
          <Ionicons name="search-outline" size={16} color="#6B7280" />
          <TextInput
            className="flex-1 ml-2 text-white text-sm"
            placeholder="Search exercises..."
            placeholderTextColor="#6B7280"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Muscle group filter chips — derived from backend enum values */}
        <FilterChips
          chips={chipLabels}
          selected={selectedFilter}
          onSelect={setSelectedFilter}
        />
      </SafeAreaView>

      {/* FlatList is a sibling of SafeAreaView, not a child of it.
          This prevents safe area insets from being applied to the scroll context. */}
      <FlatList
        style={{ flex: 1, marginTop: 8 }}
        data={filtered}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => (
          <ExerciseRow
            name={item.name}
            muscleGroup={item.muscle_group}
            equipment={item.equipment}
            trackingType={item.tracking_type}
            onPress={() => router.push(`/library/exercise/${item.uuid}`)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center justify-center pt-16">
              <ActivityIndicator color="#E8FF47" />
            </View>
          ) : (
            <View className="items-center justify-center pt-16">
              <Text className="text-muted text-sm">No exercises found</Text>
            </View>
          )
        }
      />
    </View>
  );
}
