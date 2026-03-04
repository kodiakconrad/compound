package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/domain"
	"compound/internal/handler/dto"
	"compound/internal/store"
)

// ExerciseHandler handles exercise HTTP endpoints.
type ExerciseHandler struct {
	store *store.Store
}

// NewExerciseHandler creates a new ExerciseHandler.
func NewExerciseHandler(s *store.Store) *ExerciseHandler {
	return &ExerciseHandler{store: s}
}

// HandleCreate handles POST /api/v1/exercises.
func (h *ExerciseHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	// Check idempotency key.
	idempotencyKey := r.Header.Get("Idempotency-Key")
	if idempotencyKey != "" {
		result, err := h.store.CheckIdempotencyKey(r.Context(), h.store.DB, idempotencyKey, r.Method, r.URL.Path)
		if err != nil {
			respondError(w, err)
			return
		}
		if result != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(result.Status)
			w.Write(result.Response)
			return
		}
	}

	var req dto.CreateExerciseRequest
	if err := decode(r, &req); err != nil {
		respondJSON(w, http.StatusBadRequest, errorResponse("bad_request", "invalid JSON body", nil))
		return
	}

	// DTO-level validation (request shape, collects all errors).
	if errs := req.Validate(); len(errs) > 0 {
		RespondValidationErrors(w, errs)
		return
	}

	exercise := req.ToExercise()

	// Domain-level validation (business rules).
	if err := exercise.Validate(); err != nil {
		respondError(w, err)
		return
	}

	if err := h.store.CreateExercise(r.Context(), h.store.DB, exercise); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("exercise created", "uuid", exercise.UUID, "name", exercise.Name)

	// Build response and save idempotency key if present.
	respData := dto.ToExerciseResponse(exercise)
	status := http.StatusCreated

	if idempotencyKey != "" {
		body, _ := json.Marshal(map[string]any{"data": respData})
		_ = h.store.SaveIdempotencyKey(r.Context(), h.store.DB, idempotencyKey, r.Method, r.URL.Path, status, body)
	}

	respond(w, status, respData)
}

// HandleGet handles GET /api/v1/exercises/{id}.
func (h *ExerciseHandler) HandleGet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	exercise, err := h.store.GetExerciseByUUID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToExerciseResponse(exercise))
}

// HandleList handles GET /api/v1/exercises.
func (h *ExerciseHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	pp := ParsePaginationParams(r)

	params := store.ExerciseListParams{
		Limit: pp.Limit,
		Cursor: pp.Cursor,
		Sort:  r.URL.Query().Get("sort"),
		Order: r.URL.Query().Get("order"),
	}

	if mg := r.URL.Query().Get("muscle_group"); mg != "" {
		params.MuscleGroup = &mg
	}
	if eq := r.URL.Query().Get("equipment"); eq != "" {
		params.Equipment = &eq
	}
	if s := r.URL.Query().Get("search"); s != "" {
		params.Search = &s
	}

	exercises, hasMore, err := h.store.ListExercises(r.Context(), h.store.DB, params)
	if err != nil {
		respondError(w, err)
		return
	}

	var lastID int64
	if len(exercises) > 0 {
		lastID = exercises[len(exercises)-1].ID
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"data":       dto.ToExerciseListResponse(exercises),
		"pagination": BuildCursorResponse(lastID, hasMore),
	})
}

// HandleUpdate handles PUT /api/v1/exercises/{id}.
func (h *ExerciseHandler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Fetch existing exercise.
	existing, err := h.store.GetExerciseByUUID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}

	// Prebuilt exercises cannot be modified.
	if !existing.IsCustom {
		respondError(w, domain.NewUnprocessableError("prebuilt exercises cannot be modified"))
		return
	}

	var req dto.UpdateExerciseRequest
	if err := decode(r, &req); err != nil {
		respondJSON(w, http.StatusBadRequest, errorResponse("bad_request", "invalid JSON body", nil))
		return
	}

	// DTO-level validation.
	if errs := req.Validate(); len(errs) > 0 {
		RespondValidationErrors(w, errs)
		return
	}

	// Apply updates to existing exercise.
	req.ApplyTo(existing)

	// Domain-level validation on the merged exercise.
	if err := existing.Validate(); err != nil {
		respondError(w, err)
		return
	}

	if err := h.store.UpdateExercise(r.Context(), h.store.DB, id, existing); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("exercise updated", "uuid", id, "name", existing.Name)
	respond(w, http.StatusOK, dto.ToExerciseResponse(existing))
}

// HandleDelete handles DELETE /api/v1/exercises/{id}.
func (h *ExerciseHandler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Fetch existing exercise to check is_custom.
	existing, err := h.store.GetExerciseByUUID(r.Context(), h.store.DB, id)
	if err != nil {
		respondError(w, err)
		return
	}

	if !existing.IsCustom {
		respondError(w, domain.NewUnprocessableError("prebuilt exercises cannot be deleted"))
		return
	}

	if err := h.store.DeleteExercise(r.Context(), h.store.DB, id); err != nil {
		respondError(w, err)
		return
	}

	slog.Info("exercise deleted", "uuid", id)
	w.WriteHeader(http.StatusNoContent)
}
