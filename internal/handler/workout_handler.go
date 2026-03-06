package handler

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/domain"
	"compound/internal/handler/dto"
)

// HandleAddWorkout handles POST /api/v1/programs/{id}/workouts.
func (h *ProgramHandler) HandleAddWorkout(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	programID, err := h.store.GetProgramInternalID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}
	if !h.checkActiveCycle(w, r, programID) {
		return
	}

	var req dto.CreateWorkoutRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	workout := req.ToWorkout()
	if err := workout.Validate(); err != nil {
		respondError(w, err)
		return
	}

	workout.ProgramID = programID

	// Check day_number conflict + create inside a transaction.
	err = h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		dayNumbers, err := h.store.GetDayNumbersForProgram(r.Context(), tx, programID)
		if err != nil {
			return err
		}
		p := &domain.Program{}
		if err := p.HasDayNumber(workout.DayNumber, dayNumbers); err != nil {
			return err
		}
		return h.store.CreateWorkout(r.Context(), tx, workout)
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("workout created", "uuid", workout.UUID, "program_uuid", id)
	respond(w, http.StatusCreated, dto.ToWorkoutResponse(workout))
}

// HandleUpdateWorkout handles PUT /api/v1/programs/{id}/workouts/{wid}.
func (h *ProgramHandler) HandleUpdateWorkout(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	wid := chi.URLParam(r, "wid")

	programID, err := h.store.GetProgramInternalID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}
	if !h.checkActiveCycle(w, r, programID) {
		return
	}

	existing, err := h.store.GetWorkoutByUUID(r.Context(), h.store.DB, wid)
	if err != nil {
		respondError(w, err)
		return
	}
	if err := h.store.VerifyWorkoutBelongsToProgram(r.Context(), h.store.DB, existing.ID, programID); err != nil {
		respondError(w, err)
		return
	}

	var req dto.UpdateWorkoutRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	// Check day_number conflict only if changed.
	if req.DayNumber != nil && *req.DayNumber != existing.DayNumber {
		dayNumbers, err := h.store.GetDayNumbersForProgram(r.Context(), h.store.DB, programID)
		if err != nil {
			respondError(w, err)
			return
		}
		p := &domain.Program{}
		if err := p.HasDayNumber(*req.DayNumber, dayNumbers); err != nil {
			respondError(w, err)
			return
		}
	}

	req.ApplyTo(existing)
	if err := existing.Validate(); err != nil {
		respondError(w, err)
		return
	}

	if err := h.store.UpdateWorkout(r.Context(), h.store.DB, wid, existing); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("workout updated", "uuid", wid)
	respond(w, http.StatusOK, dto.ToWorkoutResponse(existing))
}

// HandleDeleteWorkout handles DELETE /api/v1/programs/{id}/workouts/{wid}.
func (h *ProgramHandler) HandleDeleteWorkout(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	wid := chi.URLParam(r, "wid")

	programID, err := h.store.GetProgramInternalID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}
	if !h.checkActiveCycle(w, r, programID) {
		return
	}

	workoutID, err := h.store.GetWorkoutInternalID(r.Context(), h.store.DB, wid)
	if err != nil {
		respondError(w, err)
		return
	}
	if err := h.store.VerifyWorkoutBelongsToProgram(r.Context(), h.store.DB, workoutID, programID); err != nil {
		respondError(w, err)
		return
	}

	err = h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		return h.store.DeleteWorkout(r.Context(), tx, wid)
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("workout deleted", "uuid", wid)
	w.WriteHeader(http.StatusNoContent)
}

// HandleReorderWorkouts handles PUT /api/v1/programs/{id}/workouts/reorder.
func (h *ProgramHandler) HandleReorderWorkouts(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	programID, err := h.store.GetProgramInternalID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}
	if !h.checkActiveCycle(w, r, programID) {
		return
	}

	var req dto.ReorderRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	err = h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		return h.store.ReorderWorkouts(r.Context(), tx, programID, req.UUIDs)
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("workouts reordered", "program_uuid", id)
	respond(w, http.StatusOK, nil)
}
