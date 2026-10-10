import { bestClean, type Progress, type Run } from './storage.ts';

export function nextCourse(courses: readonly Readonly<{ id: string }>[], progress: Progress, after = -1): number | null {
  for (let offset = 1; offset <= courses.length; offset++) {
    const index = (after + offset) % courses.length;
    if (!progress[courses[index].id]) return index;
  }
  return null;
}

export function finishResult(previous: Run | undefined, current: Run) {
  if (current.deaths === 0) {
    const clean = bestClean(previous);
    previous = clean === undefined ? undefined : { ticks: clean, deaths: 0 };
  } else if (previous?.deaths === 0) previous = undefined;
  const deltaTicks = previous ? current.ticks - previous.ticks : 0;
  const fewerRetries = previous ? previous.deaths - current.deaths : 0;
  const kind = !previous ? 'first' : deltaTicks < 0 || deltaTicks === 0 && fewerRetries > 0 ? 'best'
    : deltaTicks === 0 && fewerRetries === 0 ? 'equal' : 'slower';
  return { kind, deltaTicks, fewerRetries } as const;
}
