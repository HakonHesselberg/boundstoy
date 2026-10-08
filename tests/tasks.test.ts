import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseIssue, validateIssues, readiness, renderIndex, runCli, type Issue,
} from '../scripts/tasks.ts';

function source(id = 'BT-001', overrides: Record<string, unknown> = {}, done = false) {
  const metadata = {
    id, title: `Task ${id}`, type: 'chore', status: done ? 'done' : 'ready', priority: 'P1',
    depends_on: [], parent: null, scope: [`core/${id}.ts`], approval: 'User approved this test task.',
    assignment: null, blocked_reason: null, ...overrides,
  };
  return `---\n${JSON.stringify(metadata, null, 2)}\n---
# ${id}: ${metadata.title}

## Problem
An observable problem to solve.

## Scope
Only the listed paths. No unrelated changes.

## Acceptance criteria
- [${done ? 'x' : ' '}] The required behaviour works.

## Implementation context
Read CLAUDE.md and the existing core.

## Verification
Run \`npm test\` and inspect the behaviour.

## Handoff
${done ? '- Summary: Implemented the behaviour.\n- Changes: Updated the scoped module.\n- Verification: Targeted tests passed.\n- Risks: None identified.\n- Commit: Integrated working-tree changes.' : 'Pending.'}

## Result
${done ? '- Summary: Accepted the result.\n- Verification: Integration checks passed.\n- Integration: Present in the main working tree.' : 'Pending.'}
`;
}
function issue(id = 'BT-001', overrides: Record<string, unknown> = {}, done = false): Issue {
  return parseIssue(source(id, overrides, done), `tasks/issues/${id}-task.md`);
}
function assigned(owner = 'worker-1') {
  return { owner, run: 'agent-run-123', branch: 'task/bt-001', worktree: '../boundstoy-bt-001' };
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'boundstoy-tasks-'));
  mkdirSync(join(root, 'tasks', 'issues'), { recursive: true });
  const put = (id: string, text: string) => writeFileSync(join(root, 'tasks', 'issues', `${id}-task.md`), text);
  return { root, put, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('ParseIssue_JSONFrontMatter_ReadsStableIdentityAndChecklists', () => {
  const parsed = issue();
  assert.equal(parsed.meta.id, 'BT-001');
  assert.equal(parsed.meta.status, 'ready');
  assert.equal(parsed.criteria.length, 1);
  assert.equal(parsed.criteria[0].checked, false);
  assert.match(parsed.sections.Verification, /npm test/);
});

test('ParseIssue_CRLFAndFencedHeadings_PreservesMarkdownSections', () => {
  const text = source().replace('Read CLAUDE.md and the existing core.', 'Example:\n```md\n## Result\nNot a real heading.\n```\nRead the core.');
  const parsed = parseIssue(text.replaceAll('\n', '\r\n'), 'tasks/issues/BT-001-task.md');
  assert.equal(parsed.sections.Result.trim(), 'Pending.');
});

test('ParseIssue_ExamplesAndComments_AreNotAcceptanceOrReviewEvidence', () => {
  const onlyExample = source().replace('- [ ] The required behaviour works.', '```md\n- [x] An example, not an acceptance criterion.\n```');
  assert.throws(() => parseIssue(onlyExample, 'tasks/issues/BT-001-task.md'), /Acceptance criteria/);
  const fakeEvidence = source('BT-001', { status: 'review', assignment: assigned() })
    .replace('## Handoff\nPending.', '## Handoff\nPending.\n<!--\n- Summary: Example\n- Changes: Example\n- Verification: Example\n- Risks: Example\n- Commit: Example\n-->');
  assert.throws(() => validateIssues([parseIssue(fakeEvidence, 'tasks/issues/BT-001-task.md')]), /Handoff/);
  assert.throws(() => issue('BT-0001'), /canonical|padding|ID/);
});

test('ParseIssue_InvalidMetadataAndPaths_RejectsWithIssueContext', () => {
  for (const overrides of [
    { status: 'working' }, { priority: 'urgent' }, { type: 'unknown' }, { surprise: true },
    { depends_on: 'BT-002' }, { depends_on: ['BT-002', 'BT-002'] },
    { scope: ['../secrets'] }, { scope: ['/etc'] }, { scope: ['core/**/*.ts'] },
    { scope: ['core\\file.ts'] }, { scope: [] }, { title: 'Bad\nheading' },
    { assignment: { owner: 'x' } },
  ]) {
    assert.throws(() => issue('BT-001', overrides), /BT-001/);
  }
  assert.throws(() => parseIssue('---\nid: BT-001\n---\n# Example', 'tasks/issues/BT-001-task.md'), /JSON/);
  assert.throws(() => parseIssue(source(), 'tasks/issues/BT-002-task.md'), /filename/i);
  assert.throws(() => parseIssue(source().replace('## Scope', '## Missing scope'), 'tasks/issues/BT-001-task.md'), /Scope/);
});

test('ValidateIssues_DuplicateMissingAndCyclicDependencies_Rejects', () => {
  assert.throws(() => validateIssues([issue(), issue()]), /Duplicate/);
  assert.throws(() => validateIssues([issue('BT-001', { depends_on: ['BT-099'] })]), /BT-099/);
  assert.throws(() => validateIssues([
    issue('BT-001', { depends_on: ['BT-002'] }),
    issue('BT-002', { depends_on: ['BT-001'] }),
  ]), /cycle/i);
  assert.throws(() => validateIssues([issue('BT-001', { depends_on: ['BT-001'] })]), /itself|cycle/i);
});

test('ValidateIssues_ApprovalAndAssignment_AreRequiredForActiveWork', () => {
  assert.throws(() => validateIssues([issue('BT-001', { approval: null })]), /approval/i);
  assert.throws(() => validateIssues([issue('BT-001', { status: 'in_progress' })]), /assignment/i);
  assert.throws(() => validateIssues([issue('BT-001', { status: 'blocked' })]), /blocked_reason/i);
  assert.throws(() => validateIssues([issue('BT-001', { assignment: assigned() })]), /assignment/i);
  assert.doesNotThrow(() => validateIssues([issue('BT-001', { status: 'backlog', approval: null })]));
  assert.doesNotThrow(() => validateIssues([issue('BT-001', { status: 'in_progress', assignment: assigned() })]));
});

test('Readiness_UnfinishedDependenciesAndUnapprovedBacklog_DoNotDispatch', () => {
  const approved = issue('BT-001', { depends_on: ['BT-002'] });
  const backlog = issue('BT-002', { status: 'backlog', approval: null });
  const independent = issue('BT-003');
  const issues = [approved, backlog, independent];
  validateIssues(issues);
  assert.equal(readiness(approved, issues).ready, false);
  assert.match(readiness(approved, issues).reasons.join(' '), /BT-002/);
  assert.equal(readiness(backlog, issues).ready, false);
  assert.equal(readiness(independent, issues).ready, true);
  assert.equal(readiness(approved, [approved, issue('BT-002', {}, true)]).ready, true);
});

test('Readiness_ActiveOverlappingScopes_AreSerializedIncludingBlockedOwners', () => {
  const candidate = issue('BT-001', { scope: ['core/simulation.ts'] });
  const other = issue('BT-002', { status: 'in_progress', scope: ['core/'], assignment: assigned() });
  assert.equal(readiness(candidate, [candidate, other]).ready, false);
  const prefixOnly = issue('BT-003', { status: 'in_progress', scope: ['core-extra/'], assignment: assigned('other') });
  assert.equal(readiness(candidate, [candidate, prefixOnly]).ready, true);
  const blocked = issue('BT-002', { status: 'blocked', scope: ['core/'], assignment: assigned(), blocked_reason: 'Needs a decision.' });
  assert.equal(readiness(candidate, [candidate, blocked]).ready, false);
  const released = issue('BT-002', { status: 'blocked', scope: ['core/'], blocked_reason: 'Worker stopped and scope released.' });
  assert.equal(readiness(candidate, [candidate, released]).ready, true);
  const repoWide = issue('BT-004', { status: 'review', scope: ['.'], assignment: assigned() }, true);
  assert.equal(readiness(candidate, [candidate, repoWide]).ready, false);
  const bareDirectory = issue('BT-002', { status: 'in_progress', scope: ['core'], assignment: assigned() });
  assert.equal(readiness(candidate, [candidate, bareDirectory]).ready, false, 'a missing trailing slash must not bypass a scope reservation');
});

test('ValidateIssues_ParentGroups_DoNotBecomeExecutableOrCloseEarly', () => {
  const parent = issue('BT-001', { type: 'epic', scope: [] });
  const child = issue('BT-002', { parent: 'BT-001' });
  validateIssues([parent, child]);
  assert.equal(readiness(parent, [parent, child]).ready, false);
  assert.equal(readiness(child, [parent, child]).ready, true);
  assert.throws(() => validateIssues([issue('BT-001', { type: 'epic', scope: [] }, true), child]), /child|BT-002/i);
  assert.throws(() => validateIssues([issue(), child]), /epic/i);
  assert.throws(() => validateIssues([
    issue('BT-001', { type: 'epic', scope: [], parent: 'BT-002' }),
    issue('BT-002', { type: 'epic', scope: [], parent: 'BT-001' }),
  ]), /cycle/i);
  assert.throws(() => validateIssues([parent, issue('BT-002', { parent: 'BT-001', depends_on: ['BT-001'] })]), /ancestor|deadlock/i);
  assert.doesNotThrow(() => validateIssues([issue('BT-001', { type: 'epic', status: 'in_progress', scope: [] }), child]));
  assert.throws(() => validateIssues([
    parent, issue('BT-002', { parent: 'BT-001', depends_on: ['BT-003'] }),
    issue('BT-003', { depends_on: ['BT-001'] }),
  ]), /cycle|deadlock/i);
});

test('Readiness_ParentApprovalAndPrerequisites_GateAllDescendants', () => {
  const child = issue('BT-002', { parent: 'BT-001' });
  const parent = issue('BT-001', { type: 'epic', scope: [], status: 'backlog', approval: null });
  assert.equal(readiness(child, [parent, child]).ready, false);
  const prerequisite = issue('BT-003', { status: 'backlog', approval: null });
  const waitingParent = issue('BT-001', { type: 'epic', scope: [], depends_on: ['BT-003'] });
  assert.equal(readiness(child, [waitingParent, child, prerequisite]).ready, false);
  assert.throws(() => validateIssues([
    waitingParent, issue('BT-002', { parent: 'BT-001', status: 'in_progress', assignment: assigned() }), prerequisite,
  ]), /parent|ancestor/i);
  assert.equal(readiness(child, [waitingParent, child, issue('BT-003', {}, true)]).ready, true);
});

test('ValidateIssues_ConcurrentClaims_RequireDifferentScopesOwnersAndWorktrees', () => {
  const a = issue('BT-001', { status: 'in_progress', scope: ['core/'], assignment: assigned('a') });
  const b = issue('BT-002', { status: 'in_progress', scope: ['core/simulation.ts'], assignment: { ...assigned('b'), worktree: '.worktrees/BT-002' } });
  assert.throws(() => validateIssues([a, b]), /overlap/);
  const sameTree = issue('BT-002', { status: 'in_progress', scope: ['presentation/'], assignment: assigned('b') });
  assert.throws(() => validateIssues([a, sameTree]), /worktree/);
  const sameOwner = issue('BT-002', { status: 'in_progress', scope: ['presentation/'], assignment: { ...assigned('a'), worktree: '.worktrees/BT-002' } });
  assert.throws(() => validateIssues([a, sameOwner]), /owner/);
  const sameBranch = issue('BT-002', { status: 'in_progress', scope: ['presentation/'], assignment: { ...assigned('b'), worktree: '.worktrees/BT-002' } });
  assert.throws(() => validateIssues([a, sameBranch]), /branch/);
  const absoluteTree = issue('BT-002', { status: 'in_progress', scope: ['presentation/'], assignment: { ...assigned('b'), branch: 'task/bt-002', worktree: '/project/worker' } });
  const relativeTree = issue('BT-001', { status: 'in_progress', scope: ['core/'], assignment: { ...assigned('a'), worktree: 'worker' } });
  assert.throws(() => validateIssues([relativeTree, absoluteTree], '/project'), /worktree/);
});

test('ValidateIssues_ReviewAndDone_RequireHandoffEvidenceAndCompletion', () => {
  assert.throws(() => validateIssues([issue('BT-001', { status: 'review', assignment: assigned() })]), /Handoff/);
  assert.throws(() => validateIssues([issue('BT-001', { status: 'done' })]), /Acceptance|criteria/i);
  const missingResult = source('BT-001', {}, true).replace('- Integration: Present in the main working tree.', '');
  assert.throws(() => validateIssues([parseIssue(missingResult, 'tasks/issues/BT-001-task.md')]), /Integration/);
  assert.doesNotThrow(() => validateIssues([issue('BT-001', {}, true)]));
});

test('RenderIndex_IsStableEscapesCellsAndExplainsWaitingWork', () => {
  const a = issue('BT-001', { title: 'A | table title', depends_on: ['BT-002'] });
  const b = issue('BT-002', { priority: 'P0', status: 'backlog', approval: null });
  const first = renderIndex([a, b]);
  assert.equal(first, renderIndex([b, a]));
  assert.ok(first.includes('A \\| table title'));
  assert.match(first, /issues\/BT-001-task\.md/);
  assert.match(first, /BT-002/);
  assert.doesNotMatch(first, /\d{4}-\d{2}-\d{2}T/);
});

test('Cli_IndexCheckAndJson_OperateOnMarkdownWithoutTouchingIssues', () => {
  const f = fixture();
  try {
    const original = source();
    f.put('BT-001', original);
    assert.throws(() => runCli(['check'], f.root), /INDEX|index/);
    assert.match(runCli(['index'], f.root), /INDEX/);
    const index = readFileSync(join(f.root, 'tasks/INDEX.md'), 'utf8');
    assert.match(runCli(['check'], f.root), /1 issue/);
    assert.equal(JSON.parse(runCli(['ready', '--json'], f.root))[0].id, 'BT-001');
    assert.equal(runCli(['next-id'], f.root).trim(), 'BT-002');
    assert.match(runCli(['brief', 'BT-001'], f.root), /Acceptance criteria/);
    assert.equal(runCli(['show', 'BT-001'], f.root), original);
    assert.equal(readFileSync(join(f.root, 'tasks/issues/BT-001-task.md'), 'utf8'), original);
    runCli(['index'], f.root);
    assert.equal(readFileSync(join(f.root, 'tasks/INDEX.md'), 'utf8'), index);
    f.put('BT-002', source('BT-002'));
    assert.throws(() => runCli(['check'], f.root), /stale|index/i);
  } finally { f.cleanup(); }
});

test('Cli_InvalidDataOrArguments_DoesNotRewriteIndex', () => {
  const f = fixture();
  try {
    f.put('BT-001', source());
    runCli(['index'], f.root);
    const original = readFileSync(join(f.root, 'tasks/INDEX.md'), 'utf8');
    f.put('BT-001', source('BT-001', { depends_on: ['BT-099'] }));
    assert.throws(() => runCli(['index'], f.root), /BT-099/);
    assert.equal(readFileSync(join(f.root, 'tasks/INDEX.md'), 'utf8'), original);
    assert.throws(() => runCli(['approve', 'BT-001'], f.root), /Usage|Unknown command/i);
    assert.throws(() => runCli(['ready', '--typo'], f.root), /Usage|argument/i);
    assert.equal(readdirSync(join(f.root, 'tasks')).some(name => name.startsWith('.INDEX-')), false);
  } finally { f.cleanup(); }
});

test('Cli_SymlinkIssueFiles_AreRejectedWithoutFollowingThem', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'external.md'), source());
    symlinkSync(join(f.root, 'external.md'), join(f.root, 'tasks/issues/BT-001-task.md'));
    assert.throws(() => runCli(['list'], f.root), /symlink|regular file/i);
    assert.equal(existsSync(join(f.root, 'tasks/INDEX.md')), false);
  } finally { f.cleanup(); }
});

test('AgentProfiles_HaveValidLocalRolesAndDocumentedReferences', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const orchestrator = readFileSync(join(root, '.github/agents/boundstoy-orchestrator.agent.md'), 'utf8');
  const worker = readFileSync(join(root, '.github/agents/boundstoy-worker.agent.md'), 'utf8');
  for (const [name, text] of [['boundstoy-orchestrator', orchestrator], ['boundstoy-worker', worker]]) {
    assert.ok(text.startsWith(`---\nname: ${name}\n`));
    assert.match(text, /^description: .+/m);
    assert.doesNotMatch(text, /^model:/m, 'model selection must inherit user configuration');
    const match = text.match(/^tools: (\[.*\])$/m);
    assert.ok(match);
    assert.ok(Array.isArray(JSON.parse(match[1])));
    assert.ok(text.length < 30_000);
  }
  assert.match(orchestrator, /^disable-model-invocation: true$/m);
  assert.match(orchestrator, /"agent"/);
  assert.match(worker, /^user-invocable: false$/m);
  assert.doesNotMatch(worker, /"agent"/);
  assert.match(worker, /do not edit `tasks\/`/i);
  assert.ok(existsSync(join(root, 'tasks/README.md')));
  assert.ok(existsSync(join(root, 'tasks/TEMPLATE.md')));
});

test('Cli_BacklogCannotBeBriefedAndEmptyTrackerIsValid', () => {
  const f = fixture();
  try {
    assert.equal(runCli(['next-id'], f.root).trim(), 'BT-001');
    assert.deepEqual(JSON.parse(runCli(['ready', '--json'], f.root)), []);
    runCli(['index'], f.root);
    assert.match(runCli(['check'], f.root), /0 issues/);
    f.put('BT-001', source('BT-001', { status: 'backlog', approval: null }));
    assert.throws(() => runCli(['brief', 'BT-001'], f.root), /unapproved/);
    assert.throws(() => runCli(['show', 'BT-099'], f.root), /Unknown issue/);
  } finally { f.cleanup(); }
});

test('Cli_NextIdOverflow_FailsInsteadOfSuggestingAnInvalidId', () => {
  const f = fixture();
  try {
    const last = `BT-${Number.MAX_SAFE_INTEGER}`;
    f.put(last, source(last));
    assert.throws(() => runCli(['next-id'], f.root), /range|IDs|overflow/i);
  } finally { f.cleanup(); }
});
test('Cli_ExecutableEntry_FailsClearlyWithoutStartingServices', () => {
  const script = fileURLToPath(new URL('../scripts/tasks.ts', import.meta.url));
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /ready/);
  const invalid = spawnSync(process.execPath, [script, 'not-a-command'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Unknown command|Usage/);
});
