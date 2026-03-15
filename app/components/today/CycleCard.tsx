import { ActivityIndicator, Text, View } from "react-native";

import { UpcomingSession } from "./UpcomingSession";
import { useCycleDetail } from "../../hooks/useCycles";
import { useSessionDetail } from "../../hooks/useSession";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CycleCardProps {
  /** UUID of the active cycle. */
  cycleUUID: string;
  /** Display name of the program this cycle belongs to. */
  programName: string;
  /** Called when the user taps "Start Session" on this card. */
  onStartSession: (cycleUUID: string, sessionUUID: string) => void;
  /** Whether the start mutation is currently loading. */
  isStarting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CycleCard is a self-contained card for one active cycle.
 *
 * It internally fetches the cycle detail (to find the next pending session)
 * and the session detail (to show the exercise preview). This avoids the
 * "hooks in a loop" problem — each CycleCard is a separate component with
 * its own hook calls.
 *
 * If all sessions in the cycle are complete, it shows a "Cycle complete"
 * message instead of an upcoming session preview.
 */
export function CycleCard({
  cycleUUID,
  programName,
  onStartSession,
  isStarting = false,
}: CycleCardProps) {
  // 1. Fetch cycle detail with its sessions.
  const { data: cycleDetail, isLoading: isLoadingCycle } = useCycleDetail(cycleUUID);

  // 2. Find the next pending session in sort_order.
  const nextPendingSession = cycleDetail?.sessions
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.sort_order - b.sort_order)[0];

  // 3. Compute session label like "Session 3 of 12".
  const sessionLabel = cycleDetail
    ? (() => {
        const total = cycleDetail.sessions.length;
        const completed = cycleDetail.sessions.filter(
          (s) => s.status === "completed" || s.status === "skipped"
        ).length;
        return `Session ${completed + 1} of ${total}`;
      })()
    : "";

  // 4. Fetch full session detail (exercises, targets) for the preview.
  const { data: sessionDetail } = useSessionDetail(
    cycleUUID,
    nextPendingSession?.uuid
  );

  // --- Loading state ---
  if (isLoadingCycle) {
    return (
      <View className="px-4 pt-4">
        <View className="bg-surface rounded-xl border border-border p-4 items-center py-8">
          <ActivityIndicator color="#E8FF47" />
          <Text className="text-muted text-xs mt-3">Loading...</Text>
        </View>
      </View>
    );
  }

  // --- Cycle complete (all sessions done) ---
  if (!nextPendingSession) {
    return (
      <View className="px-4 pt-4">
        <View className="bg-surface rounded-xl border border-border p-4">
          <Text className="text-muted text-xs mb-1">{programName}</Text>
          <Text className="text-white text-base font-semibold mb-1">
            Cycle complete!
          </Text>
          <Text className="text-muted text-sm">
            All sessions are done. Start a new cycle from the Programs tab.
          </Text>
        </View>
      </View>
    );
  }

  // --- Upcoming session preview ---
  if (sessionDetail) {
    return (
      <UpcomingSession
        programName={programName}
        workoutName={sessionDetail.workout_name}
        sessionLabel={sessionLabel}
        sections={sessionDetail.sections}
        onStart={() => onStartSession(cycleUUID, nextPendingSession.uuid)}
        isStarting={isStarting}
      />
    );
  }

  // --- Loading session detail ---
  return (
    <View className="px-4 pt-4">
      <View className="bg-surface rounded-xl border border-border p-4 items-center py-8">
        <ActivityIndicator color="#E8FF47" />
        <Text className="text-muted text-xs mt-3">Loading workout...</Text>
      </View>
    </View>
  );
}
