import axios from 'axios'
import { DataRow } from "@dataden/sdk"

import { AccountResult } from "./ig-auth"
import { Settings } from "./types"
import { DateTime } from "luxon"
import { date, dateFromComponents, float } from "./converters";

const dateFormat = "dd-MM-yyyy"

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

export interface IGTrade<TDate=string, TNumber=string> {
  accountId: string
  convertOnCloseRate: TNumber
  currency: string
  direction: string
  entryType: string
  epic: string
  formalInstrumentName: string
  instrumentDesc: string
  narrative: string
  orderID: string
  orderSize: TNumber
  orderType: string
  price: TNumber
  scaledSize: TNumber
  settlementDate: TDate
  settlementStatus: string
  summaryCode: string
  summaryCodeDescription: string
  amounts: Amount[]
  tradeDate: TDate
  tradeTime: string
  tradeDateTime: TDate
  tradeValue: TNumber
  venue: string
  tradeType: string
}


export type Trade = IGTrade<Date, number> & DataRow & { 
  accountId: string
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
  const http = axios.create({
    headers: {
      'Content-Type': 'application/json',
      'CST': account.cst,
      'X-SECURITY-TOKEN': account.xSecurityToken,
      'Origin': 'https://www.ig.com'
    },
    baseURL: settings.plugin.igApiUri
  })

  const accountId = account.accountId

  const dateFrom = DateTime.fromISO(startDateIso).toFormat(dateFormat)
  const dateTo = DateTime.fromISO(endDateIso).toFormat(dateFormat)

  const result = await http.get<IGLedgerHistoryResponse>(
   `/deal/ledgerhistory/list?startDate=${dateFrom}&endDate=${dateTo}&pageNumber=1&recordsPerPage=10000000`,
    {
      headers: {
        'Version': 1,
        'IG-Account-ID': accountId,
        'ig-account-id': accountId,
      },
      validateStatus: status => status === 200
    }
  )

  // TODO: validate pages in case a second page exists
  
  return result.data.payload.txnHistory.map(t => {
    const trade: Trade = {
      ...t,

      // extra fields
      uniqueId: t.orderID,
      accountId: accountId,

      // Conversions
      convertOnCloseRate: float(t.convertOnCloseRate),
      orderSize: float(t.orderSize),
      price: float(t.price),
      scaledSize: float(t.scaledSize),
      settlementDate: date(t.settlementDate, "dd/MM/yyyy"),
      tradeDate: date(t.tradeDate, "dd/MM/yyyy"),
      tradeDateTime: dateFromComponents(t.tradeDate, t.tradeTime),
      tradeValue: float(t.tradeValue),

      rawTrade: t
    }

    return trade
  })
}
