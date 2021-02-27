import { SdkLogger, DataRow } from "@dataden/sdk"
import _ from "lodash"
import { DateTime, Duration } from "luxon";

import { Settings } from "../types"
import { SessionResult } from "../api/ig-auth"
import { FundingTransaction, loadFunding } from "./loadFunding"
import { loadAllTrades, Trade } from "../api/trades"
import { loadAllBetsPNL, BetsPNL } from "../api/bets-pnl"

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
  
  currency: string
  netFunding: number
  cash: number
  bookCost: number
  bookValue: number
  accountValue: number
  feesPaid: number

  trades: Trade[]
  transactions: FundingTransaction[]
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

  const portfolio = new Portfolio()
  while (cursor.next()) {
    const slice = portfolio.getNextSlice(cursor.left())

    while (allFunding.length > 0 && allFunding[0].date.valueOf() < cursor.right().valueOf()) {
      const [funding] = allFunding.splice(0, 1)
      slice.cash = slice.cash + funding.amount
      slice.netFunding = slice.netFunding + funding.amount

      slice.currency = funding.currency

      slice.transactions.push(funding)
    }

    while (allTrades.length > 0 && allTrades[0].tradeDateTime.valueOf() < cursor.right().valueOf()) {
      const [trade] = allTrades.splice(0, 1)
      if (trade.amounts.total.currency !== slice.currency) {
        throw "Unexpected Error: Currency in trade does not match funding currency"
      }
      
      // Top level data
      slice.cash = slice.cash + trade.amounts.total.value
      slice.feesPaid = slice.feesPaid + trade.amounts.charges.value + trade.amounts.commission.value

      editPosition(slice, trade.stockId, (current: Position) => {
        const position: Position = {
          stockId: trade.stockId,
          stockName: trade.stockName,
          stockAltName: trade.stockAltName,
          averagePrice: 0,
          bookCost: 0,
          size: 0,
          bookValue: 0,
          latestPrice: 0
        }
        
        if (trade.direction === 'buy') {
          position.bookCost = position.bookCost - trade.amounts.total.value
        } else {
          position.bookCost = position.bookCost + (trade.size * position.averagePrice)
        }
        
        position.size = current.size + trade.size
        
        position.averagePrice = position.size === 0 
          ? 0 
          : position.bookCost / position.size

        position.latestPrice = trade.price 
        position.bookValue = (position.size * trade.price) 

        return position
      })

      slice.trades.push(trade)
    }

    while (allBets.length > 0 && allBets[0].date.valueOf() < cursor.right().valueOf()) {
      const [pnl] = allBets.splice(0, 1)

      if (pnl.currency !== slice.currency) {
        throw "Unexpected Error: Currency in bet pnl does not match funding currency"
      }

      // TODO: move cash in to a separate collateral bucket for spread/cfd trading accounts
      slice.cash += pnl.value
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
      currency: "Unknown",
      cash: 0,
      bookCost: 0,
      bookValue: 0,
      accountValue: 0,
      netFunding: 0,
      feesPaid: 0,
      trades: [],
      transactions: [],
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
