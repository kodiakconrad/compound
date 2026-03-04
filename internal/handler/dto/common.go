package dto

// FieldError represents a single field validation error in the API response.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}
