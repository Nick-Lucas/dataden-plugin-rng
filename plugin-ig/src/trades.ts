import axios from 'axios'
import { DataRow } from "@dataden/sdk"

import { SessionResult } from "./ig-auth"
import { Settings } from "./types"
import { DateTime } from "luxon"

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

export interface IGTrade {
  accountId: string
  convertOnCloseRate: string
  currency: string
  direction: string
  entryType: string
  epic: string
  formalInstrumentName: string
  instrumentDesc: string
  narrative: string
  orderID: string
  orderSize: string
  orderType: string
  price: string
  scaledSize: string
  settlementDate: string
  settlementStatus: string
  summaryCode: string
  summaryCodeDescription: string
  amounts: Amount[]
  tradeDate: string
  tradeTime: string
  tradeValue: string
  venue: string
  tradeType: string
}


export type Trade = IGTrade & DataRow & { 
  accountId: string
}

export interface IGLedgerHistoryResponse {
  success: boolean
  payload: {
    accountID: string
    startDate: string
    endDate: string
    pagination: Pagination
    txnHistory: Trade[]
  }
  error?: any
}

export async function loadTrades(settings: Settings, session: SessionResult, startDateIso: string, endDateIso: string): Promise<Trade[]> {
  const http = axios.create({
    headers: {
      'Content-Type': 'application/json',
      'CST': session.cst,
      'X-SECURITY-TOKEN': session.xSecurityToken,
      'Origin': 'https://www.ig.com'
    },
    baseURL: settings.plugin.igApiUri
  })

  const accountId = session.accountId

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
  
  return result.data.payload.txnHistory.map(_t => {
    const t = _t as Trade

    t.uniqueId = t.orderID
    t.accountId = accountId

    return t
  })
}

