package dto

// FieldError represents a single field validation error in the API response.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Validator is implemented by request DTOs that support field-level validation.
type Validator interface {
	Validate() []FieldError
}
