import { generateBatches, Batch } from "./generateBatches";

describe("generateBatches", () => {
  it('works on strings', () => {
    const batches = generateBatches(
      "2020-01-01T00:00:00Z",
      "2020-06-01T00:00:00Z",
      2
    )

    expect(batches).toEqual([
      {
        dateFromISO: "2020-01-01T00:00:00.000Z",
        dateToISO: "2020-03-01T00:00:00.000Z",
        failCount: 0
      },
      {
        dateFromISO: "2020-03-01T00:00:00.000Z",
        dateToISO: "2020-05-01T00:00:00.000Z",
        failCount: 0
      },
      {
        dateFromISO: "2020-05-01T00:00:00.000Z",
        dateToISO: "2020-06-01T00:00:00.000Z",
        failCount: 0
      },
    ] as Batch[])
  })

  it('works on dates', () => {
    const batches = generateBatches(
      new Date("2020-01-01T00:00:00Z"),
      new Date("2020-06-01T00:00:00Z"),
      2
    )

    expect(batches).toEqual([
      {
        dateFromISO: "2020-01-01T00:00:00.000Z",
        dateToISO: "2020-03-01T00:00:00.000Z",
        failCount: 0
      },
      {
        dateFromISO: "2020-03-01T00:00:00.000Z",
        dateToISO: "2020-05-01T00:00:00.000Z",
        failCount: 0
      },
      {
        dateFromISO: "2020-05-01T00:00:00.000Z",
        dateToISO: "2020-06-01T00:00:00.000Z",
        failCount: 0
      },
    ] as Batch[])
  })

  it('throws on invalid inputs', () => {
    expect(() => {
      generateBatches(
        "kjnasdkjnad",
        new Date("2020-01-01T00:00:00Z"),
        2
      )
    }).toThrowError(/Could not parse 'left' .*/)
    
    expect(() => {
      generateBatches(
        new Date("2020-01-01T00:00:00Z"),
        "asjinasdjnasd",
        2
      )
    }).toThrowError(/Could not parse 'toDate' .*/)
  })
})
