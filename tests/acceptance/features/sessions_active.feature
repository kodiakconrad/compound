Feature: Active Session
  GET /api/v1/sessions/active returns the currently in-progress session,
  or a 404 with code "no_active_session" when none exists.

  Scenario: No active session returns 404
    When I get the active session
    Then the response status should be 404
    And the response should have error code "no_active_session"

  Scenario: Active session returned with sections and exercises
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name     |
      | Compound |
    And the section "Compound" has exercise "Bench Press" with:
      | target_sets | target_reps |
      | 3           | 5           |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    When I get the active session
    Then the response status should be 200
    And the active session should have status "in_progress"
    And the active session should have 1 section
    And the active session section "Compound" should have 1 exercise

  Scenario: Active session includes logged sets
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name     |
      | Compound |
    And the section "Compound" has exercise "Bench Press" with:
      | target_sets | target_reps |
      | 3           | 5           |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    And I log a set for section exercise "Bench Press" in section "Compound" with:
      | set_number | actual_reps | weight |
      | 1          | 5           | 80     |
    When I get the active session
    Then the response status should be 200
    And the active session exercise "Bench Press" in section "Compound" should have 1 logged set
