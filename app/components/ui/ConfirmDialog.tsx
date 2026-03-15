import { Modal, Text, TouchableOpacity, View } from "react-native";

// ---------------------------------------------------------------------------
// ConfirmDialog — a dark-themed confirmation modal that replaces Alert.alert.
//
// Renders a centred card on a dim backdrop. Has a title, message, and two
// buttons (cancel + destructive confirm). Tapping the backdrop cancels.
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Label for the destructive action. Defaults to "Delete". */
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
              <Text className="text-white font-semibold text-lg mb-2">{title}</Text>
              <Text className="text-muted text-sm mb-5">{message}</Text>

              <View className="flex-row justify-end">
                <TouchableOpacity
                  onPress={onCancel}
                  className="px-4 py-2 mr-2"
                  activeOpacity={0.7}
                >
                  <Text className="text-muted text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onConfirm}
                  className="rounded-lg px-4 py-2"
                  style={{ backgroundColor: "#EF4444" }}
                  activeOpacity={0.7}
                >
                  <Text className="text-white text-sm font-semibold">{confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
