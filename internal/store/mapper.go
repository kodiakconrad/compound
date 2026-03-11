package store

import (
	dbgen "compound/internal/db"
	"compound/internal/domain"
)

// mapExercise converts a dbgen GetExerciseByUUIDRow to a domain Exercise.
func mapExercise(row dbgen.GetExerciseByUUIDRow) *domain.Exercise {
	return &domain.Exercise{
		ID:           row.ID,
		UUID:         row.Uuid,
		Name:         row.Name,
		MuscleGroup:  row.MuscleGroup,
		Equipment:    row.Equipment,
		TrackingType: domain.TrackingType(row.TrackingType),
		Notes:        row.Notes,
		IsCustom:     row.IsCustom,
		CreatedAt:    row.CreatedAt.Time,
		UpdatedAt:    row.UpdatedAt.Time,
	}
}

// mapExerciseFromModel converts a full dbgen.Exercise model to a domain Exercise.
// Used when scanning rows that return the full model (e.g. list scans).
func mapExerciseFromModel(row dbgen.Exercise) *domain.Exercise {
	return &domain.Exercise{
		ID:           row.ID,
		UUID:         row.Uuid,
		Name:         row.Name,
		MuscleGroup:  row.MuscleGroup,
		Equipment:    row.Equipment,
		TrackingType: domain.TrackingType(row.TrackingType),
		Notes:        row.Notes,
		IsCustom:     row.IsCustom,
		CreatedAt:    row.CreatedAt.Time,
		UpdatedAt:    row.UpdatedAt.Time,
		DeletedAt:    row.DeletedAt.ToTimePtr(),
	}
}

// mapProgram converts a dbgen.Program to a domain Program (metadata only, no tree).
func mapProgram(row dbgen.Program) *domain.Program {
	return &domain.Program{
		ID:          row.ID,
		UUID:        row.Uuid,
		Name:        row.Name,
		Description: row.Description,
		IsPrebuilt:  row.IsPrebuilt,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
		DeletedAt:   row.DeletedAt.ToTimePtr(),
	}
}

// mapWorkout converts a dbgen.ProgramWorkout to a domain ProgramWorkout.
func mapWorkout(row dbgen.ProgramWorkout) *domain.ProgramWorkout {
	return &domain.ProgramWorkout{
		ID:        row.ID,
		UUID:      row.Uuid,
		ProgramID: row.ProgramID,
		Name:      row.Name,
		DayNumber: int(row.DayNumber),
		SortOrder: int(row.SortOrder),
		CreatedAt: row.CreatedAt.Time,
		UpdatedAt: row.UpdatedAt.Time,
	}
}

// mapSection converts a dbgen.Section to a domain Section.
func mapSection(row dbgen.Section) *domain.Section {
	return &domain.Section{
		ID:               row.ID,
		UUID:             row.Uuid,
		ProgramWorkoutID: row.ProgramWorkoutID,
		Name:             row.Name,
		SortOrder:        int(row.SortOrder),
		RestSeconds:      ptrInt64ToInt(row.RestSeconds),
		CreatedAt:        row.CreatedAt.Time,
		UpdatedAt:        row.UpdatedAt.Time,
	}
}

// mapSectionExercise converts a dbgen.SectionExercise to a domain SectionExercise.
func mapSectionExercise(row dbgen.SectionExercise) *domain.SectionExercise {
	return &domain.SectionExercise{
		ID:             row.ID,
		UUID:           row.Uuid,
		SectionID:      row.SectionID,
		ExerciseID:     row.ExerciseID,
		TargetSets:     ptrInt64ToInt(row.TargetSets),
		TargetReps:     ptrInt64ToInt(row.TargetReps),
		TargetWeight:   row.TargetWeight,
		TargetDuration: ptrInt64ToInt(row.TargetDuration),
		TargetDistance: row.TargetDistance,
		SortOrder:      int(row.SortOrder),
		Notes:          row.Notes,
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
	}
}

// mapSectionExerciseWithExercise converts a GetSectionExercisesWithExerciseBySectionIDsRow
// (which joins in exercise UUID and name) to a domain SectionExercise.
func mapSectionExerciseWithExercise(row dbgen.GetSectionExercisesWithExerciseBySectionIDsRow) *domain.SectionExercise {
	return &domain.SectionExercise{
		ID:             row.ID,
		UUID:           row.Uuid,
		SectionID:      row.SectionID,
		ExerciseID:     row.ExerciseID,
		ExerciseUUID:   row.ExerciseUuid,
		ExerciseName:   row.ExerciseName,
		TargetSets:     ptrInt64ToInt(row.TargetSets),
		TargetReps:     ptrInt64ToInt(row.TargetReps),
		TargetWeight:   row.TargetWeight,
		TargetDuration: ptrInt64ToInt(row.TargetDuration),
		TargetDistance: row.TargetDistance,
		SortOrder:      int(row.SortOrder),
		Notes:          row.Notes,
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
	}
}

// mapProgressionRule converts a dbgen.ProgressionRule to a domain ProgressionRule.
func mapProgressionRule(row dbgen.ProgressionRule) *domain.ProgressionRule {
	return &domain.ProgressionRule{
		ID:                row.ID,
		UUID:              row.Uuid,
		SectionExerciseID: row.SectionExerciseID,
		Strategy:          domain.ProgressionStrategy(row.Strategy),
		Increment:         row.Increment,
		IncrementPct:      row.IncrementPct,
		DeloadThreshold:   int(row.DeloadThreshold),
		DeloadPct:         row.DeloadPct,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

// mapCycle converts a dbgen.Cycle to a domain Cycle (no sessions).
func mapCycle(row dbgen.Cycle) *domain.Cycle {
	return &domain.Cycle{
		ID:          row.ID,
		UUID:        row.Uuid,
		ProgramID:   row.ProgramID,
		Status:      domain.CycleStatus(row.Status),
		StartedAt:   row.StartedAt.ToTimePtr(),
		CompletedAt: row.CompletedAt.ToTimePtr(),
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}
}

// mapSession converts a dbgen.Session to a domain Session (no set_logs).
func mapSession(row dbgen.Session) *domain.Session {
	return &domain.Session{
		ID:               row.ID,
		UUID:             row.Uuid,
		CycleID:          row.CycleID,
		ProgramWorkoutID: row.ProgramWorkoutID,
		SortOrder:        int(row.SortOrder),
		Status:           domain.SessionStatus(row.Status),
		StartedAt:        row.StartedAt.ToTimePtr(),
		CompletedAt:      row.CompletedAt.ToTimePtr(),
		Notes:            row.Notes,
		CreatedAt:        row.CreatedAt.Time,
		UpdatedAt:        row.UpdatedAt.Time,
	}
}

// mapSetLog converts a dbgen.GetSetLogsBySessionIDRow to a domain SetLog.
func mapSetLog(row dbgen.GetSetLogsBySessionIDRow) *domain.SetLog {
	return &domain.SetLog{
		ID:                  row.ID,
		UUID:                row.Uuid,
		SessionID:           row.SessionID,
		ExerciseID:          row.ExerciseID,
		ExerciseUUID:        row.ExerciseUuid,
		SectionExerciseID:   row.SectionExerciseID,
		SectionExerciseUUID: row.SectionExerciseUuid,
		SetNumber:           int(row.SetNumber),
		TargetReps:          ptrInt64ToInt(row.TargetReps),
		ActualReps:          ptrInt64ToInt(row.ActualReps),
		Weight:              row.Weight,
		Duration:            ptrInt64ToInt(row.Duration),
		Distance:            row.Distance,
		RPE:                 row.Rpe,
		CompletedAt:         row.CompletedAt.Time,
		CreatedAt:           row.CreatedAt.Time,
	}
}

// mapHistoryEntryPage converts a GetExerciseHistoryPageRow to a domain HistoryEntry.
func mapHistoryEntryPage(row dbgen.GetExerciseHistoryPageRow) *domain.HistoryEntry {
	return &domain.HistoryEntry{
		SessionID:   row.ID,
		SessionUUID: row.Uuid,
		CompletedAt: row.CompletedAt.Time,
		Weight:      interfaceToFloat64(row.Weight),
	}
}

// mapHistoryEntryPageAfter converts a GetExerciseHistoryPageAfterRow to a domain HistoryEntry.
func mapHistoryEntryPageAfter(row dbgen.GetExerciseHistoryPageAfterRow) *domain.HistoryEntry {
	return &domain.HistoryEntry{
		SessionID:   row.ID,
		SessionUUID: row.Uuid,
		CompletedAt: row.CompletedAt.Time,
		Weight:      interfaceToFloat64(row.Weight),
	}
}

// mapPersonalRecord converts a GetPersonalRecordRow to a domain PersonalRecord.
func mapPersonalRecord(row dbgen.GetPersonalRecordRow) *domain.PersonalRecord {
	pr := &domain.PersonalRecord{
		Weight:      derefFloat64(row.Weight),
		SessionUUID: row.Uuid,
		CompletedAt: row.CompletedAt.Time,
	}
	if row.ActualReps != nil {
		v := int(*row.ActualReps)
		pr.ActualReps = &v
	}
	return pr
}

// derefFloat64 dereferences a *float64 safely, returning 0 if nil.
func derefFloat64(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

// interfaceToFloat64 converts an interface{} from a sqlc aggregate column to float64.
// SQLite returns REAL aggregates as float64.
func interfaceToFloat64(v interface{}) float64 {
	if v == nil {
		return 0
	}
	f, _ := v.(float64)
	return f
}

// ptrInt64ToInt converts *int64 to *int.
func ptrInt64ToInt(v *int64) *int {
	if v == nil {
		return nil
	}
	i := int(*v)
	return &i
}

// intToInt64Ptr converts *int to *int64.
func intToInt64Ptr(v *int) *int64 {
	if v == nil {
		return nil
	}
	i := int64(*v)
	return &i
}

