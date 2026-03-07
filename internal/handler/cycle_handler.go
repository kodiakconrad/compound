package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/domain"
	"compound/internal/handler/dto"
	"compound/internal/store"
)

// CycleHandler handles cycle HTTP endpoints.
type CycleHandler struct {
	store *store.Store
}

// NewCycleHandler creates a new CycleHandler.
func NewCycleHandler(s *store.Store) *CycleHandler {
	return &CycleHandler{store: s}
}

// HandleStartCycle handles POST /api/v1/programs/{id}/start.
// Creates a new cycle and pre-generates one session per workout.
func (h *CycleHandler) HandleStartCycle(w http.ResponseWriter, r *http.Request) {
	programUUID := chi.URLParam(r, "id")

	p, err := h.store.GetProgramWithTree(r.Context(), h.store.DB, programUUID)
	if err != nil {
		respondError(w, err)
		return
	}

	cycle, err := h.store.CreateCycle(r.Context(), h.store.DB, p.ID, p.Workouts)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusCreated, dto.ToCycleWithSessionsResponse(cycle))
}

// HandleGetCycle handles GET /api/v1/cycles/{cycleID}.
func (h *CycleHandler) HandleGetCycle(w http.ResponseWriter, r *http.Request) {
	cycleUUID := chi.URLParam(r, "cycleID")

	c, err := h.store.GetCycleWithSessions(r.Context(), h.store.DB, cycleUUID)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToCycleWithSessionsResponse(c))
}

// HandleListCycles handles GET /api/v1/cycles.
// Optional query param: ?status=active|paused|completed
func (h *CycleHandler) HandleListCycles(w http.ResponseWriter, r *http.Request) {
	pp := ParsePaginationParams(r)

	params := store.CycleListParams{
		Limit:  pp.Limit,
		Cursor: pp.Cursor,
	}

	if statusStr := r.URL.Query().Get("status"); statusStr != "" {
		s := domain.CycleStatus(statusStr)
		params.Status = &s
	}

	cycles, hasMore, err := h.store.ListCycles(r.Context(), h.store.DB, params)
	if err != nil {
		respondError(w, err)
		return
	}

	resp := make([]dto.CycleResponse, len(cycles))
	for i, c := range cycles {
		resp[i] = dto.ToCycleResponse(c)
	}

	var lastID int64
	if len(cycles) > 0 {
		lastID = cycles[len(cycles)-1].ID
	}

	respond(w, http.StatusOK, map[string]any{
		"cycles": resp,
		"page":   BuildCursorResponse(lastID, hasMore),
	})
}

// HandleUpdateCycle handles PUT /api/v1/cycles/{cycleID}.
// Body: { "status": "paused" | "active" | "completed" }
func (h *CycleHandler) HandleUpdateCycle(w http.ResponseWriter, r *http.Request) {
	cycleUUID := chi.URLParam(r, "cycleID")

	var req dto.UpdateCycleRequest
	if !decodeAndValidate(w, r, &req) {
		return
	}

	c, err := h.store.UpdateCycleStatus(r.Context(), h.store.DB, cycleUUID, domain.CycleStatus(req.Status))
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToCycleResponse(c))
}
