import { DateTime } from "luxon";

export function float(value: string) {
  const num: number = parseFloat(value)
  if (isNaN(num)) {
    return 0
  }
  return num
}

export function date(value: string, format=null) {
  const date: Date = format
    ? DateTime.fromFormat(value, format).toJSDate()
    : new Date(value)

  return date
}

export function dateFromComponents(dateValue: string, timeValue: string, format="dd/MM/yyyy") {
  const [hour, minute, second] = (timeValue || '00:00:00')
    .split(":")
    .map(str => parseInt(str))

  return DateTime.fromFormat(dateValue, format)
                 .set({ hour, minute, second })
                 .toJSDate()
}
