import { DateTime } from "luxon";

const nonNumericRegexp = /[^\d\-\.]*/g

export function float(value: string): number {
  if (!value || value.trim() === '-') {
    return null
  }

  let saneValue = value.replace(nonNumericRegexp, '')

  const num: number = parseFloat(saneValue)
  if (isNaN(num)) {
    return 0
  }
  return num
}

export function date(value: string, format=null): Date {
  const date: Date = format
    ? DateTime.fromFormat(value, format, {zone: format ? 'utc' : undefined}).toJSDate()
    : new Date(value)

  return date
}

export function dateFromComponents(dateValue: string, timeValue: string, format="dd/MM/yyyy") {
  const [hour, minute, second] = (timeValue || '00:00:00')
    .split(":")
    .map(str => parseInt(str))

  return DateTime.fromFormat(dateValue, format, {zone: "utc"})
                 .set({ hour, minute, second })
                 .toJSDate()
}

export function round(val) {
  return Math.round(val * 100) / 100
}


export function weightedAverage(weightLeft: number, left: number, weightRight: number,  right: number) {
  return (weightLeft * left + weightRight * right) / (weightLeft + weightRight)
}
