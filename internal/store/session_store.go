package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	dbgen "compound/internal/db"
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
	sRows, err := db.QueryContext(ctx,
		`SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at
		 FROM sections
		 WHERE program_workout_id = ?
		 ORDER BY sort_order`,
		workoutID,
	)
	if err != nil {
		return nil, nil, err
	}
	defer sRows.Close()

	var sections []*domain.Section
	var sectionIDs []int64
	sectionMap := make(map[int64]*domain.Section)
	for sRows.Next() {
		var secID, programWorkoutID int64
		var secUUID, name string
		var sortOrder int64
		var restSeconds *int64
		var createdAt, updatedAt time.Time
		if err := sRows.Scan(&secID, &secUUID, &programWorkoutID, &name,
			&sortOrder, &restSeconds, &createdAt, &updatedAt); err != nil {
			return nil, nil, err
		}
		sec := &domain.Section{
			ID: secID, UUID: secUUID, ProgramWorkoutID: programWorkoutID,
			Name: name, SortOrder: int(sortOrder), RestSeconds: ptrInt64ToInt(restSeconds),
			CreatedAt: createdAt, UpdatedAt: updatedAt,
		}
		sections = append(sections, sec)
		sectionIDs = append(sectionIDs, secID)
		sectionMap[secID] = sec
	}
	if err := sRows.Err(); err != nil {
		return nil, nil, err
	}

	if len(sectionIDs) == 0 {
		return sections, nil, nil
	}

	seQuery := fmt.Sprintf(
		`SELECT se.id, se.uuid, se.section_id, se.exercise_id,
		        se.target_sets, se.target_reps, se.target_weight,
		        se.target_duration, se.target_distance,
		        se.sort_order, se.notes, se.created_at, se.updated_at,
		        e.uuid, e.name
		 FROM section_exercises se
		 JOIN exercises e ON e.id = se.exercise_id
		 WHERE se.section_id IN (%s)
		 ORDER BY se.sort_order`,
		placeholders(len(sectionIDs)),
	)
	seRows, err := db.QueryContext(ctx, seQuery, int64sToAny(sectionIDs)...)
	if err != nil {
		return nil, nil, err
	}
	defer seRows.Close()

	seMap := make(map[int64]*domain.SectionExercise)
	var seIDs []int64
	for seRows.Next() {
		var seID, sectionID, exerciseID int64
		var seUUID, exerciseUUID, exerciseName string
		var targetSets, targetReps, targetDuration *int64
		var targetWeight, targetDistance *float64
		var sortOrder int64
		var notes *string
		var createdAt, updatedAt time.Time
		if err := seRows.Scan(
			&seID, &seUUID, &sectionID, &exerciseID,
			&targetSets, &targetReps, &targetWeight,
			&targetDuration, &targetDistance,
			&sortOrder, &notes, &createdAt, &updatedAt,
			&exerciseUUID, &exerciseName,
		); err != nil {
			return nil, nil, err
		}
		se := &domain.SectionExercise{
			ID: seID, UUID: seUUID, SectionID: sectionID, ExerciseID: exerciseID,
			ExerciseUUID: exerciseUUID, ExerciseName: exerciseName,
			TargetSets: ptrInt64ToInt(targetSets), TargetReps: ptrInt64ToInt(targetReps),
			TargetWeight: targetWeight, TargetDuration: ptrInt64ToInt(targetDuration),
			TargetDistance: targetDistance, SortOrder: int(sortOrder), Notes: notes,
			CreatedAt: createdAt, UpdatedAt: updatedAt,
		}
		if sec, ok := sectionMap[sectionID]; ok {
			sec.Exercises = append(sec.Exercises, se)
		}
		seIDs = append(seIDs, seID)
		seMap[seID] = se
	}
	if err := seRows.Err(); err != nil {
		return nil, nil, err
	}

	if len(seIDs) == 0 {
		return sections, seMap, nil
	}

	prQuery := fmt.Sprintf(
		`SELECT id, uuid, section_exercise_id, strategy,
		        increment, increment_pct, deload_threshold, deload_pct,
		        created_at, updated_at
		 FROM progression_rules
		 WHERE section_exercise_id IN (%s)`,
		placeholders(len(seIDs)),
	)
	prRows, err := db.QueryContext(ctx, prQuery, int64sToAny(seIDs)...)
	if err != nil {
		return nil, nil, err
	}
	defer prRows.Close()

	for prRows.Next() {
		var prID, sectionExerciseID int64
		var prUUID, strategy string
		var increment, incrementPct *float64
		var deloadThreshold int64
		var deloadPct float64
		var createdAt, updatedAt time.Time
		if err := prRows.Scan(
			&prID, &prUUID, &sectionExerciseID, &strategy,
			&increment, &incrementPct, &deloadThreshold, &deloadPct,
			&createdAt, &updatedAt,
		); err != nil {
			return nil, nil, err
		}
		pr := &domain.ProgressionRule{
			ID: prID, UUID: prUUID, SectionExerciseID: sectionExerciseID,
			Strategy:        domain.ProgressionStrategy(strategy),
			Increment:       increment, IncrementPct: incrementPct,
			DeloadThreshold: int(deloadThreshold), DeloadPct: deloadPct,
			CreatedAt: createdAt, UpdatedAt: updatedAt,
		}
		if se, ok := seMap[sectionExerciseID]; ok {
			se.ProgressionRule = pr
		}
	}
	if err := prRows.Err(); err != nil {
		return nil, nil, err
	}

	return sections, seMap, nil
}

// computeProgressionWeights computes the next target weight for each
// section_exercise that has a progression rule, using historical set_logs
// across all cycles (cross-cycle progression scope).
func (s *Store) computeProgressionWeights(ctx context.Context, db DBTX, seIDs []int64, seMap map[int64]*domain.SectionExercise) (map[int64]*float64, error) {
	result := make(map[int64]*float64)

	query := fmt.Sprintf(
		`SELECT sl.section_exercise_id, sl.set_number,
		        sl.actual_reps, sl.target_reps, sl.weight,
		        s.id AS session_id, s.completed_at
		 FROM set_logs sl
		 JOIN sessions s ON s.id = sl.session_id
		 WHERE sl.section_exercise_id IN (%s)
		   AND s.status = 'completed'
		 ORDER BY sl.section_exercise_id, s.completed_at DESC, s.id DESC, sl.set_number ASC`,
		placeholders(len(seIDs)),
	)
	rows, err := db.QueryContext(ctx, query, int64sToAny(seIDs)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type setEntry struct {
		actualReps *int64
		targetReps *int64
		weight     *float64
		sessionID  int64
	}
	history := make(map[int64][]setEntry)
	for rows.Next() {
		var seID, sessionID, setNumber int64
		var actualReps, targetReps *int64
		var weight *float64
		var completedAt time.Time
		if err := rows.Scan(&seID, &setNumber, &actualReps, &targetReps, &weight, &sessionID, &completedAt); err != nil {
			return nil, err
		}
		history[seID] = append(history[seID], setEntry{
			actualReps: actualReps,
			targetReps: targetReps,
			weight:     weight,
			sessionID:  sessionID,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
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
		StartedAt:   sess.StartedAt,
		CompletedAt: sess.CompletedAt,
		Notes:       sess.Notes,
		UpdatedAt:   now,
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
		StartedAt:   sess.StartedAt,
		CompletedAt: sess.CompletedAt,
		Notes:       sess.Notes,
		UpdatedAt:   now,
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
		StartedAt:   sess.StartedAt,
		CompletedAt: sess.CompletedAt,
		Notes:       sess.Notes,
		UpdatedAt:   now,
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

// GetExerciseUUIDsByIDs returns a map of exercise_id → UUID for the given IDs.
// Used to resolve exercise UUIDs for set_log responses.
func (s *Store) GetExerciseUUIDsByIDs(ctx context.Context, db DBTX, ids []int64) (map[int64]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	query := fmt.Sprintf(`SELECT id, uuid FROM exercises WHERE id IN (%s)`, placeholders(len(ids)))
	rows, err := db.QueryContext(ctx, query, int64sToAny(ids)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := make(map[int64]string, len(ids))
	for rows.Next() {
		var id int64
		var u string
		if err := rows.Scan(&id, &u); err != nil {
			return nil, err
		}
		m[id] = u
	}
	return m, rows.Err()
}

// GetSectionExerciseUUIDsByIDs returns a map of section_exercise_id → UUID.
func (s *Store) GetSectionExerciseUUIDsByIDs(ctx context.Context, db DBTX, ids []int64) (map[int64]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	query := fmt.Sprintf(`SELECT id, uuid FROM section_exercises WHERE id IN (%s)`, placeholders(len(ids)))
	rows, err := db.QueryContext(ctx, query, int64sToAny(ids)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := make(map[int64]string, len(ids))
	for rows.Next() {
		var id int64
		var u string
		if err := rows.Scan(&id, &u); err != nil {
			return nil, err
		}
		m[id] = u
	}
	return m, rows.Err()
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
		CompletedAt:       log.CompletedAt,
		CreatedAt:         log.CreatedAt,
	})
	if err != nil {
		return err
	}
	log.ID, _ = result.LastInsertId()
	return nil
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
