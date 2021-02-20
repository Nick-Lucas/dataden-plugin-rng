import { Settings } from "./types";
import { SessionResult } from "./ig-auth";
import { SdkLogger, DataRow } from "@dataden/sdk";

import { Summary, loadTransactions } from "./transactions";

export interface FundingTransaction extends DataRow {
  accountId: string
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
        accountId: account.accountId,
        currency: transaction.currency,
        type: transaction.summary,
        amount: transaction.profitAndLoss
      })
    }

    log.info(`Done for account ${account.accountId}`)
  }

  return funding
}
