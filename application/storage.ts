export type Run = Readonly<{ ticks: number; deaths: number }>;
export type Progress = Readonly<Record<string, Run>>;
export const PROGRESS_KEY = 'boundstoy.progress.v1';
export const DRAFT_KEY = 'boundstoy.draft.v1';

export function readProgress(source: string | null): Progress {
  if (source === null) return {};
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) {
    throw new Error('Unsupported progress version.');
  }
  if (!('runs' in value) || !value.runs || typeof value.runs !== 'object' || Array.isArray(value.runs)) {
    throw new Error('Saved runs are invalid.');
  }
  const runs: Record<string, Run> = {};
  for (const [id, run] of Object.entries(value.runs)) {
    if (!/^[a-z0-9-]{1,60}$/.test(id) || !run || typeof run !== 'object'
      || !Number.isSafeInteger(run.ticks) || run.ticks < 1
      || !Number.isSafeInteger(run.deaths) || run.deaths < 0) throw new Error('Saved run is invalid.');
    runs[id] = { ticks: run.ticks, deaths: run.deaths };
  }
  return runs;
}
export function recordFinish(progress: Progress, id: string, ticks: number, deaths: number): Progress {
  const previous = progress[id];
  if (previous && (previous.ticks < ticks || previous.ticks === ticks && previous.deaths <= deaths)) return progress;
  return { ...progress, [id]: { ticks, deaths } };
}
