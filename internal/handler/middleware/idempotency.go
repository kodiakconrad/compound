package middleware

import (
	"bytes"
	"net/http"

	"compound/internal/store"
)

// responseRecorder captures the status code and body written by downstream
// handlers so the idempotency middleware can store them.
type responseRecorder struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (r *responseRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

// Idempotency returns chi middleware that handles Idempotency-Key headers on
// POST requests. If the key was seen before, the stored response is replayed.
// Otherwise the request proceeds normally and the response is captured and saved.
func Idempotency(s *store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("Idempotency-Key")
			if key == "" {
				next.ServeHTTP(w, r)
				return
			}

			// Check for a stored response.
			result, err := s.CheckIdempotencyKey(r.Context(), s.DB, key, r.Method, r.URL.Path)
			if err != nil {
				// CheckIdempotencyKey returns UnprocessableError for mismatched method+path.
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnprocessableEntity)
				w.Write([]byte(`{"error":{"code":"unprocessable","message":"` + err.Error() + `"}}`))
				return
			}
			if result != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(result.Status)
				w.Write(result.Response)
				return
			}

			// Wrap the ResponseWriter to capture status + body.
			rec := &responseRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)

			// Only save successful responses (2xx).
			if rec.status >= 200 && rec.status < 300 {
				_ = s.SaveIdempotencyKey(r.Context(), s.DB, key, r.Method, r.URL.Path, rec.status, rec.body.Bytes())
			}
		})
	}
}
