import { useState } from "react";
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { SessionExercise, SetLogResponse } from "../../hooks/useActiveSession";

// ---------------------------------------------------------------------------
// StepperInput — a numeric input with − / + buttons
// ---------------------------------------------------------------------------

interface StepperInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Amount to add/subtract per button press (default 1). */
  step?: number;
  /** Use "number-pad" for integers, "decimal-pad" for floats. */
  keyboardType?: "number-pad" | "decimal-pad";
  placeholder?: string;
}

/**
 * StepperInput renders:  [ − ]  [ text input ]  [ + ]
 *
 * The − and + buttons adjust the numeric value by `step`.
 * The user can also type a value directly into the input.
 */
function StepperInput({
  label,
  value,
  onChangeText,
  step = 1,
  keyboardType = "number-pad",
  placeholder = "0",
}: StepperInputProps) {
  const isInteger = keyboardType === "number-pad";

  function adjust(delta: number) {
    const current = isInteger ? parseInt(value, 10) : parseFloat(value);
    const base = isNaN(current) ? 0 : current;
    const next = Math.max(0, base + delta);
    onChangeText(isInteger ? String(next) : String(parseFloat(next.toFixed(2))));
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Minus button */}
        <TouchableOpacity
          onPress={() => adjust(-step)}
          activeOpacity={0.7}
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.4)",
            borderWidth: 1,
            borderColor: "#2A2A2A",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="remove" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor="#6B7280"
          placeholder={placeholder}
          style={{
            flex: 1,
            marginHorizontal: 8,
            height: 44,
            backgroundColor: "rgba(0,0,0,0.4)",
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: "600",
            textAlign: "center",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#2A2A2A",
          }}
        />

        {/* Plus button */}
        <TouchableOpacity
          onPress={() => adjust(step)}
          activeOpacity={0.7}
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.4)",
            borderWidth: 1,
            borderColor: "#2A2A2A",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdjustSetSheetProps {
  /** Whether the sheet is visible. */
  visible: boolean;
  /** The exercise this set belongs to. */
  exercise: SessionExercise;
  /** 1-based set number being adjusted. */
  setNumber: number;
  /** Existing log if re-editing a logged set (null for new sets). */
  existingLog?: SetLogResponse;
  /** Called when the user taps "Log Set" with the adjusted values. */
  onLog: (values: {
    setNumber: number;
    actualReps?: number;
    weight?: number;
    duration?: number;
    distance?: number;
  }) => void;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AdjustSetSheet renders a bottom-sheet-style modal for manually adjusting
 * set values before logging.
 *
 * Triggered by long-pressing any set button. Pre-filled with:
 * - Target values (for unlogged sets)
 * - Actual values (for re-editing logged sets)
 *
 * Shows different input fields based on tracking_type:
 * - weight_reps / bodyweight_reps → Weight + Reps (with +/− steppers)
 * - duration → Duration
 * - distance → Distance
 */
export function AdjustSetSheet({
  visible,
  exercise,
  setNumber,
  existingLog,
  onLog,
  onClose,
}: AdjustSetSheetProps) {
  // Determine initial values: prefer existing log, fall back to targets.
  const targetWeight =
    exercise.computed_target_weight ?? exercise.static_target_weight;

  const [reps, setReps] = useState(
    String(existingLog?.actual_reps ?? exercise.target_reps ?? "")
  );
  const [weight, setWeight] = useState(
    String(existingLog?.weight ?? targetWeight ?? "")
  );
  const [duration, setDuration] = useState(
    String(existingLog?.duration ?? exercise.target_duration ?? "")
  );
  const [distance, setDistance] = useState(
    String(existingLog?.distance ?? exercise.target_distance ?? "")
  );

  function handleSubmit() {
    const values: Parameters<typeof onLog>[0] = { setNumber };

    const tt = exercise.tracking_type;
    if (tt === "weight_reps") {
      values.actualReps = reps ? parseInt(reps, 10) : undefined;
      values.weight = weight ? parseFloat(weight) : undefined;
    } else if (tt === "bodyweight_reps") {
      values.actualReps = reps ? parseInt(reps, 10) : undefined;
    } else if (tt === "duration") {
      values.duration = duration ? parseInt(duration, 10) : undefined;
    } else if (tt === "distance") {
      values.distance = distance ? parseFloat(distance) : undefined;
    }

    onLog(values);
    onClose();
  }

  const tt = exercise.tracking_type;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/60 justify-end"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-surface rounded-t-2xl px-6 pt-5 pb-10"
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <View>
              <Text className="text-white text-lg font-semibold">
                Log Set {setNumber}
              </Text>
              <Text className="text-muted text-sm mt-0.5">
                {exercise.exercise_name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Input fields — vary by tracking type */}
          <View style={{ marginBottom: 36 }}>
            {tt === "weight_reps" && (
              <View className="flex-row">
                <View className="flex-1 mr-3">
                  <StepperInput
                    label="Weight (kg)"
                    value={weight}
                    onChangeText={setWeight}
                    step={2.5}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <StepperInput
                    label="Reps"
                    value={reps}
                    onChangeText={setReps}
                    step={1}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}
            {tt === "bodyweight_reps" && (
              <StepperInput
                label="Reps"
                value={reps}
                onChangeText={setReps}
                step={1}
                keyboardType="number-pad"
              />
            )}
            {tt === "duration" && (
              <StepperInput
                label="Duration (seconds)"
                value={duration}
                onChangeText={setDuration}
                step={5}
                keyboardType="number-pad"
              />
            )}
            {tt === "distance" && (
              <StepperInput
                label="Distance (m)"
                value={distance}
                onChangeText={setDistance}
                step={10}
                keyboardType="decimal-pad"
              />
            )}
          </View>

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-accent py-3 rounded-lg items-center"
            activeOpacity={0.7}
          >
            <Text className="text-black font-bold text-sm">Log Set</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
