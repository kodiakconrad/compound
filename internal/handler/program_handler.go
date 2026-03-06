package handler

import (
	"database/sql"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"compound/internal/domain"
	"compound/internal/handler/dto"
	"compound/internal/store"
)

// ProgramHandler handles program, workout, section, and section exercise HTTP endpoints.
type ProgramHandler struct {
	store *store.Store
}

// NewProgramHandler creates a new ProgramHandler.
func NewProgramHandler(s *store.Store) *ProgramHandler {
	return &ProgramHandler{store: s}
}

// --- Helpers ---

// checkActiveCycle returns true if the handler should continue (no active cycle).
// If an active cycle exists, it writes a 422 response and returns false.
func (h *ProgramHandler) checkActiveCycle(w http.ResponseWriter, r *http.Request, programID int64) bool {
	active, err := h.store.HasActiveCycle(r.Context(), h.store.DB, programID)
	if err != nil {
		respondError(w, err)
		return false
	}
	if active {
		respondError(w, domain.NewUnprocessableError("cannot modify a program with an active cycle"))
		return false
	}
	return true
}

// ===================================================================
// Program CRUD
// ===================================================================

// HandleCreateProgram handles POST /api/v1/programs.
func (h *ProgramHandler) HandleCreateProgram(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateProgramRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	p := req.ToProgram()
	if err := p.Validate(); err != nil {
		respondError(w, err)
		return
	}

	if err := h.store.CreateProgram(r.Context(), h.store.DB, p); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("program created", "uuid", p.UUID, "name", p.Name)
	respond(w, http.StatusCreated, dto.ToProgramResponse(p))
}

// HandleGetProgram handles GET /api/v1/programs/{id}.
func (h *ProgramHandler) HandleGetProgram(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	p, err := h.store.GetProgramWithTree(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToProgramTreeResponse(p))
}

// HandleListPrograms handles GET /api/v1/programs.
func (h *ProgramHandler) HandleListPrograms(w http.ResponseWriter, r *http.Request) {
	pp := ParsePaginationParams(r)

	params := store.ProgramListParams{
		Limit:  pp.Limit,
		Cursor: pp.Cursor,
		Sort:   r.URL.Query().Get("sort"),
		Order:  r.URL.Query().Get("order"),
	}
	if it := r.URL.Query().Get("is_template"); it != "" {
		val := strings.EqualFold(it, "true")
		params.IsTemplate = &val
	}

	programs, hasMore, err := h.store.ListPrograms(r.Context(), h.store.DB, params)
	if err != nil {
		respondError(w, err)
		return
	}

	var lastID int64
	if len(programs) > 0 {
		lastID = programs[len(programs)-1].ID
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"data":       dto.ToProgramListResponse(programs),
		"pagination": BuildCursorResponse(lastID, hasMore),
	})
}

// HandleUpdateProgram handles PUT /api/v1/programs/{id}.
func (h *ProgramHandler) HandleUpdateProgram(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	existing, err := h.store.GetProgramByUUID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}

	if existing.IsPrebuilt {
		respondError(w, domain.NewUnprocessableError("prebuilt programs cannot be modified"))
		return
	}

	programID, err := h.store.GetProgramInternalID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}
	if !h.checkActiveCycle(w, r, programID) {
		return
	}

	var req dto.UpdateProgramRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	req.ApplyTo(existing)
	if err := existing.Validate(); err != nil {
		respondError(w, err)
		return
	}

	if err := h.store.UpdateProgram(r.Context(), h.store.DB, id, existing); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("program updated", "uuid", id, "name", existing.Name)
	respond(w, http.StatusOK, dto.ToProgramResponse(existing))
}

// HandleDeleteProgram handles DELETE /api/v1/programs/{id}.
func (h *ProgramHandler) HandleDeleteProgram(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	existing, err := h.store.GetProgramByUUID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}

	if existing.IsPrebuilt {
		respondError(w, domain.NewUnprocessableError("prebuilt programs cannot be deleted"))
		return
	}

	if err := h.store.DeleteProgram(r.Context(), h.store.DB, id); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("program deleted", "uuid", id)
	w.WriteHeader(http.StatusNoContent)
}

// HandleCopyProgram handles POST /api/v1/programs/{id}/copy.
func (h *ProgramHandler) HandleCopyProgram(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var cp *domain.Program
	err := h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		var txErr error
		cp, txErr = h.store.CopyProgram(r.Context(), tx, id)
		return txErr
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("program copied", "source_uuid", id, "new_uuid", cp.UUID)
	respond(w, http.StatusCreated, dto.ToProgramTreeResponse(cp))
}

// ===================================================================
// Workouts
// ===================================================================

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

// ===================================================================
// Sections
// ===================================================================

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

// ===================================================================
// Section Exercises
// ===================================================================

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
		TargetDistance:  req.TargetDistance,
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
