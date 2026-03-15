import { useState, useEffect, useMemo } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { StepperRow } from "../ui/StepperRow";
import { build531, estimate1RM, trainingMax } from "../../lib/schemes";
import type { SetScheme } from "../../lib/types";

// ---------------------------------------------------------------------------
// FiveThreeOneInputModal — configure a Wendler 5/3/1 progression scheme.
//
// The user can input either:
//   (a) A known 1RM, or
//   (b) A working weight + reps (from which we estimate the 1RM)
//
// They also select a week (1, 2, or 3) which determines the percentage
// template. A live preview shows the three working sets.
// ---------------------------------------------------------------------------

// Week labels for the toggle buttons.
const WEEKS: { week: 1 | 2 | 3; label: string }[] = [
  { week: 1, label: "W1: 5/5/5+" },
  { week: 2, label: "W2: 3/3/3+" },
  { week: 3, label: "W3: 5/3/1+" },
];

interface FiveThreeOneInputModalProps {
  visible: boolean;
  exerciseName: string;
  onSubmit: (scheme: SetScheme) => void;
  onCancel: () => void;
}

export function FiveThreeOneInputModal({
  visible,
  exerciseName,
  onSubmit,
  onCancel,
}: FiveThreeOneInputModalProps) {
  // "1rm" = user enters their known 1RM directly.
  // "working" = user enters a weight + reps and we estimate the 1RM.
  const [inputMethod, setInputMethod] = useState<"1rm" | "working">("1rm");
  const [oneRepMax, setOneRepMax] = useState(100);
  const [workingWeight, setWorkingWeight] = useState(80);
  const [workingReps, setWorkingReps] = useState(5);
  const [week, setWeek] = useState<1 | 2 | 3>(1);

  // Reset when modal opens.
  useEffect(() => {
    if (visible) {
      setInputMethod("1rm");
      setOneRepMax(100);
      setWorkingWeight(80);
      setWorkingReps(5);
      setWeek(1);
    }
  }, [visible]);

  // Compute effective 1RM based on the selected input method.
  const effective1RM = useMemo(() => {
    if (inputMethod === "1rm") return oneRepMax;
    return estimate1RM(workingWeight, workingReps);
  }, [inputMethod, oneRepMax, workingWeight, workingReps]);

  const tm = useMemo(() => trainingMax(effective1RM), [effective1RM]);

  // Live preview of the scheme.
  const scheme = useMemo(() => {
    if (inputMethod === "1rm") {
      return build531({ oneRepMax }, week);
    }
    return build531({ workingWeight, workingReps }, week);
  }, [inputMethod, oneRepMax, workingWeight, workingReps, week]);

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
              <Text className="text-white font-semibold text-lg mb-1">5/3/1 Setup</Text>
              <Text className="text-muted text-sm mb-4">{exerciseName}</Text>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {/* Input method toggle */}
                <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
                  INPUT METHOD
                </Text>
                <View className="flex-row mb-4" style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setInputMethod("1rm")}
                    className={`flex-1 py-2 rounded-lg border ${
                      inputMethod === "1rm"
                        ? "bg-accent border-accent"
                        : "bg-background border-border"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        inputMethod === "1rm" ? "text-background" : "text-white"
                      }`}
                    >
                      1RM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setInputMethod("working")}
                    className={`flex-1 py-2 rounded-lg border ${
                      inputMethod === "working"
                        ? "bg-accent border-accent"
                        : "bg-background border-border"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        inputMethod === "working" ? "text-background" : "text-white"
                      }`}
                    >
                      Working Weight
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Conditional inputs based on method */}
                {inputMethod === "1rm" ? (
                  <StepperRow
                    label="1RM"
                    value={oneRepMax}
                    onChange={setOneRepMax}
                    min={0}
                    step={2.5}
                    keyboardType="decimal-pad"
                    suffix="kg"
                  />
                ) : (
                  <>
                    <StepperRow
                      label="Weight"
                      value={workingWeight}
                      onChange={setWorkingWeight}
                      min={0}
                      step={2.5}
                      keyboardType="decimal-pad"
                      suffix="kg"
                    />
                    <StepperRow
                      label="Reps"
                      value={workingReps}
                      onChange={setWorkingReps}
                      min={1}
                    />
                  </>
                )}

                {/* Training max display */}
                <View className="flex-row justify-between mb-4 px-1">
                  <Text className="text-muted text-xs">
                    Est. 1RM: {effective1RM} kg
                  </Text>
                  <Text className="text-muted text-xs">
                    Training Max (90%): {tm} kg
                  </Text>
                </View>

                {/* Week selector */}
                <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
                  WEEK
                </Text>
                <View className="flex-row mb-4" style={{ gap: 8 }}>
                  {WEEKS.map((w) => (
                    <TouchableOpacity
                      key={w.week}
                      onPress={() => setWeek(w.week)}
                      className={`flex-1 py-2 rounded-lg border ${
                        week === w.week
                          ? "bg-accent border-accent"
                          : "bg-background border-border"
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-center text-xs font-semibold ${
                          week === w.week ? "text-background" : "text-white"
                        }`}
                      >
                        {w.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Preview */}
                <View className="bg-background border border-border rounded-xl p-3 mb-4">
                  <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
                    PREVIEW
                  </Text>
                  {scheme.sets.map((s, i) => {
                    const isLast = i === scheme.sets.length - 1;
                    return (
                      <Text key={i} className="text-white text-sm mb-0.5">
                        Set {i + 1}: {s.reps}{isLast ? "+" : ""} x {s.weight} kg
                      </Text>
                    );
                  })}
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
