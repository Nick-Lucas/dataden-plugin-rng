import { SdkLogger, DataRow } from "@dataden/sdk"
import _, { last } from "lodash"
import { DateTime, Duration } from "luxon";

import { Settings } from "../types"
import { SessionResult } from "../api/ig-auth"
import { FundingTransaction, loadFunding } from "./loadFunding"
import { StockTrade, loadStockTrades } from "./loadStockTrades"
import { round, weightedAverage } from "../converters";

export interface PortfolioSlice extends DataRow {
  date: Date
  
  stockId: string
  stockName: string
  stockDescription: string

  currency: string
  bookCost: number
  plPercent: number
  pl: number
  shares: number
  bookValue: number
  averageCost: number

  aggregateFees: number
  aggregatePl: number
  trades?: StockTrade[]
}

export const loadPortfolio = async (settings: Settings, session: SessionResult, log: SdkLogger): Promise<PortfolioSlice[]> => {
  log.info(`Loading Portfolio for Stockbroking accounts`)

  // TODO: start this from last slice of previous sync
  const portfolio: PortfolioSlice[] = []

  // const allFunding = await loadFunding(settings, session, log)
  const allTrades = await loadStockTrades(settings, session, log)
  if (allTrades.length === 0) {
    log.warn(`No trading data retrieved`)
    return []
  }

  const grain = Duration.fromObject({week: 1})
  let cursorDate = DateTime.fromJSDate(allTrades[0].date).set({hour: 0, minute: 0, second: 0, millisecond: 0})
  let nextCursorDate = cursorDate.plus(grain)
  const endDate = DateTime.now()
  const endDateValue = endDate.valueOf()

  if (cursorDate.valueOf() > endDateValue) {
    throw new Error("backdateToISO is greater than now")
  }

  log.info(`Starting to build portfolio from ${cursorDate.toISO()} to ${endDate.toISO()}`)

  let lastSlicesByStockId: Record<string, PortfolioSlice> = {}
  while (cursorDate.valueOf() <= endDateValue) {
    const slicesByStockId: Record<string, PortfolioSlice> = {}
    const getSlice = (stockId: string): PortfolioSlice => {
      const uniqueId = `${stockId}_${cursorDate.toISO()}`

      if (!slicesByStockId[stockId]) {
        const existingSlice = lastSlicesByStockId[stockId]
        if (existingSlice) {
          // If we already have a running portfolio, we clone it over first
          log.info("CLONING SLICE!")
          slicesByStockId[stockId] = _.cloneDeep(existingSlice)
          slicesByStockId[stockId].trades = []
        } else {
          log.info("CREATING SLICE!")
          slicesByStockId[stockId] = {
            uniqueId: "TOFILL",
            date: null,

            stockId: stockId,
            stockName: "TOFILL",
            stockDescription: "TOFILL",

            currency: "TOFILL",
            averageCost: 0,
            bookCost: 0,
            bookValue: 0,
            pl: 0,
            plPercent: 0,
            shares: 0,
            
            aggregateFees: 0,
            aggregatePl: 0,
            trades: []
          }
        }
      }

      const slice = slicesByStockId[stockId]
      slice.uniqueId = uniqueId
      slice.date = cursorDate.toJSDate()

      return slice
    }

    // TODO: how to deal with funding?
    // const cash = getSlice("CASH")
    // if (allFunding.length > 0) {
    //   while (allFunding[0].date.valueOf() < nextDate.valueOf()) {
    //     const [funding] = allFunding.splice(0, 1)

    //     cash.currency = funding.currency
    //     cash.pl
    //   }
    // }

    while (allTrades.length > 0 && allTrades[0].date.valueOf() < nextCursorDate.valueOf()) {
      const [trade] = allTrades.splice(0, 1)
      if (trade.stockId !== 'UC.D.MSFT.CASH.IP') {
        continue
      }

      const slice = getSlice(trade.stockId)
      slice.stockName = trade.stockName
      slice.stockDescription = trade.stockDescription

      if (trade.isBuy) {
        slice.averageCost = weightedAverage(slice.shares, slice.averageCost, trade.size, trade.pricePerShare)
      } else {
        // Nothing to do
      }
      
      
      if (trade.isBuy) {
        slice.bookCost += -trade.plWithFees
      } else {
        // Want to subtract the initial price, not the actual sale price
        const originalBookCost = slice.averageCost * trade.size
        const saleBookCost = trade.plWithFees // TODO: should store multiple values with and without fees?
        slice.bookCost -= originalBookCost
        slice.aggregatePl += (saleBookCost - originalBookCost)
      }

      slice.currency = trade.currency
      slice.shares += trade.size
      slice.aggregateFees += trade.fees

      // Based on latest stock price
      // TODO: fetch real hourly data for this, for now just use the latest available price from the trade
      slice.bookValue = trade.pricePerShare * slice.shares
      slice.pl = round((trade.pricePerShare * slice.shares - slice.aggregateFees) - (slice.averageCost * slice.shares))
      slice.plPercent = slice.bookValue === 0 ? 0 : (slice.pl / slice.bookValue) * 100

      slice.trades?.push(trade)
    }
    
    const finalSlicesByStockId = _.assign(
      {}, 
      _.mapValues(lastSlicesByStockId, v => ({ ...v, trades: [] })), 
      slicesByStockId)
    portfolio.push(..._.values(
      finalSlicesByStockId
    ))
    lastSlicesByStockId = finalSlicesByStockId
    cursorDate = nextCursorDate
    nextCursorDate = nextCursorDate.plus(grain)
  }
  
  return portfolio
}
      