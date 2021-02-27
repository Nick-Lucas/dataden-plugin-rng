import axios from 'axios'
import { DateTime } from "luxon"
import _ from 'lodash'
import { DataRow, SdkLogger } from "@dataden/sdk"

import { AccountResult, SessionResult } from "./ig-auth"
import { Settings } from "../types"
import { date } from "../converters";

const dateFormat = "yyyy-MM-dd"

export interface IGBetsPNL<TDate=Date> {
  date: TDate
  currency: string
  value: number
  closedPositions: number
  profitablePositions: number
}

interface ApiResponse {
  currency: string
  dataPoints: IGBetsPNL<string>[]
}

export type BetsPNL = IGBetsPNL & DataRow & {
  accountId: string
}

export async function loadAllBetsPNL(settings: Settings, session: SessionResult, log: SdkLogger, startDateIso: string, endDateIso: string) {
  const pnls: BetsPNL[] = []

  log.info("Will load PNL for Bets")
  for (const account of session.accounts) {
    if (account.type !== 'cfd' && account.type !== 'spreadbet') {
      log.info(`Skipping account ${account.accountId} as PNL is not supported on "${account.type}" accounts`)
      continue
    }

    const accountPnls = await loadBetsPNL(settings, account, log, startDateIso, endDateIso)

    pnls.push(...accountPnls)
  }

  return _.sortBy(pnls, pnl => pnl.date.valueOf())
}

/** Load and sanitise all spread/cfd bets in a date range, converting all prices to the account currency (ie. GBP) and correcting any flaws in the data */
export async function loadBetsPNL(settings: Settings, account: AccountResult, log: SdkLogger, startDateIso: string, endDateIso: string): Promise<BetsPNL[]> {
  const dateFrom = DateTime.fromISO(startDateIso).toFormat(dateFormat)
  const dateTo = DateTime.fromISO(endDateIso).toFormat(dateFormat)

  log.info(`Loading PNL for account ${account.accountId}`)

  try {
    const result = await axios.get<ApiResponse>(
      `/uk/myig/api/client-performance/charts/pnlDaily`,
       {
         headers: {
           'Referrer': 'https://www.ig.com',
           'Content-Type': 'application/json',
           'CST': account.cst,
           'IG-ACCOUNT-ID': account.accountId,
           'Accept': 'application/json, text/plain, */*'
         },
         params: {
           startDate: dateFrom,
           endDate: dateTo
         },
         baseURL: "https://www.ig.com",
         validateStatus: status => status === 200
       }
     )

     return result.data.dataPoints.map(t => {
      return { 
        ...t,
        uniqueId: `${t.date}_${account.accountId}`,
        accountId: account.accountId,
        date: date(t.date, "yyyy-MM-dd"),
        currency: result.data.currency
      }
    })
  } catch (e) {
    if (e?.response?.status === 404) {
      log.warn(`Could not load PNL for account ${account.accountId} as 404 response was recieved. This most likely means the account has no trade data.`)
      return []
    } else {
      throw e
    }
  }
  
}
