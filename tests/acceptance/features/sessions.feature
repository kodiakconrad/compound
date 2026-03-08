Feature: Sessions & Set Logging
  Execute a session within a cycle, log sets, and track weight progression.
  Sessions are pre-generated as pending when a cycle starts. Target weights
  are computed from prior history using the exercise's progression rule.

  # Note on progression scope: target weight computation and consecutive
  # failure tracking look across all prior cycles for the same
  # section_exercise_id, not just the current cycle. This means progression
  # carries forward from one cycle to the next.

  # --- Session state machine ---

  Scenario: Start a session
    Given the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    When I start the session for workout "Day 1" in the current cycle
    Then the response status should be 200
    And the response should include:
      | status      |
      | in_progress |

  Scenario: Complete a session with notes
    Given the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    When I complete the current session with notes "Felt strong today"
    Then the response status should be 200
    And the response should include:
      | status    | notes             |
      | completed | Felt strong today |

  Scenario: Skip a pending session
    Given the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    When I skip the session for workout "Day 1" in the current cycle
    Then the response status should be 200
    And the response should include:
      | status  |
      | skipped |

  Scenario: Skip an in-progress session
    Given the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    When I skip the session for workout "Day 1" in the current cycle
    Then the response status should be 200
    And the response should include:
      | status  |
      | skipped |

  # --- Set logging ---

  Scenario: Log a set for a weight_reps exercise
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name       |
      | Main Lifts |
    And the section "Main Lifts" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    When I log a set for section exercise "Bench Press" in section "Main Lifts" with:
      | set_number | actual_reps | weight |
      | 1          | 5           | 135    |
    Then the response status should be 201
    And the response should have a uuid

  Scenario: Log a set with a substituted exercise
    Given the following exercises exist:
      | name           | muscle_group | tracking_type |
      | Bench Press    | chest        | weight_reps   |
      | Dumbbell Press | chest        | weight_reps   |
    And the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name       |
      | Main Lifts |
    And the section "Main Lifts" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    When I log a set for section exercise "Bench Press" in section "Main Lifts" substituting "Dumbbell Press" with:
      | set_number | actual_reps | weight |
      | 1          | 5           | 70     |
    Then the response status should be 201
    And the set log exercise should be "Dumbbell Press"

  Scenario: Log an ad-hoc set not tied to a planned exercise
    Given the following exercises exist:
      | name      | muscle_group | tracking_type |
      | Face Pull | shoulders    | weight_reps   |
    And the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    When I log an ad-hoc set for exercise "Face Pull" with:
      | set_number | actual_reps | weight |
      | 1          | 15          | 30     |
    Then the response status should be 201

  Scenario: Cannot log a set with tracking type mismatch
    Given the following exercises exist:
      | name  | muscle_group | tracking_type |
      | Plank | core         | duration      |
    And the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name |
      | Core |
    And the section "Core" has exercise "Plank" with:
      | target_sets | target_duration |
      | 3           | 60              |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    When I log a set for section exercise "Plank" in section "Core" with:
      | set_number | weight |
      | 1          | 45     |
    Then the response status should be 400
    And the response should have error code "validation_failed"

  # --- Session detail ---

  Scenario: Get session detail with target weights and logged sets
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name   |
      | My Plan|
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name       |
      | Main Lifts |
    And the section "Main Lifts" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    And I log a set for section exercise "Bench Press" in section "Main Lifts" with:
      | set_number | actual_reps | weight |
      | 1          | 5           | 135    |
    When I get the session for workout "Day 1" in the current cycle
    Then the response status should be 200
    And the session should have 1 section
    And the session's first section should have 1 exercise
    And the exercise "Bench Press" should have computed_target_weight 135
    And the exercise "Bench Press" should have 1 logged set

  # --- Progression ---

  Scenario: Target weight increases after a successful session
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name     |
      | Push Plan|
    And the program "Push Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name      |
      | Main Work |
    And the section "Main Work" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    And the exercise "Bench Press" in section "Main Work" has a linear progression rule:
      | increment | deload_threshold | deload_pct |
      | 5         | 3                | 10         |
    And a cycle is started from program "Push Plan"
    And I successfully complete the session for workout "Day 1" hitting all reps at 135
    When I start a new cycle from program "Push Plan"
    And I get the session for workout "Day 1" in the current cycle
    Then the exercise "Bench Press" should have computed_target_weight 140

  Scenario: Target weight unchanged after a failed session
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name     |
      | Push Plan|
    And the program "Push Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name      |
      | Main Work |
    And the section "Main Work" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    And the exercise "Bench Press" in section "Main Work" has a linear progression rule:
      | increment | deload_threshold | deload_pct |
      | 5         | 3                | 10         |
    And a cycle is started from program "Push Plan"
    And I complete the session for workout "Day 1" missing reps on "Bench Press"
    When I start a new cycle from program "Push Plan"
    And I get the session for workout "Day 1" in the current cycle
    Then the exercise "Bench Press" should have computed_target_weight 135

  Scenario: Deload applied after consecutive failures reach threshold
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name     |
      | Push Plan|
    And the program "Push Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name      |
      | Main Work |
    And the section "Main Work" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    And the exercise "Bench Press" in section "Main Work" has a linear progression rule:
      | increment | deload_threshold | deload_pct |
      | 5         | 3                | 10         |
    And a cycle is started from program "Push Plan"
    And I complete the session for workout "Day 1" missing reps on "Bench Press"
    And I start a new cycle from program "Push Plan"
    And I complete the session for workout "Day 1" missing reps on "Bench Press"
    And I start a new cycle from program "Push Plan"
    And I complete the session for workout "Day 1" missing reps on "Bench Press"
    When I start a new cycle from program "Push Plan"
    And I get the session for workout "Day 1" in the current cycle
    Then the exercise "Bench Press" should have computed_target_weight 121.5
