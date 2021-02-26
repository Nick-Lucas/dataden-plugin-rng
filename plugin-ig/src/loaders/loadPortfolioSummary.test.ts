import { DateTime, Duration } from "luxon";
import { Settings } from "src/types";
import { AccountResult, SessionResult } from "../api/ig-auth";

import type { FundingTransaction } from './loadFunding'
import type { Trade } from '../api/trades'
import { loadPortfolioSummary, PortfolioSlice } from './loadPortfolioSummary'

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
    tradeData = []
    fundingData = []

    const portfolioSummary = await subject(settings, session, console, new Date())

    expect(portfolioSummary).toEqual([])
  })

  it ("should build a portfolio with funding only, rewound to the start of the first week", async () => {
    tradeData = []
    fundingData = [
      getFunding(0, 5000),
      getFunding(1, -2600),
    ]

    const portfolioSummary = await subject(settings, session, console, fundingData[1].date)

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
        transactions: [fundingData[0]]
      }),
      getPortfolioSlice({
        uniqueId: getDate(1).toISO(),
        date: getDate(1).toJSDate(),
        netFunding: 2400,
        cash: 2400,
        transactions: [fundingData[1]]
      })
    ])
  })
})

function getDate(dayDelta, time: "time-zero" | 'time-set' = 'time-zero'): DateTime {
  const date = DateTime.fromISO("2020-06-15T00:00:00+00:00", { zone: "UTC" }).plus({
    days: dayDelta,
    hours: time === 'time-set' ? 8 : 0
  })

  expect(date.offset).toBe(0)

  return date
}

function getFunding(dayDelta, amount = 0, { accountId = "1", currency = "GBP" }: Partial<FundingTransaction> = {}): FundingTransaction {
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

function getPortfolioSlice(slice: Partial<PortfolioSlice>) : PortfolioSlice {
  return Object.assign(
    {
      uniqueId: getDate(0).toISO(),
      date: getDate(0).toJSDate(),
      netFunding: 0,
      cash: 0,
      bookCost: 0,
      accountValue: 0,
      feesPaid: 0,
      trades: [],
      transactions: []
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
