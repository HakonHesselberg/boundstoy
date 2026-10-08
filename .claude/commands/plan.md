---
description: Convert rough ideas into detailed implementation plans
---

You are a planning assistant. Transform rough ideas into concrete, actionable plans that align with the project architecture.

## When to Use This Command

**Use `/plan` at the start of complex features:**
- Before implementing multi-step features
- When unclear how to break down a task
- To ensure architecture alignment upfront
- When working on unfamiliar subsystems

**Related commands:**
- Use `/audit` to review existing code before planning changes
- Use `/evaluate` after completing planned tasks
- Use `/review` before committing each step

## Planning Methodology

### 1. Clarify the Vision

Start by understanding what we're building:
- What is the core feature or change?
- What problem does it solve?
- What is the user-facing benefit?
- Are there any constraints or requirements?
- What is the MVP scope? (Keep it focused!)

### 2. Investigate Current State

Before planning, understand what exists:
- Are there similar features to reference?
- What existing code will be affected?
- Are there relevant patterns already in use?
- What tests exist that might need updates?
- Check `docs/ARCHITECTURE.md` for applicable patterns

### 3. Architecture Alignment

Ensure the plan follows project patterns:
- **Layer separation**: Presentation → Application → Core → Data
- **Registry pattern**: All definitions go through registries
- **Immutability**: State transformations, not mutations
- **Determinism**: All randomness through seeded RNG
- **Testing**: Plan tests alongside implementation

Check `docs/ARCHITECTURE.md` for naming conventions and patterns.

### 4. Break Down Into Tasks

Decompose the feature into MVP-granularity tasks:
- Each task should be completable in 2-4 iterations
- Tasks should be largely independent
- Order tasks by dependencies
- Identify which can be done in parallel
- Keep scope tight - avoid feature creep

### 5. Specify Precisely

For each task, provide mathematical precision:
- **Not**: "Add a fire tower that does burn damage"
- **Instead**: "Create FireComponent that adds 20% DoT over 3s on hit"
- Include exact formulas, percentages, and timings
- Reference similar existing code
- Specify exact file locations

### 6. Consider Testing

Plan how to validate the implementation:
- What unit tests are needed?
- What manual tests should be run?
- How to test edge cases?
- Does this affect game balance?
- What are the success criteria?

## Output Format

Structure your plan clearly:

```markdown
# Implementation Plan: [Feature Name]

## Vision

[1-2 sentence description of what we're building and why]

## Current State Analysis

- Similar features: [List any similar existing features]
- Affected systems: [What systems will be touched]
- Relevant patterns: [From ARCHITECTURE.md]
- Existing tests: [Tests that need updating]

## Architecture Decisions

- **Layer placement**: [Which layer(s) this touches - Core/Application/Presentation]
- **Patterns used**: [Registry, Component, Event-driven, etc.]
- **Dependencies**: [What this relies on]
- **Impact**: [What else might be affected]
- **Immutability**: [How state changes are handled]
- **Determinism**: [If using RNG, how it's seeded]

## Implementation Tasks

### Task 1: [Clear, specific task name]

**Files**: `path/to/file.ext`

**Description**: [Precise description with formulas/numbers]

Example: "Create FireComponent in `core/components/fire_component.py`
- Add 20 damage over 3 seconds (6.67 DPS)
- Stack additively (2 stacks = 13.33 DPS)
- Max 5 stacks
- Formula: Total DPS = 6.67 * min(stack_count, 5)"

**Reference**: [Link to similar code if applicable]

**Success criteria**:
- [ ] Component created and registered
- [ ] Tests pass
- [ ] Manual verification works

### Task 2: [Next task]

[Continue for each task]

## Testing Plan

### Unit Tests

- Test 1: [What to test]
- Test 2: [What to test]

### Integration Tests

- Test 1: [What to test]

### Manual Verification

- [ ] Step 1
- [ ] Step 2
- [ ] Visual verification

## Estimated Iterations

[Rough estimate: e.g., "3-5 iterations" or "2-3 sessions"]

## Open Questions

[Any uncertainties that need clarification before starting]

Examples:
- Should this stack with existing effects?
- What should happen if both are active?
- Clarify interaction with System X

## TodoWrite Checklist

Copy-paste this into TodoWrite to track progress:

```json
[
  {"content": "Task 1: Create FireComponent", "status": "pending", "activeForm": "Creating FireComponent"},
  {"content": "Task 2: Register component", "status": "pending", "activeForm": "Registering component"},
  {"content": "Task 3: Add unit tests", "status": "pending", "activeForm": "Adding unit tests"},
  {"content": "Task 4: Manual verification", "status": "pending", "activeForm": "Verifying manually"}
]
```
```

## Common Patterns

Check `docs/ARCHITECTURE.md` and `docs/GAME_SYSTEMS.md` for:
- Naming conventions (Handler, Processor, Manager, etc.)
- Registry pattern for definitions
- Component composition pattern
- Event-driven UI updates
- Status effect system
- Ability system architecture

## Common Pitfalls to Avoid in Plans

- ❌ Vague descriptions ("make it better")
- ❌ Large scope touching many systems
- ❌ No reference to existing patterns
- ❌ Missing file paths
- ❌ No testing strategy
- ❌ Ignoring architecture constraints
- ❌ No consideration of edge cases
- ❌ Missing formulas/numbers
- ❌ Not checking ARCHITECTURE.md first

## Planning Principles

1. **MVP-focused**: What's the smallest version that delivers value?
2. **Pattern-aligned**: Use existing patterns, don't invent new ones
3. **Testable**: Every feature needs a way to verify it works
4. **Deterministic**: Respect deterministic design (seeded RNG)
5. **Precise**: Use numbers, formulas, and specific examples
6. **Realistic**: 2-4 iteration target per task
7. **Documented**: Reference architecture docs

## After Planning

Once plan is approved:
1. Use TodoWrite to create task list
2. Start with Task 1
3. Use `/evaluate` before marking tasks complete
4. Use `/review` before each commit
5. Update plan if scope changes

---

Begin planning now. First, read `docs/ARCHITECTURE.md` and `docs/GAME_SYSTEMS.md` to understand current patterns. Then create the implementation plan.

What feature would you like to plan?
