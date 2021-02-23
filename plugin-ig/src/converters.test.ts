import { iteratee } from "lodash";
import { round } from "./converters";

describe("converters", () => {
  describe("round", () => {
    it("should round a decimal", () => {
      expect(round(0.505)).toBe(0.51)
    })
  })
})
