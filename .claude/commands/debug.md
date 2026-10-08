---
description: Systematic issue investigation and root cause analysis
---

You are a debugging assistant. Use systematic Q&A-based root cause analysis to investigate issues.

## When to Use This Command

**Use `/debug` when:**
- Tests are failing
- Feature doesn't work as expected
- Encountering errors or exceptions
- Behavior is incorrect
- Performance issues

**Related commands:**
- Use `/evaluate` after fixing to verify
- Use `/review` before committing fix
- Use `/plan` if fix requires significant changes

## Debugging Methodology

### 1. Gather Information

**Understand the problem:**
- What is the expected behavior?
- What is the actual behavior?
- How to reproduce the issue?
- When did it start happening?
- What changed recently?

**Collect evidence:**
```bash
# Run tests to see failures
<test-command>

# Check git history
git log --oneline -10
git diff HEAD~1

# Check current state
git status
```

### 2. Form Hypotheses

Based on evidence, list possible causes:
1. [Hypothesis 1] - [Why this might be the cause]
2. [Hypothesis 2] - [Why this might be the cause]
3. [Hypothesis 3] - [Why this might be the cause]

Rank by likelihood.

### 3. Test Hypotheses

For each hypothesis (starting with most likely):
- What would prove/disprove this?
- What can we check?
- What test can we run?

### 4. Identify Root Cause

Once found:
- What is the actual cause?
- Why did it happen?
- How did it pass code review?
- Is this a common pitfall to document?

### 5. Plan Fix

- Minimal change to fix the issue
- Regression test to prevent recurrence
- Related issues to check

## Systematic Investigation Questions

### For Test Failures

**Q1: Which tests are failing?**
- Unit tests? Integration tests? Specific test file?
- All tests or just some?
- Consistent or intermittent?

**Q2: What is the error message?**
- Exception type?
- Stack trace?
- Assertion failure?

**Q3: What changed recently?**
```bash
git diff HEAD~1  # Last commit
git log --oneline -5  # Recent commits
```

**Q4: Can you reproduce locally?**
- Run the failing test
- Does it fail consistently?
- What's the actual vs expected output?

**Q5: Is it a test issue or code issue?**
- Is the test correct?
- Is the code correct?
- Is it an environment issue?

### For Runtime Errors

**Q1: What is the exact error?**
- Full error message
- Stack trace
- Line number

**Q2: What were you doing when it happened?**
- Specific action
- Input values
- Game state

**Q3: Can you reproduce it?**
- Steps to reproduce
- Required preconditions
- Frequency (always/sometimes/rare)

**Q4: What's in the logs?**
- Any warnings before the error?
- State of variables?
- Previous operations?

**Q5: What does the code do at that line?**
- Read the code
- Check assumptions
- Verify types

### For Incorrect Behavior

**Q1: What should happen?**
- Expected behavior
- From specs/docs
- From tests

**Q2: What actually happens?**
- Observed behavior
- Specific values
- Visual evidence

**Q3: Where does it diverge?**
- At what point does it go wrong?
- What decision/calculation is wrong?
- Which component is responsible?

**Q4: What are the inputs?**
- What values are being used?
- Are they correct?
- Are they what you expect?

**Q5: What are the intermediate values?**
- Add logging/breakpoints
- Check calculations step-by-step
- Verify each transformation

### For Performance Issues

**Q1: How slow is it?**
- Specific measurements
- FPS or execution time
- Compared to target

**Q2: When does it happen?**
- With how many entities?
- During what operations?
- Always or specific scenarios?

**Q3: What's the bottleneck?**
- Profile the code
- Which function takes time?
- How many times is it called?

**Q4: What's the algorithmic complexity?**
- O(1), O(n), O(n²)?
- Can it be optimized?
- Is there unnecessary work?

**Q5: Are there quick wins?**
- Caching?
- Early returns?
- Better data structures?

## Common Issues Checklist

Check docs/COMMON_PITFALLS.md for:

- [ ] **Magic numbers** - Hard-coded values causing unexpected behavior
- [ ] **Missing imports** - Using undefined constants/types
- [ ] **Type mismatches** - Wrong types passed/returned
- [ ] **Null/None** - Accessing null/none without checking
- [ ] **Layer violations** - Core importing Presentation
- [ ] **Mutability** - Accidentally mutating instead of creating new instance
- [ ] **Non-determinism** - Using Math.random() or Date.now()
- [ ] **Not registered** - New content not added to registry
- [ ] **Mutable defaults** - (Python) List/dict as default argument

## Output Format

```markdown
# Debug Report: [Issue Description]

## Problem Statement

**Expected**: [What should happen]

**Actual**: [What actually happens]

**Severity**: [Critical/High/Medium/Low]

**Reproducible**: [Always/Sometimes/Rarely]

## Reproduction Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Observe issue]

## Evidence Collected

### Error Messages

```
[Full error message and stack trace]
```

### Test Results

[Failing tests and output]

### Recent Changes

[Relevant recent commits or changes]

### Relevant Code

```[language]
// Code snippet where issue occurs
```

## Hypotheses

### Hypothesis 1: [Description]

**Likelihood**: [High/Medium/Low]

**Reasoning**: [Why this might be the cause]

**Test**: [How to verify this]

**Result**: [What happened when tested]

### Hypothesis 2: [Description]

[Same structure]

## Root Cause

**Cause**: [What is actually causing the issue]

**Location**: [File:line where the problem is]

**Explanation**: [Why this causes the observed behavior]

**Example**:
```[language]
// BAD - Current code causing issue
def calculate(value):
    return value / 0  # Division by zero!

// GOOD - Fix
def calculate(value):
    if value == 0:
        return 0
    return 10 / value
```

## Impact Analysis

**Affected areas**:
- [System/component 1]
- [System/component 2]

**Related issues**:
- [Any related bugs this might explain]

**Regression risk**:
- [What might break if we fix this]

## Proposed Fix

### Minimal Fix

**Change**:
```[language]
// Show exact code change
```

**Files to modify**:
- `path/to/file.ext` - [What to change]

**Regression test**:
```[language]
// Test to prevent this from happening again
def test_issue_X_does_not_recur():
    # Reproduce the issue
    # Verify it doesn't happen
    ...
```

### Verification Plan

- [ ] Fix applied
- [ ] Regression test added
- [ ] Regression test fails before fix
- [ ] Regression test passes after fix
- [ ] All other tests still pass
- [ ] Manual verification (if applicable)

### Prevention

**Add to COMMON_PITFALLS.md?** [Yes/No]

**Reason**: [Why this is a common pitfall]

**Pattern to avoid**:
```[language]
// ❌ BAD - What caused this issue
```

**Better pattern**:
```[language]
// ✅ GOOD - How to avoid it
```

## Related Issues

[Any other issues this might fix or cause]

## Next Steps

1. [Action 1]
2. [Action 2]
3. [Action 3]
```

## Example: Debug Report

```markdown
# Debug Report: FireComponent Not Applying Burn Damage

## Problem Statement

**Expected**: FireComponent should apply 6.67 DPS burn for 3 seconds

**Actual**: No burn damage is applied

**Severity**: High

**Reproducible**: Always

## Reproduction Steps

1. Create entity with 100 HP
2. Apply FireComponent
3. Attack entity with fire tower
4. Wait 3 seconds
5. Observe: HP is still 100 (should be 80)

## Evidence Collected

### Test Results

```
FAILED test_fire_component_applies_burn
Expected: 80 HP
Actual: 100 HP
```

### Recent Changes

Commit abc123: "Add FireComponent"

### Relevant Code

```python
# fire_component.py
def on_hit(self, target, context):
    burn = BurnStatus(duration=3.0, dps=6.67)
    target.statuses.append(burn)  # Adding to list
    # ... but not applying to game state!
```

## Hypotheses

### Hypothesis 1: Status not being processed

**Likelihood**: High

**Reasoning**: Burn is added to list but may not be registered with status processor

**Test**: Check if status_processor.process_statuses() is being called

**Result**: Confirmed - statuses added to list but processor never sees them

### Hypothesis 2: DPS calculation wrong

**Likelihood**: Low

**Reasoning**: Formula might be incorrect

**Test**: Check if burn is actually ticking

**Result**: Burn never ticks because it's not in processor

## Root Cause

**Cause**: Adding status to entity's local list, but not registering with StatusProcessor

**Location**: `core/components/fire_component.py:45`

**Explanation**: The status is appended to target.statuses (local list) but StatusProcessor maintains its own list of active statuses. Need to call `context.status_processor.add_status(burn)` to actually apply it.

**Example**:
```python
# BAD - Current code
def on_hit(self, target, context):
    burn = BurnStatus(duration=3.0, dps=6.67)
    target.statuses.append(burn)  # Only local

# GOOD - Fix
def on_hit(self, target, context):
    burn = BurnStatus(duration=3.0, dps=6.67)
    context.status_processor.add_status(target.id, burn)  # Register with processor
```

## Impact Analysis

**Affected areas**:
- FireComponent (main issue)
- Any other components adding statuses locally (IceComponent, PoisonComponent)

**Related issues**:
- Might explain why IceComponent also doesn't work

**Regression risk**:
- Low - This is a bug fix, not a behavior change

## Proposed Fix

### Minimal Fix

**Change**:
```python
def on_hit(self, target, context):
    burn = BurnStatus(duration=3.0, dps=6.67)
    context.status_processor.add_status(target.id, burn)
```

**Files to modify**:
- `core/components/fire_component.py` - Fix on_hit method
- `core/components/ice_component.py` - Same fix
- `core/components/poison_component.py` - Same fix

**Regression test**:
```python
def test_fire_component_burn_applies_and_ticks():
    # Arrange
    entity = create_entity(health=100)
    fire = FireComponent()
    context = create_test_context()

    # Act
    fire.on_hit(entity, context)
    context.status_processor.update(1.0)  # Tick 1 second

    # Assert
    assert entity.health < 100, "Burn should deal damage"
    assert entity.health == 100 - 6.67, "Burn should deal 6.67 DPS"
```

### Verification Plan

- [ ] Fix applied to all three components
- [ ] Regression test added
- [ ] Regression test fails before fix
- [ ] Regression test passes after fix
- [ ] All other tests still pass
- [ ] Manual test: burn visibly ticks in game

### Prevention

**Add to COMMON_PITFALLS.md?** Yes

**Reason**: Easy to add to local list instead of registering with processor

**Pattern to avoid**:
```python
# ❌ BAD - Only updating local state
target.statuses.append(status)
```

**Better pattern**:
```python
# ✅ GOOD - Registering with processor
context.status_processor.add_status(target.id, status)
```

## Next Steps

1. Apply fix to all three components
2. Add regression tests
3. Run full test suite
4. Manual verification in game
5. Update COMMON_PITFALLS.md
6. Use `/evaluate` to verify fix
7. Use `/review` before committing
```

---

Begin debugging now. Ask questions systematically to narrow down the root cause.

What issue are you investigating?
