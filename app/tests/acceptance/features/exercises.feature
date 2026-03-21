Feature: Exercise management
  As a user I want to create, list, update, and delete exercises
  so that I can build custom workout programs.

  Scenario: Create a custom exercise with all fields
    When I create an exercise with:
      | name         | muscle_group | equipment | tracking_type |
      | Bench Press  | chest        | barbell   | weight_reps   |
    Then the exercise "Bench Press" should exist
    And the exercise "Bench Press" should have muscle_group "chest"
    And the exercise "Bench Press" should have equipment "barbell"
    And the exercise "Bench Press" should have tracking_type "weight_reps"
    And the exercise "Bench Press" should be custom

  Scenario: Create a minimal exercise with just a name
    When I create an exercise with:
      | name       |
      | Pull Ups   |
    Then the exercise "Pull Ups" should exist
    And the exercise "Pull Ups" should have tracking_type "weight_reps"

  Scenario: Cannot create an exercise without a name
    When I try to create an exercise with:
      | name |
      |      |
    Then I should see a validation error for "name"

  Scenario: List all exercises
    Given the following exercises exist:
      | name          | muscle_group | equipment |
      | Squat         | legs         | barbell   |
      | Deadlift      | back         | barbell   |
      | Bicep Curl    | biceps       | dumbbell  |
    When I list all exercises
    Then I should see 3 exercises

  Scenario: Filter exercises by muscle group
    Given the following exercises exist:
      | name          | muscle_group | equipment |
      | Bench Press   | chest        | barbell   |
      | Incline Fly   | chest        | dumbbell  |
      | Squat         | legs         | barbell   |
    When I list exercises filtered by muscle_group "chest"
    Then I should see 2 exercises
    And the exercise list should include "Bench Press"
    And the exercise list should include "Incline Fly"
    And the exercise list should not include "Squat"

  Scenario: Search exercises by name
    Given the following exercises exist:
      | name              | muscle_group |
      | Bench Press       | chest        |
      | Incline Bench     | chest        |
      | Squat             | legs         |
    When I search exercises for "Bench"
    Then I should see 2 exercises
    And the exercise list should include "Bench Press"
    And the exercise list should include "Incline Bench"

  Scenario: Update an exercise name
    Given the following exercises exist:
      | name          | muscle_group |
      | Bench Press   | chest        |
    When I update the exercise "Bench Press" with name "Flat Bench Press"
    Then the exercise "Flat Bench Press" should exist
    And the exercise "Flat Bench Press" should have muscle_group "chest"

  Scenario: Delete an exercise (soft delete — hidden from list)
    Given the following exercises exist:
      | name          | muscle_group |
      | Squat         | legs         |
      | Deadlift      | back         |
    When I delete the exercise "Squat"
    And I list all exercises
    Then I should see 1 exercise
    And the exercise list should include "Deadlift"
    And the exercise list should not include "Squat"

  Scenario: Deleted exercise cannot be retrieved
    Given the following exercises exist:
      | name          | muscle_group |
      | Squat         | legs         |
    When I delete the exercise "Squat"
    And I try to get the exercise "Squat"
    Then I should see a not found error
