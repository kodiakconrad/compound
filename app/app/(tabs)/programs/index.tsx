import { useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ProgramCard } from "../../../components/program/ProgramCard";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { usePrograms } from "../../../hooks/usePrograms";
import { useDeleteProgram } from "../../../hooks/useDeleteProgram";
import { useTheme } from "../../../hooks/useTheme";
import type { ProgramListItem } from "../../../lib/types";

export default function ProgramsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { data: programs = [], isLoading } = usePrograms();
  const deleteMutation = useDeleteProgram();

  // State for the dark-themed delete confirmation dialog.
  const [deleteTarget, setDeleteTarget] = useState<{
    uuid: string;
    name: string;
  } | null>(null);

  return (
    // Same layout pattern as Library: outer View owns flex:1, SafeAreaView
    // wraps only the static header, FlatList is a sibling.
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-foreground text-2xl font-bold">Programs</Text>
          <TouchableOpacity
            onPress={() => router.push("/programs/create")}
            className="w-8 h-8 items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={26} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FlatList
        style={{ flex: 1, marginTop: 4 }}
        data={programs}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => (
          <ProgramCard
            name={item.name}
            workoutCount={item.workout_count}
            isPrebuilt={item.is_prebuilt}
            hasActiveCycle={item.has_active_cycle}
            onPress={() => router.push(`/programs/${item.uuid}`)}
            onDeleteRequest={
              item.is_prebuilt
                ? undefined
                : () => setDeleteTarget({ uuid: item.uuid, name: item.name })
            }
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center justify-center pt-16">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View className="items-center justify-center pt-16 px-8">
              <Text className="text-muted text-sm text-center">
                No programs yet. Tap + to create one or copy a prebuilt program.
              </Text>
            </View>
          )
        }
      />

      {/* Dark-themed delete confirmation */}
      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Program"
        message={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            // Remove the program from the cache immediately — synchronously,
            // before the dialog closes — so there's no frame where the item
            // is still visible behind the fading modal.
            queryClient.setQueryData<ProgramListItem[]>(["programs"], (old) =>
              old ? old.filter((p) => p.uuid !== deleteTarget.uuid) : [],
            );
            // Fire the actual DELETE request in the background.
            deleteMutation.mutate(deleteTarget.uuid);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}
