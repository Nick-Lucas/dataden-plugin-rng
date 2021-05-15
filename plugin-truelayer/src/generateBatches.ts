import { DateTime, Duration } from "luxon";

export interface Batch {
  dateFromISO: string;
  dateToISO: string;
  failCount: number;
}
export function generateBatches(fromDateISO: string, toDateISO: string, batchLengthMonths: number): Batch[] {
  const batches: Batch[] = [];

  const grain = Duration.fromObject({
    months: batchLengthMonths
  });

  let left = DateTime.fromISO(fromDateISO);
  const toDate = DateTime.fromISO(toDateISO);

  while (left.valueOf() < toDate.valueOf()) {
    const right = DateTime.min(left.plus(grain), toDate);

    batches.push({
      dateFromISO: left.toISO(),
      dateToISO: right.toISO(),
      failCount: 0
    });

    left = right;
  }

  return batches;
}
