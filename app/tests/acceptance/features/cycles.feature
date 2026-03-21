Feature: Cycles
  As a user I want to start, pause, resume, and complete cycles
  so that I can track my progress through a program.

  Background:
    Given a program "PPL" with workouts:
      | name |
      | Push |
      | Pull |
      | Legs |

  Scenario: Start a cycle for a program
    When I start a cycle for program "PPL"
    Then the cycle status should be "active"
    And the cycle should have 3 pending sessions

  Scenario: List active cycles
    When I start a cycle for program "PPL"
    Then listing active cycles should return 1 cycle

  Scenario: Pause and resume a cycle
    Given I start a cycle for program "PPL"
    When I pause the cycle
    Then the cycle status should be "paused"
    When I resume the cycle
    Then the cycle status should be "active"

  Scenario: Complete a cycle
    Given I start a cycle for program "PPL"
    When I complete the cycle
    Then the cycle status should be "completed"

  Scenario: Cannot start cycle for non-existent program
    When I try to start a cycle for a non-existent program
    Then it should fail with a NotFoundError
