import axios from 'axios'
import { DataRow } from "@dataden/sdk"

import { AccountResult } from "./ig-auth"
import { Settings } from "../types"
import { DateTime } from "luxon"
import { date, dateFromComponents, float } from "../converters";

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
  amountType: string
  transactionToBaseCcyRate?: any
}

export interface IGTradeGoodStuff<TDate=string, TNumber=string> {
  accountId: string
  convertOnCloseRate: TNumber
  currency: string
  epic: string
  formalInstrumentName: string
  instrumentDesc: string
  orderID: string
  orderSize: TNumber
  price: TNumber
  scaledSize: TNumber
  amounts: Amount[]
  tradeDateTime: TDate
  tradeValue: TNumber
  tradeType: TradeType
}

export type IGTrade<TDate=string, TNumber=string> = IGTradeGoodStuff<TDate, TNumber> & {
  direction: string
  entryType: string
  narrative: string
  orderType: string
  settlementDate: TDate
  settlementStatus: string
  summaryCode: string
  summaryCodeDescription: string
  tradeDate: TDate
  tradeTime: string
  venue: string
}


export type Trade = IGTradeGoodStuff<Date, number> & DataRow & { 
  accountId: string
  tradeDateTime: Date
  isBuy: boolean
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
    const trade: Trade = {
      // extra fields
      uniqueId: t.orderID,
      accountId: account.accountId,
      isBuy: float(t.scaledSize) > 0,

      // Conversions
      convertOnCloseRate: float(t.convertOnCloseRate),
      orderSize: float(t.orderSize),
      price: float(t.price),
      scaledSize: float(t.scaledSize),
      tradeDateTime: dateFromComponents(t.tradeDate, t.tradeTime),
      tradeValue: float(t.tradeValue),

      // Direct mappings
      amounts: t.amounts,
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
