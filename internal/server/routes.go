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

		// Exercise routes (and per-exercise progress sub-routes from Step 5)
		eh := handler.NewExerciseHandler(s.store)
		prh := handler.NewProgressHandler(s.store)
		r.Route("/exercises", func(r chi.Router) {
			r.Get("/", eh.HandleList)
			r.Get("/filters", eh.HandleGetFilters)
			r.Post("/", eh.HandleCreate)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", eh.HandleGet)
				r.Put("/", eh.HandleUpdate)
				r.Delete("/", eh.HandleDelete)
				// Progress sub-routes (Step 5)
				r.Get("/history", prh.HandleGetHistory)
				r.Get("/record", prh.HandleGetRecord)
			})
		})

		// Program routes
		ph := handler.NewProgramHandler(s.store)
		r.Route("/programs", func(r chi.Router) {
			r.Get("/", ph.HandleListPrograms)
			r.Post("/", ph.HandleCreateProgram)
			r.Post("/scaffold", ph.HandleScaffoldProgram)
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
		ch := handler.NewCycleHandler(s.store)
		sh := handler.NewSessionHandler(s.store)

		r.Post("/programs/{id}/start", ch.HandleStartCycle)

		r.Route("/cycles", func(r chi.Router) {
			r.Get("/", ch.HandleListCycles)
			r.Route("/{cycleID}", func(r chi.Router) {
				r.Get("/", ch.HandleGetCycle)
				r.Put("/", ch.HandleUpdateCycle)

				// Session routes (Step 4)
				r.Route("/sessions/{sessionID}", func(r chi.Router) {
					r.Get("/", sh.HandleGetSession)
					r.Post("/start", sh.HandleStartSession)
					r.Post("/sets", sh.HandleLogSet)
					r.Delete("/sets/{setLogID}", sh.HandleDeleteSetLog)
					r.Put("/complete", sh.HandleCompleteSession)
					r.Put("/skip", sh.HandleSkipSession)
				})
			})
		})

		// Session-scoped flat routes.
		r.Get("/sessions/active", sh.HandleGetActiveSession)
		r.Delete("/sessions/{sid}/sets", sh.HandleDeleteSetsForExercise)

		// Progress routes (Step 5 + Step 6)
		r.Get("/progress/summary", prh.HandleGetSummary)
		r.Get("/progress/records", prh.HandleGetRecords)
		r.Get("/progress/recent", prh.HandleGetRecentSessions)
		r.Get("/progress/exercise/{id}", prh.HandleGetExerciseChart)
	})
}
