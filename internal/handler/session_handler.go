package handler

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/domain"
	"compound/internal/handler/dto"
	"compound/internal/store"
)

// SessionHandler handles session and set-log HTTP endpoints.
type SessionHandler struct {
	store *store.Store
}

// NewSessionHandler creates a new SessionHandler.
func NewSessionHandler(s *store.Store) *SessionHandler {
	return &SessionHandler{store: s}
}

// HandleGetSession handles GET /api/v1/cycles/{cycleID}/sessions/{sessionID}.
// Returns the full session detail including sections, exercises with computed
// target weights, and any set_logs already recorded.
func (h *SessionHandler) HandleGetSession(w http.ResponseWriter, r *http.Request) {
	sessionUUID := chi.URLParam(r, "sessionID")

	detail, err := h.store.GetSessionDetail(r.Context(), h.store.DB, sessionUUID)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToSessionDetailResponse(detail))
}

// HandleStartSession handles POST /api/v1/cycles/{cycleID}/sessions/{sessionID}/start.
func (h *SessionHandler) HandleStartSession(w http.ResponseWriter, r *http.Request) {
	sessionUUID := chi.URLParam(r, "sessionID")

	sess, err := h.store.StartSession(r.Context(), h.store.DB, sessionUUID)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToSessionResponse(sess))
}

// HandleCompleteSession handles PUT /api/v1/cycles/{cycleID}/sessions/{sessionID}/complete.
// Optionally accepts { "notes": "..." } in the body.
// After completing, auto-completes the cycle if all sessions are done.
func (h *SessionHandler) HandleCompleteSession(w http.ResponseWriter, r *http.Request) {
	cycleUUID := chi.URLParam(r, "cycleID")
	sessionUUID := chi.URLParam(r, "sessionID")

	var req dto.CompleteSessionRequest
	// Allow empty body — ignore decode error.
	_ = decode(r, &req)

	var sess *domain.Session
	err := h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		var err error
		sess, err = h.store.CompleteSession(r.Context(), tx, sessionUUID, req.Notes)
		if err != nil {
			return err
		}
		count, err := h.store.CountIncompleteSessionsInCycle(r.Context(), tx, sess.CycleID)
		if err != nil {
			return err
		}
		if count == 0 {
			return h.store.AutoCompleteCycleByID(r.Context(), tx, sess.CycleID)
		}
		return nil
	})
	if err != nil {
		respondError(w, err)
		return
	}

	_ = cycleUUID // used implicitly via the cycle update
	respond(w, http.StatusOK, dto.ToSessionResponse(sess))
}

// HandleSkipSession handles PUT /api/v1/cycles/{cycleID}/sessions/{sessionID}/skip.
// Optionally accepts { "notes": "..." } in the body.
// After skipping, auto-completes the cycle if all sessions are done.
func (h *SessionHandler) HandleSkipSession(w http.ResponseWriter, r *http.Request) {
	cycleUUID := chi.URLParam(r, "cycleID")
	sessionUUID := chi.URLParam(r, "sessionID")

	var req dto.SkipSessionRequest
	_ = decode(r, &req)

	var sess *domain.Session
	err := h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		var err error
		sess, err = h.store.SkipSession(r.Context(), tx, sessionUUID, req.Notes)
		if err != nil {
			return err
		}
		count, err := h.store.CountIncompleteSessionsInCycle(r.Context(), tx, sess.CycleID)
		if err != nil {
			return err
		}
		if count == 0 {
			return h.store.AutoCompleteCycleByID(r.Context(), tx, sess.CycleID)
		}
		return nil
	})
	if err != nil {
		respondError(w, err)
		return
	}

	_ = cycleUUID
	respond(w, http.StatusOK, dto.ToSessionResponse(sess))
}

// HandleDeleteSetsForExercise handles DELETE /api/v1/sessions/{sid}/sets?exercise_uuid={uuid}.
// Deletes all set_logs for a given exercise in a session. Session must be in_progress.
func (h *SessionHandler) HandleDeleteSetsForExercise(w http.ResponseWriter, r *http.Request) {
	sessionUUID := chi.URLParam(r, "sid")
	exerciseUUID := r.URL.Query().Get("exercise_uuid")
	if exerciseUUID == "" {
		respondError(w, domain.NewValidationError("exercise_uuid", "is required"))
		return
	}
	if err := h.store.DeleteSetLogsForExercise(r.Context(), h.store.DB, sessionUUID, exerciseUUID); err != nil {
		respondError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// HandleLogSet handles POST /api/v1/cycles/{cycleID}/sessions/{sessionID}/sets.
// Logs a performed set. The set can be tied to a planned section_exercise
// (with optional exercise substitution) or be an ad-hoc set.
func (h *SessionHandler) HandleLogSet(w http.ResponseWriter, r *http.Request) {
	sessionUUID := chi.URLParam(r, "sessionID")

	var req dto.LogSetRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	// Verify session is in progress.
	sess, err := h.store.GetSessionByUUID(r.Context(), h.store.DB, sessionUUID)
	if err != nil {
		respondError(w, err)
		return
	}
	if sess.Status != domain.SessionInProgress {
		respondError(w, domain.NewUnprocessableError("session is not in progress"))
		return
	}

	log := &domain.SetLog{
		SessionID:  sess.ID,
		SetNumber:  req.SetNumber,
		TargetReps: req.TargetReps,
		ActualReps: req.ActualReps,
		Weight:     req.Weight,
		Duration:   req.Duration,
		Distance:   req.Distance,
		RPE:        req.RPE,
	}

	// Resolve IDs and determine the exercise UUID for the response.
	var exerciseUUID string

	if req.SectionExerciseUUID != nil {
		seID, seExerciseID, seExerciseUUID, err := h.store.ResolveSectionExercise(r.Context(), h.store.DB, *req.SectionExerciseUUID)
		if err != nil {
			respondError(w, err)
			return
		}
		log.SectionExerciseID = &seID

		if req.ExerciseUUID != nil {
			// Substitution: use the specified exercise instead of the planned one.
			ex, err := h.store.GetExerciseByUUID(r.Context(), h.store.DB, *req.ExerciseUUID)
			if err != nil {
				respondError(w, err)
				return
			}
			log.ExerciseID = ex.ID
			exerciseUUID = ex.UUID
		} else {
			// Regular: use the exercise from the section_exercise.
			log.ExerciseID = seExerciseID
			exerciseUUID = seExerciseUUID
		}
	} else {
		// Ad-hoc: exercise_uuid is required (validated by DTO).
		ex, err := h.store.GetExerciseByUUID(r.Context(), h.store.DB, *req.ExerciseUUID)
		if err != nil {
			respondError(w, err)
			return
		}
		log.ExerciseID = ex.ID
		exerciseUUID = ex.UUID
	}

	if err := h.store.LogSet(r.Context(), h.store.DB, log); err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusCreated, map[string]any{
		"uuid":         log.UUID,
		"exercise_uuid": exerciseUUID,
	})
}
