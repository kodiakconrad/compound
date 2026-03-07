Feature: Cycles
  Manage training cycles — active runs of a program with pre-generated sessions.
  Supports pause, resume, and manual or auto-completion.

  # --- Start cycle ---

  Scenario: Start a cycle from a program
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    When I start a cycle from program "My Plan"
    Then the response status should be 201
    And the response should have a uuid
    And the response should include:
      | status |
      | active |

  Scenario: Sessions are pre-generated when a cycle starts
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 2 | 2          |
    When I start a cycle from program "My Plan"
    Then the response status should be 201
    And the cycle should have 2 sessions

  Scenario: Cannot start a cycle from a program with no workouts
    Given the following programs exist:
      | name  | is_template |
      | Empty | false       |
    When I start a cycle from program "Empty"
    Then the response status should be 422
    And the response should have error code "unprocessable"

  # --- List cycles ---

  Scenario: List cycles
    Given the following programs exist:
      | name      | is_template |
      | Program A | false       |
      | Program B | false       |
    And the program "Program A" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the program "Program B" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "Program A"
    And a cycle is started from program "Program B"
    When I list cycles
    Then the response status should be 200
    And the response should contain 2 cycles

  Scenario: List cycles filtered by status
    Given the following programs exist:
      | name      | is_template |
      | Program A | false       |
      | Program B | false       |
    And the program "Program A" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And the program "Program B" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "Program A"
    And a cycle is started from program "Program B"
    And the cycle for program "Program A" is paused
    When I list cycles with status "active"
    Then the response status should be 200
    And the response should contain 1 cycle

  # --- Get cycle ---

  Scenario: Get cycle with sessions
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    When I get the cycle for program "My Plan"
    Then the response status should be 200
    And the response should have 1 session
    And the session should have status "pending"

  # --- State transitions ---

  Scenario: Pause a cycle
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    When I update the cycle for program "My Plan" with status "paused"
    Then the response status should be 200
    And the response should include:
      | status |
      | paused |

  Scenario: Resume a paused cycle
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    And the cycle for program "My Plan" is paused
    When I update the cycle for program "My Plan" with status "active"
    Then the response status should be 200
    And the response should include:
      | status |
      | active |

  Scenario: Complete a cycle manually
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    When I update the cycle for program "My Plan" with status "completed"
    Then the response status should be 200
    And the response should include:
      | status    |
      | completed |

  # --- Auto-complete ---

  Scenario: Cycle auto-completes when last session is completed
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    When I start the session for workout "Day 1" in the current cycle
    And I complete the current session
    And I get the cycle for program "My Plan"
    Then the response should include:
      | status    |
      | completed |

  Scenario: Cycle auto-completes when last session is skipped
    Given the following programs exist:
      | name    | is_template |
      | My Plan | false       |
    And the program "My Plan" has a workout:
      | name  | day_number |
      | Day 1 | 1          |
    And a cycle is started from program "My Plan"
    When I skip the session for workout "Day 1" in the current cycle
    And I get the cycle for program "My Plan"
    Then the response should include:
      | status    |
      | completed |

  Scenario: Multi-session cycle only auto-completes when all sessions are done
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
    When I start the session for workout "Day 1" in the current cycle
    And I complete the current session
    And I get the cycle for program "My Plan"
    Then the response should include:
      | status |
      | active |
