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
          "close": 2012,
          "open": 2013,
          "high": 2014,
          "low": 2011,
        },
        {
          "startDate": new Date("2015-01-01T00:00:00.000Z"),
          "endDate": new Date("2017-01-01T00:00:00.000Z"),
          "close": 2014,
          "open": 2015,
          "high": 2016,
          "low": 2013,
        },
        {
          "startDate": new Date("2017-01-01T00:00:00.000Z"),
          "endDate": new Date("2019-01-01T00:00:00.000Z"),
          "close": 2016,
          "open": 2017,
          "high": 2018,
          "low": 2015,
        },
        {
          "startDate": new Date("2019-01-01T00:00:00.000Z"),
          "endDate": new Date("2021-01-01T00:00:00.000Z"),
          "close": 2018,
          "open": 2019,
          "high": 2020,
          "low": 2017,
        },
      ],
      "epic2": [
        {
          "startDate": new Date("2013-01-01T00:00:00.000Z"),
          "endDate": new Date("2015-01-01T00:00:00.000Z"),
          "close": 4025,
          "open": 4026,
          "high": 4027,
          "low": 4024,
        },
        {
          "startDate": new Date("2015-01-01T00:00:00.000Z"),
          "endDate": new Date("2017-01-01T00:00:00.000Z"),
          "close": 4029,
          "open": 4030,
          "high": 4031,
          "low": 4028,
        },
        {
          "startDate": new Date("2017-01-01T00:00:00.000Z"),
          "endDate": new Date("2019-01-01T00:00:00.000Z"),
          "close": 4033,
          "open": 4034,
          "high": 4035,
          "low": 4032,
        },
        {
          "startDate": new Date("2019-01-01T00:00:00.000Z"),
          "endDate": new Date("2021-01-01T00:00:00.000Z"),
          "close": 4037,
          "open": 4038,
          "high": 4039,
          "low": 4036,
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

