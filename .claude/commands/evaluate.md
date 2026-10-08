---
description: Verify work is complete before marking tasks done
---

You are an evaluation assistant. Verify that work actually works before claiming completion.

## When to Use This Command

**Use `/evaluate` BEFORE marking a task as complete:**
- After implementing a feature (may span multiple commits)
- Before marking TodoWrite items as complete
- To ensure everything actually works end-to-end
- When you think you're done but want to be sure

**Related commands:**
- Use `/review` before each individual commit
- Use `/plan` at the start to break down the work
- Use `/debug` if evaluation reveals issues

## Critical Philosophy

**NEVER claim work is complete without verification.**

This evaluation command exists to ensure we actually test and validate our work. See the "Critical Work Standards" section in CLAUDE.md for the full philosophy.

**Key principles:**
- ❌ Don't say "complete" if tests are failing
- ❌ Don't pretend problems are solved
- ✅ Actually run the code and verify it works
- ✅ Be honest if something needs more work

## Usage

```bash
/evaluate              # Full comprehensive evaluation (default)
/evaluate quick        # Fast check (type check + tests only)
/evaluate <path>       # Evaluate specific scope
```

## Pre-Flight Checks

Before running evaluation, verify environment is ready:

### Check 1: Git Status

```bash
git status
```

- Identify what has changed
- Note any unrelated changes (other Claude sessions may be active)

### Check 2: Environment Setup

```bash
which <language-command>
<language-command> --version
```

- Ensure correct language/runtime version
- Platform-specific notes in docs/PLATFORM.md

### Check 3: Dependencies

```bash
<dependency-check-command>
```

- Verify required packages installed
- Check docs/PLATFORM.md for dependency setup

## Evaluation Process (Full Mode)

Run these checks systematically and report all results:

### 1. Type Checking

```bash
<type-check-command>
```

See docs/PLATFORM.md for platform-specific command.

- Must pass with no errors
- Report any type issues found
- Check new code has full type hints/annotations

### 2. Unit Tests

```bash
<test-command>
```

- All tests must pass (100% pass rate required)
- Report pass/fail count
- Show any failures in detail
- Check if new tests were added for new features

### 3. Integration Tests (if applicable)

```bash
<integration-test-command>
```

- Run integration tests if relevant
- Verify systems work together
- Report any errors

### 4. Manual Tests

If applicable:
- Run the game/application
- Test the new feature manually
- Try edge cases
- Verify visual/audio correctness

### 5. Code Quality Checks

From docs/COMMON_PITFALLS.md, check for:

**Hard-coded values**
- Grep for magic numbers in new code
- Verify constants extracted appropriately

**Missing imports**
- Check all imports are present
- No undefined names

**Type hints**
- All functions have parameter and return type hints
- Class attributes typed where needed

**Null/None handling**
- Defensive checks where needed
- No potential crashes from null access

**Layer violations**
- Core not importing Application/Presentation
- Dependencies flow correctly

**Immutability**
- State transformations not mutations
- No accidental in-place modifications

**Determinism**
- Using seeded RNG, not Math.random()
- No time-based gameplay logic

**Registry compliance** (if applicable)
- New entities/abilities registered
- IDs are unique

### 6. Integration Verification

If applicable:
- Does the game/application run without errors?
- Can you demonstrate the feature works?
- Are there edge cases to test?
- Does it work with existing features?

### 7. Documentation Check

- Is CLAUDE.md still accurate?
- Is GAME_SYSTEMS.md updated if mechanics changed?
- Are code comments helpful?
- Do docstrings explain non-obvious behavior?

## Evaluation Process (Quick Mode)

For minor changes, run abbreviated checks:

### Quick Mode Steps

1. Run `git status` to identify changes
2. Run type checker
3. Run unit tests
4. Report pass/fail status

If both pass, report "Quick evaluation passed" with minimal detail.

## Output Format (Full Mode)

```markdown
# Evaluation Report

## Scope

- **Task**: [Description of what was implemented]
- **Files changed**: [count] files
- **Commits**: [count if multiple]
- **Mode**: [Full/Quick]

## Pre-Flight Status

- **Language/Runtime**: [version]
- **Environment**: [platform info]
- **Dependencies**: [OK/MISSING]

## Test Results

### Type Checking

**Status**: [PASS/FAIL]

[Output or "All checks passed"]

### Unit Tests

**Status**: [PASS/FAIL]
**Passed**: X / Y tests (Z%)

[Details if any failed]

### Integration Tests

**Status**: [PASS/FAIL/NOT APPLICABLE]

[Output or issues found]

### Manual Tests

**Status**: [PASS/FAIL/NOT APPLICABLE]

[What was tested and results]

## Code Quality

### Hard-coded Values

[PASS/ISSUES] - [Details]

### Missing Imports

[PASS/ISSUES] - [Details]

### Type Hints

[PASS/ISSUES] - [Details]

### Null/None Handling

[PASS/ISSUES] - [Details]

### Layer Violations

[PASS/ISSUES] - [Details]

### Immutability

[PASS/ISSUES] - [Details]

### Determinism

[PASS/ISSUES] - [Details]

### Registry Compliance (if applicable)

[PASS/ISSUES] - [Details]

### Common Pitfalls (from COMMON_PITFALLS.md)

[List any issues found from checklist]

## Integration Check

### Functionality Verification

[Description of how you verified it works]
[Or "Not applicable"]

### Edge Cases

[Tests performed or considerations]

## Documentation

### CLAUDE.md Accuracy

[CURRENT/NEEDS UPDATE] - [Details]

### GAME_SYSTEMS.md

[CURRENT/NEEDS UPDATE] - [Details]

### Code Comments

[ADEQUATE/NEEDS IMPROVEMENT] - [Details]

## Summary Metrics

- **Total test pass rate**: X/Y (Z%)
- **Type errors**: X
- **Code quality issues**: X
  - Critical: X
  - High: X
  - Medium: X
  - Low: X

## Overall Assessment

**Status**: [READY TO MARK COMPLETE / NEEDS WORK]

**Summary**: [Brief assessment in 1-2 sentences]

**Remaining Issues**: [List any issues that must be fixed]

**Recommendations**: [Optional improvements]

**Next Steps**: [What to do next - e.g., run /review before committing]
```

## Evaluation Standards

**READY TO MARK COMPLETE requires:**
- ✅ All tests pass (type check + unit tests + integration)
- ✅ No critical code quality issues
- ✅ Functionality verified working
- ✅ No obvious bugs or edge case failures
- ✅ Documentation accurate

**NEEDS WORK means:**
- ❌ Any test failures
- ❌ Type errors
- ❌ Missing critical imports
- ❌ Feature doesn't actually work
- ❌ Major code quality violations
- ❌ Layer violations
- ❌ Breaking immutability/determinism

## Important Notes

1. **Actually run the tests** - Don't assume they pass
2. **Show your work** - Include actual output
3. **Be honest** - If something doesn't work, say so
4. **Be thorough** - Check all relevant areas
5. **Be specific** - Point to exact files/lines with issues
6. **Read COMMON_PITFALLS.md** - Refresh on what to look for
7. **Check ARCHITECTURE.md** - Verify patterns followed

## Example: Success Output

```markdown
# Evaluation Report

## Scope

- **Task**: Implement FireComponent with burn DoT mechanic
- **Files changed**: 4 files
  - core/components/fire_component.py
  - data/component_registry.py
  - tests/unit/test_fire_component.py
  - tests/integration/test_combat_with_fire.py
- **Commits**: 2
- **Mode**: Full

## Pre-Flight Status

- **Language/Runtime**: Python 3.11.6
- **Environment**: Linux (venv active)
- **Dependencies**: OK (all installed)

## Test Results

### Type Checking

**Status**: PASS

All checks passed - no type errors found

### Unit Tests

**Status**: PASS
**Passed**: 48/48 tests (100%)

All tests pass, including 8 new tests for FireComponent

### Manual Tests

**Status**: PASS

Ran application and verified:
- Fire component applies burn correctly
- Burn ticks every second for 3 seconds
- Multiple burns stack additively
- Burn expires after duration

## Code Quality

### Hard-coded Values

PASS - All constants extracted (BURN_DURATION = 3.0, BURN_DPS = 6.67)

### Missing Imports

PASS - All imports present

### Type Hints

PASS - Full type coverage on all new code

### Layer Violations

PASS - No violations detected

### Immutability

PASS - All state updates return new instances

### Determinism

PASS - No random() usage, all through seeded RNG

### Registry Compliance

PASS - FireComponent registered in component_registry.py

### Common Pitfalls

PASS - No issues from COMMON_PITFALLS.md checklist

## Integration Check

### Functionality Verification

Verified FireComponent works correctly:
- Burns apply on hit and tick for damage
- Multiple burn stacks work as intended
- Burns expire after 3 seconds
- Works with other components

### Edge Cases

Tested:
- Burn on entity death (expires cleanly)
- Burn with zero stacks (no crash)
- Maximum stacks (caps at 5)

## Documentation

### CLAUDE.md

CURRENT - No changes needed

### GAME_SYSTEMS.md

NEEDS UPDATE - Should add FireComponent to status effects section

### Code Comments

ADEQUATE - Burn stacking formula well documented

## Summary Metrics

- **Total test pass rate**: 48/48 (100%)
- **Type errors**: 0
- **Code quality issues**: 1 (Low: missing GAME_SYSTEMS.md update)

## Overall Assessment

**Status**: READY TO MARK COMPLETE

**Summary**: FireComponent implementation is complete and fully tested. All checks pass. Only minor documentation update needed.

**Remaining Issues**:
- Update GAME_SYSTEMS.md to document FireComponent

**Recommendations**:
- Consider adding visual test for burn effect
- May want performance test with 100+ burning entities

**Next Steps**:
1. Update GAME_SYSTEMS.md
2. Run /review before committing
```

---

Begin evaluation now. First read docs/COMMON_PITFALLS.md, then run all checks and report comprehensive results.
