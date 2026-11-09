Feature: Program management
  Users create and manage workout programs with a hierarchical tree
  of workouts, sections, and exercises.

  Background:
    Given the following exercises exist:
      | name        | muscle_group | equipment |
      | Bench Press | chest        | barbell   |
      | Squat       | legs         | barbell   |

  Scenario: Create a program with name and description
    When I create a program with name "Push Pull" and description "Upper/lower split"
    Then the program "Push Pull" should exist
    And the program description should be "Upper/lower split"

  Scenario: List programs shows workout count
    Given I create a program with name "My Program" and description "test"
    And I add a workout "Day 1" with day number 1 to the program
    And I add a workout "Day 2" with day number 2 to the program
    When I list programs
    Then the program list should contain "My Program" with workout count 2

  Scenario: View program detail returns the full tree
    Given I create a program with name "Full Body" and description "One workout"
    And I add a workout "Day 1" with day number 1 to the program
    And I add a section "Compound" to workout "Day 1"
    And I add exercise "Bench Press" to section "Compound" with 3 sets, 5 reps, 135 weight
    When I get the program detail
    Then the program should have 1 workout
    And workout "Day 1" should have 1 section
    And section "Compound" should have 1 exercise
    And the exercise should be "Bench Press" with 3 sets, 5 reps, 135 weight

  Scenario: Build a program tree step by step
    Given I create a program with name "PPL" and description "Push Pull Legs"
    When I add a workout "Push" with day number 1 to the program
    And I add a section "Main Lifts" to workout "Push"
    And I add exercise "Bench Press" to section "Main Lifts" with 5 sets, 5 reps, 185 weight
    And I add exercise "Squat" to section "Main Lifts" with 3 sets, 8 reps, 225 weight
    Then the program should have 1 workout
    And section "Main Lifts" should have 2 exercises

  Scenario: Delete a workout from a program
    Given I create a program with name "Trim" and description "Will remove a workout"
    And I add a workout "Day 1" with day number 1 to the program
    And I add a workout "Day 2" with day number 2 to the program
    When I delete workout "Day 2" from the program
    Then the program should have 1 workout

  Scenario: Delete a section from a program
    Given I create a program with name "Trim Sections" and description "Will remove a section"
    And I add a workout "Day 1" with day number 1 to the program
    And I add a section "Compound" to workout "Day 1"
    And I add a section "Isolation" to workout "Day 1"
    When I delete section "Isolation" from the program
    Then workout "Day 1" should have 1 section

  Scenario: Copy a program creates a deep copy with new UUIDs
    Given I create a program with name "Original" and description "Source program"
    And I add a workout "Day 1" with day number 1 to the program
    And I add a section "Main" to workout "Day 1"
    And I add exercise "Bench Press" to section "Main" with 3 sets, 5 reps, 135 weight
    When I copy the program
    Then the copied program name should be "Original (Copy)"
    And the copied program UUID should differ from the original
    And the copied program should have 1 workout
    And the copied workout UUIDs should differ from the original

  Scenario: Copy a prebuilt program sets is_prebuilt to false
    Given a prebuilt program "Starting Strength" exists
    When I copy the prebuilt program
    Then the copied program should not be prebuilt

  Scenario: Delete a program (soft delete)
    Given I create a program with name "Doomed" and description "Will be deleted"
    When I delete the program
    Then getting the program detail should raise a not found error

  Scenario: Deleted program does not appear in list
    Given I create a program with name "Hidden" and description "Will vanish from list"
    When I delete the program
    And I list programs
    Then the program list should not contain "Hidden"
