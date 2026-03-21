import { useState, useEffect, useMemo } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { StepperRow } from "../ui/StepperRow";
import { buildPyramid, formatSchemeSummary } from "../../lib/schemes";
import type { SetScheme } from "../../domain/program";

// ---------------------------------------------------------------------------
// PyramidInputModal — configure a pyramid progression scheme.
//
// The user sets:
// - Number of sets
// - Start weight & peak weight (weight ramps up each set)
// - Start reps & end reps (reps decrease each set)
//
// A live preview shows the calculated sets as the user adjusts values.
// ---------------------------------------------------------------------------

interface PyramidInputModalProps {
  visible: boolean;
  exerciseName: string;
  onSubmit: (scheme: SetScheme) => void;
  onCancel: () => void;
}

export function PyramidInputModal({
  visible,
  exerciseName,
  onSubmit,
  onCancel,
}: PyramidInputModalProps) {
  const [sets, setSets] = useState(4);
  const [startWeight, setStartWeight] = useState(40);
  const [peakWeight, setPeakWeight] = useState(80);
  const [startReps, setStartReps] = useState(12);
  const [endReps, setEndReps] = useState(6);

  // Reset when modal opens.
  useEffect(() => {
    if (visible) {
      setSets(4);
      setStartWeight(40);
      setPeakWeight(80);
      setStartReps(12);
      setEndReps(6);
    }
  }, [visible]);

  // Live preview of the scheme.
  const scheme = useMemo(
    () => buildPyramid(sets, startWeight, peakWeight, startReps, endReps),
    [sets, startWeight, peakWeight, startReps, endReps],
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
              <Text className="text-foreground font-semibold text-lg mb-1">Pyramid Setup</Text>
              <Text className="text-muted text-sm mb-5">{exerciseName}</Text>

              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                <StepperRow label="Sets" value={sets} onChange={setSets} min={2} />
                <StepperRow
                  label="Start Weight"
                  value={startWeight}
                  onChange={setStartWeight}
                  min={0}
                  step={2.5}
                  keyboardType="decimal-pad"
                  suffix="kg"
                />
                <StepperRow
                  label="Peak Weight"
                  value={peakWeight}
                  onChange={setPeakWeight}
                  min={0}
                  step={2.5}
                  keyboardType="decimal-pad"
                  suffix="kg"
                />
                <StepperRow
                  label="Start Reps"
                  value={startReps}
                  onChange={setStartReps}
                  min={1}
                />
                <StepperRow
                  label="End Reps"
                  value={endReps}
                  onChange={setEndReps}
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
