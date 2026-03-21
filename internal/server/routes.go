package server

import "net/http"

func (s *Server) registerRoutes() {
	// Health check — outside /api/v1, no auth, not versioned.
	s.router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})
}
