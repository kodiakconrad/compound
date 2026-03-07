Feature: Progress Tracking
  View exercise history, personal records, and overall session statistics.
  All data is computed from set_logs and sessions across all cycles.

  # History entries represent the best (heaviest) set per completed session,
  # ordered newest first. One entry per session, not per set.
  #
  # "Best set" eligibility rules:
  #   - weight_reps exercises: only sets where actual_reps >= target_reps count
  #   - All other tracking types (duration, distance, bodyweight_reps): always counted
  #   - Ad-hoc sets with no target_reps: always counted
  #
  # The same eligibility rules apply to personal records.

  # --- Exercise history ---

  Scenario: History shows best set per completed session
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name    | is_template |
      | My Plan | false       |
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
    And I successfully complete the session for workout "Day 1" hitting all reps at 135
    When I get the history for exercise "Bench Press"
    Then the response status should be 200
    And the history should have 1 entry
    And the first history entry should have weight 135

  Scenario: History is ordered newest first across cycles
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name    | is_template |
      | My Plan | false       |
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
    And I successfully complete the session for workout "Day 1" hitting all reps at 135
    And I start a new cycle from program "My Plan"
    And I successfully complete the session for workout "Day 1" hitting all reps at 140
    When I get the history for exercise "Bench Press"
    Then the history should have 2 entries
    And the first history entry should have weight 140

  Scenario: Missed sets are excluded from history
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name    | is_template |
      | My Plan | false       |
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
    And I complete the session for workout "Day 1" missing reps on "Bench Press"
    When I get the history for exercise "Bench Press"
    Then the history should have 0 entries

  Scenario: History is empty when no sets have been logged
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    When I get the history for exercise "Bench Press"
    Then the response status should be 200
    And the history should have 0 entries

  # --- Personal records ---

  Scenario: Personal record is the highest weight ever logged
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the following programs exist:
      | name    | is_template |
      | My Plan | false       |
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
    And I successfully complete the session for workout "Day 1" hitting all reps at 135
    And I start a new cycle from program "My Plan"
    And I successfully complete the session for workout "Day 1" hitting all reps at 140
    When I get the record for exercise "Bench Press"
    Then the response status should be 200
    And the record weight should be 140

  Scenario: Personal record returns 404 when no sets have been logged
    Given the following exercises exist:
      | name  | muscle_group | tracking_type |
      | Squat | legs         | weight_reps   |
    When I get the record for exercise "Squat"
    Then the response status should be 404

  # --- Summary ---

  Scenario: Summary counts all completed sessions and streak across cycles
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    And the session for workout "Day 1" is in progress
    And I complete the current session
    And I start a new cycle from program "My Plan"
    And the session for workout "Day 1" is in progress
    And I complete the current session
    When I get the progress summary
    Then the response status should be 200
    And the summary total_sessions should be 2
    And the current_streak should be 2

  Scenario: Streak resets after a skipped session
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 2 | 2          |
    And a cycle is started from program "My Plan"
    And I skip the session for workout "Day 1" in the current cycle
    And I start the session for workout "Day 2" in the current cycle
    And I complete the current session
    When I get the progress summary
    Then the current_streak should be 1
