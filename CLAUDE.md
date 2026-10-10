# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Boundstoy is a static browser playground for ice sliding and timed bounds.
Scope: a shippable, consumer-facing game with at most ten focused levels,
a secondary level editor, and the existing four movement surfaces. Teach each
mechanic before combining it; build on existing mechanics only.
The playable set is the three Aftershock encounters: Slipstream, Borrowed Ground,
The Cut. Relay is retired to tests/fixtures only: the user rejected its low
difficulty and replay value. The approved Aftershock world (BT-024) must receive
gameplay feedback on these three encounters before expanding to eight stages.
Preserve their deliberate challenge, distinct clear/mastery routes and measured
timing margins. Do not silently apply forgiving onboarding margins.
Retries reset the encounter pattern, not elapsed time/deaths. Clean records and
mastery targets must never be awarded by checkpoint-assisted runs.
Explosions are lethal for exactly one simulation tick; lingering effects are
harmless. Do not restore sustained flames or stack consecutive detonations to
disguise a continuous damage window. Keep the four movement rules unchanged.
Changes to routes require exact legal replays, necessity checks and measured
input margins; these checks are not a substitute for worthwhile gameplay.
Do not restore the obsolete six-lesson/Pocket wave preservation constraints.
Do not add puzzle systems, accounts, telemetry or backend services. Keep the
main UI focused on playing, not a development dashboard.
Soft ice always glides at full speed with bounded turning, never braking.
Reverse input makes a U-turn; soft-ice wall contacts reflect momentum.
Hard ice remains direction-locked and stops at walls.

**Core Principles:**
- Test-Driven Development (TDD required, 100% pass rate)
- Data-Driven Design (registries and configuration)
- Immutable state from day one
- Headless-first architecture (rendering optional)
- Deterministic gameplay (seeded RNG)

**Platform:** Browser with WebGL2; Node 24+ for tooling.
**Engine/Framework:** TypeScript, Three.js (only runtime dependency), Vite.
Use Node's built-in test runner, not another test dependency.

## Quick Commands

See docs/PLATFORM.md for platform-specific build/test commands.

```bash
# Core workflow (adapt to your platform)
npm run build       # Type-check and static production build
npm test            # Node unit tests and deterministic course replays
npm run dev         # http://127.0.0.1:4321
npm run inspect -- 1 --replay
```

## Project Structure

```
/core/              # Pure game logic (platform-independent)
/application/       # Game loop, managers, orchestration
/presentation/      # UI/rendering layer (optional, platform-specific)
/data/              # JSON/config files (game content)
/tests/             # Test suite
/docs/              # Documentation
  ARCHITECTURE.md   # System design and patterns
  TESTING.md        # Test standards
  GAME_SYSTEMS.md   # Gameplay mechanics
  PLATFORM.md       # Platform-specific guide
  COMMON_PITFALLS.md # Frequent mistakes to avoid
```

## Core Architecture

**Immutable State & Deterministic Execution**
- Game state is immutable (functional transformations)
- All randomness through seeded RNG
- Pure functions for game logic
- Event-driven UI updates

**Layer Separation:**
```
Presentation (Optional) → reads state only
    ↓
Application → game loop, managers
    ↓
Core → entities, logic, rules
    ↓
Data → registries, loaders
```

**Critical Rule:** Core has ZERO dependencies on Application or Presentation.

See `docs/ARCHITECTURE.md` for comprehensive architecture documentation.

## Development Workflow

### ⚠️ CRITICAL: Work Standards

**NEVER claim work is complete without verification.**

This is absolutely critical and non-negotiable:

- **NEVER** mark task as "resolved" unless you verified it actually works
- **NEVER** say "implementation complete" if tests are failing
- **NEVER** pretend a problem is solved when it isn't
- **ALWAYS** run actual tests/verification before claiming it works
- **ALWAYS** be honest if something doesn't work yet or needs investigation

**Examples of what NOT to do:**
- ❌ Writing tests that fail, then marking task complete anyway
- ❌ Saying "this should work" without actually running it
- ❌ Moving on to documentation when implementation is broken
- ❌ Claiming "all tests pass" when you haven't run them

**Correct behavior:**
- ✅ Run the code, see it fail, debug until it works, THEN mark complete
- ✅ If tests fail, investigate and fix before moving on
- ✅ Be honest: "Implemented X but need to verify before marking complete"
- ✅ Actually run the game/tests and observe correct behavior

If you're caught claiming something is done when it's not, stop immediately and:
1. Acknowledge the mistake honestly
2. Actually verify the implementation works
3. Fix any issues found
4. Only then mark it as complete

### Test-Driven Development (MANDATORY)

1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up while keeping tests green
4. **VERIFY**: Run full test suite
5. **COMMIT**: Only when all tests pass (100% required)

**Quality Rules:**
- Tests must be at **100% pass rate** before any commit
- Run tests before and after every change
- Never implement features without tests first
- Use meaningful test names: `Method_Condition_Behavior`

## Custom Slash Commands

### Durable task coordination

Use `tasks/issues/*.md` for project work and handoffs. Read `tasks/README.md`
before coordinating multiple tasks. `tasks/INDEX.md` is generated; session todo
tools are not a replacement for the local records.

Only one orchestrator writes canonical issue state. Execute approved eligible
work, not backlog suggestions. Workers use their assigned worktree and return
evidence for review; only the orchestrator marks issues done after integration.
The profiles live in `.github/agents/`. Do not launch workers or create a broad
Git baseline commit merely because the profiles exist.

```sh
npm run tasks -- ready
npm run tasks -- index
npm run tasks:check
```

The template commands below help plan individual changes. Keep persistent
issues and approval in the tracker rather than creating competing plan files.

Use these commands for efficient workflow:

- `/plan` - Convert rough ideas into detailed specs (use at START of features)
- `/evaluate` - Verify work is complete (use BEFORE marking tasks done)
- `/review` - Pre-commit code review (use BEFORE every commit)
- `/debug` - Systematic issue investigation (use when tests fail)
- `/audit` - Architecture compliance check (use for refactoring)
- `/refactor` - Safe refactoring with test validation

**Recommended Workflows:**

**New Feature:**
```bash
/plan       # Break down feature into tasks
# ... implement ...
/evaluate   # Verify it works
/review     # Check quality
# ... commit ...
```

**Bug Fix:**
```bash
/debug      # Find root cause
# ... fix ...
/evaluate   # Verify fix works
/review     # Check fix quality
# ... commit ...
```

**Refactoring:**
```bash
/audit      # Identify issues
/plan       # Plan refactoring
/refactor   # Execute safely
/review     # Final check
# ... commit ...
```

See `.claude/commands/` for command details.

## Data-Driven Design

**Registry Pattern:**
- All game content defined in registries
- Immutable definitions (loaded once, frozen)
- Mutable instances (per-entity state)
- Reference by ID for memory efficiency

**Configuration:**
- Use JSON or structured config files
- Keep hardcoded values in `/data/` directory
- Extract magic numbers to named constants
- Document formulas and balance values

## Common Pitfalls

**Before committing, check docs/COMMON_PITFALLS.md for:**
- Hard-coded magic numbers (extract to constants)
- Missing imports
- Missing type hints/annotations
- Null/None handling
- Code duplication
- Deprecated API usage
- Layer violations (e.g., Core importing Presentation)

**Quick pre-commit checklist:**
```bash
# Run quality checks
npm run typecheck
npm test
npm run build
```

See docs/COMMON_PITFALLS.md for detailed examples and solutions.

## Documentation

- **ARCHITECTURE.md** - System design, patterns, naming conventions
- **TESTING.md** - Test standards, TDD workflow, quality gates
- **GAME_SYSTEMS.md** - Gameplay mechanics, formulas, systems
- **PLATFORM.md** - Platform-specific setup, build, tools
- **COMMON_PITFALLS.md** - Frequent mistakes and how to avoid them

## Platform-Specific Notes

See **docs/PLATFORM.md** for:
- Installation and setup
- Build commands
- Platform-specific dependencies
- IDE/editor configuration
- Debugging tools
- Asset pipeline (if applicable)

## Git Workflow

**When committing code:**
- If there are unrelated changes, ignore them (other Claude sessions may be active)
- Only commit changes relevant to your current task
- Use `git add <specific-files>` rather than `git add .`

**Always perform code review before commit:**
- Use `/review` command
- Check code correctness and project patterns
- Verify type hints and documentation
- Confirm test coverage
- Check performance implications
- Ensure consistency with codebase style

---

**Remember:** Use `/plan` at the start, `/evaluate` before completion, `/review` before commits.
