Feature: Progress
  As a user I want to see my training progress
  so that I can track improvements over time.

  Background:
    Given a program "PPL" with workouts:
      | name |
      | Push |
      | Pull |
      | Legs |
    And I start a cycle for program "PPL"

  Scenario: Progress summary shows total completed sessions
    Given I start and complete the first session with a set
    Then the progress summary should show 1 completed session

  Scenario: Personal records show best weight per exercise
    Given I start and complete the first session with a set at weight 100
    Then personal records should include weight 100 for the exercise

  Scenario: Recent sessions list returns completed sessions in order
    Given I start and complete the first session with a set
    And I start and complete the second session with a set
    Then recent sessions should return 2 sessions with the second first
