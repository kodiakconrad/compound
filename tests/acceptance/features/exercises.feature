Feature: Exercise Library
  Manage custom and prebuilt exercises with CRUD operations,
  filtering, search, pagination, and idempotency support.

  Scenario: Create a custom exercise
    When I create an exercise with:
      | name                  | muscle_group | equipment | tracking_type |
      | Bulgarian Split Squat | legs         | dumbbell  | weight_reps   |
    Then the response status should be 201
    And the response should include:
      | name                  | tracking_type |
      | Bulgarian Split Squat | weight_reps   |
    And the response should have a uuid

  Scenario: Cannot create exercise without a name
    When I create an exercise with:
      | muscle_group |
      | chest        |
    Then the response status should be 400
    And the response should have error code "validation_failed"
    And the response should have field error "name"

  Scenario: Cannot create exercise with invalid tracking_type
    When I create an exercise with:
      | name         | tracking_type |
      | Bad Exercise | invalid_type  |
    Then the response status should be 400
    And the response should have error code "validation_failed"
    And the response should have field error "tracking_type"

  Scenario: Get exercise by uuid
    Given the following exercises exist:
      | name        | muscle_group | equipment | tracking_type |
      | Bench Press | chest        | barbell   | weight_reps   |
    When I get the exercise "Bench Press"
    Then the response status should be 200
    And the response should include:
      | name        | muscle_group | equipment | tracking_type |
      | Bench Press | chest        | barbell   | weight_reps   |

  Scenario: Get non-existent exercise
    When I get an exercise with uuid "00000000-0000-0000-0000-000000000000"
    Then the response status should be 404
    And the response should have error code "not_found"

  Scenario: List exercises
    Given the following exercises exist:
      | name        | muscle_group |
      | Bench Press | chest        |
      | Squat       | legs         |
      | Deadlift    | back         |
    When I list exercises
    Then the response status should be 200
    And the response should contain 3 exercises

  Scenario: List exercises filtered by muscle_group
    Given the following exercises exist:
      | name        | muscle_group |
      | Bench Press | chest        |
      | Squat       | legs         |
      | Deadlift    | back         |
    When I list exercises with muscle_group "chest"
    Then the response status should be 200
    And the response should contain 1 exercise
    And the response should include exercise "Bench Press"

  Scenario: Search exercises by name
    Given the following exercises exist:
      | name          | muscle_group |
      | Bench Press   | chest        |
      | Incline Bench | chest        |
      | Squat         | legs         |
    When I search exercises for "bench"
    Then the response status should be 200
    And the response should contain 2 exercises

  Scenario: Update a custom exercise
    Given the following exercises exist:
      | name        | muscle_group | is_custom |
      | My Exercise | chest        | true      |
    When I update the exercise "My Exercise" with:
      | name             | muscle_group |
      | Updated Exercise | back         |
    Then the response status should be 200
    And the response should include:
      | name             | muscle_group |
      | Updated Exercise | back         |

  Scenario: Cannot update a prebuilt exercise
    Given the following exercises exist:
      | name        | muscle_group | is_custom |
      | Bench Press | chest        | false     |
    When I update the exercise "Bench Press" with:
      | name     |
      | New Name |
    Then the response status should be 422
    And the response should have error code "unprocessable"

  Scenario: Soft delete a custom exercise
    Given the following exercises exist:
      | name        | muscle_group | is_custom |
      | My Exercise | chest        | true      |
    When I delete the exercise "My Exercise"
    Then the response status should be 204
    When I list exercises
    Then the response should contain 0 exercises

  Scenario: Cannot delete a prebuilt exercise
    Given the following exercises exist:
      | name        | muscle_group | is_custom |
      | Bench Press | chest        | false     |
    When I delete the exercise "Bench Press"
    Then the response status should be 422
    And the response should have error code "unprocessable"

  Scenario: Replaying a create with same Idempotency-Key returns original response
    When I create an exercise with idempotency key "test-key-001":
      | name                | tracking_type |
      | Idempotent Exercise | weight_reps   |
    Then the response status should be 201
    And the response should have a uuid
    When I create an exercise with idempotency key "test-key-001":
      | name                | tracking_type |
      | Idempotent Exercise | weight_reps   |
    Then the response status should be 201
    And the response uuid should match the previous response
    When I list exercises
    Then the response should contain 1 exercise
