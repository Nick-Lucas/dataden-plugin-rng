import { SdkLogger, DataRow } from "@dataden/sdk"
import _ from "lodash"
import { DateTime, Duration } from "luxon";

import { Settings } from "../types"
import { SessionResult } from "../api/ig-auth"
import { FundingTransaction, loadFunding } from "./loadFunding"
import { loadAllTrades, Trade } from "../api/trades"
import { loadAllBetsPNL, BetsPNL } from "../api/bets-pnl"
import { loadPrices, Price } from "../api/prices";

export interface Position {
  stockId: string
  stockName: string
  stockAltName: string

  size: number
  bookCost: number
  averagePrice: number

  // TODO: pull this data from proper feeds, rather than inferring it from recent trades
  bookValue: number
  latestPrice: number
}

export interface PortfolioSlice extends DataRow {
  date: Date
  
  netFunding: number
  cash: number
  bookCost: number
  bookValue: number
  accountValue: number
  feesPaid: number

  trades: Trade[]
  transactions: FundingTransaction[]
  betPnls: BetsPNL[]
  positions: Record<string, Position>
}

export const loadPortfolioSummary = async (settings: Settings, session: SessionResult, log: SdkLogger, toDate: Date): Promise<PortfolioSlice[]> => {
  log.info(`Loading Portfolio for Stockbroking accounts`)

  const dateFromIso = settings.plugin.backdateToISO
  const dateToIso = new Date().toISOString()

  const allFunding = await loadFunding(settings, session, log)
  const allTrades = await loadAllTrades(settings, session, dateFromIso, dateToIso)
  const allBets = await loadAllBetsPNL(settings, session, log, dateFromIso, dateToIso)
  if (allFunding.length === 0 && allTrades.length === 0 && allBets.length === 0) {
    log.warn(`No trading data retrieved`)
    return []
  }

  const minDate = new Date(Math.min(...[
    allFunding[0]?.date.valueOf(), 
    allTrades[0]?.tradeDateTime.valueOf()
  ].filter(Boolean)))

  const cursor = new DateRangeCursor(minDate, toDate, Duration.fromObject({day: 1}))

  
  log.info(`Starting to build portfolio from ${cursor.left().toISO()} to ${toDate.toISOString()}`)
  
  const allPriceHistories: Record<string, Price[]> = {}
  const getPrice = async (stockId: string, tradeDate: Date, returnPrice = false): Promise<Price | null> => {
    if (!allPriceHistories[stockId]) {
      const pricesByStockId = await loadPrices(
        settings, log, session.accounts[0].xSecurityToken, 
        tradeDate.toISOString(), toDate.toISOString(), 
        "sell", [stockId])

      Object.assign(allPriceHistories, pricesByStockId)
    }

    if (!returnPrice) {
      return null
    }

    const prices = allPriceHistories[stockId]
    if (!prices?.length) {
      return null
    }

    // TODO: switch this out for a less naive binary search
    // Get the newest price which is before the current trade date
    let price: Price = null
    for (const element of prices) {
      if (element.startDate.valueOf() > tradeDate.valueOf()) {
        break
      }
      price = element
    }

    return price
  }

  const portfolio = new Portfolio()
  while (cursor.next()) {
    const slice = portfolio.getNextSlice(cursor.left())

    // 
    // Update cash holdings with new funding movements

    while (allFunding.length > 0 && allFunding[0].date.valueOf() < cursor.right().valueOf()) {
      const [funding] = allFunding.splice(0, 1)
      slice.cash = slice.cash + funding.amount
      slice.netFunding = slice.netFunding + funding.amount

      slice.transactions.push(funding)
    }

    // 
    // Update all portfolio positions with latest prices

    for (const position of Object.values(slice.positions)) {
      if (position.size === 0) {
        continue
      }

      const price = await getPrice(position.stockId, slice.date, true)
      if (!price) {
        continue
      }

      position.latestPrice = price.high
      position.bookValue = price.high * position.size
    }

    // 
    // Add new trades to portfolios

    while (allTrades.length > 0 && allTrades[0].tradeDateTime.valueOf() < cursor.right().valueOf()) {
      const [trade] = allTrades.splice(0, 1)

      const historicalPrice = await getPrice(trade.stockId, trade.tradeDateTime)

      // Top level data
      slice.cash = slice.cash + trade.amounts.total.value
      slice.feesPaid = slice.feesPaid + trade.amounts.charges.value + trade.amounts.commission.value

      editPosition(slice, trade.stockId, (current: Position) => {
        const next: Position = {
          stockId: trade.stockId,
          stockName: trade.stockName,
          stockAltName: trade.stockAltName,
          averagePrice: 0,
          bookCost: 0,
          size: 0,
          bookValue: 0,
          latestPrice: 0
        }

        let newPrice = trade.price
        if (historicalPrice != null) {
          newPrice = historicalPrice.high
        }

        const newSize = current.size + trade.size

        if (trade.direction === 'buy') {
          // Simple sum when buying
          next.bookCost = current.bookCost - trade.amounts.total.value
        } else {
          if (newSize === 0) {
            // Tiny float errors, or simply leftovers due to conversions, do accrue, but we don't generally mind until this point
            next.bookCost = 0
          } else {
            // When selling subtract a proportional amount relative to the book cost
            next.bookCost = current.bookCost + (trade.size * current.averagePrice)
          }
        }
        
        next.size = newSize
        next.averagePrice = newSize === 0 
          ? 0 
          : next.bookCost / newSize
        next.bookValue = (newSize * newPrice) 
        next.latestPrice = newPrice 

        return next
      })

      slice.trades.push(trade)
    }

    // 
    // Adjust cash balances with margin bets PNL

    while (allBets.length > 0 && allBets[0].date.valueOf() < cursor.right().valueOf()) {
      const [pnl] = allBets.splice(0, 1)

      // TODO: move cash in to a separate collateral bucket for spread/cfd trading accounts
      slice.cash += pnl.value

      slice.betPnls.push(pnl)
    }

    // Calculated data from positions
    slice.bookCost = _.sumBy(Object.values(slice.positions), position => position.bookCost)
    slice.bookValue = _.sumBy(Object.values(slice.positions), position => position.bookValue)
    slice.accountValue = slice.bookValue + slice.cash
  }
  
  return portfolio.getSlices()
}

function editPosition(slice: PortfolioSlice, stockId: string, callback: (position: Position) => Position) {
  slice.positions = slice.positions ?? {}

  const currentPosition: Position = slice.positions[stockId]
    ? _.clone(slice.positions[stockId])
    : {
      stockId,
      stockName: null, 
      stockAltName: null,
      bookCost: 0,
      size: 0,
      averagePrice: 0,
      bookValue: 0,
      latestPrice: 0
    }
    
  slice.positions[stockId] = callback(currentPosition)
}

class Portfolio {
  slices: PortfolioSlice[] = []

  private getDefaultSlice(): PortfolioSlice {
    return {
      uniqueId: null,
      date: null,
      cash: 0,
      bookCost: 0,
      bookValue: 0,
      accountValue: 0,
      netFunding: 0,
      feesPaid: 0,
      trades: [],
      transactions: [],
      betPnls: [],
      positions: {}
    }
  }

  getNextSlice = (date: DateTime) => {
    const slice = _.clone(_.last(this.slices) ?? this.getDefaultSlice())
    
    this.slices.push(slice)

    slice.uniqueId = date.toISO()
    slice.date = date.toJSDate()
    slice.trades = []
    slice.transactions = []
    slice.betPnls = []
    slice.positions = _.cloneDeep(slice.positions)
  
    return slice
  }

  getSlices = () => this.slices
}

class DateRangeCursor {
  private _grain: Duration = null
  private _end: DateTime = null
  private _endValue: number = null

  private _cursor: DateTime = null
  private _nextCursor: DateTime = null

  constructor(start: Date, end: Date, grain: Duration) {
    this._grain = grain
    this._end = DateTime.fromJSDate(end, { zone: 'UTC' })
    this._endValue = this._end.valueOf()

    this._cursor = null
    this._nextCursor = DateTime.fromJSDate(start, { zone: 'UTC' }).set({weekday: 0, hour: 0, minute: 0, second: 0, millisecond: 0})
  }

  left = () => {
    return this._cursor ?? this._nextCursor
  }

  right = () => {
    return this._nextCursor
  }

  next = () => {
    if (!this._cursor || this._cursor.valueOf() < this._endValue) {
      this._cursor = this._nextCursor
      this._nextCursor = this._cursor.plus(this._grain)
      return true
    } else {
      return false
    }
  }
}
