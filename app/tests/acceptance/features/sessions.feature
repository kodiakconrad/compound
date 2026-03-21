Feature: Sessions
  As a user I want to start sessions, log sets, and complete workouts
  so that I can record my training.

  Background:
    Given a program "PPL" with workouts:
      | name |
      | Push |
      | Pull |
      | Legs |
    And I start a cycle for program "PPL"

  Scenario: Start a session
    When I start the first session
    Then the session status should be "in_progress"

  Scenario: Log a set during a session
    Given I start the first session
    When I log a set with weight 100 and reps 8
    Then the set log should be recorded

  Scenario: Log multiple sets and complete the session
    Given I start the first session
    When I log a set with weight 100 and reps 8
    And I log a set with weight 100 and reps 8
    And I complete the session
    Then the session status should be "completed"

  Scenario: Cannot log sets on a pending session
    When I try to log a set on the first pending session
    Then it should fail with an UnprocessableError

  Scenario: Skip a session
    When I skip the first session
    Then the session status should be "skipped"

  Scenario: Complete all sessions auto-completes the cycle
    When I start and complete all sessions
    Then the cycle status should be "completed"

  Scenario: Get active session returns the in-progress session
    When I start the first session
    Then the active session should match the first session
