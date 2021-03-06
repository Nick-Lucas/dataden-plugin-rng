import axios from 'axios'
import { DateTime } from "luxon"
import _ from 'lodash'
import { DataRow } from "@dataden/sdk"

import { AccountResult, SessionResult } from "./ig-auth"
import { Settings } from "../types"
import { date, dateFromComponents, float, round } from "../converters";

const dateFormat = "dd-MM-yyyy"

export type TradeType = 
  // Normal trades  
  "TRADE" 

  // Used for account corrections on stock mergers and ticker changes. Typically messes up lots of calculations
  | "CORPORATE_ACTION" 

export interface Pagination {
  page: number
  recordsPerPage: number
  pageCount: number
  totalRecordCount: number
}

export interface Amount {
  value: number
  currency: string
  amountType: "CONSIDERATION" | "COMMISSION" | "TOTAL_CHARGE" | "TOTAL_AMOUNT"
  transactionToBaseCcyRate?: any
}
export interface Amounts {
  /** the initial sum (price*size) in the original currency, with no fees applied */
  consideration: Amount

  /** just commission/trade fees */
  commission: Amount

  /** additional charges */
  charges: Amount

  /** final sum in the account's native currency, with fees and commissions applied */
  total: Amount

  /** Although all currencies are converted, it's sometimes useful to track the conversion info */
  conversions: {
    originalCurrency: string
    conversionRate: number
  }
}

function getAmounts(amounts: Amount[]): Amounts {
  return {
    consideration: amounts.find(a => a.amountType === "CONSIDERATION") ?? {
      value: 0,
      amountType: "CONSIDERATION",
      currency: "GBP"
    },
    charges: amounts.find(a => a.amountType === "TOTAL_CHARGE") ?? {
      value: 0,
      amountType: "TOTAL_CHARGE",
      currency: "GBP"
    },
    commission: amounts.find(a => a.amountType === "COMMISSION") ?? {
      value: 0,
      amountType: "COMMISSION",
      currency: "GBP"
    },
    total: amounts.find(a => a.amountType === "TOTAL_AMOUNT") ?? {
      value: 0,
      amountType: "TOTAL_AMOUNT",
      currency: "GBP"
    },
    conversions: {
      originalCurrency: null,
      conversionRate: 1
    }
  }
}

export interface IGTradeGoodStuff<TDate=string, TNumber=string> {
  accountId: string
  currency: string
  orderID: string
  price: TNumber
  tradeType: TradeType
}

export type IGTrade<TDate=string, TNumber=string> = IGTradeGoodStuff<TDate, TNumber> & {
  direction: "+" | "-"
  epic: string
  formalInstrumentName: string
  instrumentDesc: string
  entryType: string
  narrative: string
  convertOnCloseRate: TNumber
  orderType: string
  orderSize: TNumber
  scaledSize: TNumber
  settlementDate: TDate
  settlementStatus: string
  summaryCode: string
  summaryCodeDescription: string
  amounts: Amount[]
  tradeDate: TDate
  tradeTime: string
  tradeValue: TNumber
  venue: string
}


export type Trade = IGTradeGoodStuff<Date, number> & DataRow & { 
  accountId: string
  stockId: string,
  stockName: string,
  stockAltName: string,
  tradeDateTime: Date
  direction: "buy" | "sell"
  amounts: Amounts
  size: number
}

export interface IGLedgerHistoryResponse {
  success: boolean
  payload: {
    accountID: string
    startDate: string
    endDate: string
    pagination: Pagination
    txnHistory: IGTrade[]
  }
  error?: any
}

/** Load and sanitise all trades in a range for all accounts in session */
export async function loadAllTrades(settings: Settings, session: SessionResult, startDateIso: string, endDateIso: string) {
  const trades: Trade[] = []
  for (const account of session.accounts) {
    const accountTrades = await loadTrades(settings, account, startDateIso, endDateIso)

    trades.push(...accountTrades)
  }
  return _.sortBy(trades, trade => trade.tradeDateTime.valueOf())
}

/** Load and sanitise all trades in a date range, converting all prices to the account currency (ie. GBP) and correcting any flaws in the data */
export async function loadTrades(settings: Settings, account: AccountResult, startDateIso: string, endDateIso: string): Promise<Trade[]> {
  const dateFrom = DateTime.fromISO(startDateIso).toFormat(dateFormat)
  const dateTo = DateTime.fromISO(endDateIso).toFormat(dateFormat)

  const result = await axios.get<IGLedgerHistoryResponse>(
   `/deal/ledgerhistory/list?startDate=${dateFrom}&endDate=${dateTo}&pageNumber=1&recordsPerPage=10000000`,
    {
      headers: {
        'Version': 1,
        'Origin': 'https://www.ig.com',
        'Content-Type': 'application/json',
        'CST': account.cst,
        'X-SECURITY-TOKEN': account.xSecurityToken,
        'IG-Account-ID': account.accountId,
      },
      baseURL: settings.plugin.igApiUri,
      validateStatus: status => status === 200
    }
  )

  // TODO: validate pages in case a second page exists
  
  return result.data.payload.txnHistory.map(t => {
    const isBuy = float(t.scaledSize) >= 0
    const amounts: Amounts = getAmounts(t.amounts)
    const convertRate = float(t.convertOnCloseRate)
    const targetCurrency = amounts.total.currency

    amounts.conversions.originalCurrency = amounts.consideration.currency
    amounts.conversions.conversionRate = convertRate

    // IG BUG: repair sign on final amounts, which is sometimes wrong
    amounts.consideration.value = isBuy
      ? -Math.abs(amounts.consideration.value)
      : Math.abs(amounts.consideration.value)
    amounts.total.value = isBuy
      ? -Math.abs(amounts.total.value)
      : Math.abs(amounts.total.value)

    if (amounts.consideration.currency !== amounts.total.currency) {
      amounts.consideration.value = amounts.consideration.value * convertRate
      amounts.consideration.currency = amounts.total.currency
    }
    if (amounts.charges.currency !== amounts.total.currency) {
      amounts.charges.value = amounts.charges.value * convertRate
      amounts.charges.currency = amounts.total.currency
    }
    if (amounts.commission.currency !== amounts.total.currency) {
      amounts.commission.value = amounts.commission.value * convertRate
      amounts.commission.currency = amounts.total.currency
    }

    const size = float(t.scaledSize)
    const price = round(Math.abs(amounts.consideration.value / size))

    const trade: Trade = {
      // extra fields
      uniqueId: t.orderID,
      orderID: t.orderID,
      accountId: account.accountId,
      stockId: t.epic,
      stockName: t.formalInstrumentName,
      stockAltName: t.instrumentDesc,
      direction: isBuy ? "buy" : "sell",
      tradeType: t.tradeType,

      // Conversions
      currency: targetCurrency,
      price,
      size,
      tradeDateTime: dateFromComponents(t.tradeDate, t.tradeTime),
      amounts,

      // Debugging data
      rawTrade: settings.plugin.includeRawData ? t : undefined
    }

    return trade
  })
}
