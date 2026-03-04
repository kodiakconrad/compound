package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/handler"
)

func (s *Server) registerRoutes() {
	// Health check — outside /api/v1, no auth, not versioned.
	s.router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API v1
	s.router.Route("/api/v1", func(r chi.Router) {
		// Exercise routes
		eh := handler.NewExerciseHandler(s.store)
		r.Route("/exercises", func(r chi.Router) {
			r.Get("/", eh.HandleList)
			r.Post("/", eh.HandleCreate)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", eh.HandleGet)
				r.Put("/", eh.HandleUpdate)
				r.Delete("/", eh.HandleDelete)
			})
		})

		// Program routes (Step 3)
		// Cycle routes (Step 4)
		// Session routes (Step 4)
		// Progress routes (Step 5)
	})
}
