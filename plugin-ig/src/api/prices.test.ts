import mockAxios from 'jest-mock-axios'
import { Settings } from '../types'
import { AccountResult } from './ig-auth'
import { IGPrice, ApiResponse, Price, loadPrices, IGDataPointPrice } from "./prices"

describe("api prices", () => {
  const apiRespondsWith = (queueItem, prices: IGPrice<number>[]) => {
    mockAxios.mockResponse(
      {
        status: 200,
        data: {
          consolidated: true,
          transactionId: "abcdefg",
          intervalsDataPoints: prices
        } as ApiResponse
      },
      queueItem)
  }

  it("should call the API for correct batches", async () => {
    const promise = loadPrices(settings, console, "security-token", "2015-01-01", "2020-01-01", "sell", ["epic1", "epic2"])

    const queue = [...mockAxios.queue()]
    expect(queue.map(req => req.url)).toEqual(expect.arrayContaining([
      "/chart/snapshot/epic1/1/DAY/batch/start/2013/1/1/1/0/0/0/end/2015/1/1/1/0/0/0",
      "/chart/snapshot/epic1/1/DAY/batch/start/2017/1/1/1/0/0/0/end/2019/1/1/1/0/0/0",
      "/chart/snapshot/epic1/1/DAY/batch/start/2015/1/1/1/0/0/0/end/2017/1/1/1/0/0/0",
      "/chart/snapshot/epic1/1/DAY/batch/start/2019/1/1/1/0/0/0/end/2021/1/1/1/0/0/0",
      "/chart/snapshot/epic2/1/DAY/batch/start/2013/1/1/1/0/0/0/end/2015/1/1/1/0/0/0",
      "/chart/snapshot/epic2/1/DAY/batch/start/2015/1/1/1/0/0/0/end/2017/1/1/1/0/0/0",
      "/chart/snapshot/epic2/1/DAY/batch/start/2017/1/1/1/0/0/0/end/2019/1/1/1/0/0/0",
      "/chart/snapshot/epic2/1/DAY/batch/start/2019/1/1/1/0/0/0/end/2021/1/1/1/0/0/0",
    ]))

    for (const request of queue) {
      const regex = /\/chart\/snapshot\/(\w+)\/1\/DAY\/batch\/start\/(\d+)\/1\/1\/1\/0\/0\/0\/end\/(\d+)\/1\/1\/1\/0\/0\/0/
      const [, epic, yearStartStr, yearEndStr] = request.url.match(regex)
      const isEpic1 = epic === "epic1"
      
      apiRespondsWith(request, makeApiResponse(yearStartStr, yearEndStr, isEpic1 ? 1 : 2))
    }

    const result = await promise
    expect(result).toEqual({
      "epic1": [
        {
          "startDate": new Date("2013-01-01T00:00:00.000Z"),
          "endDate": new Date("2015-01-01T00:00:00.000Z"),
          "close": 20.12,
          "open": 20.13,
          "high": 20.14,
          "low": 20.11,
        },
        {
          "startDate": new Date("2015-01-01T00:00:00.000Z"),
          "endDate": new Date("2017-01-01T00:00:00.000Z"),
          "close": 20.14,
          "open": 20.15,
          "high": 20.16,
          "low": 20.13,
        },
        {
          "startDate": new Date("2017-01-01T00:00:00.000Z"),
          "endDate": new Date("2019-01-01T00:00:00.000Z"),
          "close": 20.16,
          "open": 20.17,
          "high": 20.18,
          "low": 20.15,
        },
        {
          "startDate": new Date("2019-01-01T00:00:00.000Z"),
          "endDate": new Date("2021-01-01T00:00:00.000Z"),
          "close": 20.18,
          "open": 20.19,
          "high": 20.20,
          "low": 20.17,
        },
      ],
      "epic2": [
        {
          "startDate": new Date("2013-01-01T00:00:00.000Z"),
          "endDate": new Date("2015-01-01T00:00:00.000Z"),
          "close": 40.25,
          "open": 40.26,
          "high": 40.27,
          "low": 40.24,
        },
        {
          "startDate": new Date("2015-01-01T00:00:00.000Z"),
          "endDate": new Date("2017-01-01T00:00:00.000Z"),
          "close": 40.29,
          "open": 40.30,
          "high": 40.31,
          "low": 40.28,
        },
        {
          "startDate": new Date("2017-01-01T00:00:00.000Z"),
          "endDate": new Date("2019-01-01T00:00:00.000Z"),
          "close": 40.33,
          "open": 40.34,
          "high": 40.35,
          "low": 40.32,
        },
        {
          "startDate": new Date("2019-01-01T00:00:00.000Z"),
          "endDate": new Date("2021-01-01T00:00:00.000Z"),
          "close": 40.37,
          "open": 40.38,
          "high": 40.39,
          "low": 40.36,
        },
      ],
    })
  })
})

const settings: Settings = {
  plugin: {
    backdateToISO: new Date(2010).toISOString(),
    batchLengthMonths: 2,
    igApiUri: "",
    includeRawData: false
  },
  schedule: {
    every: 1,
    grain: "week"
  },
  secrets: {
    igPassword: "",
    igUsername: ""
  }
}

function makeApiResponse(yearStartStr: string, yearEndStr: string, price: number): IGPrice<number>[] {
  const yearStart = parseInt(yearStartStr)
  const yearEnd = parseInt(yearEndStr)

  const innerPrice = (mod): IGDataPointPrice => ({
    ask: -(yearStart * price + mod),
    bid: (yearStart * price + mod),
    lastTraded: -(yearStart * price + mod)
  })

  return [
    {
      startTimestamp: new Date(yearStart, 0).valueOf(),
      endTimestamp: new Date(yearEnd, 0).valueOf(),
      tickCount: 0,
      dataPoints: [
        {
          timestamp: new Date(yearStart, 0).valueOf(),
          lastTradedVolume: 0,
          openPrice: innerPrice(0),
          closePrice: innerPrice(-1),
          highPrice: innerPrice(1),
          lowPrice: innerPrice(-2),
        }
      ]
    }
  ]  
}

