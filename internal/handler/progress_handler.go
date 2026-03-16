package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/handler/dto"
	"compound/internal/store"
)

// ProgressHandler handles progress HTTP endpoints.
type ProgressHandler struct {
	store *store.Store
}

// NewProgressHandler creates a new ProgressHandler.
func NewProgressHandler(s *store.Store) *ProgressHandler {
	return &ProgressHandler{store: s}
}

// HandleGetHistory handles GET /api/v1/exercises/{id}/history.
// Returns the best (heaviest) eligible set per completed session, newest first.
func (h *ProgressHandler) HandleGetHistory(w http.ResponseWriter, r *http.Request) {
	exerciseUUID := chi.URLParam(r, "id")
	pp := ParsePaginationParams(r)

	params := store.HistoryParams{
		Limit:  pp.Limit,
		Cursor: pp.Cursor,
	}

	entries, hasMore, err := h.store.GetExerciseHistory(r.Context(), h.store.DB, exerciseUUID, params)
	if err != nil {
		respondError(w, err)
		return
	}

	var lastID int64
	if len(entries) > 0 {
		lastID = entries[len(entries)-1].SessionID
	}

	respond(w, http.StatusOK, map[string]any{
		"history": dto.ToHistoryEntryList(entries),
		"page":    BuildCursorResponse(lastID, hasMore),
	})
}

// HandleGetRecord handles GET /api/v1/exercises/{id}/record.
// Returns the heaviest eligible set ever logged, or 404 if none exists.
func (h *ProgressHandler) HandleGetRecord(w http.ResponseWriter, r *http.Request) {
	exerciseUUID := chi.URLParam(r, "id")

	pr, err := h.store.GetPersonalRecord(r.Context(), h.store.DB, exerciseUUID)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToPersonalRecordResponse(pr))
}

// HandleGetSummary handles GET /api/v1/progress/summary.
// Returns total completed sessions, weeks trained, and current consecutive session streak.
func (h *ProgressHandler) HandleGetSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.store.GetProgressSummary(r.Context(), h.store.DB)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToProgressSummaryResponse(summary))
}

// HandleGetRecentSessions handles GET /api/v1/progress/recent.
// Returns the last 5 completed or skipped sessions with workout and program names.
func (h *ProgressHandler) HandleGetRecentSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := h.store.GetRecentSessions(r.Context(), h.store.DB, 5)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToRecentSessionListResponse(sessions))
}

// HandleGetRecords handles GET /api/v1/progress/records.
// Returns the heaviest eligible set for every exercise that has logged sets.
func (h *ProgressHandler) HandleGetRecords(w http.ResponseWriter, r *http.Request) {
	records, err := h.store.GetAllPersonalRecords(r.Context(), h.store.DB)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToPersonalRecordListResponse(records))
}

// HandleGetExerciseChart handles GET /api/v1/progress/exercise/{id}.
// Returns chart-ready data points (date, weight, reps, volume) for an exercise.
func (h *ProgressHandler) HandleGetExerciseChart(w http.ResponseWriter, r *http.Request) {
	exerciseUUID := chi.URLParam(r, "id")

	points, err := h.store.GetExerciseChartData(r.Context(), h.store.DB, exerciseUUID)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, dto.ToExerciseChartResponse(points))
}
