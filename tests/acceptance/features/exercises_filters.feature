Feature: Exercise Filters
  GET /api/v1/exercises/filters returns the allowed enum values
  for muscle_group, equipment, and tracking_type fields.

  Scenario: Returns all filter enum values
    When I get the exercise filters
    Then the response status should be 200
    And the filters should include muscle groups "chest", "back", "legs", "shoulders", "biceps", "triceps", "core", "cardio", "other"
    And the filters should include equipment "barbell", "dumbbell", "cable", "machine", "bodyweight", "band", "kettlebell", "other"
    And the filters should include tracking types "weight_reps", "bodyweight_reps", "duration", "distance"
