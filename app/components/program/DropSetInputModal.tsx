import { useState, useEffect, useMemo } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { StepperRow } from "../ui/StepperRow";
import { buildDropSet } from "../../lib/schemes";
import type { SetScheme } from "../../lib/types";

// ---------------------------------------------------------------------------
// DropSetInputModal — configure a drop set progression scheme.
//
// The user sets:
// - Number of sets
// - Top weight (heaviest set)
// - Drop percentage (how much to reduce each set)
// - Reps per set (same for all sets)
//
// A live preview shows the calculated sets.
// ---------------------------------------------------------------------------

interface DropSetInputModalProps {
  visible: boolean;
  exerciseName: string;
  onSubmit: (scheme: SetScheme) => void;
  onCancel: () => void;
}

export function DropSetInputModal({
  visible,
  exerciseName,
  onSubmit,
  onCancel,
}: DropSetInputModalProps) {
  const [sets, setSets] = useState(3);
  const [topWeight, setTopWeight] = useState(80);
  const [dropPercent, setDropPercent] = useState(25);
  const [repsPerSet, setRepsPerSet] = useState(8);

  // Reset when modal opens.
  useEffect(() => {
    if (visible) {
      setSets(3);
      setTopWeight(80);
      setDropPercent(25);
      setRepsPerSet(8);
    }
  }, [visible]);

  // Live preview of the scheme.
  const scheme = useMemo(
    () => buildDropSet(sets, topWeight, dropPercent, repsPerSet),
    [sets, topWeight, dropPercent, repsPerSet],
  );

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
              <Text className="text-foreground font-semibold text-lg mb-1">Drop Set Setup</Text>
              <Text className="text-muted text-sm mb-5">{exerciseName}</Text>

              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <StepperRow label="Sets" value={sets} onChange={setSets} min={2} />
                <StepperRow
                  label="Top Weight"
                  value={topWeight}
                  onChange={setTopWeight}
                  min={0}
                  step={2.5}
                  keyboardType="decimal-pad"
                  suffix="kg"
                />
                <StepperRow
                  label="Drop"
                  value={dropPercent}
                  onChange={setDropPercent}
                  min={5}
                  step={5}
                  suffix="%"
                />
                <StepperRow
                  label="Reps per Set"
                  value={repsPerSet}
                  onChange={setRepsPerSet}
                  min={1}
                />

                {/* Preview */}
                <View className="bg-background border border-border rounded-xl p-3 mb-4">
                  <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
                    PREVIEW
                  </Text>
                  {scheme.sets.map((s, i) => (
                    <Text key={i} className="text-foreground text-sm mb-0.5">
                      Set {i + 1}: {s.reps} x {s.weight} kg
                    </Text>
                  ))}
                </View>
              </ScrollView>

              <View className="flex-row justify-end">
                <TouchableOpacity onPress={onCancel} className="px-4 py-2 mr-2" activeOpacity={0.7}>
                  <Text className="text-muted text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSubmit(scheme)}
                  className="bg-accent rounded-lg px-4 py-2"
                  activeOpacity={0.7}
                >
                  <Text className="text-background text-sm font-semibold">Add Exercise</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
