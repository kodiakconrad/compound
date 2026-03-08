package dto

import (
	"time"

	"compound/internal/domain"
)

// Compile-time interface checks.
var (
	_ Validator = (*UpdateCycleRequest)(nil)
	_ Validator = (*CompleteSessionRequest)(nil)
	_ Validator = (*SkipSessionRequest)(nil)
	_ Validator = (*LogSetRequest)(nil)
)

// --- Cycle request DTOs ---

// UpdateCycleRequest is the JSON body for PUT /api/v1/cycles/{id}.
type UpdateCycleRequest struct {
	Status string `json:"status"`
}

func (r *UpdateCycleRequest) Validate() []FieldError {
	var errs []FieldError
	switch domain.CycleStatus(r.Status) {
	case domain.CycleActive, domain.CyclePaused, domain.CycleCompleted:
	default:
		errs = append(errs, FieldError{Field: "status", Message: "must be one of: active, paused, completed"})
	}
	return errs
}

// --- Session request DTOs ---

// CompleteSessionRequest is the optional JSON body for PUT .../complete.
type CompleteSessionRequest struct {
	Notes *string `json:"notes"`
}

func (r *CompleteSessionRequest) Validate() []FieldError { return nil }

// SkipSessionRequest is the optional JSON body for PUT .../skip.
type SkipSessionRequest struct {
	Notes *string `json:"notes"`
}

func (r *SkipSessionRequest) Validate() []FieldError { return nil }

// LogSetRequest is the JSON body for POST .../sets.
type LogSetRequest struct {
	SectionExerciseUUID *string  `json:"section_exercise_uuid"`
	ExerciseUUID        *string  `json:"exercise_uuid"`
	SetNumber           int      `json:"set_number"`
	TargetReps          *int     `json:"target_reps"`
	ActualReps          *int     `json:"actual_reps"`
	Weight              *float64 `json:"weight"`
	Duration            *int     `json:"duration"`
	Distance            *float64 `json:"distance"`
	RPE                 *float64 `json:"rpe"`
}

func (r *LogSetRequest) Validate() []FieldError {
	var errs []FieldError
	if r.SetNumber < 1 {
		errs = append(errs, FieldError{Field: "set_number", Message: "must be at least 1"})
	}
	if r.SectionExerciseUUID == nil && r.ExerciseUUID == nil {
		errs = append(errs, FieldError{Field: "exercise_uuid", Message: "exercise_uuid or section_exercise_uuid is required"})
	}
	return errs
}

// --- Cycle response DTOs ---

// CycleResponse is the JSON shape returned for a cycle (without sessions).
type CycleResponse struct {
	UUID        string  `json:"uuid"`
	ProgramID   int64   `json:"program_id"`
	Status      string  `json:"status"`
	StartedAt   *string `json:"started_at,omitempty"`
	CompletedAt *string `json:"completed_at,omitempty"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

// CycleWithSessionsResponse is the JSON shape for GET /cycles/{id}.
type CycleWithSessionsResponse struct {
	UUID        string            `json:"uuid"`
	ProgramID   int64             `json:"program_id"`
	Status      string            `json:"status"`
	StartedAt   *string           `json:"started_at,omitempty"`
	CompletedAt *string           `json:"completed_at,omitempty"`
	Sessions    []SessionResponse `json:"sessions"`
	CreatedAt   string            `json:"created_at"`
	UpdatedAt   string            `json:"updated_at"`
}

// ToCycleResponse converts a domain Cycle to the flat response DTO.
func ToCycleResponse(c *domain.Cycle) CycleResponse {
	r := CycleResponse{
		UUID:      c.UUID,
		ProgramID: c.ProgramID,
		Status:    string(c.Status),
		CreatedAt: c.CreatedAt.Format(time.RFC3339),
		UpdatedAt: c.UpdatedAt.Format(time.RFC3339),
	}
	if c.StartedAt != nil {
		s := c.StartedAt.Format(time.RFC3339)
		r.StartedAt = &s
	}
	if c.CompletedAt != nil {
		s := c.CompletedAt.Format(time.RFC3339)
		r.CompletedAt = &s
	}
	return r
}

// ToCycleWithSessionsResponse converts a Cycle with sessions to the full response DTO.
func ToCycleWithSessionsResponse(c *domain.Cycle) CycleWithSessionsResponse {
	sessions := make([]SessionResponse, len(c.Sessions))
	for i, s := range c.Sessions {
		sessions[i] = ToSessionResponse(s)
	}
	r := CycleWithSessionsResponse{
		UUID:      c.UUID,
		ProgramID: c.ProgramID,
		Status:    string(c.Status),
		Sessions:  sessions,
		CreatedAt: c.CreatedAt.Format(time.RFC3339),
		UpdatedAt: c.UpdatedAt.Format(time.RFC3339),
	}
	if c.StartedAt != nil {
		s := c.StartedAt.Format(time.RFC3339)
		r.StartedAt = &s
	}
	if c.CompletedAt != nil {
		s := c.CompletedAt.Format(time.RFC3339)
		r.CompletedAt = &s
	}
	return r
}

// --- Session response DTOs ---

// SessionResponse is the flat JSON shape for a session (no set_logs).
type SessionResponse struct {
	UUID             string  `json:"uuid"`
	CycleID          int64   `json:"cycle_id"`
	ProgramWorkoutID int64   `json:"program_workout_id"`
	SortOrder        int     `json:"sort_order"`
	Status           string  `json:"status"`
	StartedAt        *string `json:"started_at,omitempty"`
	CompletedAt      *string `json:"completed_at,omitempty"`
	Notes            *string `json:"notes,omitempty"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
}

// ToSessionResponse converts a domain Session to the flat response DTO.
func ToSessionResponse(s *domain.Session) SessionResponse {
	r := SessionResponse{
		UUID:             s.UUID,
		CycleID:          s.CycleID,
		ProgramWorkoutID: s.ProgramWorkoutID,
		SortOrder:        s.SortOrder,
		Status:           string(s.Status),
		Notes:            s.Notes,
		CreatedAt:        s.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        s.UpdatedAt.Format(time.RFC3339),
	}
	if s.StartedAt != nil {
		t := s.StartedAt.Format(time.RFC3339)
		r.StartedAt = &t
	}
	if s.CompletedAt != nil {
		t := s.CompletedAt.Format(time.RFC3339)
		r.CompletedAt = &t
	}
	return r
}

// --- Set log response DTO ---

// SetLogResponse is the JSON shape for a logged set.
type SetLogResponse struct {
	UUID                string   `json:"uuid"`
	ExerciseUUID        string   `json:"exercise_uuid"`
	SectionExerciseUUID *string  `json:"section_exercise_uuid,omitempty"`
	SetNumber           int      `json:"set_number"`
	TargetReps          *int     `json:"target_reps,omitempty"`
	ActualReps          *int     `json:"actual_reps,omitempty"`
	Weight              *float64 `json:"weight,omitempty"`
	Duration            *int     `json:"duration,omitempty"`
	Distance            *float64 `json:"distance,omitempty"`
	RPE                 *float64 `json:"rpe,omitempty"`
	CompletedAt         string   `json:"completed_at"`
}

// --- Session detail response DTOs ---

// SessionDetailResponse is the full nested JSON for GET /sessions/{id}.
type SessionDetailResponse struct {
	UUID             string                        `json:"uuid"`
	CycleID          int64                         `json:"cycle_id"`
	ProgramWorkoutID int64                         `json:"program_workout_id"`
	SortOrder        int                           `json:"sort_order"`
	Status           string                        `json:"status"`
	StartedAt        *string                       `json:"started_at,omitempty"`
	CompletedAt      *string                       `json:"completed_at,omitempty"`
	Notes            *string                       `json:"notes,omitempty"`
	Sections         []SessionDetailSectionResponse `json:"sections"`
	CreatedAt        string                        `json:"created_at"`
	UpdatedAt        string                        `json:"updated_at"`
}

// SessionDetailSectionResponse is one section in the session detail.
type SessionDetailSectionResponse struct {
	UUID        string                         `json:"uuid"`
	Name        string                         `json:"name"`
	SortOrder   int                            `json:"sort_order"`
	RestSeconds *int                           `json:"rest_seconds,omitempty"`
	Exercises   []SessionDetailExerciseResponse `json:"exercises"`
}

// SessionDetailExerciseResponse is one exercise row in the session detail.
type SessionDetailExerciseResponse struct {
	SectionExerciseUUID  string           `json:"section_exercise_uuid"`
	ExerciseUUID         string           `json:"exercise_uuid"`
	ExerciseName         string           `json:"exercise_name"`
	TargetSets           *int             `json:"target_sets,omitempty"`
	TargetReps           *int             `json:"target_reps,omitempty"`
	StaticTargetWeight   *float64         `json:"static_target_weight,omitempty"`
	ComputedTargetWeight *float64         `json:"computed_target_weight,omitempty"`
	TargetDuration       *int             `json:"target_duration,omitempty"`
	TargetDistance       *float64         `json:"target_distance,omitempty"`
	SortOrder            int              `json:"sort_order"`
	Notes                *string          `json:"notes,omitempty"`
	SetLogs              []SetLogResponse `json:"set_logs"`
}

// ToSessionDetailResponse converts a domain SessionDetail to the response DTO.
func ToSessionDetailResponse(d *domain.SessionDetail) SessionDetailResponse {
	sections := make([]SessionDetailSectionResponse, len(d.Sections))
	for i, sec := range d.Sections {
		exercises := make([]SessionDetailExerciseResponse, len(sec.Exercises))
		for j, ex := range sec.Exercises {
			setLogs := make([]SetLogResponse, len(ex.SetLogs))
			for k, sl := range ex.SetLogs {
				setLogs[k] = SetLogResponse{
					UUID:                sl.UUID,
					ExerciseUUID:        sl.ExerciseUUID,
					SectionExerciseUUID: sl.SectionExerciseUUID,
					SetNumber:           sl.SetNumber,
					TargetReps:          sl.TargetReps,
					ActualReps:          sl.ActualReps,
					Weight:              sl.Weight,
					Duration:            sl.Duration,
					Distance:            sl.Distance,
					RPE:                 sl.RPE,
					CompletedAt:         sl.CompletedAt.Format(time.RFC3339),
				}
			}
			exercises[j] = SessionDetailExerciseResponse{
				SectionExerciseUUID:  ex.SectionExerciseUUID,
				ExerciseUUID:         ex.ExerciseUUID,
				ExerciseName:         ex.ExerciseName,
				TargetSets:           ex.TargetSets,
				TargetReps:           ex.TargetReps,
				StaticTargetWeight:   ex.StaticTargetWeight,
				ComputedTargetWeight: ex.ComputedTargetWeight,
				TargetDuration:       ex.TargetDuration,
				TargetDistance:       ex.TargetDistance,
				SortOrder:            ex.SortOrder,
				Notes:                ex.Notes,
				SetLogs:              setLogs,
			}
		}
		sections[i] = SessionDetailSectionResponse{
			UUID:        sec.UUID,
			Name:        sec.Name,
			SortOrder:   sec.SortOrder,
			RestSeconds: sec.RestSeconds,
			Exercises:   exercises,
		}
	}

	r := SessionDetailResponse{
		UUID:             d.UUID,
		CycleID:          d.CycleID,
		ProgramWorkoutID: d.ProgramWorkoutID,
		SortOrder:        d.SortOrder,
		Status:           string(d.Status),
		Notes:            d.Notes,
		Sections:         sections,
		CreatedAt:        d.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        d.UpdatedAt.Format(time.RFC3339),
	}
	if d.StartedAt != nil {
		t := d.StartedAt.Format(time.RFC3339)
		r.StartedAt = &t
	}
	if d.CompletedAt != nil {
		t := d.CompletedAt.Format(time.RFC3339)
		r.CompletedAt = &t
	}
	return r
}
