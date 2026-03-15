package acceptance

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/cucumber/godog"
)

// TestClient holds state for a single scenario.
type TestClient struct {
	BaseURL    string
	DB         *sql.DB
	LastStatus int
	LastBody   map[string]any
	LastRawBody []byte

	// UUID lookups keyed by name (set by Given steps).
	ExerciseUUIDs        map[string]string
	ProgramUUIDs         map[string]string
	WorkoutUUIDs         map[string]string
	SectionUUIDs         map[string]string
	SectionExerciseUUIDs map[string]string // keyed by "exerciseName:sectionName"

	// Parent relationship maps for nested URL construction.
	WorkoutProgramUUID map[string]string // workout name → program UUID
	SectionWorkoutUUID map[string]string // section name → workout UUID

	// Stores the UUID from the previous response for idempotency assertions.
	PreviousUUID string

	// Cycle and session tracking (Step 4).
	CycleUUIDs            map[string]string // program name → cycle UUID (most recent)
	SessionsByWorkoutName map[string]string // workout name → session UUID (in current cycle)
	CurrentCycleUUID      string
	CurrentSessionUUID    string

	// Set log tracking.
	LastSetLogUUID         string
	LastSetLogExerciseUUID string

	// Scaffold tracking.
	ScaffoldedProgramUUID string
}

// NewTestClient creates a TestClient for a single scenario.
func NewTestClient(baseURL string, db *sql.DB) *TestClient {
	return &TestClient{
		BaseURL:              baseURL,
		DB:                   db,
		ExerciseUUIDs:        make(map[string]string),
		ProgramUUIDs:         make(map[string]string),
		WorkoutUUIDs:         make(map[string]string),
		SectionUUIDs:         make(map[string]string),
		SectionExerciseUUIDs: make(map[string]string),
		WorkoutProgramUUID:   make(map[string]string),
		SectionWorkoutUUID:   make(map[string]string),
		CycleUUIDs:            make(map[string]string),
		SessionsByWorkoutName: make(map[string]string),
	}
}

// --- HTTP methods ---

// Post sends a POST request and stores the response.
func (c *TestClient) Post(path string, body any) error {
	return c.doRequest("POST", path, body, nil)
}

// PostWithHeaders sends a POST request with custom headers.
func (c *TestClient) PostWithHeaders(path string, body any, headers map[string]string) error {
	return c.doRequest("POST", path, body, headers)
}

// Get sends a GET request and stores the response.
func (c *TestClient) Get(path string) error {
	return c.doRequest("GET", path, nil, nil)
}

// Put sends a PUT request and stores the response.
func (c *TestClient) Put(path string, body any) error {
	return c.doRequest("PUT", path, body, nil)
}

// Delete sends a DELETE request and stores the response.
func (c *TestClient) Delete(path string) error {
	return c.doRequest("DELETE", path, nil, nil)
}

func (c *TestClient) doRequest(method, path string, body any, headers map[string]string) error {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	c.LastStatus = resp.StatusCode
	c.LastRawBody, err = io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body: %w", err)
	}

	// Parse JSON body if present.
	c.LastBody = nil
	if len(c.LastRawBody) > 0 {
		var parsed map[string]any
		if err := json.Unmarshal(c.LastRawBody, &parsed); err == nil {
			c.LastBody = parsed
		}
	}

	return nil
}

// --- Shared step definitions ---

// InitializeCommonSteps registers step definitions shared across features.
func InitializeCommonSteps(ctx *godog.ScenarioContext, client *TestClient) {
	ctx.Step(`^the response status should be (\d+)$`, client.theResponseStatusShouldBe)
	ctx.Step(`^the response should have error code "([^"]*)"$`, client.theResponseShouldHaveErrorCode)
	ctx.Step(`^the response should have field error "([^"]*)"$`, client.theResponseShouldHaveFieldError)
	ctx.Step(`^the response should have a uuid$`, client.theResponseShouldHaveAUUID)
	ctx.Step(`^the response should include:$`, client.theResponseShouldInclude)
}

func (c *TestClient) theResponseStatusShouldBe(expected int) error {
	if c.LastStatus != expected {
		return fmt.Errorf("expected status %d, got %d (body: %s)", expected, c.LastStatus, string(c.LastRawBody))
	}
	return nil
}

func (c *TestClient) theResponseShouldHaveErrorCode(code string) error {
	if c.LastBody == nil {
		return fmt.Errorf("no response body")
	}
	errObj, ok := c.LastBody["error"].(map[string]any)
	if !ok {
		return fmt.Errorf("response has no 'error' object: %s", string(c.LastRawBody))
	}
	actual, ok := errObj["code"].(string)
	if !ok {
		return fmt.Errorf("error has no 'code' field")
	}
	if actual != code {
		return fmt.Errorf("expected error code %q, got %q", code, actual)
	}
	return nil
}

func (c *TestClient) theResponseShouldHaveFieldError(field string) error {
	if c.LastBody == nil {
		return fmt.Errorf("no response body")
	}
	errObj, ok := c.LastBody["error"].(map[string]any)
	if !ok {
		return fmt.Errorf("response has no 'error' object")
	}
	details, ok := errObj["details"].([]any)
	if !ok {
		return fmt.Errorf("error has no 'details' array")
	}
	for _, d := range details {
		detail, ok := d.(map[string]any)
		if !ok {
			continue
		}
		if detail["field"] == field {
			return nil
		}
	}
	return fmt.Errorf("no field error for %q in details: %v", field, details)
}

func (c *TestClient) theResponseShouldHaveAUUID() error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	uuid, ok := data["uuid"].(string)
	if !ok || uuid == "" {
		return fmt.Errorf("response data has no 'uuid' field")
	}
	return nil
}

func (c *TestClient) theResponseShouldInclude(table *godog.Table) error {
	data, err := c.dataObject()
	if err != nil {
		return err
	}
	fields := tableToMap(table)
	for key, expected := range fields {
		actual := fmt.Sprintf("%v", data[key])
		if actual != expected {
			return fmt.Errorf("expected %s=%q, got %q", key, expected, actual)
		}
	}
	return nil
}

// --- Helpers ---

// dataObject extracts the "data" object from the response body.
func (c *TestClient) dataObject() (map[string]any, error) {
	if c.LastBody == nil {
		return nil, fmt.Errorf("no response body")
	}
	data, ok := c.LastBody["data"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("response has no 'data' object: %s", string(c.LastRawBody))
	}
	return data, nil
}

// dataArray extracts the "data" array from the response body.
func (c *TestClient) dataArray() ([]any, error) {
	if c.LastBody == nil {
		return nil, fmt.Errorf("no response body")
	}
	data, ok := c.LastBody["data"].([]any)
	if !ok {
		return nil, fmt.Errorf("response has no 'data' array: %s", string(c.LastRawBody))
	}
	return data, nil
}

// tableToMap converts a godog table with a header row and a single data row
// into a map[string]string keyed by header names.
func tableToMap(table *godog.Table) map[string]string {
	rows := tableToMapSlice(table)
	if len(rows) == 0 {
		return make(map[string]string)
	}
	return rows[0]
}

// tableToMapSlice converts a godog table with a header row to a slice of maps.
func tableToMapSlice(table *godog.Table) []map[string]string {
	if len(table.Rows) < 2 {
		return nil
	}
	headers := make([]string, len(table.Rows[0].Cells))
	for i, cell := range table.Rows[0].Cells {
		headers[i] = cell.Value
	}
	var result []map[string]string
	for _, row := range table.Rows[1:] {
		m := make(map[string]string)
		for i, cell := range row.Cells {
			if i < len(headers) {
				m[headers[i]] = cell.Value
			}
		}
		result = append(result, m)
	}
	return result
}

// stringPtr returns a pointer to the given string.
func stringPtr(s string) *string {
	return &s
}

// parseBool parses a string "true"/"false" to bool with a default.
func parseBool(s string, defaultVal bool) bool {
	if s == "" {
		return defaultVal
	}
	v, err := strconv.ParseBool(s)
	if err != nil {
		return defaultVal
	}
	return v
}
