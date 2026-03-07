package acceptance

import (
	"fmt"
	"strconv"

	"github.com/cucumber/godog"
)

// InitializeProgressSteps registers progress tracking step definitions.
func InitializeProgressSteps(ctx *godog.ScenarioContext, client *TestClient) {
	// Exercise history
	ctx.Step(`^I get the history for exercise "([^"]*)"$`, client.iGetTheHistoryForExercise)
	ctx.Step(`^the history should have (\d+) entr(?:y|ies)$`, client.theHistoryShouldHaveEntries)
	ctx.Step(`^the first history entry should have weight (\S+)$`, client.theFirstHistoryEntryShouldHaveWeight)

	// Personal record
	ctx.Step(`^I get the record for exercise "([^"]*)"$`, client.iGetTheRecordForExercise)
	ctx.Step(`^the record weight should be (\S+)$`, client.theRecordWeightShouldBe)

	// Summary
	ctx.Step(`^I get the progress summary$`, client.iGetTheProgressSummary)
	ctx.Step(`^the summary total_sessions should be (\d+)$`, client.theSummaryTotalSessionsShouldBe)
	ctx.Step(`^the current_streak should be (\d+)$`, client.theCurrentStreakShouldBe)
}

// --- Exercise history ---

func (c *TestClient) iGetTheHistoryForExercise(exerciseName string) error {
	uuid, ok := c.ExerciseUUIDs[exerciseName]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", exerciseName)
	}
	return c.Get("/api/v1/exercises/" + uuid + "/history")
}

func (c *TestClient) theHistoryShouldHaveEntries(count int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	history, ok := data["history"].([]any)
	if !ok {
		if count == 0 {
			return nil
		}
		return fmt.Errorf("response has no 'history' array: %s", string(c.LastRawBody))
	}
	if len(history) != count {
		return fmt.Errorf("expected %d history entries, got %d", count, len(history))
	}
	return nil
}

func (c *TestClient) theFirstHistoryEntryShouldHaveWeight(weightStr string) error {
	expected, err := strconv.ParseFloat(weightStr, 64)
	if err != nil {
		return fmt.Errorf("invalid weight %q: %w", weightStr, err)
	}

	data, err := c.dataObject()
	if err != nil {
		return err
	}
	history, ok := data["history"].([]any)
	if !ok || len(history) == 0 {
		return fmt.Errorf("response has no history entries")
	}
	entry, ok := history[0].(map[string]any)
	if !ok {
		return fmt.Errorf("first history entry is not an object")
	}
	actual, ok := entry["weight"].(float64)
	if !ok {
		return fmt.Errorf("first history entry has no 'weight' field: %v", entry)
	}
	if actual != expected {
		return fmt.Errorf("expected first history entry weight %g, got %g", expected, actual)
	}
	return nil
}

// --- Personal record ---

func (c *TestClient) iGetTheRecordForExercise(exerciseName string) error {
	uuid, ok := c.ExerciseUUIDs[exerciseName]
	if !ok {
		return fmt.Errorf("no UUID stored for exercise %q", exerciseName)
	}
	return c.Get("/api/v1/exercises/" + uuid + "/record")
}

func (c *TestClient) theRecordWeightShouldBe(weightStr string) error {
	expected, err := strconv.ParseFloat(weightStr, 64)
	if err != nil {
		return fmt.Errorf("invalid weight %q: %w", weightStr, err)
	}

	data, err := c.dataObject()
	if err != nil {
		return err
	}
	actual, ok := data["weight"].(float64)
	if !ok {
		return fmt.Errorf("response data has no 'weight' field: %s", string(c.LastRawBody))
	}
	if actual != expected {
		return fmt.Errorf("expected record weight %g, got %g", expected, actual)
	}
	return nil
}

// --- Summary ---

func (c *TestClient) iGetTheProgressSummary() error {
	return c.Get("/api/v1/progress/summary")
}

func (c *TestClient) theSummaryTotalSessionsShouldBe(expected int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	// JSON numbers decode as float64.
	actual, ok := data["total_sessions"].(float64)
	if !ok {
		return fmt.Errorf("response data has no 'total_sessions' field: %s", string(c.LastRawBody))
	}
	if int(actual) != expected {
		return fmt.Errorf("expected total_sessions %d, got %d", expected, int(actual))
	}
	return nil
}

func (c *TestClient) theCurrentStreakShouldBe(expected int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	actual, ok := data["current_streak"].(float64)
	if !ok {
		return fmt.Errorf("response data has no 'current_streak' field: %s", string(c.LastRawBody))
	}
	if int(actual) != expected {
		return fmt.Errorf("expected current_streak %d, got %d", expected, int(actual))
	}
	return nil
}
