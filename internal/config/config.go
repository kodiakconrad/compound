package config

import (
	"os"
	"strconv"

	"gopkg.in/yaml.v3"
)

// Config holds all application configuration.
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Log      LogConfig      `yaml:"log"`
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Port           int      `yaml:"port"`
	Host           string   `yaml:"host"`
	AllowedOrigins []string `yaml:"allowed_origins"`
}

// DatabaseConfig holds SQLite database settings.
type DatabaseConfig struct {
	Path string `yaml:"path"`
}

// LogConfig holds logging settings.
type LogConfig struct {
	Level string `yaml:"level"`
}

// DefaultConfig returns the default configuration.
func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port:           8080,
			Host:           "localhost",
			AllowedOrigins: []string{"*"},
		},
		Database: DatabaseConfig{
			Path: "compound.db",
		},
		Log: LogConfig{
			Level: "info",
		},
	}
}

// Load reads configuration from the given YAML file path. If the file does not
// exist, it generates one with defaults and writes it to path. Environment
// variable overrides are applied after file loading:
//   - PORT overrides server.port
//   - DATABASE_PATH overrides database.path
func Load(path string) (*Config, error) {
	cfg := DefaultConfig()

	data, err := os.ReadFile(path)
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
		// File doesn't exist — generate it with defaults.
		if err := writeDefault(path, cfg); err != nil {
			return nil, err
		}
	} else {
		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, err
		}
	}

	applyEnvOverrides(cfg)
	return cfg, nil
}

// ConfigPath returns the config file path. It checks the COMPOUND_CONFIG
// environment variable first, falling back to the provided default.
func ConfigPath(defaultPath string) string {
	if p := os.Getenv("COMPOUND_CONFIG"); p != "" {
		return p
	}
	return defaultPath
}

func applyEnvOverrides(cfg *Config) {
	if p := os.Getenv("PORT"); p != "" {
		if port, err := strconv.Atoi(p); err == nil {
			cfg.Server.Port = port
		}
	}
	if p := os.Getenv("DATABASE_PATH"); p != "" {
		cfg.Database.Path = p
	}
}

func writeDefault(path string, cfg *Config) error {
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
