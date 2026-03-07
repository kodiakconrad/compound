package acceptance

import (
	"fmt"

	"github.com/cucumber/godog"
)

// InitializeCycleSteps registers cycle step definitions.
func InitializeCycleSteps(ctx *godog.ScenarioContext, client *TestClient) {
	// Start / create
	ctx.Step(`^I start a cycle from program "([^"]*)"$`, client.iStartACycleFromProgram)
	ctx.Step(`^a cycle is started from program "([^"]*)"$`, client.aCycleIsStartedFromProgram)
	ctx.Step(`^I start a new cycle from program "([^"]*)"$`, client.iStartACycleFromProgram)

	// List
	ctx.Step(`^I list cycles$`, client.iListCycles)
	ctx.Step(`^I list cycles with status "([^"]*)"$`, client.iListCyclesWithStatus)
	ctx.Step(`^the response should contain (\d+) cycles?$`, client.theResponseShouldContainCycles)

	// Get
	ctx.Step(`^I get the cycle for program "([^"]*)"$`, client.iGetTheCycleForProgram)
	ctx.Step(`^the response should have (\d+) sessions?$`, client.theResponseShouldHaveSessions)
	ctx.Step(`^the session should have status "([^"]*)"$`, client.theSessionShouldHaveStatus)
	ctx.Step(`^the cycle should have (\d+) sessions?$`, client.theCycleShouldHaveSessions)

	// Update (state transitions)
	ctx.Step(`^I update the cycle for program "([^"]*)" with status "([^"]*)"$`, client.iUpdateTheCycleForProgramWithStatus)
	ctx.Step(`^the cycle for program "([^"]*)" is paused$`, client.theCycleForProgramIsPaused)
}

// --- Start cycle ---

func (c *TestClient) iStartACycleFromProgram(programName string) error {
	programUUID, ok := c.ProgramUUIDs[programName]
	if !ok {
		return fmt.Errorf("no UUID stored for program %q", programName)
	}

	if err := c.Post("/api/v1/programs/"+programUUID+"/start", nil); err != nil {
		return fmt.Errorf("start cycle: %w", err)
	}

	if c.LastStatus == 201 {
		data, err := c.dataObject()
		if err != nil {
			return err
		}
		cycleUUID := data["uuid"].(string)
		c.CycleUUIDs[programName] = cycleUUID
		c.CurrentCycleUUID = cycleUUID

		// Build workout integer-ID → name reverse map using DB.
		workoutIDToName, err := c.buildWorkoutIDToName()
		if err != nil {
			return fmt.Errorf("build workout id map: %w", err)
		}

		// Populate SessionsByWorkoutName from sessions array in response.
		c.SessionsByWorkoutName = make(map[string]string)
		if sessions, ok := data["sessions"].([]any); ok {
			for _, s := range sessions {
				sess, ok := s.(map[string]any)
				if !ok {
					continue
				}
				sessUUID, _ := sess["uuid"].(string)
				// program_workout_id is a JSON number (float64).
				workoutIDFloat, _ := sess["program_workout_id"].(float64)
				workoutID := int64(workoutIDFloat)
				workoutName := workoutIDToName[workoutID]
				if workoutName != "" && sessUUID != "" {
					c.SessionsByWorkoutName[workoutName] = sessUUID
				}
			}
		}
	}

	return nil
}

// buildWorkoutIDToName queries the DB to build a map of program_workout integer ID → name
// based on the workout UUIDs stored in the client.
func (c *TestClient) buildWorkoutIDToName() (map[int64]string, error) {
	result := make(map[int64]string)
	for name, wUUID := range c.WorkoutUUIDs {
		var id int64
		err := c.DB.QueryRow("SELECT id FROM program_workouts WHERE uuid = ?", wUUID).Scan(&id)
		if err != nil {
			return nil, fmt.Errorf("look up id for workout %q: %w", name, err)
		}
		result[id] = name
	}
	return result, nil
}

// aCycleIsStartedFromProgram is a Given step (background setup) — same as iStartACycleFromProgram
// but asserts success.
func (c *TestClient) aCycleIsStartedFromProgram(programName string) error {
	if err := c.iStartACycleFromProgram(programName); err != nil {
		return err
	}
	if c.LastStatus != 201 {
		return fmt.Errorf("expected 201 starting cycle for program %q, got %d: %s",
			programName, c.LastStatus, string(c.LastRawBody))
	}
	return nil
}

// --- List cycles ---

func (c *TestClient) iListCycles() error {
	return c.Get("/api/v1/cycles")
}

func (c *TestClient) iListCyclesWithStatus(status string) error {
	return c.Get("/api/v1/cycles?status=" + status)
}

func (c *TestClient) theResponseShouldContainCycles(count int) error {
	// List cycles returns {"data": {"cycles": [...], "page": {...}}}.
	obj, err := c.dataObject()
	if err != nil {
		return err
	}
	cycles, ok := obj["cycles"].([]any)
	if !ok {
		if count == 0 {
			return nil
		}
		return fmt.Errorf("response has no 'cycles' array: %s", string(c.LastRawBody))
	}
	if len(cycles) != count {
		return fmt.Errorf("expected %d cycles, got %d", count, len(cycles))
	}
	return nil
}

// --- Get cycle ---

func (c *TestClient) iGetTheCycleForProgram(programName string) error {
	cycleUUID, ok := c.CycleUUIDs[programName]
	if !ok {
		return fmt.Errorf("no cycle UUID stored for program %q", programName)
	}
	return c.Get("/api/v1/cycles/" + cycleUUID)
}

func (c *TestClient) theResponseShouldHaveSessions(count int) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	sessions, ok := data["sessions"].([]any)
	if !ok {
		if count == 0 {
			return nil
		}
		return fmt.Errorf("response has no 'sessions' array: %s", string(c.LastRawBody))
	}
	if len(sessions) != count {
		return fmt.Errorf("expected %d sessions, got %d", count, len(sessions))
	}
	return nil
}

// theCycleShouldHaveSessions checks the sessions count in the most recently
// started cycle response (which is the full CycleWithSessionsResponse from POST /start).
func (c *TestClient) theCycleShouldHaveSessions(count int) error {
	return c.theResponseShouldHaveSessions(count)
}

func (c *TestClient) theSessionShouldHaveStatus(status string) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	sessions, ok := data["sessions"].([]any)
	if !ok || len(sessions) == 0 {
		return fmt.Errorf("response has no sessions")
	}
	sess, ok := sessions[0].(map[string]any)
	if !ok {
		return fmt.Errorf("first session is not an object")
	}
	actual, _ := sess["status"].(string)
	if actual != status {
		return fmt.Errorf("expected session status %q, got %q", status, actual)
	}
	return nil
}

// --- Update cycle ---

func (c *TestClient) iUpdateTheCycleForProgramWithStatus(programName, status string) error {
	cycleUUID, ok := c.CycleUUIDs[programName]
	if !ok {
		return fmt.Errorf("no cycle UUID stored for program %q", programName)
	}
	return c.Put("/api/v1/cycles/"+cycleUUID, map[string]any{
		"status": status,
	})
}

func (c *TestClient) theCycleForProgramIsPaused(programName string) error {
	if err := c.iUpdateTheCycleForProgramWithStatus(programName, "paused"); err != nil {
		return err
	}
	if c.LastStatus != 200 {
		return fmt.Errorf("expected 200 pausing cycle for program %q, got %d: %s",
			programName, c.LastStatus, string(c.LastRawBody))
	}
	return nil
}
