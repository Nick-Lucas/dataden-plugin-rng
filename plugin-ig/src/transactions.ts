import axios from 'axios'
import { DataRow } from "@dataden/sdk"

import { SessionResult } from "./ig-auth"
import { Settings } from "./types"
import { DateTime } from "luxon"

const dateFormat = "dd-MM-yyyy"

type Summary =
  'Cash In' // from bank
  | 'Cash Out' // to bank
  | 'Client Consideration' // sold
  | 'Closing trades' // sold
  | 'Share Dealing Commissions' // fee
  | 'SDRT' // stamp duty tax/fee
  | 'Dividend' // dividend received
  | 'Dividends Paid' // dividend corrections/fees
  | 'Exchange Fees' // fee
  | 'PTM Levy' // fee
  | 'CFD funding Interest Paid' // fee
  | 'Stock Borrowing Costs' // fee
  | 'Inter Account Transfers' // internal

const SUMMARY_BANK: Summary[] = ['Cash In', 'Cash Out']
const SUMMARY_CLOSED: Summary[] = [
  'Client Consideration',
  'Closing trades'
]
const SUMMARY_FEES: Summary[] = [
  'Share Dealing Commissions', 
  'SDRT', 
  'Dividend', 
  'Dividends Paid', 
  'Exchange Fees', 
  'PTM Levy', 
  'CFD funding Interest Paid', 
  'Stock Borrowing Costs'
]

interface SummaryFlags {
  isBankTransfer: boolean
  isClosingTrade: boolean
  isFee: boolean
}
function getSummaryFlags(summary: Summary): SummaryFlags {
  return {
    isBankTransfer: SUMMARY_BANK.includes(summary),
    isClosingTrade: SUMMARY_CLOSED.includes(summary),
    isFee: SUMMARY_FEES.includes(summary),
  }
}

export interface IGTransaction {
  date: string
  summary: Summary
  marketName: string
  period: string
  profitAndLoss: string
  transactionType: string
  reference: string
  openLevel: string
  closeLevel: string
  size: string
  currency: string
  plAmount: string
  cashTransaction: boolean
  dateUtc: string
  openDateUtc: string
  currencyIsoCode?: any
}

export type Transaction = IGTransaction & DataRow & { 
  summaryFlags: SummaryFlags 
  accountId: string
}

export interface IGTransactionsResponse {
  transactions: IGTransaction[],
  pageData: {
    pageSize: number
    pageNumber: number
    totalCount: number
    numberPages: number
  }
}

export async function loadTransactions(settings: Settings, session: SessionResult, startDateIso: string, endDateIso: string): Promise<Transaction[]> {
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

  const result = await http.get<IGTransactionsResponse>(
    `/deal/v2/history/transactions/${dateFrom}/${dateTo}/fromcodes?pageSize=10000000&pageNumber=1&codes=ALL`,
    {
      headers: {
        'Version': 1,
        'IG-Account-ID': accountId,
      },
      validateStatus: status => status === 200
    }
  )

  // TODO: validate pages in case a second page exists

  return result.data.transactions.map(_t => {
    const t = _t as Transaction

    t.uniqueId = t.reference
    t.summaryFlags = getSummaryFlags(t.summary)
    t.accountId = accountId

    return t
  })
}
