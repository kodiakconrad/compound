import { create } from "zustand";

// Session store tracks UI state for the active workout session.
// This is separate from the server-side session data (fetched via TanStack Query)
// because it holds transient UI state like "which exercise the user is currently on"
// that doesn't need to be persisted to the backend.
//
// Server state (sections, exercises, logged sets) → useActiveSession() hook
// UI state (which card is focused, which set button is highlighted) → this store

interface SessionState {
  sessionUUID: string | null;
  currentSectionIndex: number;
  currentExerciseIndex: number;

  // setSession is called when the user starts or resumes a session
  setSession: (uuid: string) => void;

  // clearSession is called when the session is completed or skipped
  clearSession: () => void;

  // Navigate between sections/exercises within the active session
  setSectionIndex: (index: number) => void;
  setExerciseIndex: (index: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionUUID: null,
  currentSectionIndex: 0,
  currentExerciseIndex: 0,

  setSession: (uuid) =>
    set({ sessionUUID: uuid, currentSectionIndex: 0, currentExerciseIndex: 0 }),

  clearSession: () =>
    set({ sessionUUID: null, currentSectionIndex: 0, currentExerciseIndex: 0 }),

  setSectionIndex: (index) => set({ currentSectionIndex: index }),
  setExerciseIndex: (index) => set({ currentExerciseIndex: index }),
}));
