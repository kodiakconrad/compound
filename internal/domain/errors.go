package domain

import "fmt"

// NotFoundError indicates that a requested entity does not exist.
type NotFoundError struct {
	Entity string // "exercise", "program", etc.
	ID     string // UUID
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("%s with id %s not found", e.Entity, e.ID)
}

// NewNotFoundError creates a NotFoundError for the given entity type and UUID.
func NewNotFoundError(entity string, id string) *NotFoundError {
	return &NotFoundError{Entity: entity, ID: id}
}

// ValidationError indicates that a field failed validation.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Message)
}

// NewValidationError creates a ValidationError for a specific field.
func NewValidationError(field string, message string) *ValidationError {
	return &ValidationError{Field: field, Message: message}
}

// ConflictError indicates a state or uniqueness conflict.
type ConflictError struct {
	Message string
}

func (e *ConflictError) Error() string {
	return e.Message
}

// NewConflictError creates a ConflictError with the given message.
func NewConflictError(message string) *ConflictError {
	return &ConflictError{Message: message}
}

// UnprocessableError indicates a semantically invalid operation (e.g., editing
// a prebuilt exercise, starting a completed cycle). Mapped to HTTP 422.
type UnprocessableError struct {
	Message string
}

func (e *UnprocessableError) Error() string {
	return e.Message
}

// NewUnprocessableError creates an UnprocessableError with the given message.
func NewUnprocessableError(message string) *UnprocessableError {
	return &UnprocessableError{Message: message}
}
