import { SdkLogger, DataRow } from "@dataden/sdk"
import _, { last } from "lodash"
import { DateTime, Duration } from "luxon";

import { Settings } from "../types"
import { round } from "../converters";
import { SessionResult } from "../api/ig-auth"
import { FundingTransaction, loadFunding } from "./loadFunding"
import { loadAllTrades, Trade } from "../api/trades"

export interface PortfolioSlice extends DataRow {
  date: Date
  
  netFunding: number
  cash: number
  bookCost: number
  accountValue: number
  feesPaid: number

  trades: Trade[]
  transactions: FundingTransaction[]
}

export const loadPortfolioSummary = async (settings: Settings, session: SessionResult, log: SdkLogger, toDate: Date): Promise<PortfolioSlice[]> => {
  log.info(`Loading Portfolio for Stockbroking accounts`)

  const allFunding = await loadFunding(settings, session, log)
  const allTrades = await loadAllTrades(settings, session, settings.plugin.backdateToISO, new Date().toISOString())
  if (allFunding.length === 0 && allTrades.length === 0) {
    log.warn(`No trading data retrieved`)
    return []
  }

  const minDate = new Date(Math.min(...[
    allFunding[0]?.date.valueOf(), 
    allTrades[0]?.tradeDateTime.valueOf()
  ].filter(Boolean)))

  const grain = Duration.fromObject({day: 1})
  let cursorDate = DateTime.fromJSDate(minDate, { zone: 'UTC' }).set({weekday: 0, hour: 0, minute: 0, second: 0, millisecond: 0})
  let nextCursorDate = cursorDate.plus(grain)
  const endDate = DateTime.fromJSDate(toDate, { zone: 'UTC' })
  const endDateValue = endDate.valueOf()

  if (cursorDate.valueOf() > endDateValue) {
    throw new Error("backdateToISO is greater than now")
  }

  log.info(`Starting to build portfolio from ${cursorDate.toISO()} to ${endDate.toISO()}`)

  const portfolio: PortfolioSlice[] = []
  while (cursorDate.valueOf() <= endDateValue) {
    const slice = _.clone(_.last(portfolio) ?? getDefaultSlice(cursorDate))

    slice.uniqueId = cursorDate.toISO()
    slice.date = cursorDate.toJSDate()
    slice.trades = []
    slice.transactions = []

    while (allFunding.length > 0 && allFunding[0].date.valueOf() < nextCursorDate.valueOf()) {
      const [funding] = allFunding.splice(0, 1)
      slice.cash = round(slice.cash + funding.amount)
      slice.netFunding = round(slice.netFunding + funding.amount)

      slice.transactions.push(funding)
    }

    while (allTrades.length > 0 && allTrades[0].tradeDateTime.valueOf() < nextCursorDate.valueOf()) {
      const [trade] = allTrades.splice(0, 1)
      slice.cash = round(slice.cash + trade.amounts.total.value)
      slice.bookCost = round(slice.bookCost - trade.amounts.total.value) // TODO: adjust this for bookValue changes based on DCA
      slice.feesPaid = round(slice.feesPaid + trade.amounts.charges.value + trade.amounts.commission.value)
      // slice.accountValue //TODO: calculate this

      slice.trades.push(trade)
    }
    
    portfolio.push(slice)
    cursorDate = nextCursorDate
    nextCursorDate = nextCursorDate.plus(grain)
  }
  
  return portfolio
}

function getDefaultSlice(date: DateTime): PortfolioSlice {
  return {
    uniqueId: date.toISO(),
    date: date.toJSDate(),
    cash: 0,
    accountValue: 0,
    bookCost: 0,
    netFunding: 0,
    feesPaid: 0,
    trades: [],
    transactions: []
  }
}
