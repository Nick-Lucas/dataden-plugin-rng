import axios from 'axios'
import { DataRow } from "@dataden/sdk"

import { AccountResult, SessionResult } from "./ig-auth"
import { Settings } from "../types"
import { DateTime } from "luxon"
import { date, float } from "../converters";

const dateFormat = "dd-MM-yyyy"

export type Summary =
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

export interface IGTransaction<TDate=string, TNumber=string> {
  date: TDate
  summary: Summary
  marketName: string
  period: string
  profitAndLoss: TNumber
  transactionType: string
  reference: string
  openLevel: TNumber
  closeLevel: TNumber
  size: TNumber
  currency: string
  plAmount: TNumber
  cashTransaction: boolean
  dateUtc: TDate
  openDateUtc: TDate
  currencyIsoCode?: string
}

export type Transaction = IGTransaction<Date, number> & DataRow & { 
  summaryFlags: SummaryFlags 
  accountId: string
}

export interface IGTransactionsResponse {
  transactions: IGTransaction<string, string>[],
  pageData: {
    pageSize: number
    pageNumber: number
    totalCount: number
    numberPages: number
  }
}

export async function loadTransactions(settings: Settings, account: AccountResult, startDateIso: string, endDateIso: string, codes: "ALL"| "DEPOSIT,WITHDRAWAL" = "ALL"): Promise<Transaction[]> {
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

  let codeNum = "ALL"
  if (codes === "DEPOSIT,WITHDRAWAL") {
    codeNum = "20001,20002"
  }

  const result = await http.get<IGTransactionsResponse>(
    `/deal/v2/history/transactions/${dateFrom}/${dateTo}/fromcodes?pageSize=10000000&pageNumber=1&codes=${encodeURIComponent(codeNum)}`,
    {
      headers: {
        'Version': 1,
        'IG-Account-ID': accountId,
      },
      validateStatus: status => status === 200
    }
  )

  // TODO: validate pages in case a second page exists

  return result.data.transactions.map(t => {
    const transaction: Transaction = {
      ...t,

      // new fields
      uniqueId: t.reference,
      summaryFlags: getSummaryFlags(t.summary),
      accountId: accountId,

      // conversions
      closeLevel: float(t.closeLevel),
      openLevel: float(t.openLevel),
      plAmount: float(t.plAmount),
      profitAndLoss: float(t.profitAndLoss),
      size: float(t.profitAndLoss),
      date: date(t.date, "dd/MM/yy"),
      dateUtc: date(t.dateUtc),
      openDateUtc: date(t.openDateUtc),

      rawTransaction: t
    }

    return transaction
  })
}
