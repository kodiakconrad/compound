package handler

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/domain"
	"compound/internal/handler/dto"
)

// HandleAddSectionExercise handles POST .../sections/{sid}/exercises.
func (h *ProgramHandler) HandleAddSectionExercise(w http.ResponseWriter, r *http.Request) {
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

	var req dto.CreateSectionExerciseRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	// Resolve exercise UUID to internal ID.
	exercise, err := h.store.GetExerciseByUUID(r.Context(), h.store.DB, req.ExerciseUUID)
	if err != nil {
		respondError(w, err)
		return
	}

	se := &domain.SectionExercise{
		SectionID:      sectionID,
		ExerciseID:     exercise.ID,
		TargetSets:     req.TargetSets,
		TargetReps:     req.TargetReps,
		TargetWeight:   req.TargetWeight,
		TargetDuration: req.TargetDuration,
		TargetDistance: req.TargetDistance,
		Notes:          req.Notes,
	}

	if err := se.Validate(); err != nil {
		respondError(w, err)
		return
	}

	if err := h.store.CreateSectionExercise(r.Context(), h.store.DB, se); err != nil {
		respondError(w, err)
		return
	}

	// Populate denormalized fields for the response.
	se.ExerciseUUID = exercise.UUID
	se.ExerciseName = exercise.Name

	slog.Info("section exercise created", "uuid", se.UUID, "section_uuid", sid)
	respond(w, http.StatusCreated, dto.ToSectionExerciseResponse(se))
}

// HandleUpdateSectionExercise handles PUT .../sections/{sid}/exercises/{eid}.
func (h *ProgramHandler) HandleUpdateSectionExercise(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	wid := chi.URLParam(r, "wid")
	sid := chi.URLParam(r, "sid")
	eid := chi.URLParam(r, "eid")

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

	existing, err := h.store.GetSectionExerciseByUUID(r.Context(), h.store.DB, eid)
	if err != nil {
		respondError(w, err)
		return
	}
	if err := h.store.VerifySectionExerciseBelongsToSection(r.Context(), h.store.DB, existing.ID, sectionID); err != nil {
		respondError(w, err)
		return
	}

	var req dto.UpdateSectionExerciseRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	req.ApplyTo(existing)
	if err := existing.Validate(); err != nil {
		respondError(w, err)
		return
	}

	if err := h.store.UpdateSectionExercise(r.Context(), h.store.DB, eid, existing); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("section exercise updated", "uuid", eid)
	respond(w, http.StatusOK, dto.ToSectionExerciseResponse(existing))
}

// HandleDeleteSectionExercise handles DELETE .../sections/{sid}/exercises/{eid}.
func (h *ProgramHandler) HandleDeleteSectionExercise(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	wid := chi.URLParam(r, "wid")
	sid := chi.URLParam(r, "sid")
	eid := chi.URLParam(r, "eid")

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

	existing, err := h.store.GetSectionExerciseByUUID(r.Context(), h.store.DB, eid)
	if err != nil {
		respondError(w, err)
		return
	}
	if err := h.store.VerifySectionExerciseBelongsToSection(r.Context(), h.store.DB, existing.ID, sectionID); err != nil {
		respondError(w, err)
		return
	}

	err = h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		return h.store.DeleteSectionExercise(r.Context(), tx, eid)
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("section exercise deleted", "uuid", eid)
	w.WriteHeader(http.StatusNoContent)
}

// HandleReorderSectionExercises handles PUT .../sections/{sid}/exercises/reorder.
func (h *ProgramHandler) HandleReorderSectionExercises(w http.ResponseWriter, r *http.Request) {
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

	var req dto.ReorderRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	err = h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		return h.store.ReorderSectionExercises(r.Context(), tx, sectionID, req.UUIDs)
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("section exercises reordered", "section_uuid", sid)
	respond(w, http.StatusOK, nil)
}
