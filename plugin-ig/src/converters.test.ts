import { dateFromComponents, round, weightedAverage } from "./converters";

describe("converters", () => {
  describe("round", () => {
    it("should round a decimal", () => {
      expect(round(0.505)).toBe(0.51)
    })

    it("should ignore a whole number", () => {
      expect(round(1.0)).toBe(1)
    })
  })

  describe("weighted average", () => {
    it ("should work for two sets of numbers", () => {
      expect(weightedAverage(1, 0, 1, 100)).toBe(50)
    })

    it ("should weight the result", () => {
      expect(weightedAverage(1, 0, 3, 100)).toBe(75)
    })

    it ("should work for an empty left side", () => {
      expect(weightedAverage(0, 0, 1, 100)).toBe(100)
    })

    it ("should work for an empty right side", () => {
      expect(weightedAverage(1, 100, 0, 0)).toBe(100)
    })
  })

  describe("dateFromComponents", () => {
    it ("should convert a valid date string", () => {
      expect(dateFromComponents("25/06/2010", "08:15:01", "dd/MM/yyyy"))
        .toBe(new Date("2010-06-25T08:15:01:000"))
    })
  })
})
