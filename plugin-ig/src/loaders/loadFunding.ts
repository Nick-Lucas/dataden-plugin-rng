import { Settings } from "../types"
import { SdkLogger, DataRow } from "@dataden/sdk"
import _ from 'lodash'

import { SessionResult } from "../api/ig-auth"
import { Summary, loadTransactions } from "../api/transactions"

export interface FundingTransaction extends DataRow {
  accountId: string
  date: Date
  currency: string
  amount: number
  type: Summary
}

export const loadFunding = async (settings: Settings, session: SessionResult, log: SdkLogger): Promise<FundingTransaction[]> => {
  log.info(`Loading CashIn/CashOut Transactions`)

  const funding: FundingTransaction[] = []
  for (const account of session.accounts) {
    log.info(`Loading transactions for account ${account.accountId}`)

    // TODO: perhaps include "20010" for inter-account transfers? How to reconcile this?
    const transactions = await loadTransactions(settings, account, settings.plugin.backdateToISO, new Date().toISOString(), "DEPOSIT,WITHDRAWAL")
    for (const transaction of transactions) {
      funding.push({
        uniqueId: transaction.uniqueId,
        date: transaction.dateUtc,
        accountId: account.accountId,
        currency: transaction.currency,
        type: transaction.summary,
        amount: transaction.profitAndLoss
      })
    }

    log.info(`Done for account ${account.accountId}`)
  }

  return _.sortBy(funding, st => st.date.valueOf())
}
