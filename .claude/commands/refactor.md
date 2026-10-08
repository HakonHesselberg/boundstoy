---
description: Safe refactoring with before/after test validation
---

You are a refactoring assistant. Execute safe, test-validated refactorings that improve code quality without changing behavior.

## When to Use This Command

**Use `/refactor` when:**
- After `/audit` identifies improvements
- After `/plan` details refactoring steps
- Code works but needs cleanup
- Want to improve structure without breaking things

**Related commands:**
- Use `/audit` first to identify what to refactor
- Use `/plan` to plan complex refactorings
- Use `/evaluate` after to verify nothing broke
- Use `/review` before committing

## Refactoring Principles

### 1. Red-Green-Refactor

**Process:**
1. **Red**: Tests exist and pass (if not, write tests first!)
2. **Green**: Tests still pass (verify before refactoring)
3. **Refactor**: Improve code structure
4. **Verify**: Tests still pass (prove behavior unchanged)

### 2. Small Steps

**Rules:**
- Make one change at a time
- Run tests after each change
- Commit working state frequently
- Can revert easily if something breaks

### 3. Behavior Preservation

**Critical:**
- External behavior must not change
- Internal implementation can change
- Tests must still pass
- Performance should not degrade significantly

## Safety Checklist

Before refactoring:
- [ ] Tests exist and pass (100%)
- [ ] Understand what code does
- [ ] Know why you're refactoring
- [ ] Have plan for changes
- [ ] Can measure success

During refactoring:
- [ ] Make small, incremental changes
- [ ] Run tests after each change
- [ ] Verify behavior unchanged
- [ ] Keep tests passing

After refactoring:
- [ ] All tests pass (100%)
- [ ] Code is cleaner/better
- [ ] Documentation updated
- [ ] Performance acceptable

## Common Refactorings

### Extract Constant

**When**: Hard-coded magic numbers

**Before**:
```python
if damage > 100:
    apply_critical()
```

**After**:
```python
CRITICAL_DAMAGE_THRESHOLD = 100

if damage > CRITICAL_DAMAGE_THRESHOLD:
    apply_critical()
```

**Steps**:
1. Define constant at top of file
2. Replace all uses of literal
3. Run tests

### Extract Function

**When**: Long function or code duplication

**Before**:
```python
def process_combat():
    # 50 lines of damage calculation
    result = attack - defense
    if result < 0:
        result = 0
    result = result * multiplier
    # ... more calculation
```

**After**:
```python
def process_combat():
    damage = calculate_damage(attack, defense, multiplier)
    # ... rest of logic

def calculate_damage(attack, defense, multiplier):
    result = attack - defense
    if result < 0:
        result = 0
    return result * multiplier
```

**Steps**:
1. Identify code to extract
2. Create new function
3. Copy code to new function
4. Replace original with function call
5. Run tests
6. Clean up parameters

### Rename Variable/Function

**When**: Unclear or misleading names

**Before**:
```python
def calc(a, b):
    return a - b
```

**After**:
```python
def calculate_damage_after_defense(attack, defense):
    return attack - defense
```

**Steps**:
1. Use IDE rename refactoring (if available)
2. Or manually rename in one place
3. Run tests
4. Rename in next place
5. Repeat until done

### Inline Function

**When**: Function is trivial and used once

**Before**:
```python
def get_hp(entity):
    return entity.health

# Used once
hp = get_hp(player)
```

**After**:
```python
hp = player.health
```

### Move Function

**When**: Function in wrong class/file

**Before**:
```python
# In presentation/renderer.py
def calculate_damage(attack, defense):  # Game logic in UI!
    return attack - defense
```

**After**:
```python
# In core/combat.py
def calculate_damage(attack, defense):
    return attack - defense

# In presentation/renderer.py
from core.combat import calculate_damage
```

**Steps**:
1. Copy function to new location
2. Update imports
3. Run tests
4. Remove from old location
5. Run tests again

### Extract Class

**When**: Class has too many responsibilities (God class)

**Before**:
```python
class GameManager:
    # 500 lines
    # Handles combat, UI, input, physics, etc.
    ...
```

**After**:
```python
class CombatManager:
    # Handles only combat
    ...

class InputManager:
    # Handles only input
    ...

class GameManager:
    # Coordinates managers
    def __init__(self):
        self.combat = CombatManager()
        self.input = InputManager()
```

### Replace Conditional with Polymorphism

**When**: Large if/else or switch on type

**Before**:
```python
def get_damage(entity):
    if entity.type == "warrior":
        return 10
    elif entity.type == "mage":
        return 8
    elif entity.type == "archer":
        return 12
```

**After**:
```python
class Warrior:
    def get_damage(self):
        return 10

class Mage:
    def get_damage(self):
        return 8

# Usage
damage = entity.get_damage()
```

## Process

### Step 1: Verify Tests Pass

```bash
<test-command>
```

**All tests must pass before refactoring!**

If tests don't exist:
1. Write tests first
2. Verify they pass
3. Then refactor

### Step 2: Make Change

**Choose ONE refactoring** from plan:
- Extract constant
- Extract function
- Rename
- Move
- etc.

**Make minimal change** to achieve goal.

### Step 3: Verify Tests Still Pass

```bash
<test-command>
```

**If tests fail:**
- Undo change
- Figure out why
- Try smaller step
- Or fix tests if they're wrong

**If tests pass:**
- Commit (optional)
- Move to next refactoring

### Step 4: Repeat

Continue with next refactoring in plan.

## Output Format

```markdown
# Refactoring Report: [Description]

## Goal

**Objective**: [What we're improving]

**Motivation**: [Why this refactoring is needed]

**Success Criteria**:
- [ ] Tests pass before
- [ ] Tests pass after
- [ ] Code is cleaner/better
- [ ] Behavior unchanged

## Before State

**Test Results** (Before):
```
<test-command>
[Output showing all tests pass]
```

**Code Metrics** (Before):
- Lines of code: [X]
- Cyclomatic complexity: [X]
- Code duplication: [X%]
- Function length: [X lines average]

## Refactoring Steps

### Step 1: [Refactoring name]

**Type**: [Extract function/Rename/Move/etc.]

**Change**:
```[language]
// Before
[old code]

// After
[new code]
```

**Files modified**:
- `path/to/file.ext`

**Test result**: [PASS/FAIL]

### Step 2: [Next refactoring]

[Same structure]

### Step 3: [Next refactoring]

[Same structure]

## After State

**Test Results** (After):
```
<test-command>
[Output showing all tests still pass]
```

**Code Metrics** (After):
- Lines of code: [X] (change: [+/-Y])
- Cyclomatic complexity: [X] (change: [+/-Y])
- Code duplication: [X%] (change: [+/-Y%])
- Function length: [X lines average] (change: [+/-Y])

## Verification

**Behavior preserved**: [YES/NO]
- [ ] All tests pass
- [ ] Manual testing confirms same behavior
- [ ] Performance is acceptable

**Code quality improved**: [YES/NO]
- [ ] More readable
- [ ] Better structure
- [ ] Follows patterns
- [ ] Less duplication

## Changes Summary

**Files modified**: [count]
- `file1.ext` - [What changed]
- `file2.ext` - [What changed]

**Lines changed**: +[X] -[Y]

**Tests**: [X/Y passing] (100%)

## Documentation Updates

**Files to update**:
- [ ] ARCHITECTURE.md - [If patterns changed]
- [ ] GAME_SYSTEMS.md - [If mechanics changed]
- [ ] COMMON_PITFALLS.md - [If new pattern emerged]
- [ ] Code comments - [Updated]

## Next Steps

1. Use `/evaluate` to verify completeness
2. Use `/review` before committing
3. Commit with message: "refactor: [description]"
4. [Any follow-up refactorings]
```

## Example: Refactoring Report

```markdown
# Refactoring Report: Extract DoT Status Logic

## Goal

**Objective**: Eliminate code duplication in fire and poison components

**Motivation**: Both components have identical DoT application logic (16 lines duplicated). Makes maintenance harder and increases bug risk.

**Success Criteria**:
- [x] Tests pass before
- [ ] Tests pass after
- [ ] Code is cleaner
- [ ] Behavior unchanged

## Before State

**Test Results** (Before):
```
pytest tests/ -v
48 passed in 2.3s
```

**Code Metrics** (Before):
- Lines of code: 1200
- Code duplication: 3% (2 instances of 16 lines)
- fire_component.py: 80 lines
- poison_component.py: 85 lines

## Refactoring Steps

### Step 1: Create StatusEffectHelper

**Type**: Extract class

**Change**:
```python
// New file: core/effects/status_helper.py
class StatusEffectHelper:
    @staticmethod
    def apply_dot_status(target, status_type, dps, duration, context):
        """Apply damage-over-time status to target"""
        status = status_type(
            target_id=target.id,
            dps=dps,
            duration=duration,
            start_time=context.game_time
        )
        context.status_processor.add_status(target.id, status)
        return status
```

**Files modified**:
- `core/effects/status_helper.py` (created)

**Test result**: PASS (48/48)

### Step 2: Update FireComponent to use helper

**Type**: Replace with function call

**Change**:
```python
// Before
def on_hit(self, target, context):
    status = BurnStatus(
        target_id=target.id,
        dps=self.BURN_DPS,
        duration=self.BURN_DURATION,
        start_time=context.game_time
    )
    context.status_processor.add_status(target.id, status)

// After
def on_hit(self, target, context):
    StatusEffectHelper.apply_dot_status(
        target,
        BurnStatus,
        self.BURN_DPS,
        self.BURN_DURATION,
        context
    )
```

**Files modified**:
- `core/components/fire_component.py`

**Test result**: PASS (48/48)

### Step 3: Update PoisonComponent to use helper

**Type**: Replace with function call

**Change**:
```python
// Before
def on_hit(self, target, context):
    status = PoisonStatus(
        target_id=target.id,
        dps=self.POISON_DPS,
        duration=self.POISON_DURATION,
        start_time=context.game_time
    )
    context.status_processor.add_status(target.id, status)

// After
def on_hit(self, target, context):
    StatusEffectHelper.apply_dot_status(
        target,
        PoisonStatus,
        self.POISON_DPS,
        self.POISON_DURATION,
        context
    )
```

**Files modified**:
- `core/components/poison_component.py`

**Test result**: PASS (48/48)

## After State

**Test Results** (After):
```
pytest tests/ -v
48 passed in 2.3s
```

**Code Metrics** (After):
- Lines of code: 1205 (+5 total, but -32 duplicated)
- Code duplication: 0% (-3%)
- fire_component.py: 68 lines (-12)
- poison_component.py: 73 lines (-12)
- status_helper.py: 17 lines (new)

## Verification

**Behavior preserved**: YES
- [x] All tests pass (48/48)
- [x] Manual testing confirms same burn/poison behavior
- [x] Performance unchanged

**Code quality improved**: YES
- [x] No duplication
- [x] Clear helper function
- [x] Easier to maintain
- [x] Single source of truth for DoT logic

## Changes Summary

**Files modified**: 3
- `core/effects/status_helper.py` - Created helper class
- `core/components/fire_component.py` - Use helper
- `core/components/poison_component.py` - Use helper

**Lines changed**: +17 -32 (net: -15)

**Tests**: 48/48 passing (100%)

## Documentation Updates

**Files to update**:
- [ ] ARCHITECTURE.md - Add StatusEffectHelper to naming conventions
- [x] GAME_SYSTEMS.md - No change needed
- [x] COMMON_PITFALLS.md - No change needed
- [x] Code comments - Helper is well-documented

## Next Steps

1. Update ARCHITECTURE.md with StatusEffectHelper
2. Use `/evaluate` to verify completeness
3. Use `/review` before committing
4. Commit with message: "refactor: extract DoT status logic to helper"
```

---

Begin refactoring now. First verify all tests pass, then make changes incrementally, testing after each step.

What would you like to refactor?
