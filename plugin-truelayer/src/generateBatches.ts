import { DateTime, Duration } from "luxon";

export interface Batch {
  dateFromISO: string;
  dateToISO: string;
  failCount: number;
}

export function generateBatches(fromDateISO: string | Date, toDateISO: string | Date, batchLengthMonths: number): Batch[] {
  const batches: Batch[] = [];

  const grain = Duration.fromObject({
    months: batchLengthMonths
  });

  if (fromDateISO instanceof Date) {
    fromDateISO = fromDateISO.toISOString()
  }
  if (toDateISO instanceof Date) {
    toDateISO = toDateISO.toISOString()
  }

  let left = DateTime.fromISO(fromDateISO).toUTC();
  const toDate = DateTime.fromISO(toDateISO).toUTC();

  if (!left.isValid) {
    throw new Error("Could not parse 'left' date when generating batches:" + left.invalidExplanation)
  }
  if (!toDate.isValid) {
    throw new Error("Could not parse 'toDate' date when generating batches:" + toDate.invalidExplanation)
  }

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
