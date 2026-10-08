---
description: Architecture compliance review and refactoring recommendations
---

You are an architecture audit assistant. Review code for compliance with project patterns and recommend improvements.

## When to Use This Command

**Use `/audit` when:**
- Before major refactoring
- Code feels messy or hard to maintain
- Unsure if code follows project patterns
- Planning architectural improvements
- Technical debt review

**Related commands:**
- Use `/plan` after audit to plan refactoring
- Use `/refactor` to execute safe refactoring
- Use `/review` before committing changes

## Audit Process

### 1. Understand Scope

**What to audit:**
- Specific file/directory
- Entire system
- Recent changes
- High-churn areas

**Goals:**
- Identify architectural violations
- Find technical debt
- Recommend improvements
- Prioritize refactoring

### 2. Check Architecture Compliance

From docs/ARCHITECTURE.md, verify:

**Layer Separation**
- [ ] Core has no Presentation/Application imports
- [ ] Application has no Presentation imports
- [ ] Dependencies flow correctly (Presentation → Application → Core → Data)
- [ ] Presentation only reads state, doesn't modify

**Naming Conventions**
- [ ] Correct suffixes (Handler, Processor, Manager, System, Service, etc.)
- [ ] Names are descriptive
- [ ] No generic names (Helper, Util, etc.)

**Design Patterns**
- [ ] Registry pattern for definitions
- [ ] Composition over inheritance
- [ ] Event-driven UI updates
- [ ] Immutable state transformations
- [ ] Deterministic gameplay (seeded RNG)

**File Organization**
- [ ] Files in correct directories
- [ ] Related code grouped logically
- [ ] No orphaned files

### 3. Check Code Quality

From docs/COMMON_PITFALLS.md, look for:

- [ ] Hard-coded magic numbers
- [ ] Missing type hints/annotations
- [ ] Code duplication
- [ ] Layer violations
- [ ] Breaking immutability
- [ ] Non-deterministic operations
- [ ] Poor null/none handling
- [ ] Mutable default arguments (Python)

### 4. Check Testability

**Test coverage:**
- [ ] Core logic has unit tests
- [ ] Integration tests for system interactions
- [ ] Tests follow naming convention
- [ ] Tests are maintainable

**Design for testability:**
- [ ] Pure functions where possible
- [ ] Dependencies injected
- [ ] State is mockable
- [ ] No hidden global state

### 5. Check Maintainability

**Code clarity:**
- [ ] Functions are focused (single responsibility)
- [ ] Complex logic has comments
- [ ] Variable names are clear
- [ ] No deep nesting (>3 levels)

**Modularity:**
- [ ] High cohesion (related code together)
- [ ] Low coupling (minimal dependencies)
- [ ] Clear interfaces
- [ ] Encapsulation

### 6. Identify Technical Debt

**Smells:**
- God classes (too many responsibilities)
- Long functions (>50 lines)
- Repeated code (DRY violations)
- Complex conditionals
- Tight coupling
- Rigid architecture

## Output Format

```markdown
# Architecture Audit Report

## Scope

**Audited**: [Files/directories audited]

**Date**: [Date]

**Focus**: [What was specifically examined]

## Executive Summary

**Overall Grade**: [A/B/C/D/F]

**Key Findings**:
- [Finding 1]
- [Finding 2]
- [Finding 3]

**Immediate Actions**:
- [Action 1]
- [Action 2]

## Architecture Compliance

### Layer Separation

**Grade**: [A/B/C/D/F]

**Findings**:
- ✅ [What's correct]
- ❌ [Violations found]

**Examples**:
```[language]
// Violation example with file:line
```

**Recommendation**:
[How to fix]

### Naming Conventions

**Grade**: [A/B/C/D/F]

**Findings**:
- ✅ [Correct usage]
- ❌ [Incorrect usage]

**Examples**:
```[language]
// ❌ BAD
class Helper { }

// ✅ GOOD
class DamageCalculator { }
```

**Recommendation**:
[What to rename]

### Design Patterns

**Grade**: [A/B/C/D/F]

**Pattern Usage**:
- Registry: [Correct/Incorrect/Not Used]
- Composition: [Correct/Incorrect/Not Used]
- Events: [Correct/Incorrect/Not Used]
- Immutability: [Correct/Incorrect/Not Used]

**Findings**:
[What's good and what needs work]

**Recommendation**:
[Pattern improvements]

## Code Quality

### Common Pitfalls

**Hard-coded Values**: [Count] found
- `file.ext:line` - [Description]

**Type Hints**: [Count] missing
- `file.ext:line` - [Description]

**Code Duplication**: [Count] instances
- `file1.ext:line` and `file2.ext:line` - [Description]

**Layer Violations**: [Count] found
- `file.ext:line` - [Description]

[Continue for each pitfall]

### Code Smells

**God Classes**:
- `ClassName` (500 lines, 20 methods)
  - Responsibility: [Too many things]
  - Recommendation: [Split into X, Y, Z]

**Long Functions**:
- `function_name()` (120 lines)
  - Recommendation: [Extract helpers]

**Deep Nesting**:
- `file.ext:line` (5 levels)
  - Recommendation: [Early returns, extraction]

**Tight Coupling**:
- `ClassA` depends on 10 other classes
  - Recommendation: [Dependency injection, interfaces]

## Testability

**Grade**: [A/B/C/D/F]

**Test Coverage**:
- Core: [X%]
- Application: [X%]
- Presentation: [X%]

**Findings**:
- ✅ [Well-tested areas]
- ❌ [Untested areas]

**Recommendations**:
- Add tests for [areas]
- Refactor [class] for testability
- Mock [dependency]

## Maintainability

**Grade**: [A/B/C/D/F]

**Strengths**:
- [What makes it maintainable]

**Weaknesses**:
- [What makes it hard to maintain]

**Recommendations**:
- [Improvements]

## Technical Debt

### High Priority

**Debt Item 1**: [Description]
- **Impact**: [How it affects development]
- **Effort**: [Estimated time to fix]
- **Recommendation**: [How to address]

### Medium Priority

[Same structure]

### Low Priority

[Same structure]

## Refactoring Recommendations

### Immediate (This Sprint)

1. **[Refactoring 1]**
   - Files: [Affected files]
   - Reason: [Why this is important]
   - Approach: [How to do it]
   - Effort: [Time estimate]
   - Risk: [Low/Medium/High]

### Short-term (Next Sprint)

[Same structure]

### Long-term (Backlog)

[Same structure]

## Metrics

**Lines of Code**: [Count]

**Average Function Length**: [Lines]

**Cyclomatic Complexity**: [Average]

**Test Coverage**: [Percentage]

**Code Duplication**: [Percentage]

**Dependencies per Class**: [Average]

## Positive Patterns

[What's being done well]

Examples:
- ✅ Excellent use of composition in component system
- ✅ Clear separation of concerns in Core layer
- ✅ Good test coverage on combat system

## Anti-Patterns Found

[What should be avoided]

Examples:
- ❌ God class: GameManager handles 15 different responsibilities
- ❌ Shotgun surgery: Changing entity type requires updates in 8 files
- ❌ Spaghetti code: 5-level deep nesting in combat resolution

## Action Plan

### Week 1
- [ ] [Action 1]
- [ ] [Action 2]

### Week 2
- [ ] [Action 3]
- [ ] [Action 4]

### Month 1
- [ ] [Action 5]

## Conclusion

**Summary**: [Brief summary of findings]

**Priority**: [What to focus on first]

**Next Steps**:
1. Use `/plan` to plan refactoring
2. Use `/refactor` to execute changes
3. Re-audit in [timeframe]
```

## Example: Audit Report

```markdown
# Architecture Audit Report

## Scope

**Audited**: `/core/components/` (8 files, 1200 lines)

**Date**: 2025-01-15

**Focus**: Component system architecture and quality

## Executive Summary

**Overall Grade**: B

**Key Findings**:
- Layer separation is excellent (no violations)
- Some code duplication in status effects
- Missing type hints in 3 files
- Naming conventions mostly correct

**Immediate Actions**:
- Add type hints to fire_component.py, ice_component.py, poison_component.py
- Extract shared status effect logic
- Rename ComponentHelper to ComponentValidator

## Architecture Compliance

### Layer Separation

**Grade**: A

**Findings**:
- ✅ All components in Core layer
- ✅ No Presentation imports
- ✅ Dependencies correct

**Examples**:
No violations found.

**Recommendation**:
None - this is excellent.

### Naming Conventions

**Grade**: B

**Findings**:
- ✅ Most components use Component suffix correctly
- ❌ ComponentHelper should be ComponentValidator

**Examples**:
```python
# ❌ BAD
class ComponentHelper:  # Too generic
    def validate(component): ...

# ✅ GOOD
class ComponentValidator:  # Clear purpose
    def validate(component): ...
```

**Recommendation**:
Rename ComponentHelper → ComponentValidator

### Design Patterns

**Grade**: A

**Pattern Usage**:
- Registry: ✅ Correct - all components registered
- Composition: ✅ Correct - components modify stats
- Events: ✅ Correct - events for UI updates
- Immutability: ✅ Correct - no mutations

**Findings**:
Excellent adherence to patterns.

## Code Quality

### Common Pitfalls

**Hard-coded Values**: 2 found
- `fire_component.py:15` - Magic number 3.0 (burn duration)
  - Should be: BURN_DURATION = 3.0
- `ice_component.py:20` - Magic number 2.0 (freeze duration)
  - Should be: FREEZE_DURATION = 2.0

**Type Hints**: 12 missing
- `fire_component.py:10-15` - Missing return types on 4 methods
- `ice_component.py:8-12` - Missing return types on 3 methods
- `poison_component.py:15-20` - Missing return types on 5 methods

**Code Duplication**: 1 instance
- `fire_component.py:30-45` and `poison_component.py:35-50`
  - Both apply damage-over-time status
  - Should extract: apply_dot_status(target, status_type, dps, duration)

**Layer Violations**: 0 found

### Code Smells

**God Classes**: None

**Long Functions**: None

**Deep Nesting**: None

**Tight Coupling**:
- Components depend on StatusProcessor
  - This is acceptable - it's dependency injection

## Testability

**Grade**: A

**Test Coverage**:
- Components: 95% (excellent)

**Findings**:
- ✅ All components have comprehensive tests
- ✅ Tests follow naming convention
- ✅ Good edge case coverage

**Recommendations**:
None - test coverage is excellent.

## Maintainability

**Grade**: A

**Strengths**:
- Clear, focused classes
- Good separation of concerns
- Well-commented

**Weaknesses**:
- Some duplication (minor)

**Recommendations**:
- Extract shared status logic

## Technical Debt

### High Priority

None

### Medium Priority

**Debt Item 1**: Code duplication in DoT status application
- **Impact**: Changes need to be made in 2 places
- **Effort**: 1 hour
- **Recommendation**: Extract to StatusEffectHelper.apply_dot()

### Low Priority

**Debt Item 1**: Missing type hints
- **Impact**: Reduces IDE support, harder to catch bugs
- **Effort**: 30 minutes
- **Recommendation**: Add return type hints to all methods

## Refactoring Recommendations

### Immediate (This Sprint)

1. **Extract shared DoT logic**
   - Files: fire_component.py, poison_component.py
   - Reason: Eliminate duplication
   - Approach: Create apply_dot_status helper
   - Effort: 1 hour
   - Risk: Low (well-tested)

2. **Add type hints**
   - Files: fire_component.py, ice_component.py, poison_component.py
   - Reason: Improve code quality
   - Approach: Add return type annotations
   - Effort: 30 minutes
   - Risk: None

3. **Rename ComponentHelper**
   - Files: component_helper.py, tests
   - Reason: Clearer naming
   - Approach: Rename class and file
   - Effort: 15 minutes
   - Risk: Low

### Short-term (Next Sprint)

None identified.

### Long-term (Backlog)

None identified.

## Metrics

**Lines of Code**: 1200

**Average Function Length**: 12 lines (excellent)

**Cyclomatic Complexity**: 2.5 (excellent)

**Test Coverage**: 95%

**Code Duplication**: 3% (low)

**Dependencies per Class**: 1.2 (excellent)

## Positive Patterns

- ✅ Excellent use of composition pattern
- ✅ Clear separation of concerns
- ✅ Comprehensive test coverage
- ✅ Good documentation
- ✅ Consistent code style

## Anti-Patterns Found

None - code quality is high.

## Action Plan

### Week 1
- [ ] Extract DoT logic to helper (1 hour)
- [ ] Add type hints (30 min)
- [ ] Rename ComponentHelper (15 min)

## Conclusion

**Summary**: Component system is well-architected with minor quality improvements needed. No major issues found. Code follows project patterns excellently.

**Priority**: Add type hints and extract duplication (low risk, high value).

**Next Steps**:
1. Use `/plan` to plan the 3 refactorings
2. Use `/refactor` to execute changes safely
3. Re-audit in 1 month
```

---

Begin audit now. First read docs/ARCHITECTURE.md and docs/COMMON_PITFALLS.md, then analyze the code and provide comprehensive audit report.

What would you like to audit?
