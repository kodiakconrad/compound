Feature: Programs & Workout Builder
  Manage programs with nested workouts, sections,
  and section exercises. Supports deep copy, reorder, and
  active cycle locking.

  # --- Program CRUD ---

  Scenario: Create a program
    When I create a program with:
      | name             | description   |
      | My Training Plan | A custom plan |
    Then the response status should be 201
    And the response should have a uuid
    And the response should include:
      | name             | is_prebuilt |
      | My Training Plan | false       |

  Scenario: List programs
    Given the following programs exist:
      | name      |
      | Program A |
      | Program B |
    When I list programs
    Then the response status should be 200
    And the response should contain 2 programs

  Scenario: List prebuilt programs only
    Given the following programs exist:
      | name      |
      | Program A |
    And the following prebuilt programs exist:
      | name       |
      | Template B |
      | Template C |
    When I list programs with is_prebuilt "true"
    Then the response status should be 200
    And the response should contain 2 programs

  Scenario: Get program with full tree
    Given the following programs exist:
      | name      |
      | Full Plan |
    And the program "Full Plan" has a workout:
      | name         | day_number |
      | Day 1 - Push | 1          |
    And the workout "Day 1 - Push" has a section:
      | name           |
      | Compound Lifts |
    And the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the section "Compound Lifts" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    When I get the program "Full Plan"
    Then the response status should be 200
    And the response should have 1 workout
    And the first workout should have 1 section
    And the first section should have 1 exercise

  Scenario: Deep copy a program
    Given the following programs exist:
      | name          |
      | Source Program |
    And the program "Source Program" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name       |
      | Main Lifts |
    And the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
    And the section "Main Lifts" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    When I copy the program "Source Program"
    Then the response status should be 201
    And the response should have a uuid
    And the response should include:
      | is_prebuilt |
      | false       |
    And the response should have 1 workout

  Scenario: Update program metadata
    Given the following programs exist:
      | name     |
      | Old Name |
    When I update the program "Old Name" with:
      | name     | description  |
      | New Name | Updated desc |
    Then the response status should be 200
    And the response should include:
      | name     | description  |
      | New Name | Updated desc |

  Scenario: Soft delete a program
    Given the following programs exist:
      | name      |
      | To Delete |
    When I delete the program "To Delete"
    Then the response status should be 204
    When I list programs
    Then the response should contain 0 programs

  Scenario: Cannot delete a prebuilt program
    Given the following prebuilt programs exist:
      | name       |
      | 5/3/1 Base |
    When I delete the program "5/3/1 Base"
    Then the response status should be 422
    And the response should have error code "unprocessable"

  # --- Workouts ---

  Scenario: Add a workout to a program
    Given the following programs exist:
      | name    |
      | My Plan |
    When I add a workout to program "My Plan" with:
      | name         | day_number |
      | Day 1 - Push | 1          |
    Then the response status should be 201
    And the response should have a uuid

  Scenario: Cannot add workout with duplicate day_number
    Given the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    When I add a workout to program "My Plan" with:
      | name          | day_number |
      | Another Day 1 | 1          |
    Then the response status should be 409
    And the response should have error code "conflict"

  Scenario: Update a workout
    Given the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    When I update the workout "Day 1" with:
      | name         |
      | Day 1 - Push |
    Then the response status should be 200
    And the response should include:
      | name         |
      | Day 1 - Push |

  Scenario: Delete a workout
    Given the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    When I delete the workout "Day 1"
    Then the response status should be 204

  Scenario: Reorder workouts
    Given the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 2 | 2          |
    When I reorder workouts for program "My Plan" to "Day 2,Day 1"
    Then the response status should be 200

  # --- Sections ---

  Scenario: Add a section to a workout
    Given the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    When I add a section to workout "Day 1" with:
      | name           |
      | Compound Lifts |
    Then the response status should be 201
    And the response should have a uuid

  Scenario: Reorder sections
    Given the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name      |
      | Section A |
    And the workout "Day 1" has a section:
      | name      |
      | Section B |
    When I reorder sections for workout "Day 1" to "Section B,Section A"
    Then the response status should be 200

  # --- Section Exercises ---

  Scenario: Add an exercise to a section
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
      | name       |
      | Main Lifts |
    When I add exercise "Bench Press" to section "Main Lifts" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    Then the response status should be 201
    And the response should have a uuid

  Scenario: Update section exercise targets
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
      | name       |
      | Main Lifts |
    And the section "Main Lifts" has exercise "Bench Press" with:
      | target_sets | target_reps | target_weight |
      | 3           | 5           | 135           |
    When I update section exercise "Bench Press" in section "Main Lifts" with:
      | target_sets | target_reps | target_weight |
      | 5           | 3           | 185           |
    Then the response status should be 200

  Scenario: Remove an exercise from a section
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
      | name       |
      | Main Lifts |
    And the section "Main Lifts" has exercise "Bench Press" with:
      | target_sets | target_reps |
      | 3           | 5           |
    When I remove exercise "Bench Press" from section "Main Lifts"
    Then the response status should be 204

  Scenario: Reorder exercises within a section
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
      | Squat       | legs         | weight_reps   |
    And the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the workout "Day 1" has a section:
      | name       |
      | Main Lifts |
    And the section "Main Lifts" has exercise "Bench Press" with:
      | target_sets |
      | 3           |
    And the section "Main Lifts" has exercise "Squat" with:
      | target_sets |
      | 3           |
    When I reorder exercises in section "Main Lifts" to "Squat,Bench Press"
    Then the response status should be 200

  # --- Active cycle lock ---

  Scenario: Cannot modify a program with an active cycle
    Given the following programs exist:
      | name    |
      | My Plan |
    And the program "My Plan" has an active cycle
    When I update the program "My Plan" with:
      | name         |
      | Updated Name |
    Then the response status should be 422
    And the response should have error code "unprocessable"
