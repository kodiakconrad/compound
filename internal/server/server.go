package server

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"compound/internal/config"
)

// Server holds the HTTP router and dependencies.
type Server struct {
	router *chi.Mux
	cfg    *config.ServerConfig
}

// NewServer creates a Server with middleware and routes configured.
func NewServer(cfg *config.ServerConfig) *Server {
	srv := &Server{
		router: chi.NewRouter(),
		cfg:    cfg,
	}

	// Middleware stack
	srv.router.Use(middleware.Recoverer)
	srv.router.Use(requestLogger)
	srv.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	srv.registerRoutes()

	return srv
}

// Router returns the underlying chi.Mux. Useful for httptest in tests.
func (s *Server) Router() http.Handler {
	return s.router
}

// Start begins listening on the configured host:port.
func (s *Server) Start() error {
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	slog.Info("server starting", "addr", addr)
	return http.ListenAndServe(addr, s.router)
}

// TestServerConfig returns a ServerConfig suitable for tests.
func TestServerConfig() config.ServerConfig {
	return config.ServerConfig{
		Port:           0,
		Host:           "localhost",
		AllowedOrigins: []string{"*"},
	}
}

// requestLogger is a lightweight slog-based request logger.
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"duration", time.Since(start).String(),
		)
	})
}
