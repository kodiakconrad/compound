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
	if ip := r.URL.Query().Get("is_prebuilt"); ip != "" {
		val := strings.EqualFold(ip, "true")
		params.IsPrebuilt = &val
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

// HandleScaffoldProgram handles POST /api/v1/programs/scaffold.
// Creates a program with pre-defined workouts and sections in a single request.
func (h *ProgramHandler) HandleScaffoldProgram(w http.ResponseWriter, r *http.Request) {
	var req dto.ScaffoldProgramRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	p := req.ToProgram()

	var result *domain.Program
	err := h.store.WithTx(r.Context(), func(tx *sql.Tx) error {
		var txErr error
		result, txErr = h.store.ScaffoldProgram(r.Context(), tx, p)
		return txErr
	})
	if err != nil {
		respondError(w, err)
		return
	}

	slog.Info("program scaffolded", "uuid", result.UUID, "workouts", len(result.Workouts))
	respond(w, http.StatusCreated, dto.ToProgramTreeResponse(result))
}
