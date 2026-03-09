package handler

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"compound/internal/domain"
	"compound/internal/handler/dto"
)

// --- Response helpers ---

// respond wraps data in the {"data": ...} envelope and writes JSON.
func respond(w http.ResponseWriter, status int, data any) {
	respondJSON(w, status, map[string]any{"data": data})
}

// respondError maps a domain error to the appropriate HTTP status and writes
// the error envelope. Unknown errors are logged and returned as 500.
func respondError(w http.ResponseWriter, err error) {
	var notFound *domain.NotFoundError
	var noActiveSession *domain.NoActiveSessionError
	var validation *domain.ValidationError
	var conflict *domain.ConflictError
	var unprocessable *domain.UnprocessableError

	switch {
	case errors.As(err, &noActiveSession):
		respondJSON(w, http.StatusNotFound, errorResponse("no_active_session", err.Error(), nil))
	case errors.As(err, &notFound):
		respondJSON(w, http.StatusNotFound, errorResponse("not_found", err.Error(), nil))
	case errors.As(err, &validation):
		respondJSON(w, http.StatusBadRequest, errorResponse("validation_failed", "Request validation failed", []dto.FieldError{
			{Field: validation.Field, Message: validation.Message},
		}))
	case errors.As(err, &conflict):
		respondJSON(w, http.StatusConflict, errorResponse("conflict", err.Error(), nil))
	case errors.As(err, &unprocessable):
		respondJSON(w, http.StatusUnprocessableEntity, errorResponse("unprocessable", err.Error(), nil))
	default:
		slog.Error("internal error", "error", err)
		respondJSON(w, http.StatusInternalServerError, errorResponse("internal_error", "internal server error", nil))
	}
}

// respondJSON is the low-level JSON writer.
func respondJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("failed to write response", "error", err)
	}
}

// RespondValidationErrors writes a 400 response with multiple field errors.
func RespondValidationErrors(w http.ResponseWriter, errs []dto.FieldError) {
	respondJSON(w, http.StatusBadRequest, errorResponse("validation_failed", "Request validation failed", errs))
}

// --- Request helpers ---

// decode reads and unmarshals the JSON request body into v.
func decode(r *http.Request, v any) error {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return err
	}
	return nil
}

// decodeAndValidate decodes the JSON body into req and runs DTO validation.
// Returns true if the request is valid and the handler should continue.
// On failure, writes the appropriate error response and returns false.
func decodeAndValidate[T dto.Validator](w http.ResponseWriter, r *http.Request, req T) bool {
	if err := decode(r, req); err != nil {
		respondJSON(w, http.StatusBadRequest, errorResponse("bad_request", "invalid JSON body", nil))
		return false
	}
	if errs := req.Validate(); len(errs) > 0 {
		RespondValidationErrors(w, errs)
		return false
	}
	return true
}

// --- Error response types ---

type errorBody struct {
	Code    string           `json:"code"`
	Message string           `json:"message"`
	Details []dto.FieldError `json:"details,omitempty"`
}

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

func errorResponse(code string, message string, details []dto.FieldError) errorEnvelope {
	return errorEnvelope{
		Error: errorBody{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}

// --- Pagination helpers ---

const (
	DefaultPageLimit = 20
	MaxPageLimit     = 100
)

// PaginationParams holds the parsed limit and cursor from a request.
type PaginationParams struct {
	Limit  int
	Cursor *int64 // nil means first page
}

// ParsePaginationParams extracts limit and cursor from query parameters.
func ParsePaginationParams(r *http.Request) PaginationParams {
	p := PaginationParams{Limit: DefaultPageLimit}

	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			p.Limit = parsed
		}
	}
	if p.Limit > MaxPageLimit {
		p.Limit = MaxPageLimit
	}

	if c := r.URL.Query().Get("cursor"); c != "" {
		if decoded, err := base64.StdEncoding.DecodeString(c); err == nil {
			if id, err := strconv.ParseInt(string(decoded), 10, 64); err == nil {
				p.Cursor = &id
			}
		}
	}

	return p
}

// CursorResponse is the pagination metadata included in list responses.
type CursorResponse struct {
	NextCursor string `json:"next_cursor,omitempty"`
	HasMore    bool   `json:"has_more"`
}

// BuildCursorResponse creates a CursorResponse. If there are more items than
// the limit, hasMore is true and the cursor encodes lastID.
func BuildCursorResponse(lastID int64, hasMore bool) CursorResponse {
	cr := CursorResponse{HasMore: hasMore}
	if hasMore {
		cr.NextCursor = base64.StdEncoding.EncodeToString([]byte(strconv.FormatInt(lastID, 10)))
	}
	return cr
}
