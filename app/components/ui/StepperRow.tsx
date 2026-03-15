import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// StepperRow — a labelled numeric input with +/− buttons.
//
// Extracted as a shared component because the scheme modals (Pyramid, 5/3/1,
// Drop Set) and TargetInputModal all use this exact same pattern.
// ---------------------------------------------------------------------------

interface StepperRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** Minimum allowed value. Defaults to 0. */
  min?: number;
  /** Step size for +/− buttons. Defaults to 1. */
  step?: number;
  /** Keyboard type. Defaults to "number-pad". */
  keyboardType?: "number-pad" | "decimal-pad";
  /** Placeholder when value is 0. Defaults to "0". */
  placeholder?: string;
  /** Suffix shown after the label (e.g., "kg", "%"). */
  suffix?: string;
}

export function StepperRow({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  keyboardType = "number-pad",
  placeholder = "0",
  suffix,
}: StepperRowProps) {
  function adjust(delta: number) {
    onChange(Math.max(min, value + delta));
  }

  const displayLabel = suffix ? `${label} (${suffix})` : label;

  return (
    <View className="mb-4">
      <Text className="text-muted text-xs font-semibold tracking-widest mb-2">
        {displayLabel.toUpperCase()}
      </Text>
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => adjust(-step)}
          className="bg-background border border-border rounded-lg items-center justify-center"
          style={{ width: 48, height: 48 }}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TextInput
          className="flex-1 mx-3 bg-background border border-border rounded-lg text-white text-center"
          style={{ height: 48, fontSize: 16, paddingVertical: 0, textAlignVertical: "center" }}
          value={value > 0 ? String(value) : ""}
          onChangeText={(t) => {
            const parsed = keyboardType === "decimal-pad" ? parseFloat(t) : parseInt(t, 10);
            onChange(parsed || 0);
          }}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          selectTextOnFocus
        />
        <TouchableOpacity
          onPress={() => adjust(step)}
          className="bg-background border border-border rounded-lg items-center justify-center"
          style={{ width: 48, height: 48 }}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
