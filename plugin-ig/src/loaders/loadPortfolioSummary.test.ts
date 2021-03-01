import { DateTime, Duration } from "luxon";
import { Settings } from "src/types";
import { AccountResult, SessionResult } from "../api/ig-auth";

import type { FundingTransaction } from './loadFunding'
import type { Trade } from '../api/trades'
import type { BetsPNL } from '../api/bets-pnl'
import type { Price } from '../api/prices'
import { loadPortfolioSummary, PortfolioSlice } from './loadPortfolioSummary'
import _ from "lodash";

describe("loadPortfolioSummary", () => {
  let tradeData: Trade[] = []
  let fundingData: FundingTransaction[] = []
  let betsPnl: BetsPNL[] = []
  let historicalPrices: Record<string, Price[]> = {}
  let subject: typeof loadPortfolioSummary

  beforeEach(async () => {
    fundingData = []
    tradeData = []
    betsPnl = []
    historicalPrices = {}

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
    jest.doMock('../api/bets-pnl', () => {
      return {
        __esModule: true,
        loadAllBetsPNL: () => Promise.resolve([...betsPnl])
      }
    })
    jest.doMock('../api/prices', () => {
      return {
        __esModule: true,
        loadPrices: () => Promise.resolve({...historicalPrices})
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
    betsPnl = []

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
        cash: 5000,
      
        accountValueLastTrade: 5000,
        accountValueHigh: 5000,
        accountValueLow: 5000,
        accountValueMedian: 5000,
        
        bookValueLastTrade: 0,
        bookValueHigh: 0,
        bookValueLow: 0,
        bookValueMedian: 0,

        netFunding: 5000,

        transactions: [fundingData[0]]
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        cash: 2400,
        
        accountValueLastTrade: 2400,
        accountValueHigh: 2400,
        accountValueLow: 2400,
        accountValueMedian: 2400,
        
        bookValueLastTrade: 0,
        bookValueHigh: 0,
        bookValueLow: 0,
        bookValueMedian: 0,

        netFunding: 2400,

        transactions: [fundingData[1]]
      })
    ])
  })

  it ("should adjust cash levels based on spread/cfd bets PNL", async () => {
    fundingData = [
      getFunding(0, 5000)
    ]
    tradeData = []
    betsPnl = [
      getBetPNL(0, 4, -1000),
      getBetPNL(1, 0, 500)
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
        cash: 4000,
      
        accountValueLastTrade: 4000,
        accountValueHigh: 4000,
        accountValueLow: 4000,
        accountValueMedian: 4000,
        
        bookValueLastTrade: 0,
        bookValueHigh: 0,
        bookValueLow: 0,
        bookValueMedian: 0,

        netFunding: 5000,
        netPlLastTrade: -1000,
        netPlHigh: -1000,
        netPlMedian: -1000,
        netPlLow: -1000,
        netPlPercentLastTrade: -20,
        netPlPercentHigh: -20,
        netPlPercentMedian: -20,
        netPlPercentLow: -20,

        transactions: [fundingData[0]],
        betPnls: [betsPnl[0]]
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        cash: 4500,
      
        accountValueLastTrade: 4500,
        accountValueHigh: 4500,
        accountValueLow: 4500,
        accountValueMedian: 4500,
        
        bookValueLastTrade: 0,
        bookValueHigh: 0,
        bookValueLow: 0,
        bookValueMedian: 0,

        netFunding: 5000,
        netPlLastTrade: -500,
        netPlHigh: -500,
        netPlMedian: -500,
        netPlLow: -500,
        netPlPercentLastTrade: -10,
        netPlPercentHigh: -10,
        netPlPercentMedian: -10,
        netPlPercentLow: -10,

        transactions: [],
        betPnls: [betsPnl[1]]
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
        cash: 3997,
        bookCost: 1003,
      
        accountValueLastTrade: 4997,
        accountValueHigh: 4997,
        accountValueLow: 4997,
        accountValueMedian: 4997,
        
        bookValueLastTrade: 1000,
        bookValueHigh: 1000,
        bookValueLow: 1000,
        bookValueMedian: 1000,

        netFunding: 5000,
        netPlLastTrade: -3,
        netPlHigh: -3,
        netPlMedian: -3,
        netPlLow: -3,
        netPlPercentLastTrade: -0.06,
        netPlPercentHigh: -0.06,
        netPlPercentMedian: -0.06,
        netPlPercentLow: -0.06,

        feesPaid: 3,
        trades: [tradeData[0]],
        transactions: [fundingData[0]],
        positions: {
          "AMD": {
            stockId: "AMD",
            stockName: `AMD (Name)`,
            stockAltName: `AMD (All Sessions)`,
            averagePrice: 10.03,
            size: 100,
            bookCost: 1003,
            latestTradePrice: 10,
            dailyLowPrice: 0,
            dailyHighPrice: 0,
            dailyMedianPrice: 0,
            meta: {
              latestCurrencyConversion: 1
            }
          }
        }
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        cash: 3997,
        bookCost: 1003,
      
        accountValueLastTrade: 4997,
        accountValueHigh: 4997,
        accountValueLow: 4997,
        accountValueMedian: 4997,
        
        bookValueLastTrade: 1000,
        bookValueHigh: 1000,
        bookValueLow: 1000,
        bookValueMedian: 1000,

        netFunding: 5000,
        netPlLastTrade: -3,
        netPlHigh: -3,
        netPlMedian: -3,
        netPlLow: -3,
        netPlPercentLastTrade: -0.06,
        netPlPercentHigh: -0.06,
        netPlPercentMedian: -0.06,
        netPlPercentLow: -0.06,

        feesPaid: 3,
        positions: {
          "AMD": {
            stockId: "AMD",
            stockName: `AMD (Name)`,
            stockAltName: `AMD (All Sessions)`,
            averagePrice: 10.03,
            size: 100,
            bookCost: 1003,
            latestTradePrice: 10,
            dailyLowPrice: 0,
            dailyHighPrice: 0,
            dailyMedianPrice: 0,
            meta: {
              latestCurrencyConversion: 1
            }
          }
        }
      })
    ])
  })

  it ("should incorporate historical prices into portfolio value", async () => {
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
    historicalPrices = {
      "AMD": [
        {
          startDate: getDate(0, 'time-zero').toJSDate(),
          endDate: null,
          low: 9,
          high: 11,
          open: 9.5,
          close: 10.5,
        },
        {
          startDate: getDate(1, 'time-zero').toJSDate(),
          endDate: null,
          low: 90,
          high: 110,
          open: 95,
          close: 10.5,
        }
      ]
    }

    const portfolioSummary = await subject(settings, session, console, getDate(1).toJSDate())

    expect(portfolioSummary).toEqual<PortfolioSlice[]>([
      getPortfolioSlice({
        uniqueId: getDate(-1).toISO(),
        date: getDate(-1).toJSDate(),
      }),
      getPortfolioSlice({
        uniqueId: getDate(0).toISO(),
        date: getDate(0).toJSDate(),
        cash: 3997,
        bookCost: 1003,
      
        accountValueLastTrade: 4997,
        accountValueHigh: 5097,
        accountValueLow: 4897,
        accountValueMedian: 4997,
        
        bookValueLastTrade: 1000,
        bookValueHigh: 1100,
        bookValueLow: 900,
        bookValueMedian: 1000,

        netFunding: 5000,
        netPlLastTrade: -3,
        netPlHigh: 97,
        netPlMedian: -3,
        netPlLow: -103,
        netPlPercentHigh: 1.94,
        netPlPercentLastTrade: -0.06,
        netPlPercentLow: -2.06,
        netPlPercentMedian: -0.06,

        feesPaid: 3,
        trades: [tradeData[0]],
        transactions: [fundingData[0]],
        positions: {
          "AMD": {
            stockId: "AMD",
            stockName: `AMD (Name)`,
            stockAltName: `AMD (All Sessions)`,
            averagePrice: 10.03,
            size: 100,
            bookCost: 1003,
            latestTradePrice: 10,
            dailyLowPrice: 9,
            dailyHighPrice: 11,
            dailyMedianPrice: 10,
            meta: {
              latestCurrencyConversion: 1
            }
          }
        }
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        cash: 3997,
        bookCost: 1003,
      
        accountValueLastTrade: 4997,
        accountValueHigh: 14997,
        accountValueLow: 12997,
        accountValueMedian: 13997,
        
        bookValueLastTrade: 1000,
        bookValueHigh: 11000,
        bookValueLow: 9000,
        bookValueMedian: 10000,

        netFunding: 5000,
        netPlHigh: 9997,
        netPlLastTrade: -3,
        netPlLow: 7997,
        netPlMedian: 8997,
        netPlPercentHigh: 199.94,
        netPlPercentLastTrade: -0.06,
        netPlPercentLow: 159.94,
        netPlPercentMedian: 179.94,

        feesPaid: 3,
        positions: {
          "AMD": {
            stockId: "AMD",
            stockName: `AMD (Name)`,
            stockAltName: `AMD (All Sessions)`,
            averagePrice: 10.03,
            size: 100,
            bookCost: 1003,
            latestTradePrice: 10,
            dailyLowPrice: 90,
            dailyHighPrice: 110,
            dailyMedianPrice: 100,
            meta: {
              latestCurrencyConversion: 1
            }
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
        cash: 5194,
        bookCost: 0,
      
        accountValueLastTrade: 5194,
        accountValueHigh: 5194,
        accountValueLow: 5194,
        accountValueMedian: 5194,
        
        bookValueLastTrade: 0,
        bookValueHigh: 0,
        bookValueLow: 0,
        bookValueMedian: 0,

        netFunding: 5000,
        netPlLastTrade: 194,
        netPlHigh: 194,
        netPlMedian: 194,
        netPlLow: 194,
        netPlPercentHigh: 3.88,
        netPlPercentLastTrade: 3.88,
        netPlPercentLow: 3.88,
        netPlPercentMedian: 3.88,

        feesPaid: 6,
        trades: [tradeData[0], tradeData[1]],
        transactions: [fundingData[0]],
        positions: {
          "AMD": {
            stockId: "AMD",
            stockName: `AMD (Name)`,
            stockAltName: `AMD (All Sessions)`,
            averagePrice: 0,
            size: 0,
            bookCost: 0,
            latestTradePrice: 12,
            dailyLowPrice: 0,
            dailyHighPrice: 0,
            dailyMedianPrice: 0,
            meta: {
              latestCurrencyConversion: 1
            }
          }
        }
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        cash: 5194,
        bookCost: 0,
        feesPaid: 6,
        
        accountValueLastTrade: 5194,
        accountValueHigh: 5194,
        accountValueLow: 5194,
        accountValueMedian: 5194,
        
        bookValueLastTrade: 0,
        bookValueHigh: 0,
        bookValueLow: 0,
        bookValueMedian: 0,

        netFunding: 5000,
        netPlLastTrade: 194,
        netPlHigh: 194,
        netPlMedian: 194,
        netPlLow: 194,
        netPlPercentHigh: 3.88,
        netPlPercentLastTrade: 3.88,
        netPlPercentLow: 3.88,
        netPlPercentMedian: 3.88,

        positions: {
          "AMD": {
            stockId: "AMD",
            stockName: `AMD (Name)`,
            stockAltName: `AMD (All Sessions)`,
            averagePrice: 0,
            size: 0,
            bookCost: 0,
            latestTradePrice: 12,
            dailyLowPrice: 0,
            dailyHighPrice: 0,
            dailyMedianPrice: 0,
            meta: {
              latestCurrencyConversion: 1
            }
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

function getBetPNL(dayDelta: number, hourDelta: number, amount = 0, { accountId = "2", currency = "GBP" } = {}): BetsPNL {
  const date = getDate(dayDelta, "time-set").plus({ hours: hourDelta })

  return {
    uniqueId: `${date.toISO()}_${accountId}`,
    accountId: accountId,
    date: date.toJSDate(),
    currency: currency,
    value: amount,
    closedPositions: 1,
    profitablePositions: 0,
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
      },
      conversions: {
        originalCurrency: "GBP",
        conversionRate: 1
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
      
      cash: 0,
      bookCost: 0,
      feesPaid: 0,
      
      accountValueLastTrade: 0,
      accountValueHigh: 0,
      accountValueLow: 0,
      accountValueMedian: 0,
      
      bookValueLastTrade: 0,
      bookValueHigh: 0,
      bookValueLow: 0,
      bookValueMedian: 0,
      
      netFunding: 0,
      netPlLastTrade: 0,
      netPlHigh: 0,
      netPlMedian: 0,
      netPlLow: 0,
      netPlPercentLastTrade: 0,
      netPlPercentHigh: 0,
      netPlPercentMedian: 0,
      netPlPercentLow: 0,
      
      trades: [],
      transactions: [],
      betPnls: [],
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
