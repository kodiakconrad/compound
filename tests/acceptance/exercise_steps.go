package acceptance

import (
	"fmt"
	"strings"
	"time"

	"github.com/cucumber/godog"
	"github.com/google/uuid"
)

// InitializeExerciseSteps registers exercise-specific step definitions.
func InitializeExerciseSteps(ctx *godog.ScenarioContext, client *TestClient) {
	ctx.Step(`^I create an exercise with:$`, client.iCreateAnExerciseWith)
	ctx.Step(`^I create an exercise with idempotency key "([^"]*)":$`, client.iCreateAnExerciseWithIdempotencyKey)
	ctx.Step(`^the following exercises exist:$`, client.theFollowingExercisesExist)
	ctx.Step(`^I get the exercise "([^"]*)"$`, client.iGetTheExercise)
	ctx.Step(`^I get an exercise with uuid "([^"]*)"$`, client.iGetAnExerciseWithUUID)
	ctx.Step(`^I list exercises$`, client.iListExercises)
	ctx.Step(`^I list exercises with muscle_group "([^"]*)"$`, client.iListExercisesWithMuscleGroup)
	ctx.Step(`^I search exercises for "([^"]*)"$`, client.iSearchExercisesFor)
	ctx.Step(`^I update the exercise "([^"]*)" with:$`, client.iUpdateTheExerciseWith)
	ctx.Step(`^I delete the exercise "([^"]*)"$`, client.iDeleteTheExercise)
	ctx.Step(`^the response should contain (\d+) exercises?$`, client.theResponseShouldContainExercises)
	ctx.Step(`^the response should include exercise "([^"]*)"$`, client.theResponseShouldIncludeExercise)
	ctx.Step(`^the response uuid should match the previous response$`, client.theResponseUUIDShouldMatchPrevious)

	// Filters
	ctx.Step(`^I get the exercise filters$`, client.iGetTheExerciseFilters)
	ctx.Step(`^the filters should include muscle groups (.+)$`, client.theFiltersShouldIncludeMuscleGroups)
	ctx.Step(`^the filters should include equipment (.+)$`, client.theFiltersShouldIncludeEquipment)
	ctx.Step(`^the filters should include tracking types (.+)$`, client.theFiltersShouldIncludeTrackingTypes)
}

func (c *TestClient) iCreateAnExerciseWith(table *godog.Table) error {
	body := tableToMap(table)
	return c.Post("/api/v1/exercises", body)
}

func (c *TestClient) iCreateAnExerciseWithIdempotencyKey(key string, table *godog.Table) error {
	// Save previous UUID before making the request.
	if c.LastBody != nil {
		if data, ok := c.LastBody["data"].(map[string]any); ok {
			if u, ok := data["uuid"].(string); ok {
				c.PreviousUUID = u
			}
		}
	}

	body := tableToMap(table)
	return c.PostWithHeaders("/api/v1/exercises", body, map[string]string{
		"Idempotency-Key": key,
	})
}

func (c *TestClient) theFollowingExercisesExist(table *godog.Table) error {
	rows := tableToMapSlice(table)
	for _, row := range rows {
		isCustom := parseBool(row["is_custom"], true)

		if !isCustom {
			// Insert prebuilt exercises directly via SQL (POST always sets is_custom=true).
			exerciseUUID := uuid.NewString()
			now := time.Now().UTC().Format(time.RFC3339)
			trackingType := row["tracking_type"]
			if trackingType == "" {
				trackingType = "weight_reps"
			}

			var muscleGroup, equipment *string
			if v, ok := row["muscle_group"]; ok && v != "" {
				muscleGroup = &v
			}
			if v, ok := row["equipment"]; ok && v != "" {
				equipment = &v
			}

			_, err := c.DB.Exec(
				`INSERT INTO exercises (uuid, name, muscle_group, equipment, tracking_type, is_custom, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
				exerciseUUID, row["name"], muscleGroup, equipment, trackingType, now, now,
			)
			if err != nil {
				return fmt.Errorf("insert prebuilt exercise %q: %w", row["name"], err)
			}
			c.ExerciseUUIDs[row["name"]] = exerciseUUID
		} else {
			// Create custom exercises via POST.
			body := make(map[string]string)
			body["name"] = row["name"]
			if v, ok := row["muscle_group"]; ok && v != "" {
				body["muscle_group"] = v
			}
			if v, ok := row["equipment"]; ok && v != "" {
				body["equipment"] = v
			}
			if v, ok := row["tracking_type"]; ok && v != "" {
				body["tracking_type"] = v
			} else {
				body["tracking_type"] = "weight_reps"
			}

			if err := c.Post("/api/v1/exercises", body); err != nil {
				return fmt.Errorf("create exercise %q: %w", row["name"], err)
			}
			if c.LastStatus != 201 {
				return fmt.Errorf("expected 201 creating exercise %q, got %d: %s", row["name"], c.LastStatus, string(c.LastRawBody))
			}

			data, err := c.dataObject()
			if err != nil {
				return fmt.Errorf("parse created exercise %q: %w", row["name"], err)
			}
			c.ExerciseUUIDs[row["name"]] = data["uuid"].(string)
		}
	}
	return nil
}

func (c *TestClient) iGetTheExercise(name string) error {
	uuid, ok := c.ExerciseUUIDs[name]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", name)
	}
	return c.Get("/api/v1/exercises/" + uuid)
}

func (c *TestClient) iGetAnExerciseWithUUID(uuid string) error {
	return c.Get("/api/v1/exercises/" + uuid)
}

func (c *TestClient) iListExercises() error {
	return c.Get("/api/v1/exercises")
}

func (c *TestClient) iListExercisesWithMuscleGroup(muscleGroup string) error {
	return c.Get("/api/v1/exercises?muscle_group=" + muscleGroup)
}

func (c *TestClient) iSearchExercisesFor(term string) error {
	return c.Get("/api/v1/exercises?search=" + term)
}

func (c *TestClient) iUpdateTheExerciseWith(name string, table *godog.Table) error {
	uuid, ok := c.ExerciseUUIDs[name]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", name)
	}
	body := tableToMap(table)
	return c.Put("/api/v1/exercises/"+uuid, body)
}

func (c *TestClient) iDeleteTheExercise(name string) error {
	uuid, ok := c.ExerciseUUIDs[name]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", name)
	}
	return c.Delete("/api/v1/exercises/" + uuid)
}

func (c *TestClient) theResponseShouldContainExercises(count int) error {
	data, err := c.dataArray()
	if err != nil {
		return err
	}
	if len(data) != count {
		return fmt.Errorf("expected %d exercises, got %d", count, len(data))
	}
	return nil
}

func (c *TestClient) theResponseShouldIncludeExercise(name string) error {
	data, err := c.dataArray()
	if err != nil {
		return err
	}
	for _, item := range data {
		exercise, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if exercise["name"] == name {
			return nil
		}
	}
	return fmt.Errorf("exercise %q not found in response", name)
}

func (c *TestClient) theResponseUUIDShouldMatchPrevious() error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	currentUUID, ok := data["uuid"].(string)
	if !ok || currentUUID == "" {
		return fmt.Errorf("current response has no uuid")
	}
	if c.PreviousUUID == "" {
		return fmt.Errorf("no previous UUID stored")
	}
	if currentUUID != c.PreviousUUID {
		return fmt.Errorf("expected uuid %q, got %q", c.PreviousUUID, currentUUID)
	}
	return nil
}

// --- Exercise filters ---

func (c *TestClient) iGetTheExerciseFilters() error {
	return c.Get("/api/v1/exercises/filters")
}

// theFiltersShouldIncludeMuscleGroups checks that the filters response contains
// all the expected muscle group values (provided as a quoted, comma-separated string).
func (c *TestClient) theFiltersShouldIncludeMuscleGroups(valuesStr string) error {
	return c.assertFilterContains("muscle_groups", valuesStr)
}

func (c *TestClient) theFiltersShouldIncludeEquipment(valuesStr string) error {
	return c.assertFilterContains("equipment", valuesStr)
}

func (c *TestClient) theFiltersShouldIncludeTrackingTypes(valuesStr string) error {
	return c.assertFilterContains("tracking_types", valuesStr)
}

// assertFilterContains checks that a filter field contains all the expected values.
// valuesStr is a comma-separated list of quoted values (e.g., `"chest", "back"`).
func (c *TestClient) assertFilterContains(field, valuesStr string) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	arr, ok := data[field].([]any)
	if !ok {
		return fmt.Errorf("filters response missing field %q", field)
	}
	actual := make(map[string]bool, len(arr))
	for _, v := range arr {
		if s, ok := v.(string); ok {
			actual[s] = true
		}
	}
	// Parse expected values: strip quotes and split by ", ".
	parts := strings.Split(valuesStr, ", ")
	for _, part := range parts {
		expected := strings.Trim(strings.TrimSpace(part), `"`)
		if !actual[expected] {
			return fmt.Errorf("filters field %q missing value %q (got: %v)", field, expected, arr)
		}
	}
	return nil
}
