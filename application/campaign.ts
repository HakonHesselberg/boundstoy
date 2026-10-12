import { bestClean, getWorldRecord, recordWorldFinish,
  type Progress, type Run, type WorldIdentity, type WorldRecords } from './storage.ts';

export function nextCourse(courses: readonly Readonly<{ id: string }>[], progress: Progress, after = -1): number | null {
  for (let offset = 1; offset <= courses.length; offset++) {
    const index = (after + offset) % courses.length;
    if (!Object.hasOwn(progress, courses[index].id) || !progress[courses[index].id]) return index;
  }
  return null;
}

export function finishResult(previous: Run | undefined, current: Run) {
  if (current.deaths === 0) {
    const clean = bestClean(previous);
    previous = clean === undefined ? undefined : { ticks: clean, deaths: 0 };
  } else if (previous?.deaths === 0) previous = undefined;
  return compareFinish(previous, current);
}

/** Time-first V2 personal-best feedback; deathless is separately bestClean(record). */
export function worldFinishResult(records: WorldRecords, world: WorldIdentity, current: Pick<Run, 'ticks' | 'deaths'>) {
  // Use the same validation boundary as recording; no storage or mutation.
  recordWorldFinish(records, world, current.ticks, current.deaths);
  return compareFinish(getWorldRecord(records, world), current);
}

function compareFinish(previous: Run | undefined, current: Pick<Run, 'ticks' | 'deaths'>) {
  const deltaTicks = previous ? current.ticks - previous.ticks : 0;
  const fewerRetries = previous ? previous.deaths - current.deaths : 0;
  const kind = !previous ? 'first' : deltaTicks < 0 || deltaTicks === 0 && fewerRetries > 0 ? 'best'
    : deltaTicks === 0 && fewerRetries === 0 ? 'equal' : 'slower';
  return { kind, deltaTicks, fewerRetries } as const;
}
