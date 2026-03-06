package handler

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/handler/dto"
)

// HandleAddSection handles POST /api/v1/programs/{id}/workouts/{wid}/sections.
func (h *ProgramHandler) HandleAddSection(w http.ResponseWriter, r *http.Request) {
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

	var req dto.CreateSectionRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	sec := req.ToSection()
	if err := sec.Validate(); err != nil {
		respondError(w, err)
		return
	}

	sec.ProgramWorkoutID = workoutID

	if err := h.store.CreateSection(r.Context(), h.store.DB, sec); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("section created", "uuid", sec.UUID, "workout_uuid", wid)
	respond(w, http.StatusCreated, dto.ToSectionResponse(sec))
}

// HandleUpdateSection handles PUT /api/v1/programs/{id}/workouts/{wid}/sections/{sid}.
func (h *ProgramHandler) HandleUpdateSection(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	wid := chi.URLParam(r, "wid")
	sid := chi.URLParam(r, "sid")

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

	existing, err := h.store.GetSectionByUUID(r.Context(), h.store.DB, sid)
	if err != nil {
		respondError(w, err)
		return
	}
	if err := h.store.VerifySectionBelongsToWorkout(r.Context(), h.store.DB, existing.ID, workoutID); err != nil {
		respondError(w, err)
		return
	}

	var req dto.UpdateSectionRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	req.ApplyTo(existing)
	if err := existing.Validate(); err != nil {
		respondError(w, err)
		return
	}

	if err := h.store.UpdateSection(r.Context(), h.store.DB, sid, existing); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("section updated", "uuid", sid)
	respond(w, http.StatusOK, dto.ToSectionResponse(existing))
}

// HandleDeleteSection handles DELETE /api/v1/programs/{id}/workouts/{wid}/sections/{sid}.
func (h *ProgramHandler) HandleDeleteSection(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	wid := chi.URLParam(r, "wid")
	sid := chi.URLParam(r, "sid")

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

	sectionID, err := h.store.GetSectionInternalID(r.Context(), h.store.DB, sid)
	if err != nil {
		respondError(w, err)
		return
	}
	if err := h.store.VerifySectionBelongsToWorkout(r.Context(), h.store.DB, sectionID, workoutID); err != nil {
		respondError(w, err)
		return
	}

	err = h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		return h.store.DeleteSection(r.Context(), tx, sid)
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("section deleted", "uuid", sid)
	w.WriteHeader(http.StatusNoContent)
}

// HandleReorderSections handles PUT /api/v1/programs/{id}/workouts/{wid}/sections/reorder.
func (h *ProgramHandler) HandleReorderSections(w http.ResponseWriter, r *http.Request) {
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

	var req dto.ReorderRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	err = h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		return h.store.ReorderSections(r.Context(), tx, workoutID, req.UUIDs)
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("sections reordered", "workout_uuid", wid)
	respond(w, http.StatusOK, nil)
}
