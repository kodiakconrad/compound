import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// SchemePicker — modal to choose a set progression scheme.
//
// Shown after the user selects an exercise in the builder. They pick:
// "Straight Sets" (flat targets), "Pyramid", "5/3/1", or "Drop Set".
// The choice determines which configuration modal opens next.
// ---------------------------------------------------------------------------

// The scheme choices available. "straight" means flat sets/reps/weight
// (no SetScheme on the backend — uses the existing TargetInputModal).
export type SchemeChoice = "straight" | "pyramid" | "531" | "dropset";

interface SchemePickerProps {
  visible: boolean;
  exerciseName: string;
  onSelect: (choice: SchemeChoice) => void;
  onCancel: () => void;
}

const OPTIONS: { choice: SchemeChoice; label: string; desc: string; icon: string }[] = [
  {
    choice: "straight",
    label: "Straight Sets",
    desc: "Same weight & reps every set",
    icon: "reorder-four-outline",
  },
  {
    choice: "pyramid",
    label: "Pyramid",
    desc: "Increase weight, decrease reps each set",
    icon: "triangle-outline",
  },
  {
    choice: "531",
    label: "5/3/1",
    desc: "Wendler percentages from your 1RM",
    icon: "barbell-outline",
  },
  {
    choice: "dropset",
    label: "Drop Set",
    desc: "Start heavy, strip weight each set",
    icon: "trending-down-outline",
  },
];

export function SchemePicker({ visible, exerciseName, onSelect, onCancel }: SchemePickerProps) {
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
              <Text className="text-white font-semibold text-lg mb-1">Set Scheme</Text>
              <Text className="text-muted text-sm mb-5">{exerciseName}</Text>

              {OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.choice}
                  onPress={() => onSelect(opt.choice)}
                  className="flex-row items-center bg-background border border-border rounded-xl px-4 py-3 mb-2"
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={20}
                    color="#E8FF47"
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text className="text-white font-semibold text-sm">{opt.label}</Text>
                    <Text className="text-muted text-xs mt-0.5">{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              <TouchableOpacity onPress={onCancel} className="mt-2 py-2" activeOpacity={0.7}>
                <Text className="text-muted text-sm text-center">Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
