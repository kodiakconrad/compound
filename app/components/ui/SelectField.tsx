import { useState } from "react";
import { FlatList, Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SelectFieldProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

// SelectField shows a label on the left and a tappable value button on the right.
// Tapping opens a modal slide-up sheet with a list of options.
//
// Why a Modal instead of a native Picker?
//   React Native has no built-in cross-platform dropdown. The Modal + FlatList
//   pattern gives us consistent look and feel on both iOS and Android.
export function SelectField({ label, options, value, onChange }: SelectFieldProps) {
  // `open` controls whether the picker sheet is visible.
  const [open, setOpen] = useState(false);

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-border">
      <Text className="text-white text-base">{label}</Text>

      {/* Trigger button — shows the current value and a down chevron */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-1.5"
        style={{ gap: 6 }}
        activeOpacity={0.7}
      >
        <Text className="text-white text-sm">{value}</Text>
        <Ionicons name="chevron-down" size={14} color="#6B7280" />
      </TouchableOpacity>

      {/* Modal picker sheet */}
      <Modal visible={open} transparent animationType="slide">
        <View style={{ flex: 1 }}>
          {/* Semi-transparent backdrop — fills the space above the sheet.
              Tapping it dismisses the modal. */}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          />

          {/* The sheet — rendered below the backdrop in the flex column */}
          <View className="bg-surface rounded-t-2xl pb-8">
            {/* Visual drag handle indicator */}
            <View className="items-center pt-3 pb-4">
              <View className="w-10 h-1 bg-border rounded-full" />
            </View>

            <Text className="text-white font-bold text-base px-4 mb-2">{label}</Text>

            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between px-4 py-3 border-b border-border"
                  activeOpacity={0.7}
                >
                  <Text className="text-white text-base">{item}</Text>
                  {item === value && (
                    <Ionicons name="checkmark" size={18} color="#E8FF47" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
