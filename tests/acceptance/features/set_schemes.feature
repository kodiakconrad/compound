Feature: Set Progression Schemes
  Exercises in a program can use progression schemes (Pyramid, 5/3/1, Drop Set)
  instead of flat targets. When a set_scheme is provided, each set has its own
  reps and weight target stored as JSON.

  Background:
    Given the following exercises exist:
      | name        | muscle_group | tracking_type |
      | Bench Press | chest        | weight_reps   |
      | Squat       | legs         | weight_reps   |

  # --- Scaffold with set schemes ---

  Scenario: Scaffold a program with a pyramid scheme
    When I scaffold a program with:
      """
      {
        "name": "Pyramid Plan",
        "workouts": [{
          "name": "Push Day",
          "day_number": 1,
          "sections": [{
            "name": "Main Lifts",
            "exercises": [{
              "exercise_uuid": "{{Bench Press}}",
              "target_sets": 4,
              "set_scheme": {
                "type": "pyramid",
                "sets": [
                  {"reps": 12, "weight": 60},
                  {"reps": 10, "weight": 70},
                  {"reps": 8, "weight": 80},
                  {"reps": 6, "weight": 90}
                ]
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 201
    When I get the scaffolded program
    Then the response status should be 200
    And the first exercise should have a set scheme of type "pyramid"
    And the first exercise set scheme should have 4 sets

  Scenario: Scaffold a program with a 5/3/1 scheme
    When I scaffold a program with:
      """
      {
        "name": "531 Plan",
        "workouts": [{
          "name": "Squat Day",
          "day_number": 1,
          "sections": [{
            "name": "Main Lift",
            "exercises": [{
              "exercise_uuid": "{{Squat}}",
              "target_sets": 3,
              "set_scheme": {
                "type": "531",
                "sets": [
                  {"reps": 5, "weight": 58.5},
                  {"reps": 5, "weight": 67.5},
                  {"reps": 5, "weight": 76.5}
                ],
                "one_rep_max": 100,
                "week": 1
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 201
    When I get the scaffolded program
    Then the response status should be 200
    And the first exercise should have a set scheme of type "531"
    And the first exercise set scheme should have 3 sets
    And the first exercise set scheme should have one_rep_max 100
    And the first exercise set scheme should have week 1

  Scenario: Scaffold a program with a drop set scheme
    When I scaffold a program with:
      """
      {
        "name": "Drop Set Plan",
        "workouts": [{
          "name": "Chest Day",
          "day_number": 1,
          "sections": [{
            "name": "Burnout",
            "exercises": [{
              "exercise_uuid": "{{Bench Press}}",
              "target_sets": 3,
              "set_scheme": {
                "type": "dropset",
                "sets": [
                  {"reps": 8, "weight": 80},
                  {"reps": 8, "weight": 60},
                  {"reps": 8, "weight": 45}
                ]
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 201
    When I get the scaffolded program
    Then the response status should be 200
    And the first exercise should have a set scheme of type "dropset"
    And the first exercise set scheme should have 3 sets

  Scenario: Scaffold a program without set scheme (backward compat)
    When I scaffold a program with:
      """
      {
        "name": "Simple Plan",
        "workouts": [{
          "name": "Day 1",
          "day_number": 1,
          "sections": [{
            "name": "Main Lifts",
            "exercises": [{
              "exercise_uuid": "{{Bench Press}}",
              "target_sets": 3,
              "target_reps": 5,
              "target_weight": 100
            }]
          }]
        }]
      }
      """
    Then the response status should be 201
    When I get the scaffolded program
    Then the response status should be 200
    And the first exercise should not have a set scheme

  # --- Deep copy preserves schemes ---

  Scenario: Copying a program preserves set schemes
    When I scaffold a program with:
      """
      {
        "name": "Source Plan",
        "workouts": [{
          "name": "Push Day",
          "day_number": 1,
          "sections": [{
            "name": "Main Lifts",
            "exercises": [{
              "exercise_uuid": "{{Bench Press}}",
              "target_sets": 4,
              "set_scheme": {
                "type": "pyramid",
                "sets": [
                  {"reps": 12, "weight": 60},
                  {"reps": 10, "weight": 70},
                  {"reps": 8, "weight": 80},
                  {"reps": 6, "weight": 90}
                ]
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 201
    When I copy the scaffolded program
    Then the response status should be 201
    And the first exercise should have a set scheme of type "pyramid"
    And the first exercise set scheme should have 4 sets

  # --- Validation errors ---

  Scenario: Invalid scheme type is rejected
    When I scaffold a program with:
      """
      {
        "name": "Bad Plan",
        "workouts": [{
          "name": "Day 1",
          "day_number": 1,
          "sections": [{
            "name": "Lifts",
            "exercises": [{
              "exercise_uuid": "{{Bench Press}}",
              "target_sets": 3,
              "set_scheme": {
                "type": "invalid_type",
                "sets": [{"reps": 5, "weight": 100}]
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 400
    And the response should have error code "validation_failed"

  Scenario: Empty sets array is rejected
    When I scaffold a program with:
      """
      {
        "name": "Bad Plan",
        "workouts": [{
          "name": "Day 1",
          "day_number": 1,
          "sections": [{
            "name": "Lifts",
            "exercises": [{
              "exercise_uuid": "{{Bench Press}}",
              "target_sets": 3,
              "set_scheme": {
                "type": "pyramid",
                "sets": []
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 400
    And the response should have error code "validation_failed"

  Scenario: 5/3/1 without week is rejected
    When I scaffold a program with:
      """
      {
        "name": "Bad Plan",
        "workouts": [{
          "name": "Day 1",
          "day_number": 1,
          "sections": [{
            "name": "Lifts",
            "exercises": [{
              "exercise_uuid": "{{Squat}}",
              "target_sets": 3,
              "set_scheme": {
                "type": "531",
                "sets": [
                  {"reps": 5, "weight": 60},
                  {"reps": 5, "weight": 70},
                  {"reps": 5, "weight": 80}
                ]
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 400
    And the response should have error code "validation_failed"

  Scenario: 5/3/1 with invalid week is rejected
    When I scaffold a program with:
      """
      {
        "name": "Bad Plan",
        "workouts": [{
          "name": "Day 1",
          "day_number": 1,
          "sections": [{
            "name": "Lifts",
            "exercises": [{
              "exercise_uuid": "{{Squat}}",
              "target_sets": 3,
              "set_scheme": {
                "type": "531",
                "sets": [
                  {"reps": 5, "weight": 60},
                  {"reps": 5, "weight": 70},
                  {"reps": 5, "weight": 80}
                ],
                "week": 5
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 400
    And the response should have error code "validation_failed"

  Scenario: Negative weight in scheme set is rejected
    When I scaffold a program with:
      """
      {
        "name": "Bad Plan",
        "workouts": [{
          "name": "Day 1",
          "day_number": 1,
          "sections": [{
            "name": "Lifts",
            "exercises": [{
              "exercise_uuid": "{{Bench Press}}",
              "target_sets": 2,
              "set_scheme": {
                "type": "dropset",
                "sets": [
                  {"reps": 8, "weight": -10},
                  {"reps": 8, "weight": 40}
                ]
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 400
    And the response should have error code "validation_failed"

  Scenario: Zero reps in scheme set is rejected
    When I scaffold a program with:
      """
      {
        "name": "Bad Plan",
        "workouts": [{
          "name": "Day 1",
          "day_number": 1,
          "sections": [{
            "name": "Lifts",
            "exercises": [{
              "exercise_uuid": "{{Bench Press}}",
              "target_sets": 2,
              "set_scheme": {
                "type": "pyramid",
                "sets": [
                  {"reps": 0, "weight": 60},
                  {"reps": 5, "weight": 80}
                ]
              }
            }]
          }]
        }]
      }
      """
    Then the response status should be 400
    And the response should have error code "validation_failed"
