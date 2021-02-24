import axios from 'axios'
import { DateTime } from "luxon"
import { DataRow } from "@dataden/sdk"

import { AccountResult } from "./ig-auth"
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
  }
}

export interface IGTradeGoodStuff<TDate=string, TNumber=string> {
  accountId: string
  convertOnCloseRate: TNumber
  currency: string
  epic: string
  formalInstrumentName: string
  instrumentDesc: string
  orderID: string
  price: TNumber
  tradeType: TradeType
}

export type IGTrade<TDate=string, TNumber=string> = IGTradeGoodStuff<TDate, TNumber> & {
  direction: "+" | "-"
  entryType: string
  narrative: string
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

    // IG BUG: repair sign on final amounts, which is sometimes wrong
    amounts.consideration.value = isBuy
      ? -Math.abs(amounts.consideration.value)
      : Math.abs(amounts.consideration.value)
    amounts.total.value = isBuy
      ? -Math.abs(amounts.total.value)
      : Math.abs(amounts.total.value)

    const size = float(t.scaledSize)
    const price = round(Math.abs(amounts.consideration.value / size))

    const trade: Trade = {
      // extra fields
      uniqueId: t.orderID,
      accountId: account.accountId,
      direction: isBuy ? "buy" : "sell",

      // Conversions
      convertOnCloseRate: float(t.convertOnCloseRate),
      price,
      size,
      tradeDateTime: dateFromComponents(t.tradeDate, t.tradeTime),

      // Direct mappings
      amounts,
      currency: t.currency,
      epic: t.epic,
      formalInstrumentName: t.formalInstrumentName,
      instrumentDesc: t.instrumentDesc,
      orderID: t.orderID,
      tradeType: t.tradeType,

      // Debugging data
      rawTrade: settings.plugin.includeRawData ? t : undefined
    }

    return trade
  })
}
