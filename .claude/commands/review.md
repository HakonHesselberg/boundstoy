---
description: Pre-commit code review against project standards
---

You are a code review assistant. Review changes against project standards before committing.

## When to Use This Command

**Use `/review` BEFORE every commit:**
- After implementing changes
- After `/evaluate` passes
- Before running git commit
- To catch issues early

**Related commands:**
- Use `/plan` to plan work
- Use `/evaluate` to verify completion
- Use `/debug` if review finds issues

## Review Process

### 1. Identify Changes

```bash
git status
git diff
```

List all changed files and understand scope.

### 2. Check Against COMMON_PITFALLS.md

Read docs/COMMON_PITFALLS.md and check each changed file for:

**Critical Issues:**
- ⚠️ Hard-coded magic numbers
- ⚠️ Layer violations (Core importing Presentation/Application)
- ⚠️ Breaking immutability
- ⚠️ Non-deterministic operations (Math.random(), Date.now())

**High Priority:**
- Missing type hints/annotations
- Missing imports
- Breaking existing tests
- Null/None handling issues
- New content not registered

**Medium Priority:**
- Code duplication
- Unclear variable names
- Missing comments on complex logic

**Low Priority:**
- Formatting inconsistencies
- Minor style issues

### 3. Architecture Compliance

From docs/ARCHITECTURE.md, verify:

**Naming Conventions:**
- Using correct suffixes (Handler, Processor, Manager, System, etc.)
- Names are descriptive and clear
- No generic names (Helper, Util, Manager without context)

**Layer Separation:**
- Dependencies flow correctly (Presentation → Application → Core → Data)
- Core has no dependencies on Application or Presentation
- Presentation only reads state, doesn't modify

**Patterns:**
- Registry pattern used for definitions
- Components use composition
- Events for UI communication
- Immutable state transformations

**Design Decisions:**
- Follows established patterns
- Doesn't reinvent existing solutions
- Justified if deviating from standards

### 4. Test Coverage

**For new features:**
- [ ] Unit tests added
- [ ] Integration tests added (if needed)
- [ ] Tests follow naming convention: Method_Condition_Behavior
- [ ] Tests use Arrange-Act-Assert structure
- [ ] All tests pass

**For bug fixes:**
- [ ] Regression test added
- [ ] Test reproduces original bug
- [ ] Test passes with fix

**For refactoring:**
- [ ] All existing tests still pass
- [ ] No test behavior changed unexpectedly

### 5. Documentation

**Code-level:**
- [ ] Complex logic has comments
- [ ] Functions have docstrings (if applicable)
- [ ] Magic numbers have explaining comments
- [ ] Public API is documented

**Project-level:**
- [ ] CLAUDE.md accurate?
- [ ] GAME_SYSTEMS.md updated if mechanics changed?
- [ ] ARCHITECTURE.md updated if patterns changed?
- [ ] COMMON_PITFALLS.md updated if new pitfall discovered?

### 6. Performance Considerations

**Check for:**
- Unnecessary iterations (can it be O(1) instead of O(n)?)
- Memory leaks (resources properly disposed?)
- Expensive operations in hot paths
- Caching opportunities

## Output Format

```markdown
# Code Review

## Summary

- **Files changed**: [count] files
- **Lines added/removed**: +[X] -[Y]
- **Scope**: [Brief description]
- **Type**: [Feature/Bugfix/Refactor/Docs]

## Files Changed

[List of files with brief description of changes]

1. `path/to/file1.ext` - [What changed]
2. `path/to/file2.ext` - [What changed]

## Issues Found

### Critical (Must Fix Before Commit)

[List critical issues or "None"]

Example:
- ❌ `core/entity.py:45` - Importing from presentation layer (violates architecture)
- ❌ `combat.py:120` - Using Math.random() instead of game.rng (breaks determinism)

### High (Should Fix Before Commit)

[List high priority issues or "None"]

Example:
- ⚠️ `damage_calculator.py:30` - Missing type hint on return value
- ⚠️ `enemy.py:15` - Magic number 100 should be CRITICAL_HEALTH_THRESHOLD

### Medium (Consider Fixing)

[List medium priority issues or "None"]

Example:
- 📝 `tower.py:50-65` - Duplicate code, could extract to helper
- 📝 `ability.py:100` - Complex formula needs explaining comment

### Low (Nice to Have)

[List low priority issues or "None"]

Example:
- 💡 `entity.py:20` - Variable name `tmp` could be more descriptive
- 💡 Formatting: inconsistent spacing

## Strengths

[What's good about this change]

Example:
- ✅ Good test coverage (8 new tests)
- ✅ Clear variable names
- ✅ Follows established patterns
- ✅ Well documented

## Architecture Compliance

**Layer Separation**: [PASS/FAIL] - [Details]

**Naming Conventions**: [PASS/FAIL] - [Details]

**Patterns**: [PASS/FAIL] - [Details]

**Immutability**: [PASS/FAIL] - [Details]

**Determinism**: [PASS/FAIL] - [Details]

## Test Coverage

**Unit Tests**: [ADEQUATE/NEEDS MORE] - [Details]

**Integration Tests**: [ADEQUATE/NEEDS MORE/NOT APPLICABLE] - [Details]

**Test Quality**: [GOOD/NEEDS IMPROVEMENT] - [Details]

## Documentation

**Code Comments**: [ADEQUATE/NEEDS MORE] - [Details]

**Docstrings**: [ADEQUATE/NEEDS MORE] - [Details]

**Project Docs**: [CURRENT/NEEDS UPDATE] - [Details]

## Performance

**Concerns**: [List any performance concerns or "None identified"]

**Opportunities**: [List optimization opportunities or "None identified"]

## Verdict

**[APPROVED / NEEDS WORK]**

## Action Items

[List what needs to be done before commit]

Example:
- [ ] Fix critical issue in core/entity.py line 45
- [ ] Add type hints to damage_calculator.py
- [ ] Extract CRITICAL_HEALTH_THRESHOLD constant
- [ ] Add comment explaining formula in ability.py
- [ ] Update GAME_SYSTEMS.md with new mechanic
```

## Review Checklist

Use this checklist for every review:

### Code Quality

- [ ] No hard-coded magic numbers
- [ ] All imports present
- [ ] Full type hints
- [ ] Defensive null checks
- [ ] No obvious duplication
- [ ] Clear variable names
- [ ] Comments on complex logic

### Architecture

- [ ] Correct layer separation
- [ ] Follows naming conventions
- [ ] Uses established patterns
- [ ] No anti-patterns
- [ ] Maintains immutability
- [ ] Preserves determinism

### Testing

- [ ] New features have tests
- [ ] Bug fixes have regression tests
- [ ] All tests pass
- [ ] Tests follow naming convention
- [ ] Tests are clear and maintainable

### Documentation

- [ ] Code is self-documenting or commented
- [ ] Public API has docstrings
- [ ] Project docs updated if needed
- [ ] COMMON_PITFALLS.md updated if new pitfall

### Common Pitfalls (from COMMON_PITFALLS.md)

- [ ] No magic numbers
- [ ] No missing imports
- [ ] No missing type hints
- [ ] No layer violations
- [ ] No mutable defaults (Python)
- [ ] No non-deterministic operations
- [ ] New content registered
- [ ] Resources properly cleaned up

## Example: Good Review

```markdown
# Code Review

## Summary

- **Files changed**: 3 files
- **Lines added/removed**: +120 -15
- **Scope**: Add FireComponent with burn DoT
- **Type**: Feature

## Files Changed

1. `core/components/fire_component.py` - New fire component
2. `data/component_registry.py` - Register fire component
3. `tests/unit/test_fire_component.py` - Tests for fire component

## Issues Found

### Critical (Must Fix Before Commit)

None

### High (Should Fix Before Commit)

- ⚠️ `fire_component.py:15` - Add type hint to `apply_burn` return value

### Medium (Consider Fixing)

- 📝 `fire_component.py:30-35` - Formula comment would help explain stacking

### Low (Nice to Have)

None

## Strengths

- ✅ Excellent test coverage (8 tests, all edge cases)
- ✅ Clear variable names (BURN_DURATION, BURN_DPS)
- ✅ Follows component pattern correctly
- ✅ Properly registered in registry
- ✅ Maintains immutability
- ✅ Well-structured code

## Architecture Compliance

**Layer Separation**: PASS - Fire component in core, no presentation dependencies

**Naming Conventions**: PASS - Uses Component suffix correctly

**Patterns**: PASS - Follows established component pattern, uses registry

**Immutability**: PASS - Returns new entity instances

**Determinism**: PASS - No random operations

## Test Coverage

**Unit Tests**: ADEQUATE - 8 tests covering all major paths

**Integration Tests**: NOT APPLICABLE - Will be tested in combat integration tests

**Test Quality**: GOOD - Clear names, good edge case coverage

## Documentation

**Code Comments**: ADEQUATE - Constants explained, but formula could use comment

**Docstrings**: ADEQUATE - Class and method docstrings present

**Project Docs**: NEEDS UPDATE - Should add to GAME_SYSTEMS.md status effects section

## Performance

**Concerns**: None identified

**Opportunities**: Could cache burn stack count instead of recalculating

## Verdict

**NEEDS WORK**

## Action Items

- [ ] Add type hint to `apply_burn` return value
- [ ] Add comment explaining burn stacking formula
- [ ] Update GAME_SYSTEMS.md with FireComponent details

Once these are addressed, ready to commit.
```

---

Begin review now. First read docs/COMMON_PITFALLS.md and docs/ARCHITECTURE.md, then analyze the changes and provide comprehensive review.
