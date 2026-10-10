export type Run = Readonly<{ ticks: number; deaths: number; cleanTicks?: number }>;
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
    if (run.cleanTicks !== undefined) {
      if (!Number.isSafeInteger(run.cleanTicks) || run.cleanTicks < run.ticks)
        throw new Error('Saved clean time is invalid.');
      if (run.deaths > 0) runs[id] = { ...runs[id], cleanTicks: run.cleanTicks };
    }
  }
  return runs;
}
export function bestClean(run: Run | undefined): number | undefined {
  return run?.deaths === 0 ? run.ticks : run?.cleanTicks;
}
export function runRank(run: Run | undefined, target: number) {
  const clean = bestClean(run);
  return !run ? 'Uncleared' : clean === undefined ? 'Clear' : clean <= target ? 'Mastered' : 'Clean';
}
export function recordFinish(progress: Progress, id: string, ticks: number, deaths: number): Progress {
  const previous = progress[id];
  const best = previous && (previous.ticks < ticks || previous.ticks === ticks && previous.deaths <= deaths)
    ? previous : { ticks, deaths };
  const previousClean = bestClean(previous);
  const cleanTicks = deaths === 0 ? Math.min(previousClean ?? ticks, ticks) : previousClean;
  if (best === previous && cleanTicks === previousClean) return progress;
  return { ...progress, [id]: { ticks: best.ticks, deaths: best.deaths,
    ...(best.deaths > 0 && cleanTicks !== undefined ? { cleanTicks } : {}) } };
}
