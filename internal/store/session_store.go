package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	dbgen "compound/internal/db"
	"compound/internal/dbutil"
	"compound/internal/domain"

	"github.com/google/uuid"
)

// GetSessionByUUID returns a session by UUID without set_logs.
func (s *Store) GetSessionByUUID(ctx context.Context, db DBTX, id string) (*domain.Session, error) {
	row, err := dbgen.New(db).GetSessionByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("session", id)
	}
	if err != nil {
		return nil, err
	}
	return mapSession(row), nil
}

// GetActiveSession returns the full detail of the currently in-progress session,
// or a NoActiveSessionError if no session is in progress.
func (s *Store) GetActiveSession(ctx context.Context, db DBTX) (*domain.SessionDetail, error) {
	uuid, err := dbgen.New(db).GetActiveSessionUUID(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNoActiveSessionError()
	}
	if err != nil {
		return nil, err
	}
	return s.GetSessionDetail(ctx, db, uuid)
}

// GetSessionDetail returns a fully populated session detail including sections,
// exercises with computed target weights, and any set_logs already recorded.
func (s *Store) GetSessionDetail(ctx context.Context, db DBTX, id string) (*domain.SessionDetail, error) {
	sess, err := s.GetSessionByUUID(ctx, db, id)
	if err != nil {
		return nil, err
	}

	sections, seMap, err := s.loadSectionsForWorkout(ctx, db, sess.ProgramWorkoutID)
	if err != nil {
		return nil, err
	}

	setLogRows, err := dbgen.New(db).GetSetLogsBySessionID(ctx, sess.ID)
	if err != nil {
		return nil, err
	}
	logsBySEID := make(map[int64][]*domain.SetLog)
	for _, slr := range setLogRows {
		sl := mapSetLog(slr)
		if sl.SectionExerciseID != nil {
			logsBySEID[*sl.SectionExerciseID] = append(logsBySEID[*sl.SectionExerciseID], sl)
		}
	}

	var seIDsWithRules []int64
	for seID, se := range seMap {
		if se.ProgressionRule != nil {
			seIDsWithRules = append(seIDsWithRules, seID)
		}
	}

	computedWeights := make(map[int64]*float64)
	if len(seIDsWithRules) > 0 {
		computedWeights, err = s.computeProgressionWeights(ctx, db, seIDsWithRules, seMap)
		if err != nil {
			return nil, err
		}
	}

	detail := &domain.SessionDetail{
		UUID:             sess.UUID,
		CycleID:          sess.CycleID,
		ProgramWorkoutID: sess.ProgramWorkoutID,
		SortOrder:        sess.SortOrder,
		Status:           sess.Status,
		StartedAt:        sess.StartedAt,
		CompletedAt:      sess.CompletedAt,
		Notes:            sess.Notes,
		CreatedAt:        sess.CreatedAt,
		UpdatedAt:        sess.UpdatedAt,
	}

	for _, sec := range sections {
		detailSec := &domain.SessionDetailSection{
			UUID:        sec.UUID,
			Name:        sec.Name,
			SortOrder:   sec.SortOrder,
			RestSeconds: sec.RestSeconds,
		}
		for _, se := range sec.Exercises {
			computed := computedWeights[se.ID]
			if computed == nil {
				// Fall back to static target weight when no progression rule.
				computed = se.TargetWeight
			}
			detailExercise := &domain.SessionDetailExercise{
				SectionExerciseUUID:  se.UUID,
				ExerciseUUID:         se.ExerciseUUID,
				ExerciseName:         se.ExerciseName,
				TargetSets:           se.TargetSets,
				TargetReps:           se.TargetReps,
				StaticTargetWeight:   se.TargetWeight,
				ComputedTargetWeight: computed,
				TargetDuration:       se.TargetDuration,
				TargetDistance:       se.TargetDistance,
				SortOrder:            se.SortOrder,
				Notes:                se.Notes,
				SetLogs:              logsBySEID[se.ID],
			}
			detailSec.Exercises = append(detailSec.Exercises, detailExercise)
		}
		detail.Sections = append(detail.Sections, detailSec)
	}
	return detail, nil
}

// loadSectionsForWorkout loads sections + exercises (with denormalized exercise
// name/uuid) + progression rules for a given workout ID. Returns the ordered
// section slice and a map of section_exercise_id → SectionExercise.
func (s *Store) loadSectionsForWorkout(ctx context.Context, db DBTX, workoutID int64) ([]*domain.Section, map[int64]*domain.SectionExercise, error) {
	q := dbgen.New(db)

	sectionRows, err := q.GetSectionsByWorkoutID(ctx, workoutID)
	if err != nil {
		return nil, nil, err
	}

	var sections []*domain.Section
	var sectionIDs []int64
	sectionMap := make(map[int64]*domain.Section)
	for _, sr := range sectionRows {
		sec := mapSection(sr)
		sections = append(sections, sec)
		sectionIDs = append(sectionIDs, sec.ID)
		sectionMap[sec.ID] = sec
	}

	if len(sectionIDs) == 0 {
		return sections, nil, nil
	}

	seRows, err := q.GetSectionExercisesWithExerciseBySectionIDs(ctx, sectionIDs)
	if err != nil {
		return nil, nil, err
	}

	seMap := make(map[int64]*domain.SectionExercise)
	var seIDs []int64
	for _, sr := range seRows {
		se := mapSectionExerciseWithExercise(sr)
		if sec, ok := sectionMap[se.SectionID]; ok {
			sec.Exercises = append(sec.Exercises, se)
		}
		seIDs = append(seIDs, se.ID)
		seMap[se.ID] = se
	}

	if len(seIDs) == 0 {
		return sections, seMap, nil
	}

	prRows, err := q.GetProgressionRulesBySectionExerciseIDs(ctx, seIDs)
	if err != nil {
		return nil, nil, err
	}
	for _, pr := range prRows {
		if se, ok := seMap[pr.SectionExerciseID]; ok {
			se.ProgressionRule = mapProgressionRule(pr)
		}
	}

	return sections, seMap, nil
}

// computeProgressionWeights computes the next target weight for each
// section_exercise that has a progression rule, using historical set_logs
// across all cycles (cross-cycle progression scope).
func (s *Store) computeProgressionWeights(ctx context.Context, db DBTX, seIDs []int64, seMap map[int64]*domain.SectionExercise) (map[int64]*float64, error) {
	result := make(map[int64]*float64)

	// GetSetLogProgressionHistory takes []*int64 because section_exercise_id is
	// nullable in the schema; we know our IDs are non-null so we convert.
	seIDPtrs := make([]*int64, len(seIDs))
	for i := range seIDs {
		seIDPtrs[i] = &seIDs[i]
	}
	histRows, err := dbgen.New(db).GetSetLogProgressionHistory(ctx, seIDPtrs)
	if err != nil {
		return nil, err
	}

	type setEntry struct {
		actualReps *int64
		targetReps *int64
		weight     *float64
		sessionID  int64
	}
	history := make(map[int64][]setEntry)
	for _, r := range histRows {
		if r.SectionExerciseID == nil {
			continue
		}
		history[*r.SectionExerciseID] = append(history[*r.SectionExerciseID], setEntry{
			actualReps: r.ActualReps,
			targetReps: r.TargetReps,
			weight:     r.Weight,
			sessionID:  r.SessionID,
		})
	}

	for _, seID := range seIDs {
		se := seMap[seID]
		if se.ProgressionRule == nil {
			continue
		}
		rule := se.ProgressionRule
		sets := history[seID]

		if len(sets) == 0 {
			result[seID] = se.TargetWeight
			continue
		}

		// Group sets by session (already sorted newest→oldest).
		type sessionGroup struct {
			id     int64
			weight *float64
			missed bool
		}
		var groups []sessionGroup
		var curID int64 = -1
		var cur sessionGroup
		for _, entry := range sets {
			if entry.sessionID != curID {
				if curID != -1 {
					groups = append(groups, cur)
				}
				curID = entry.sessionID
				cur = sessionGroup{id: entry.sessionID, weight: entry.weight}
			}
			if entry.actualReps != nil && entry.targetReps != nil && *entry.actualReps < *entry.targetReps {
				cur.missed = true
			}
			if entry.weight != nil {
				cur.weight = entry.weight
			}
		}
		if curID != -1 {
			groups = append(groups, cur)
		}

		var currentWeight float64
		if groups[0].weight != nil {
			currentWeight = *groups[0].weight
		} else if se.TargetWeight != nil {
			currentWeight = *se.TargetWeight
		}

		consecutiveFailures := 0
		for _, g := range groups {
			if g.missed {
				consecutiveFailures++
			} else {
				break
			}
		}

		next := rule.NextWeight(currentWeight, consecutiveFailures)
		result[seID] = &next
	}

	return result, nil
}

// StartSession transitions a session from pending to in_progress and persists.
func (s *Store) StartSession(ctx context.Context, db DBTX, id string) (*domain.Session, error) {
	sess, err := s.GetSessionByUUID(ctx, db, id)
	if err != nil {
		return nil, err
	}
	if err := sess.Start(); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	_, err = dbgen.New(db).UpdateSession(ctx, dbgen.UpdateSessionParams{
		Status:      string(sess.Status),
		StartedAt:   dbutil.NullableTimeFromPtr(sess.StartedAt),
		CompletedAt: dbutil.NullableTimeFromPtr(sess.CompletedAt),
		Notes:       sess.Notes,
		UpdatedAt:   dbutil.TimeFrom(now),
		Uuid:        id,
	})
	if err != nil {
		return nil, err
	}
	sess.UpdatedAt = now
	return sess, nil
}

// CompleteSession transitions a session to completed and persists.
func (s *Store) CompleteSession(ctx context.Context, db DBTX, id string, notes *string) (*domain.Session, error) {
	sess, err := s.GetSessionByUUID(ctx, db, id)
	if err != nil {
		return nil, err
	}
	if err := sess.Complete(notes); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	_, err = dbgen.New(db).UpdateSession(ctx, dbgen.UpdateSessionParams{
		Status:      string(sess.Status),
		StartedAt:   dbutil.NullableTimeFromPtr(sess.StartedAt),
		CompletedAt: dbutil.NullableTimeFromPtr(sess.CompletedAt),
		Notes:       sess.Notes,
		UpdatedAt:   dbutil.TimeFrom(now),
		Uuid:        id,
	})
	if err != nil {
		return nil, err
	}
	sess.UpdatedAt = now
	return sess, nil
}

// SkipSession transitions a session to skipped and persists.
func (s *Store) SkipSession(ctx context.Context, db DBTX, id string, notes *string) (*domain.Session, error) {
	sess, err := s.GetSessionByUUID(ctx, db, id)
	if err != nil {
		return nil, err
	}
	if err := sess.Skip(notes); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	_, err = dbgen.New(db).UpdateSession(ctx, dbgen.UpdateSessionParams{
		Status:      string(sess.Status),
		StartedAt:   dbutil.NullableTimeFromPtr(sess.StartedAt),
		CompletedAt: dbutil.NullableTimeFromPtr(sess.CompletedAt),
		Notes:       sess.Notes,
		UpdatedAt:   dbutil.TimeFrom(now),
		Uuid:        id,
	})
	if err != nil {
		return nil, err
	}
	sess.UpdatedAt = now
	return sess, nil
}

// CountIncompleteSessionsInCycle returns the count of sessions that are
// neither completed nor skipped.
func (s *Store) CountIncompleteSessionsInCycle(ctx context.Context, db DBTX, cycleID int64) (int64, error) {
	return dbgen.New(db).CountIncompleteSessionsInCycle(ctx, cycleID)
}

// ResolveSectionExercise returns the internal IDs and exercise UUID for a
// section_exercise by its UUID. Used by the session handler for LogSet lookups.
func (s *Store) ResolveSectionExercise(ctx context.Context, db DBTX, seUUID string) (seID, exerciseID int64, exerciseUUID string, err error) {
	row, dbErr := dbgen.New(db).ResolveSectionExercise(ctx, seUUID)
	if errors.Is(dbErr, sql.ErrNoRows) {
		return 0, 0, "", domain.NewNotFoundError("section_exercise", seUUID)
	}
	if dbErr != nil {
		return 0, 0, "", dbErr
	}
	return row.SectionExerciseID, row.ExerciseID, row.ExerciseUuid, nil
}

// LogSet validates the set against the exercise's tracking type and inserts it.
// log.SessionID must be set. If SectionExerciseID is set and ExerciseID is 0,
// the exercise is resolved from the section_exercise (regular set). If both are
// set, ExerciseID takes precedence for tracking-type validation (substitution).
// For ad-hoc sets, only ExerciseID is set.
func (s *Store) LogSet(ctx context.Context, db DBTX, log *domain.SetLog) error {
	var trackingType string
	if log.SectionExerciseID != nil && log.ExerciseID == 0 {
		// Regular: resolve exercise from section_exercise.
		row, err := dbgen.New(db).GetExerciseTrackingTypeBySectionExerciseID(ctx, *log.SectionExerciseID)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.NewNotFoundError("section_exercise", fmt.Sprintf("%d", *log.SectionExerciseID))
		}
		if err != nil {
			return err
		}
		trackingType = row.TrackingType
		log.ExerciseID = row.ExerciseID
	} else {
		// Substitution (both set) or ad-hoc (only ExerciseID): validate by ExerciseID.
		var err error
		trackingType, err = dbgen.New(db).GetExerciseTrackingTypeByID(ctx, log.ExerciseID)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.NewNotFoundError("exercise", fmt.Sprintf("%d", log.ExerciseID))
		}
		if err != nil {
			return err
		}
	}

	if err := validateSetLogTrackingType(log, domain.TrackingType(trackingType)); err != nil {
		return err
	}

	log.UUID = uuid.NewString()
	now := time.Now().UTC()
	if log.CompletedAt.IsZero() {
		log.CompletedAt = now
	}
	log.CreatedAt = now

	result, err := dbgen.New(db).InsertSetLog(ctx, dbgen.InsertSetLogParams{
		Uuid:              log.UUID,
		SessionID:         log.SessionID,
		ExerciseID:        log.ExerciseID,
		SectionExerciseID: log.SectionExerciseID,
		SetNumber:         int64(log.SetNumber),
		TargetReps:        intToInt64Ptr(log.TargetReps),
		ActualReps:        intToInt64Ptr(log.ActualReps),
		Weight:            log.Weight,
		Duration:          intToInt64Ptr(log.Duration),
		Distance:          log.Distance,
		Rpe:               log.RPE,
		CompletedAt:       dbutil.TimeFrom(log.CompletedAt),
		CreatedAt:         dbutil.TimeFrom(log.CreatedAt),
	})
	if err != nil {
		return err
	}
	log.ID, _ = result.LastInsertId()
	return nil
}

// DeleteSetLogsForExercise deletes all set_logs for the given exercise in a session.
// Returns UnprocessableError if the session is not in_progress.
func (s *Store) DeleteSetLogsForExercise(ctx context.Context, db DBTX, sessionUUID, exerciseUUID string) error {
	sess, err := s.GetSessionByUUID(ctx, db, sessionUUID)
	if err != nil {
		return err
	}
	if sess.Status != domain.SessionInProgress {
		return domain.NewUnprocessableError("session is not in progress")
	}
	ex, err := s.GetExerciseByUUID(ctx, db, exerciseUUID)
	if err != nil {
		return err
	}
	return dbgen.New(db).DeleteSetLogsForSessionAndExercise(ctx, dbgen.DeleteSetLogsForSessionAndExerciseParams{
		SessionID:  sess.ID,
		ExerciseID: ex.ID,
	})
}

// validateSetLogTrackingType returns an error if the set_log contains fields
// incompatible with the exercise's tracking type.
func validateSetLogTrackingType(log *domain.SetLog, t domain.TrackingType) error {
	switch t {
	case domain.TrackingWeightReps:
		if log.Duration != nil || log.Distance != nil {
			return domain.NewValidationError("tracking_type",
				"weight_reps exercises do not accept duration or distance fields")
		}
	case domain.TrackingBodyweightReps:
		if log.Weight != nil || log.Duration != nil || log.Distance != nil {
			return domain.NewValidationError("tracking_type",
				"bodyweight_reps exercises do not accept weight, duration, or distance fields")
		}
	case domain.TrackingDuration:
		if log.Weight != nil || log.ActualReps != nil || log.Distance != nil {
			return domain.NewValidationError("tracking_type",
				"duration exercises do not accept weight, reps, or distance fields")
		}
	case domain.TrackingDistance:
		if log.Weight != nil || log.ActualReps != nil || log.Duration != nil {
			return domain.NewValidationError("tracking_type",
				"distance exercises do not accept weight, reps, or duration fields")
		}
	}
	return nil
}
