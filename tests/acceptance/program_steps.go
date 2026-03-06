package acceptance

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/cucumber/godog"
	"github.com/google/uuid"
)

// InitializeProgramSteps registers program-specific step definitions.
func InitializeProgramSteps(ctx *godog.ScenarioContext, client *TestClient) {
	// Program CRUD
	ctx.Step(`^I create a program with:$`, client.iCreateAProgramWith)
	ctx.Step(`^the following programs exist:$`, client.theFollowingProgramsExist)
	ctx.Step(`^the following prebuilt programs exist:$`, client.theFollowingPrebuiltProgramsExist)
	ctx.Step(`^I list programs$`, client.iListPrograms)
	ctx.Step(`^I list programs with is_template "([^"]*)"$`, client.iListProgramsWithIsTemplate)
	ctx.Step(`^I get the program "([^"]*)"$`, client.iGetTheProgram)
	ctx.Step(`^I update the program "([^"]*)" with:$`, client.iUpdateTheProgramWith)
	ctx.Step(`^I delete the program "([^"]*)"$`, client.iDeleteTheProgram)
	ctx.Step(`^I copy the program "([^"]*)"$`, client.iCopyTheProgram)
	ctx.Step(`^the response should contain (\d+) programs?$`, client.theResponseShouldContainPrograms)

	// Workout steps
	ctx.Step(`^the program "([^"]*)" has a workout:$`, client.theProgramHasAWorkout)
	ctx.Step(`^I add a workout to program "([^"]*)" with:$`, client.iAddAWorkoutToProgramWith)
	ctx.Step(`^I update the workout "([^"]*)" with:$`, client.iUpdateTheWorkoutWith)
	ctx.Step(`^I delete the workout "([^"]*)"$`, client.iDeleteTheWorkout)
	ctx.Step(`^I reorder workouts for program "([^"]*)" to "([^"]*)"$`, client.iReorderWorkoutsForProgramTo)

	// Section steps
	ctx.Step(`^the workout "([^"]*)" has a section:$`, client.theWorkoutHasASection)
	ctx.Step(`^I add a section to workout "([^"]*)" with:$`, client.iAddASectionToWorkoutWith)
	ctx.Step(`^I reorder sections for workout "([^"]*)" to "([^"]*)"$`, client.iReorderSectionsForWorkoutTo)

	// Section exercise steps
	ctx.Step(`^the section "([^"]*)" has exercise "([^"]*)" with:$`, client.theSectionHasExerciseWith)
	ctx.Step(`^I add exercise "([^"]*)" to section "([^"]*)" with:$`, client.iAddExerciseToSectionWith)
	ctx.Step(`^I update section exercise "([^"]*)" in section "([^"]*)" with:$`, client.iUpdateSectionExerciseInSectionWith)
	ctx.Step(`^I remove exercise "([^"]*)" from section "([^"]*)"$`, client.iRemoveExerciseFromSection)
	ctx.Step(`^I reorder exercises in section "([^"]*)" to "([^"]*)"$`, client.iReorderExercisesInSectionTo)

	// Active cycle lock
	ctx.Step(`^the program "([^"]*)" has an active cycle$`, client.theProgramHasAnActiveCycle)

	// Tree assertions
	ctx.Step(`^the response should have (\d+) workouts?$`, client.theResponseShouldHaveWorkouts)
	ctx.Step(`^the first workout should have (\d+) sections?$`, client.theFirstWorkoutShouldHaveSections)
	ctx.Step(`^the first section should have (\d+) exercises?$`, client.theFirstSectionShouldHaveExercises)
}

// --- Program CRUD ---

func (c *TestClient) iCreateAProgramWith(table *godog.Table) error {
	body := tableToMap(table)
	return c.Post("/api/v1/programs", body)
}

func (c *TestClient) theFollowingProgramsExist(table *godog.Table) error {
	rows := tableToMapSlice(table)
	for _, row := range rows {
		body := map[string]any{
			"name":        row["name"],
			"is_template": parseBool(row["is_template"], false),
		}
		if desc, ok := row["description"]; ok && desc != "" {
			body["description"] = desc
		}

		if err := c.Post("/api/v1/programs", body); err != nil {
			return fmt.Errorf("create program %q: %w", row["name"], err)
		}
		if c.LastStatus != 201 {
			return fmt.Errorf("expected 201 creating program %q, got %d: %s", row["name"], c.LastStatus, string(c.LastRawBody))
		}

		data, err := c.dataObject()
		if err != nil {
			return fmt.Errorf("parse created program %q: %w", row["name"], err)
		}
		c.ProgramUUIDs[row["name"]] = data["uuid"].(string)
	}
	return nil
}

func (c *TestClient) theFollowingPrebuiltProgramsExist(table *godog.Table) error {
	rows := tableToMapSlice(table)
	for _, row := range rows {
		programUUID := uuid.NewString()
		now := time.Now().UTC().Format(time.RFC3339)
		_, err := c.DB.Exec(
			`INSERT INTO programs (uuid, name, is_template, is_prebuilt, created_at, updated_at)
			 VALUES (?, ?, 0, 1, ?, ?)`,
			programUUID, row["name"], now, now,
		)
		if err != nil {
			return fmt.Errorf("insert prebuilt program %q: %w", row["name"], err)
		}
		c.ProgramUUIDs[row["name"]] = programUUID
	}
	return nil
}

func (c *TestClient) iListPrograms() error {
	return c.Get("/api/v1/programs")
}

func (c *TestClient) iListProgramsWithIsTemplate(val string) error {
	return c.Get("/api/v1/programs?is_template=" + val)
}

func (c *TestClient) iGetTheProgram(name string) error {
	id, ok := c.ProgramUUIDs[name]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", name)
	}
	return c.Get("/api/v1/programs/" + id)
}

func (c *TestClient) iUpdateTheProgramWith(name string, table *godog.Table) error {
	id, ok := c.ProgramUUIDs[name]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", name)
	}
	body := tableToMap(table)
	return c.Put("/api/v1/programs/"+id, body)
}

func (c *TestClient) iDeleteTheProgram(name string) error {
	id, ok := c.ProgramUUIDs[name]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", name)
	}
	return c.Delete("/api/v1/programs/" + id)
}

func (c *TestClient) iCopyTheProgram(name string) error {
	id, ok := c.ProgramUUIDs[name]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", name)
	}
	return c.Post("/api/v1/programs/"+id+"/copy", nil)
}

func (c *TestClient) theResponseShouldContainPrograms(count int) error {
	data, err := c.dataArray()
	if err != nil {
		return err
	}
	if len(data) != count {
		return fmt.Errorf("expected %d programs, got %d", count, len(data))
	}
	return nil
}

// --- Workouts ---

func (c *TestClient) theProgramHasAWorkout(programName string, table *godog.Table) error {
	programUUID, ok := c.ProgramUUIDs[programName]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", programName)
	}

	fields := tableToMap(table)
	body := map[string]any{
		"name": fields["name"],
	}
	if dn, ok := fields["day_number"]; ok {
		v, _ := strconv.Atoi(dn)
		body["day_number"] = v
	}

	if err := c.Post("/api/v1/programs/"+programUUID+"/workouts", body); err != nil {
		return fmt.Errorf("create workout: %w", err)
	}
	if c.LastStatus != 201 {
		return fmt.Errorf("expected 201 creating workout, got %d: %s", c.LastStatus, string(c.LastRawBody))
	}

	data, err := c.dataObject()
	if err != nil {
		return err
	}
	workoutName := fields["name"]
	c.WorkoutUUIDs[workoutName] = data["uuid"].(string)
	c.WorkoutProgramUUID[workoutName] = programUUID
	return nil
}

func (c *TestClient) iAddAWorkoutToProgramWith(programName string, table *godog.Table) error {
	programUUID, ok := c.ProgramUUIDs[programName]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", programName)
	}

	fields := tableToMap(table)
	body := map[string]any{
		"name": fields["name"],
	}
	if dn, ok := fields["day_number"]; ok {
		v, _ := strconv.Atoi(dn)
		body["day_number"] = v
	}

	return c.Post("/api/v1/programs/"+programUUID+"/workouts", body)
}

func (c *TestClient) iUpdateTheWorkoutWith(workoutName string, table *godog.Table) error {
	workoutUUID, ok := c.WorkoutUUIDs[workoutName]
	if !ok {
		return fmt.Errorf("no UUID stored for workout %q", workoutName)
	}
	programUUID, ok := c.WorkoutProgramUUID[workoutName]
	if !ok {
		return fmt.Errorf("no program UUID stored for workout %q", workoutName)
	}

	body := tableToMap(table)
	return c.Put("/api/v1/programs/"+programUUID+"/workouts/"+workoutUUID, body)
}

func (c *TestClient) iDeleteTheWorkout(workoutName string) error {
	workoutUUID, ok := c.WorkoutUUIDs[workoutName]
	if !ok {
		return fmt.Errorf("no UUID stored for workout %q", workoutName)
	}
	programUUID, ok := c.WorkoutProgramUUID[workoutName]
	if !ok {
		return fmt.Errorf("no program UUID stored for workout %q", workoutName)
	}

	return c.Delete("/api/v1/programs/" + programUUID + "/workouts/" + workoutUUID)
}

func (c *TestClient) iReorderWorkoutsForProgramTo(programName, order string) error {
	programUUID, ok := c.ProgramUUIDs[programName]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", programName)
	}

	names := strings.Split(order, ",")
	uuids := make([]string, len(names))
	for i, name := range names {
		u, ok := c.WorkoutUUIDs[strings.TrimSpace(name)]
		if !ok {
			return fmt.Errorf("no UUID stored for workout %q", strings.TrimSpace(name))
		}
		uuids[i] = u
	}

	return c.Put("/api/v1/programs/"+programUUID+"/workouts/reorder", map[string]any{
		"uuids": uuids,
	})
}

// --- Sections ---

func (c *TestClient) theWorkoutHasASection(workoutName string, table *godog.Table) error {
	workoutUUID, ok := c.WorkoutUUIDs[workoutName]
	if !ok {
		return fmt.Errorf("no UUID stored for workout %q", workoutName)
	}
	programUUID, ok := c.WorkoutProgramUUID[workoutName]
	if !ok {
		return fmt.Errorf("no program UUID stored for workout %q", workoutName)
	}

	fields := tableToMap(table)
	body := map[string]any{
		"name": fields["name"],
	}
	if rs, ok := fields["rest_seconds"]; ok {
		v, _ := strconv.Atoi(rs)
		body["rest_seconds"] = v
	}

	if err := c.Post("/api/v1/programs/"+programUUID+"/workouts/"+workoutUUID+"/sections", body); err != nil {
		return fmt.Errorf("create section: %w", err)
	}
	if c.LastStatus != 201 {
		return fmt.Errorf("expected 201 creating section, got %d: %s", c.LastStatus, string(c.LastRawBody))
	}

	data, err := c.dataObject()
	if err != nil {
		return err
	}
	sectionName := fields["name"]
	c.SectionUUIDs[sectionName] = data["uuid"].(string)
	c.SectionWorkoutUUID[sectionName] = workoutUUID
	return nil
}

func (c *TestClient) iAddASectionToWorkoutWith(workoutName string, table *godog.Table) error {
	workoutUUID, ok := c.WorkoutUUIDs[workoutName]
	if !ok {
		return fmt.Errorf("no UUID stored for workout %q", workoutName)
	}
	programUUID, ok := c.WorkoutProgramUUID[workoutName]
	if !ok {
		return fmt.Errorf("no program UUID stored for workout %q", workoutName)
	}

	fields := tableToMap(table)
	body := map[string]any{
		"name": fields["name"],
	}

	return c.Post("/api/v1/programs/"+programUUID+"/workouts/"+workoutUUID+"/sections", body)
}

func (c *TestClient) iReorderSectionsForWorkoutTo(workoutName, order string) error {
	workoutUUID, ok := c.WorkoutUUIDs[workoutName]
	if !ok {
		return fmt.Errorf("no UUID stored for workout %q", workoutName)
	}
	programUUID, ok := c.WorkoutProgramUUID[workoutName]
	if !ok {
		return fmt.Errorf("no program UUID stored for workout %q", workoutName)
	}

	names := strings.Split(order, ",")
	uuids := make([]string, len(names))
	for i, name := range names {
		u, ok := c.SectionUUIDs[strings.TrimSpace(name)]
		if !ok {
			return fmt.Errorf("no UUID stored for section %q", strings.TrimSpace(name))
		}
		uuids[i] = u
	}

	return c.Put("/api/v1/programs/"+programUUID+"/workouts/"+workoutUUID+"/sections/reorder", map[string]any{
		"uuids": uuids,
	})
}

// --- Section Exercises ---

func (c *TestClient) sectionExercisePath(sectionName string) (string, error) {
	sectionUUID, ok := c.SectionUUIDs[sectionName]
	if !ok {
		return "", fmt.Errorf("no UUID stored for section %q", sectionName)
	}
	workoutUUID, ok := c.SectionWorkoutUUID[sectionName]
	if !ok {
		return "", fmt.Errorf("no workout UUID stored for section %q", sectionName)
	}

	// Find program UUID for this workout.
	var programUUID string
	for wName, wUUID := range c.WorkoutUUIDs {
		if wUUID == workoutUUID {
			programUUID = c.WorkoutProgramUUID[wName]
			break
		}
	}
	if programUUID == "" {
		return "", fmt.Errorf("no program UUID found for workout %q", workoutUUID)
	}

	return "/api/v1/programs/" + programUUID + "/workouts/" + workoutUUID + "/sections/" + sectionUUID + "/exercises", nil
}

func (c *TestClient) theSectionHasExerciseWith(sectionName, exerciseName string, table *godog.Table) error {
	basePath, err := c.sectionExercisePath(sectionName)
	if err != nil {
		return err
	}
	exerciseUUID, ok := c.ExerciseUUIDs[exerciseName]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", exerciseName)
	}

	fields := tableToMap(table)
	body := map[string]any{
		"exercise_uuid": exerciseUUID,
	}
	for k, v := range fields {
		if val, err := strconv.ParseFloat(v, 64); err == nil {
			body[k] = val
		} else {
			body[k] = v
		}
	}

	if err := c.Post(basePath, body); err != nil {
		return fmt.Errorf("add exercise to section: %w", err)
	}
	if c.LastStatus != 201 {
		return fmt.Errorf("expected 201 adding exercise to section, got %d: %s", c.LastStatus, string(c.LastRawBody))
	}

	data, errD := c.dataObject()
	if errD != nil {
		return errD
	}
	key := exerciseName + ":" + sectionName
	c.SectionExerciseUUIDs[key] = data["uuid"].(string)
	return nil
}

func (c *TestClient) iAddExerciseToSectionWith(exerciseName, sectionName string, table *godog.Table) error {
	basePath, err := c.sectionExercisePath(sectionName)
	if err != nil {
		return err
	}
	exerciseUUID, ok := c.ExerciseUUIDs[exerciseName]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", exerciseName)
	}

	fields := tableToMap(table)
	body := map[string]any{
		"exercise_uuid": exerciseUUID,
	}
	for k, v := range fields {
		if val, err := strconv.ParseFloat(v, 64); err == nil {
			body[k] = val
		} else {
			body[k] = v
		}
	}

	return c.Post(basePath, body)
}

func (c *TestClient) iUpdateSectionExerciseInSectionWith(exerciseName, sectionName string, table *godog.Table) error {
	basePath, err := c.sectionExercisePath(sectionName)
	if err != nil {
		return err
	}
	key := exerciseName + ":" + sectionName
	seUUID, ok := c.SectionExerciseUUIDs[key]
	if !ok {
		return fmt.Errorf("no UUID stored for section exercise %q", key)
	}

	fields := tableToMap(table)
	body := map[string]any{}
	for k, v := range fields {
		if val, err := strconv.ParseFloat(v, 64); err == nil {
			body[k] = val
		} else {
			body[k] = v
		}
	}

	return c.Put(basePath+"/"+seUUID, body)
}

func (c *TestClient) iRemoveExerciseFromSection(exerciseName, sectionName string) error {
	basePath, err := c.sectionExercisePath(sectionName)
	if err != nil {
		return err
	}
	key := exerciseName + ":" + sectionName
	seUUID, ok := c.SectionExerciseUUIDs[key]
	if !ok {
		return fmt.Errorf("no UUID stored for section exercise %q", key)
	}

	return c.Delete(basePath + "/" + seUUID)
}

func (c *TestClient) iReorderExercisesInSectionTo(sectionName, order string) error {
	basePath, err := c.sectionExercisePath(sectionName)
	if err != nil {
		return err
	}

	names := strings.Split(order, ",")
	uuids := make([]string, len(names))
	for i, name := range names {
		key := strings.TrimSpace(name) + ":" + sectionName
		u, ok := c.SectionExerciseUUIDs[key]
		if !ok {
			return fmt.Errorf("no UUID stored for section exercise %q", key)
		}
		uuids[i] = u
	}

	return c.Put(basePath+"/reorder", map[string]any{
		"uuids": uuids,
	})
}

// --- Active cycle lock ---

func (c *TestClient) theProgramHasAnActiveCycle(programName string) error {
	programUUID, ok := c.ProgramUUIDs[programName]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", programName)
	}

	// Look up the program's integer ID for the FK.
	var programID int64
	err := c.DB.QueryRow(
		"SELECT id FROM programs WHERE uuid = ?", programUUID,
	).Scan(&programID)
	if err != nil {
		return fmt.Errorf("look up program ID: %w", err)
	}

	// Insert a cycle directly via SQL (cycle API is Step 4).
	cycleUUID := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = c.DB.Exec(
		`INSERT INTO cycles (uuid, program_id, status, started_at, created_at, updated_at)
		 VALUES (?, ?, 'active', ?, ?, ?)`,
		cycleUUID, programID, now, now, now,
	)
	if err != nil {
		return fmt.Errorf("insert active cycle: %w", err)
	}
	return nil
}

// --- Tree assertions ---

func (c *TestClient) theResponseShouldHaveWorkouts(count int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	workouts, ok := data["workouts"].([]any)
	if !ok {
		if count == 0 {
			return nil
		}
		return fmt.Errorf("response has no 'workouts' array")
	}
	if len(workouts) != count {
		return fmt.Errorf("expected %d workouts, got %d", count, len(workouts))
	}
	return nil
}

func (c *TestClient) theFirstWorkoutShouldHaveSections(count int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	workouts, ok := data["workouts"].([]any)
	if !ok || len(workouts) == 0 {
		return fmt.Errorf("no workouts in response")
	}
	workout, ok := workouts[0].(map[string]any)
	if !ok {
		return fmt.Errorf("first workout is not an object")
	}
	sections, ok := workout["sections"].([]any)
	if !ok {
		if count == 0 {
			return nil
		}
		return fmt.Errorf("first workout has no 'sections' array")
	}
	if len(sections) != count {
		return fmt.Errorf("expected %d sections, got %d", count, len(sections))
	}
	return nil
}

func (c *TestClient) theFirstSectionShouldHaveExercises(count int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	workouts, ok := data["workouts"].([]any)
	if !ok || len(workouts) == 0 {
		return fmt.Errorf("no workouts in response")
	}
	workout, ok := workouts[0].(map[string]any)
	if !ok {
		return fmt.Errorf("first workout is not an object")
	}
	sections, ok := workout["sections"].([]any)
	if !ok || len(sections) == 0 {
		return fmt.Errorf("no sections in first workout")
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
