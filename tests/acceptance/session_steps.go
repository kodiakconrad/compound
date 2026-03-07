package acceptance

import (
	"fmt"
	"strconv"
	"time"

	"github.com/cucumber/godog"
	"github.com/google/uuid"
)

// InitializeSessionSteps registers session and set-log step definitions.
func InitializeSessionSteps(ctx *godog.ScenarioContext, client *TestClient) {
	// Session state machine
	ctx.Step(`^I start the session for workout "([^"]*)" in the current cycle$`, client.iStartTheSessionForWorkout)
	ctx.Step(`^I complete the current session$`, client.iCompleteTheCurrentSession)
	ctx.Step(`^I complete the current session with notes "([^"]*)"$`, client.iCompleteTheCurrentSessionWithNotes)
	ctx.Step(`^I skip the session for workout "([^"]*)" in the current cycle$`, client.iSkipTheSessionForWorkout)
	ctx.Step(`^the session for workout "([^"]*)" is in progress$`, client.theSessionForWorkoutIsInProgress)

	// Set logging
	ctx.Step(`^I log a set for section exercise "([^"]*)" in section "([^"]*)" with:$`, client.iLogASetForSectionExercise)
	ctx.Step(`^I log a set for section exercise "([^"]*)" in section "([^"]*)" substituting "([^"]*)" with:$`, client.iLogASetForSectionExerciseSubstituting)
	ctx.Step(`^I log an ad-hoc set for exercise "([^"]*)" with:$`, client.iLogAnAdHocSetForExercise)
	ctx.Step(`^the set log exercise should be "([^"]*)"$`, client.theSetLogExerciseShouldBe)

	// Session detail assertions
	ctx.Step(`^I get the session for workout "([^"]*)" in the current cycle$`, client.iGetTheSessionForWorkout)
	ctx.Step(`^the session should have (\d+) sections?$`, client.theSessionShouldHaveSections)
	ctx.Step(`^the session's first section should have (\d+) exercises?$`, client.theSessionFirstSectionShouldHaveExercises)
	ctx.Step(`^the exercise "([^"]*)" should have computed_target_weight (\S+)$`, client.theExerciseShouldHaveComputedTargetWeight)
	ctx.Step(`^the exercise "([^"]*)" should have (\d+) logged sets?$`, client.theExerciseShouldHaveLoggedSets)

	// Compound Given steps for progression scenarios
	ctx.Step(`^the exercise "([^"]*)" in section "([^"]*)" has a linear progression rule:$`, client.theExerciseHasALinearProgressionRule)
	ctx.Step(`^I successfully complete the session for workout "([^"]*)" hitting all reps at (\S+)$`, client.iSuccessfullyCompleteSessionHittingAllReps)
	ctx.Step(`^I complete the session for workout "([^"]*)" missing reps on "([^"]*)"$`, client.iCompleteSessionMissingReps)
}

// --- Session URL helper ---

func (c *TestClient) sessionPath(workoutName string) (string, error) {
	sessionUUID, ok := c.SessionsByWorkoutName[workoutName]
	if !ok {
		return "", fmt.Errorf("no session UUID stored for workout %q (current cycle)", workoutName)
	}
	cycleUUID := c.CurrentCycleUUID
	if cycleUUID == "" {
		return "", fmt.Errorf("no current cycle UUID set")
	}
	return "/api/v1/cycles/" + cycleUUID + "/sessions/" + sessionUUID, nil
}

// --- Session state machine ---

func (c *TestClient) iStartTheSessionForWorkout(workoutName string) error {
	path, err := c.sessionPath(workoutName)
	if err != nil {
		return err
	}
	if err := c.Post(path+"/start", nil); err != nil {
		return err
	}
	if c.LastStatus == 200 {
		data, errD := c.dataObject()
		if errD != nil {
			return errD
		}
		c.CurrentSessionUUID, _ = data["uuid"].(string)
	}
	return nil
}

func (c *TestClient) iCompleteTheCurrentSession() error {
	return c.iCompleteTheCurrentSessionWithNotes("")
}

func (c *TestClient) iCompleteTheCurrentSessionWithNotes(notes string) error {
	if c.CurrentCycleUUID == "" {
		return fmt.Errorf("no current cycle UUID set")
	}
	if c.CurrentSessionUUID == "" {
		return fmt.Errorf("no current session UUID set")
	}
	path := "/api/v1/cycles/" + c.CurrentCycleUUID + "/sessions/" + c.CurrentSessionUUID
	var body any
	if notes != "" {
		body = map[string]any{"notes": notes}
	}
	return c.Put(path+"/complete", body)
}

func (c *TestClient) iSkipTheSessionForWorkout(workoutName string) error {
	path, err := c.sessionPath(workoutName)
	if err != nil {
		return err
	}
	if err := c.Put(path+"/skip", nil); err != nil {
		return err
	}
	if c.LastStatus == 200 {
		data, errD := c.dataObject()
		if errD != nil {
			return errD
		}
		c.CurrentSessionUUID, _ = data["uuid"].(string)
	}
	return nil
}

// theSessionForWorkoutIsInProgress is a Given step that starts the session
// and asserts it's now in_progress.
func (c *TestClient) theSessionForWorkoutIsInProgress(workoutName string) error {
	if err := c.iStartTheSessionForWorkout(workoutName); err != nil {
		return err
	}
	if c.LastStatus != 200 {
		return fmt.Errorf("expected 200 starting session for workout %q, got %d: %s",
			workoutName, c.LastStatus, string(c.LastRawBody))
	}
	return nil
}

// --- Set logging ---

func (c *TestClient) currentSessionLogPath() (string, error) {
	if c.CurrentCycleUUID == "" {
		return "", fmt.Errorf("no current cycle UUID set")
	}
	if c.CurrentSessionUUID == "" {
		return "", fmt.Errorf("no current session UUID set")
	}
	return "/api/v1/cycles/" + c.CurrentCycleUUID + "/sessions/" + c.CurrentSessionUUID + "/sets", nil
}

func (c *TestClient) iLogASetForSectionExercise(exerciseName, sectionName string, table *godog.Table) error {
	key := exerciseName + ":" + sectionName
	seUUID, ok := c.SectionExerciseUUIDs[key]
	if !ok {
		return fmt.Errorf("no UUID stored for section exercise %q in section %q", exerciseName, sectionName)
	}

	path, err := c.currentSessionLogPath()
	if err != nil {
		return err
	}

	body := c.logSetBodyFromTable(table)
	body["section_exercise_uuid"] = seUUID

	if err := c.Post(path, body); err != nil {
		return err
	}
	if c.LastStatus == 201 {
		c.captureSetLogUUIDs()
	}
	return nil
}

func (c *TestClient) iLogASetForSectionExerciseSubstituting(exerciseName, sectionName, substituteExerciseName string, table *godog.Table) error {
	key := exerciseName + ":" + sectionName
	seUUID, ok := c.SectionExerciseUUIDs[key]
	if !ok {
		return fmt.Errorf("no UUID stored for section exercise %q in section %q", exerciseName, sectionName)
	}
	subUUID, ok := c.ExerciseUUIDs[substituteExerciseName]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", substituteExerciseName)
	}

	path, err := c.currentSessionLogPath()
	if err != nil {
		return err
	}

	body := c.logSetBodyFromTable(table)
	body["section_exercise_uuid"] = seUUID
	body["exercise_uuid"] = subUUID

	if err := c.Post(path, body); err != nil {
		return err
	}
	if c.LastStatus == 201 {
		c.captureSetLogUUIDs()
	}
	return nil
}

func (c *TestClient) iLogAnAdHocSetForExercise(exerciseName string, table *godog.Table) error {
	exerciseUUID, ok := c.ExerciseUUIDs[exerciseName]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", exerciseName)
	}

	path, err := c.currentSessionLogPath()
	if err != nil {
		return err
	}

	body := c.logSetBodyFromTable(table)
	body["exercise_uuid"] = exerciseUUID

	if err := c.Post(path, body); err != nil {
		return err
	}
	if c.LastStatus == 201 {
		c.captureSetLogUUIDs()
	}
	return nil
}

// logSetBodyFromTable converts a godog table to a LogSetRequest body map.
func (c *TestClient) logSetBodyFromTable(table *godog.Table) map[string]any {
	fields := tableToMap(table)
	body := map[string]any{}
	for k, v := range fields {
		if intVal, err := strconv.ParseInt(v, 10, 64); err == nil {
			body[k] = intVal
		} else if floatVal, err := strconv.ParseFloat(v, 64); err == nil {
			body[k] = floatVal
		} else {
			body[k] = v
		}
	}
	return body
}

// captureSetLogUUIDs saves the UUID and exercise_uuid from a set log response.
func (c *TestClient) captureSetLogUUIDs() {
	data, err := c.dataObject()
	if err != nil {
		return
	}
	c.LastSetLogUUID, _ = data["uuid"].(string)
	c.LastSetLogExerciseUUID, _ = data["exercise_uuid"].(string)
}

func (c *TestClient) theSetLogExerciseShouldBe(exerciseName string) error {
	expected, ok := c.ExerciseUUIDs[exerciseName]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", exerciseName)
	}
	if c.LastSetLogExerciseUUID == "" {
		return fmt.Errorf("no set log exercise UUID captured")
	}
	if c.LastSetLogExerciseUUID != expected {
		return fmt.Errorf("expected exercise UUID %q (%s), got %q", expected, exerciseName, c.LastSetLogExerciseUUID)
	}
	return nil
}

// --- Session detail ---

func (c *TestClient) iGetTheSessionForWorkout(workoutName string) error {
	path, err := c.sessionPath(workoutName)
	if err != nil {
		return err
	}
	return c.Get(path)
}

func (c *TestClient) theSessionShouldHaveSections(count int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	sections, ok := data["sections"].([]any)
	if !ok {
		if count == 0 {
			return nil
		}
		return fmt.Errorf("response has no 'sections' array: %s", string(c.LastRawBody))
	}
	if len(sections) != count {
		return fmt.Errorf("expected %d sections, got %d", count, len(sections))
	}
	return nil
}

func (c *TestClient) theSessionFirstSectionShouldHaveExercises(count int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	sections, ok := data["sections"].([]any)
	if !ok || len(sections) == 0 {
		return fmt.Errorf("response has no sections")
	}
	section, ok := sections[0].(map[string]any)
	if !ok {
		return fmt.Errorf("first section is not an object")
	}
	exercises, ok := section["exercises"].([]any)
	if !ok {
		if count == 0 {
			return nil
		}
		return fmt.Errorf("first section has no 'exercises' array")
	}
	if len(exercises) != count {
		return fmt.Errorf("expected %d exercises, got %d", count, len(exercises))
	}
	return nil
}

func (c *TestClient) theExerciseShouldHaveComputedTargetWeight(exerciseName, weightStr string) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}

	expected, err := strconv.ParseFloat(weightStr, 64)
	if err != nil {
		return fmt.Errorf("invalid weight %q: %w", weightStr, err)
	}

	ex, err := c.findExerciseInSessionDetail(data, exerciseName)
	if err != nil {
		return err
	}

	val, ok := ex["computed_target_weight"].(float64)
	if !ok {
		return fmt.Errorf("exercise %q has no computed_target_weight (body: %s)", exerciseName, string(c.LastRawBody))
	}
	if val != expected {
		return fmt.Errorf("expected computed_target_weight %g for %q, got %g", expected, exerciseName, val)
	}
	return nil
}

func (c *TestClient) theExerciseShouldHaveLoggedSets(exerciseName string, count int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}

	ex, err := c.findExerciseInSessionDetail(data, exerciseName)
	if err != nil {
		return err
	}

	setLogs, ok := ex["set_logs"].([]any)
	if !ok {
		if count == 0 {
			return nil
		}
		return fmt.Errorf("exercise %q has no 'set_logs' array", exerciseName)
	}
	if len(setLogs) != count {
		return fmt.Errorf("expected %d set_logs for %q, got %d", count, exerciseName, len(setLogs))
	}
	return nil
}

// findExerciseInSessionDetail walks sections → exercises to find an exercise by name.
func (c *TestClient) findExerciseInSessionDetail(data map[string]any, exerciseName string) (map[string]any, error) {
	sections, ok := data["sections"].([]any)
	if !ok {
		return nil, fmt.Errorf("response has no 'sections' array")
	}
	for _, s := range sections {
		sec, ok := s.(map[string]any)
		if !ok {
			continue
		}
		exercises, ok := sec["exercises"].([]any)
		if !ok {
			continue
		}
		for _, e := range exercises {
			ex, ok := e.(map[string]any)
			if !ok {
				continue
			}
			if ex["exercise_name"] == exerciseName {
				return ex, nil
			}
		}
	}
	return nil, fmt.Errorf("exercise %q not found in session detail", exerciseName)
}

// --- Progression rule setup ---

func (c *TestClient) theExerciseHasALinearProgressionRule(exerciseName, sectionName string, table *godog.Table) error {
	key := exerciseName + ":" + sectionName
	seUUID, ok := c.SectionExerciseUUIDs[key]
	if !ok {
		return fmt.Errorf("no UUID stored for section exercise %q in section %q", exerciseName, sectionName)
	}

	// Look up section_exercise integer ID.
	var seID int64
	err := c.DB.QueryRow("SELECT id FROM section_exercises WHERE uuid = ?", seUUID).Scan(&seID)
	if err != nil {
		return fmt.Errorf("look up section_exercise ID: %w", err)
	}

	fields := tableToMap(table)
	increment, _ := strconv.ParseFloat(fields["increment"], 64)
	deloadThreshold, _ := strconv.Atoi(fields["deload_threshold"])
	deloadPct, _ := strconv.ParseFloat(fields["deload_pct"], 64)

	ruleUUID := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = c.DB.Exec(
		`INSERT INTO progression_rules (uuid, section_exercise_id, strategy, increment, deload_threshold, deload_pct, created_at, updated_at)
		 VALUES (?, ?, 'linear', ?, ?, ?, ?, ?)`,
		ruleUUID, seID, increment, deloadThreshold, deloadPct, now, now,
	)
	if err != nil {
		return fmt.Errorf("insert progression rule: %w", err)
	}
	return nil
}

// --- Compound progression scenario helpers ---

// iSuccessfullyCompleteSessionHittingAllReps starts the session, logs all target sets/reps,
// and completes it. Used in progression scenarios.
func (c *TestClient) iSuccessfullyCompleteSessionHittingAllReps(workoutName, weightStr string) error {
	weight, err := strconv.ParseFloat(weightStr, 64)
	if err != nil {
		return fmt.Errorf("invalid weight %q: %w", weightStr, err)
	}

	if err := c.theSessionForWorkoutIsInProgress(workoutName); err != nil {
		return err
	}

	// Log 3 sets (matching the target_sets=3 from the scenario setup) for each
	// section exercise. We look up all section exercises for sessions in the
	// current workout.
	seUUIDs := c.sectionExerciseUUIDsForWorkout(workoutName)
	path, err := c.currentSessionLogPath()
	if err != nil {
		return err
	}

	targetReps := 5
	for _, seUUID := range seUUIDs {
		for setNum := 1; setNum <= 3; setNum++ {
			body := map[string]any{
				"section_exercise_uuid": seUUID,
				"set_number":            setNum,
				"actual_reps":           targetReps,
				"target_reps":           targetReps,
				"weight":                weight,
			}
			if err := c.Post(path, body); err != nil {
				return fmt.Errorf("log set %d: %w", setNum, err)
			}
			if c.LastStatus != 201 {
				return fmt.Errorf("expected 201 logging set %d, got %d: %s", setNum, c.LastStatus, string(c.LastRawBody))
			}
		}
	}

	// Complete the session.
	sessPath := "/api/v1/cycles/" + c.CurrentCycleUUID + "/sessions/" + c.CurrentSessionUUID
	return c.Put(sessPath+"/complete", nil)
}

// iCompleteSessionMissingReps starts the session, logs sets missing reps (actual < target),
// and completes it. Used in failure/deload progression scenarios.
func (c *TestClient) iCompleteSessionMissingReps(workoutName, exerciseName string) error {
	if err := c.theSessionForWorkoutIsInProgress(workoutName); err != nil {
		return err
	}

	// Log sets for the named exercise with missed reps (actual < target).
	sectionName := c.sectionNameForExercise(exerciseName)
	key := exerciseName + ":" + sectionName
	seUUID, ok := c.SectionExerciseUUIDs[key]
	if !ok {
		// Try to find section_exercise UUID for this exercise across all sections.
		for k, v := range c.SectionExerciseUUIDs {
			if len(k) > len(exerciseName) && k[:len(exerciseName)] == exerciseName {
				seUUID = v
				ok = true
				break
			}
		}
		if !ok {
			return fmt.Errorf("no section exercise UUID found for exercise %q", exerciseName)
		}
	}

	path, err := c.currentSessionLogPath()
	if err != nil {
		return err
	}

	// Log 3 sets with missed reps (actual_reps=3, target_reps=5).
	for setNum := 1; setNum <= 3; setNum++ {
		body := map[string]any{
			"section_exercise_uuid": seUUID,
			"set_number":            setNum,
			"actual_reps":           3,
			"target_reps":           5,
			"weight":                135.0,
		}
		if err := c.Post(path, body); err != nil {
			return fmt.Errorf("log set %d: %w", setNum, err)
		}
		if c.LastStatus != 201 {
			return fmt.Errorf("expected 201 logging set %d, got %d: %s", setNum, c.LastStatus, string(c.LastRawBody))
		}
	}

	// Complete the session.
	sessPath := "/api/v1/cycles/" + c.CurrentCycleUUID + "/sessions/" + c.CurrentSessionUUID
	return c.Put(sessPath+"/complete", nil)
}

// sectionExerciseUUIDsForWorkout returns all section exercise UUIDs that belong
// to the given workout (by looking up sections mapped to that workout).
func (c *TestClient) sectionExerciseUUIDsForWorkout(workoutName string) []string {
	workoutUUID := c.WorkoutUUIDs[workoutName]
	var uuids []string
	for sectionName, sectionWorkoutUUID := range c.SectionWorkoutUUID {
		if sectionWorkoutUUID == workoutUUID {
			// Find all section exercises for this section.
			for key, seUUID := range c.SectionExerciseUUIDs {
				// Key format: "exerciseName:sectionName"
				if len(key) > len(sectionName)+1 {
					suffix := key[len(key)-len(sectionName):]
					if suffix == sectionName {
						_ = seUUID
						uuids = append(uuids, seUUID)
					}
				}
			}
		}
	}
	return uuids
}

// sectionNameForExercise finds the section name that contains the given exercise
// by searching the SectionExerciseUUIDs keys (format: "exerciseName:sectionName").
func (c *TestClient) sectionNameForExercise(exerciseName string) string {
	prefix := exerciseName + ":"
	for key := range c.SectionExerciseUUIDs {
		if len(key) > len(prefix) && key[:len(prefix)] == prefix {
			return key[len(prefix):]
		}
	}
	return ""
}
