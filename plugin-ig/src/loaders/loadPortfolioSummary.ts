import { SdkLogger, DataRow } from "@dataden/sdk"
import _, { last } from "lodash"
import { DateTime, Duration } from "luxon";

import { Settings } from "../types"
import { round, weightedAverage } from "../converters";
import { SessionResult } from "../api/ig-auth"
import { FundingTransaction, loadFunding } from "./loadFunding"
import { Trade, loadAllTrades } from "../api/trades"

export interface PortfolioSlice extends DataRow {
  date: Date
  
  netFunding: number
  cash: number
  bookCost: number
  accountValue: number
  feesPaid: number
}

export const loadPortfolioSummary = async (settings: Settings, session: SessionResult, log: SdkLogger): Promise<PortfolioSlice[]> => {
  log.info(`Loading Portfolio for Stockbroking accounts`)

  const allFunding = await loadFunding(settings, session, log)
  const allTrades = await loadAllTrades(settings, session, settings.plugin.backdateToISO, new Date().toISOString())
  if (allFunding.length === 0 && allTrades.length === 0) {
    log.warn(`No trading data retrieved`)
    return []
  }

  const minDate = new Date(Math.min(allFunding[0]?.date.valueOf(), allTrades[0]?.tradeDateTime.valueOf()))

  const grain = Duration.fromObject({week: 1})
  let cursorDate = DateTime.fromJSDate(minDate).set({weekday: 0, hour: 0, minute: 0, second: 0, millisecond: 0})
  let nextCursorDate = cursorDate.plus(grain)
  const endDate = DateTime.now()
  const endDateValue = endDate.valueOf()

  if (cursorDate.valueOf() > endDateValue) {
    throw new Error("backdateToISO is greater than now")
  }

  log.info(`Starting to build portfolio from ${cursorDate.toISO()} to ${endDate.toISO()}`)


  const portfolio: PortfolioSlice[] = [
    {
      uniqueId: cursorDate.toISO(),
      date: cursorDate.toJSDate(),
      cash: 0,
      accountValue: 0,
      bookCost: 0,
      netFunding: 0,
      feesPaid: 0
    }
  ]
  while (cursorDate.valueOf() <= endDateValue) {
    const slice = {..._.last(portfolio)}

    slice.uniqueId = cursorDate.toISO()
    slice.date = cursorDate.toJSDate()
    slice.trades = []

    while (allFunding.length > 0 && allFunding[0].date.valueOf() < nextCursorDate.valueOf()) {
      const [funding] = allFunding.splice(0, 1)
      slice.cash = round(slice.cash + funding.amount)
      slice.netFunding = round(slice.netFunding + funding.amount)
    }

    while (allTrades.length > 0 && allTrades[0].tradeDateTime.valueOf() < nextCursorDate.valueOf()) {
      const [trade] = allTrades.splice(0, 1)
      slice.cash = round(slice.cash + trade.amounts.total.value)
      slice.bookCost = round(slice.bookCost - trade.amounts.total.value)
      slice.feesPaid = round(slice.feesPaid + trade.amounts.charges.value + trade.amounts.commission.value)

      slice?.trades.push(trade)
      // slice.accountValue //TODO: calculate this
    }
    
    portfolio.push(slice)
    cursorDate = nextCursorDate
    nextCursorDate = nextCursorDate.plus(grain)
  }
  
  return portfolio
}
      