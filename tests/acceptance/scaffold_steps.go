package acceptance

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/cucumber/godog"
)

// InitializeScaffoldSteps registers scaffold-specific step definitions
// (used by the set_schemes.feature for creating programs via POST /api/v1/programs/scaffold).
func InitializeScaffoldSteps(ctx *godog.ScenarioContext, client *TestClient) {
	ctx.Step(`^I scaffold a program with:$`, client.iScaffoldAProgramWith)
	ctx.Step(`^I get the scaffolded program$`, client.iGetTheScaffoldedProgram)
	ctx.Step(`^I copy the scaffolded program$`, client.iCopyTheScaffoldedProgram)
	ctx.Step(`^the first exercise should have a set scheme of type "([^"]*)"$`, client.theFirstExerciseShouldHaveSchemeType)
	ctx.Step(`^the first exercise set scheme should have (\d+) sets$`, client.theFirstExerciseSchemeShouldHaveSets)
	ctx.Step(`^the first exercise set scheme should have one_rep_max (\d+)$`, client.theFirstExerciseSchemeShouldHaveOneRepMax)
	ctx.Step(`^the first exercise set scheme should have week (\d+)$`, client.theFirstExerciseSchemeShouldHaveWeek)
	ctx.Step(`^the first exercise should not have a set scheme$`, client.theFirstExerciseShouldNotHaveScheme)
}

// iScaffoldAProgramWith sends a POST to /api/v1/programs/scaffold with the
// given JSON body. Exercise UUIDs referenced as {{ExerciseName}} are replaced
// with the real UUID stored in ExerciseUUIDs.
func (c *TestClient) iScaffoldAProgramWith(body *godog.DocString) error {
	// Replace {{ExerciseName}} placeholders with actual UUIDs.
	raw := body.Content
	for name, uuid := range c.ExerciseUUIDs {
		raw = strings.ReplaceAll(raw, "{{"+name+"}}", uuid)
	}

	// Parse the JSON into a map so we can send it via Post.
	var parsed map[string]any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return fmt.Errorf("parse scaffold body: %w", err)
	}

	if err := c.Post("/api/v1/programs/scaffold", parsed); err != nil {
		return fmt.Errorf("scaffold program: %w", err)
	}

	// If successful, store the program UUID for later retrieval.
	if c.LastStatus == 201 {
		data, err := c.dataObject()
		if err != nil {
			return err
		}
		uuid, ok := data["uuid"].(string)
		if !ok {
			return fmt.Errorf("scaffold response has no uuid")
		}
		c.ScaffoldedProgramUUID = uuid
	}

	return nil
}

// iGetTheScaffoldedProgram fetches the full program tree for the last
// scaffolded program.
func (c *TestClient) iGetTheScaffoldedProgram() error {
	if c.ScaffoldedProgramUUID == "" {
		return fmt.Errorf("no scaffolded program UUID stored")
	}
	return c.Get("/api/v1/programs/" + c.ScaffoldedProgramUUID)
}

// iCopyTheScaffoldedProgram deep-copies the last scaffolded program.
func (c *TestClient) iCopyTheScaffoldedProgram() error {
	if c.ScaffoldedProgramUUID == "" {
		return fmt.Errorf("no scaffolded program UUID stored")
	}
	return c.Post("/api/v1/programs/"+c.ScaffoldedProgramUUID+"/copy", nil)
}

// firstExerciseFromTree navigates the program tree response to extract
// the first exercise object: data.workouts[0].sections[0].exercises[0].
func (c *TestClient) firstExerciseFromTree() (map[string]any, error) {
	data, err := c.dataObject()
	if err != nil {
		return nil, err
	}

	workouts, ok := data["workouts"].([]any)
	if !ok || len(workouts) == 0 {
		return nil, fmt.Errorf("response has no workouts")
	}
	workout, ok := workouts[0].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("first workout is not an object")
	}

	sections, ok := workout["sections"].([]any)
	if !ok || len(sections) == 0 {
		return nil, fmt.Errorf("first workout has no sections")
	}
	section, ok := sections[0].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("first section is not an object")
	}

	exercises, ok := section["exercises"].([]any)
	if !ok || len(exercises) == 0 {
		return nil, fmt.Errorf("first section has no exercises")
	}
	exercise, ok := exercises[0].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("first exercise is not an object")
	}

	return exercise, nil
}

// theFirstExerciseShouldHaveSchemeType asserts that the first exercise in the
// program tree has a set_scheme with the given type.
func (c *TestClient) theFirstExerciseShouldHaveSchemeType(expectedType string) error {
	exercise, err := c.firstExerciseFromTree()
	if err != nil {
		return err
	}

	scheme, ok := exercise["set_scheme"].(map[string]any)
	if !ok {
		return fmt.Errorf("first exercise has no set_scheme (response: %v)", exercise)
	}

	actualType, ok := scheme["type"].(string)
	if !ok {
		return fmt.Errorf("set_scheme has no 'type' field")
	}
	if actualType != expectedType {
		return fmt.Errorf("expected set_scheme type %q, got %q", expectedType, actualType)
	}
	return nil
}

// theFirstExerciseSchemeShouldHaveSets asserts the set count.
func (c *TestClient) theFirstExerciseSchemeShouldHaveSets(expected int) error {
	exercise, err := c.firstExerciseFromTree()
	if err != nil {
		return err
	}

	scheme, ok := exercise["set_scheme"].(map[string]any)
	if !ok {
		return fmt.Errorf("first exercise has no set_scheme")
	}

	sets, ok := scheme["sets"].([]any)
	if !ok {
		return fmt.Errorf("set_scheme has no 'sets' array")
	}
	if len(sets) != expected {
		return fmt.Errorf("expected %d scheme sets, got %d", expected, len(sets))
	}
	return nil
}

// theFirstExerciseSchemeShouldHaveOneRepMax asserts the one_rep_max value.
func (c *TestClient) theFirstExerciseSchemeShouldHaveOneRepMax(expected int) error {
	exercise, err := c.firstExerciseFromTree()
	if err != nil {
		return err
	}

	scheme, ok := exercise["set_scheme"].(map[string]any)
	if !ok {
		return fmt.Errorf("first exercise has no set_scheme")
	}

	val, ok := scheme["one_rep_max"].(float64)
	if !ok {
		return fmt.Errorf("set_scheme has no 'one_rep_max' field")
	}
	if int(val) != expected {
		return fmt.Errorf("expected one_rep_max %d, got %v", expected, val)
	}
	return nil
}

// theFirstExerciseSchemeShouldHaveWeek asserts the week value.
func (c *TestClient) theFirstExerciseSchemeShouldHaveWeek(expected int) error {
	exercise, err := c.firstExerciseFromTree()
	if err != nil {
		return err
	}

	scheme, ok := exercise["set_scheme"].(map[string]any)
	if !ok {
		return fmt.Errorf("first exercise has no set_scheme")
	}

	val, ok := scheme["week"].(float64)
	if !ok {
		return fmt.Errorf("set_scheme has no 'week' field")
	}
	if int(val) != expected {
		return fmt.Errorf("expected week %d, got %v", expected, val)
	}
	return nil
}

// theFirstExerciseShouldNotHaveScheme asserts set_scheme is absent or null.
func (c *TestClient) theFirstExerciseShouldNotHaveScheme() error {
	exercise, err := c.firstExerciseFromTree()
	if err != nil {
		return err
	}

	scheme, exists := exercise["set_scheme"]
	if exists && scheme != nil {
		return fmt.Errorf("expected no set_scheme, but got: %v", scheme)
	}
	return nil
}
