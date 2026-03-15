import { useState, useEffect } from "react";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../hooks/useTheme";

// ---------------------------------------------------------------------------
// TargetInputModal — set sets, reps, and weight with +/− stepper buttons.
//
// Used by both the program builder (create.tsx) and the program detail edit
// mode ([uuid].tsx). The optional `initialSets` / `initialReps` /
// `initialWeight` props let it pre-fill values when editing an existing
// exercise. `submitLabel` defaults to "Add".
// ---------------------------------------------------------------------------

export interface TargetInputModalProps {
  visible: boolean;
  exerciseName: string;
  onSubmit: (targets: { sets: number; reps: number; weight: number }) => void;
  onCancel: () => void;
  /** Label for the submit button. Defaults to "Add". */
  submitLabel?: string;
  /** Pre-fill values. Defaults to 3 / 5 / 0. */
  initialSets?: number;
  initialReps?: number;
  initialWeight?: number;
}

export function TargetInputModal({
  visible,
  exerciseName,
  onSubmit,
  onCancel,
  submitLabel = "Add",
  initialSets = 3,
  initialReps = 5,
  initialWeight = 0,
}: TargetInputModalProps) {
  const { colors } = useTheme();
  const [sets, setSets] = useState(initialSets);
  const [reps, setReps] = useState(initialReps);
  const [weight, setWeight] = useState(initialWeight);

  // Reset values when the modal opens with new initial values.
  useEffect(() => {
    if (visible) {
      setSets(initialSets);
      setReps(initialReps);
      setWeight(initialWeight);
    }
  }, [visible, initialSets, initialReps, initialWeight]);

  // Increment / decrement helper that clamps to a minimum.
  function adjust(
    setter: React.Dispatch<React.SetStateAction<number>>,
    delta: number,
    min: number,
  ) {
    setter((prev) => Math.max(min, prev + delta));
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
        activeOpacity={1}
        onPress={onCancel}
      >
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
          <TouchableOpacity activeOpacity={1}>
            <View className="bg-surface border border-border rounded-2xl p-5">
              <Text className="text-foreground font-semibold text-lg mb-1">Set Targets</Text>
              <Text className="text-muted text-sm mb-5">{exerciseName}</Text>

              {/* Sets */}
              <View className="mb-4">
                <Text className="text-muted text-xs font-semibold tracking-widest mb-2">SETS</Text>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => adjust(setSets, -1, 1)}
                    className="bg-background border border-border rounded-lg items-center justify-center"
                    style={{ width: 48, height: 48 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                  <TextInput
                    className="flex-1 mx-3 bg-background border border-border rounded-lg text-foreground text-center"
                    style={{ height: 48, fontSize: 16, paddingVertical: 0, textAlignVertical: "center" }}
                    value={String(sets)}
                    onChangeText={(t) => setSets(parseInt(t, 10) || 0)}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    onPress={() => adjust(setSets, 1, 1)}
                    className="bg-background border border-border rounded-lg items-center justify-center"
                    style={{ width: 48, height: 48 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reps */}
              <View className="mb-4">
                <Text className="text-muted text-xs font-semibold tracking-widest mb-2">REPS</Text>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => adjust(setReps, -1, 1)}
                    className="bg-background border border-border rounded-lg items-center justify-center"
                    style={{ width: 48, height: 48 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                  <TextInput
                    className="flex-1 mx-3 bg-background border border-border rounded-lg text-foreground text-center"
                    style={{ height: 48, fontSize: 16, paddingVertical: 0, textAlignVertical: "center" }}
                    value={String(reps)}
                    onChangeText={(t) => setReps(parseInt(t, 10) || 0)}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    onPress={() => adjust(setReps, 1, 1)}
                    className="bg-background border border-border rounded-lg items-center justify-center"
                    style={{ width: 48, height: 48 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Weight */}
              <View className="mb-5">
                <Text className="text-muted text-xs font-semibold tracking-widest mb-2">WEIGHT (KG)</Text>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => adjust(setWeight, -2.5, 0)}
                    className="bg-background border border-border rounded-lg items-center justify-center"
                    style={{ width: 48, height: 48 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                  <TextInput
                    className="flex-1 mx-3 bg-background border border-border rounded-lg text-foreground text-center"
                    style={{ height: 48, fontSize: 16, paddingVertical: 0, textAlignVertical: "center" }}
                    value={weight > 0 ? String(weight) : ""}
                    onChangeText={(t) => setWeight(parseFloat(t) || 0)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    onPress={() => adjust(setWeight, 2.5, 0)}
                    className="bg-background border border-border rounded-lg items-center justify-center"
                    style={{ width: 48, height: 48 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row justify-end">
                <TouchableOpacity onPress={onCancel} className="px-4 py-2 mr-2" activeOpacity={0.7}>
                  <Text className="text-muted text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    onSubmit({
                      sets: sets || initialSets,
                      reps: reps || initialReps,
                      weight: weight || 0,
                    });
                  }}
                  className="bg-accent rounded-lg px-4 py-2"
                  activeOpacity={0.7}
                >
                  <Text className="text-background text-sm font-semibold">{submitLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
