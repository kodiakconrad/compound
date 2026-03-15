import { useState } from "react";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";
import { useExercises } from "../../hooks/useExercises";
import type { Exercise } from "../../lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SubstitutionPickerModalProps {
  /** Whether the modal is visible. */
  visible: boolean;
  /** The name of the exercise being replaced — shown in the header. */
  currentExerciseName: string;
  /** Muscle group to filter suggestions by (e.g., "chest"). Pass null for no filter. */
  muscleGroup?: string | null;
  /** Called when the user picks a replacement exercise. */
  onSelect: (exercise: Exercise) => void;
  /** Called when the user cancels. */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SubstitutionPickerModal shows a filterable list of exercises to swap in
 * as a replacement for the current exercise in a session.
 *
 * By default, the list is filtered to exercises that share the same muscle
 * group as the exercise being replaced. The user can toggle "Show all" to
 * see every exercise.
 */
export function SubstitutionPickerModal({
  visible,
  currentExerciseName,
  muscleGroup,
  onSelect,
  onCancel,
}: SubstitutionPickerModalProps) {
  const { colors } = useTheme();
  const { data: exercises = [] } = useExercises();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const hasFilter = !!muscleGroup && !showAll;

  const filtered = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (hasFilter) {
      return ex.muscle_group != null && ex.muscle_group === muscleGroup;
    }
    return true;
  });

  function handleSelect(exercise: Exercise) {
    setSearch("");
    setShowAll(false);
    onSelect(exercise);
  }

  function handleCancel() {
    setSearch("");
    setShowAll(false);
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* Dark scrim behind the modal so no light background peeks through */}
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
      <View style={{ flex: 1, backgroundColor: colors.background, marginTop: 60, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={handleCancel} activeOpacity={0.7} style={{ marginRight: 12 }}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>
              Swap Exercise
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
              Replacing {currentExerciseName}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View
          style={{
            marginHorizontal: 16,
            marginVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Ionicons name="search-outline" size={16} color={colors.muted} />
          <TextInput
            style={{ flex: 1, marginLeft: 8, color: colors.foreground, fontSize: 14 }}
            placeholder="Search exercises..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {/* Filter toggle */}
        {muscleGroup && (
          <TouchableOpacity
            onPress={() => setShowAll((prev) => !prev)}
            style={{ marginHorizontal: 16, marginBottom: 12 }}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.accent, fontSize: 14 }}>
              {showAll ? "Show suggested only" : "Show all exercises"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Exercise list */}
        <ScrollView style={{ flex: 1 }}>
          {filtered.map((ex) => (
            <TouchableOpacity
              key={ex.uuid}
              onPress={() => handleSelect(ex)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.foreground, fontSize: 16 }}>{ex.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
              </Text>
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && (
            <View style={{ alignItems: "center", paddingTop: 48 }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>No exercises found</Text>
            </View>
          )}
        </ScrollView>
      </View>
      </View>
    </Modal>
  );
}
