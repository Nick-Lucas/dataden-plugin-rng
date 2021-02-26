import { DateTime, Duration } from "luxon";
import { Settings } from "src/types";
import { AccountResult, SessionResult } from "../api/ig-auth";

import type { FundingTransaction } from './loadFunding'
import type { Trade } from '../api/trades'
import { loadPortfolioSummary, PortfolioSlice } from './loadPortfolioSummary'
import _ from "lodash";

describe("loadPortfolioSummary", () => {
  let tradeData: Trade[] = []
  let fundingData: FundingTransaction[] = []
  let subject: typeof loadPortfolioSummary

  beforeEach(async () => {
    jest.resetModules()

    jest.doMock('./loadFunding', () => {
      return {
        __esModule: true,
        loadFunding: () => Promise.resolve([...fundingData])
      }
    })
    jest.doMock('../api/trades', () => {
      return {
        __esModule: true,
        loadAllTrades: () => Promise.resolve([...tradeData])
      }
    })

    subject = (await import('./loadPortfolioSummary')).loadPortfolioSummary
  })

  afterAll(() => {
    jest.resetAllMocks()
    jest.resetModules()
  })

  it ("should mock modules correctly", async () => {
    fundingData = []
    tradeData = []

    const portfolioSummary = await subject(settings, session, console, new Date())

    expect(portfolioSummary).toEqual([])
  })

  it ("should build a portfolio with funding only, rewound to the start of the first week", async () => {
    fundingData = [
      getFunding(0, 5000),
      getFunding(1, -2600),
    ]
    tradeData = []

    const portfolioSummary = await subject(settings, session, console, getDate(1).toJSDate())

    expect(portfolioSummary).toEqual<PortfolioSlice[]>([
      getPortfolioSlice({
        uniqueId: getDate(-1).toISO(),
        date: getDate(-1).toJSDate(),
      }),
      getPortfolioSlice({
        uniqueId: getDate(0).toISO(),
        date: getDate(0).toJSDate(),
        netFunding: 5000,
        cash: 5000,
        accountValue: 5000,
        transactions: [fundingData[0]]
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        netFunding: 2400,
        cash: 2400,
        accountValue: 2400,
        transactions: [fundingData[1]]
      })
    ])
  })

  it ("should build a portfolio with trades", async () => {
    fundingData = [
      getFunding(0, 5000),
    ]
    tradeData = [
      getTrade(0, 0, "AMD", {
        size: 100,
        price: 10,
        fees: 3
      })
    ]

    const portfolioSummary = await subject(settings, session, console, getDate(1).toJSDate())

    expect(portfolioSummary).toEqual<PortfolioSlice[]>([
      getPortfolioSlice({
        uniqueId: getDate(-1).toISO(),
        date: getDate(-1).toJSDate(),
      }),
      getPortfolioSlice({
        uniqueId: getDate(0).toISO(),
        date: getDate(0).toJSDate(),
        netFunding: 5000,
        cash: 3997,
        bookCost: 1003,
        bookValue: 1000,
        accountValue: 4997,
        feesPaid: 3,
        trades: [tradeData[0]],
        transactions: [fundingData[0]],
        positions: {
          "AMD": {
            stockId: "AMD",
            averagePrice: 10.03,
            size: 100,
            bookCost: 1003,
            bookValue: 1000,
            latestPrice: 10,
          }
        }
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        netFunding: 5000,
        cash: 3997,
        bookCost: 1003,
        bookValue: 1000,
        accountValue: 4997,
        feesPaid: 3,
        positions: {
          "AMD": {
            stockId: "AMD",
            averagePrice: 10.03,
            size: 100,
            bookCost: 1003,
            bookValue: 1000,
            latestPrice: 10,
          }
        }
      })
    ])
  })

  it ("should buy and sell a stock on one day", async () => {
    fundingData = [
      getFunding(0, 5000),
    ]
    tradeData = [
      getTrade(0, 0, "AMD", {
        size: 100,
        price: 10,
        fees: 3
      }),
      getTrade(0, 1, "AMD", {
        size: -100,
        price: 12,
        fees: 3
      }),
    ]

    const portfolioSummary = await subject(settings, session, console, getDate(1).toJSDate())

    expect(portfolioSummary).toEqual<PortfolioSlice[]>([
      getPortfolioSlice({
        uniqueId: getDate(-1).toISO(),
        date: getDate(-1).toJSDate(),
      }),
      getPortfolioSlice({
        uniqueId: getDate(0).toISO(),
        date: getDate(0).toJSDate(),
        netFunding: 5000,
        cash: 5194,
        bookCost: 0,
        bookValue: 0,
        accountValue: 5194,
        feesPaid: 6,
        trades: [tradeData[0], tradeData[1]],
        transactions: [fundingData[0]],
        positions: {
          "AMD": {
            stockId: "AMD",
            averagePrice: 0,
            size: 0,
            bookCost: 0,
            bookValue: 0,
            latestPrice: 12,
          }
        }
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        netFunding: 5000,
        cash: 5194,
        accountValue: 5194,
        bookCost: 0,
        bookValue: 0,
        feesPaid: 6,
        positions: {
          "AMD": {
            stockId: "AMD",
            averagePrice: 0,
            size: 0,
            bookCost: 0,
            bookValue: 0,
            latestPrice: 12,
          }
        }
      })
    ])
  })
})

function getDate(dayDelta: number, time: "time-zero" | 'time-set' = 'time-zero'): DateTime {
  const date = DateTime.fromISO("2020-06-15T00:00:00+00:00", { zone: "UTC" }).plus({
    days: dayDelta,
    hours: time === 'time-set' ? 8 : 0
  })

  expect(date.offset).toBe(0)

  return date
}

function getFunding(dayDelta: number, amount = 0, { accountId = "1", currency = "GBP" }: Partial<FundingTransaction> = {}): FundingTransaction {
  const date = getDate(dayDelta, "time-set")

  return {
    uniqueId: date.toISO(),
    date: date.toJSDate(),
    accountId,
    type: amount >= 0 ? 'Cash In' : 'Cash Out',
    amount,
    currency,
  }
}

type getTradeOpts = Partial<{ size: number, price: number, fees: number, initialCurrency: "GBP" | "USD" }>
function getTrade(dayDelta: number, hourDelta: number, stockId = 'My Stock', { size = 1, price = 10, fees = 0 }: getTradeOpts): Trade {
  if (hourDelta >= 16) {
    throw "Hour delta would be the next day!"
  }
  const date = getDate(dayDelta, "time-set").plus({ hours: hourDelta })

  return {
    uniqueId: date.toISO(),
    tradeDateTime: date.toJSDate(),
    currency: "GBP",
    size: size,
    price: price,
    direction: size >= 0 ? 'buy' : 'sell',
    convertOnCloseRate: 1,
    amounts: {
      consideration: {
        amountType: "CONSIDERATION",
        currency: "GBP",
        value: -(size * price)
      },
      commission: {
        amountType: "COMMISSION",
        currency: "GBP",
        value: fees
      },
      charges: {
        amountType: "TOTAL_CHARGE",
        currency: "GBP",
        value: 0
      },
      total: {
        amountType: "TOTAL_AMOUNT",
        currency: "GBP",
        value: (-(size * price)) - fees
      }
    },
    accountId: "1",
    orderID: "orderid",
    stockId: stockId,
    stockName: `${stockId} (Name)`,
    stockAltName: `${stockId} (All Sessions)`,
    tradeType: 'TRADE'
  }
}

function getPortfolioSlice(slice: Partial<PortfolioSlice>) : PortfolioSlice {
  return Object.assign<PortfolioSlice, Partial<PortfolioSlice>>(
    {
      uniqueId: getDate(0).toISO(),
      date: getDate(0).toJSDate(),
      netFunding: 0,
      cash: 0,
      bookCost: 0,
      bookValue: 0,
      accountValue: 0,
      feesPaid: 0,
      trades: [],
      transactions: [],
      positions: {}
    }, 
    slice
  )
}

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

const account: AccountResult = {
  accountId: "1",
  name: "One",
  type: "stocks",
  cst: "",
  xSecurityToken: ""
}

const session: SessionResult = {
  info: {} as any,
  accounts: [
    account
  ]
}
