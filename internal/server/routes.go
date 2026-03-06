package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"compound/internal/handler"
	"compound/internal/handler/middleware"
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
		r.Use(middleware.Idempotency(s.store))

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

		// Program routes
		ph := handler.NewProgramHandler(s.store)
		r.Route("/programs", func(r chi.Router) {
			r.Get("/", ph.HandleListPrograms)
			r.Post("/", ph.HandleCreateProgram)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", ph.HandleGetProgram)
				r.Put("/", ph.HandleUpdateProgram)
				r.Delete("/", ph.HandleDeleteProgram)
				r.Post("/copy", ph.HandleCopyProgram)

				r.Route("/workouts", func(r chi.Router) {
					r.Post("/", ph.HandleAddWorkout)
					r.Put("/reorder", ph.HandleReorderWorkouts)
					r.Route("/{wid}", func(r chi.Router) {
						r.Put("/", ph.HandleUpdateWorkout)
						r.Delete("/", ph.HandleDeleteWorkout)

						r.Route("/sections", func(r chi.Router) {
							r.Post("/", ph.HandleAddSection)
							r.Put("/reorder", ph.HandleReorderSections)
							r.Route("/{sid}", func(r chi.Router) {
								r.Put("/", ph.HandleUpdateSection)
								r.Delete("/", ph.HandleDeleteSection)

								r.Route("/exercises", func(r chi.Router) {
									r.Post("/", ph.HandleAddSectionExercise)
									r.Put("/reorder", ph.HandleReorderSectionExercises)
									r.Route("/{eid}", func(r chi.Router) {
										r.Put("/", ph.HandleUpdateSectionExercise)
										r.Delete("/", ph.HandleDeleteSectionExercise)
									})
								})
							})
						})
					})
				})
			})
		})

		// Cycle routes (Step 4)
		// Session routes (Step 4)
		// Progress routes (Step 5)
	})
}
