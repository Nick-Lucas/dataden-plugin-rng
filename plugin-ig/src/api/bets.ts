// TODO: the problem here is, although we can wrangle the data format given by IG, 
//   there appears to be no way to calculate an opening position and the collateral (for pusposes here that's the "buy" price of a position)
//   this is because of the way that spreads and the data format given by IG work. So the best we can do is use the final PNL trades of a position, 
//   which precludes the initial collateral but at least balances the books on close.

// import axios from 'axios'
// import { DateTime } from "luxon"
// import _ from 'lodash'
// import { DataRow, SdkLogger } from "@dataden/sdk"

// import { AccountResult, SessionResult, AccountType } from "./ig-auth"
// import { Settings } from "../types"
// import { date, float } from "../converters";

// const dateFormat = "dd-MM-yyyy"

// export type Direction = "BUY" | "SELL"

// export interface IGBetTheGoodStuff<TDate=Date, TNumber=number> {
//   direction: Direction
//   accountId: string
//   closedDate: TDate
//   borrowing: TNumber
//   openingDealId: string
//   closingDealId: "OPEN" | string
//   openingLevel: number
//   closingLevel: number
//   originalSize: number
//   commission: TNumber
//   corrections: TNumber
//   creditPremium: TNumber
//   currencySymbol: string
//   dividends: TNumber
//   funding: TNumber
//   fxInterest: TNumber
//   gst: TNumber
//   marketName: string
//   modifiedDate: TDate
//   openedDate: TDate
//   presentationMarketName: string
//   realisedProfitAndLoss: TNumber
//   total: TNumber
//   sizeStillOpen: number
//   transactionType: number
//   size: number
// }

// type IGBet<TDate=number, TNumber=string> = IGBetTheGoodStuff<TDate, TNumber> & {
//   locale: string
//   epic: string
//   prompt: string
//   presentationPrompt: string
//   commissionCurrencySymbol: string
//   convertToCurrency: string
//   createdDate: number
//   currentPrice: null
//   displayOpeningLevel: number
// }

// interface ApiResponse {
//   pageData: {
//     pageSize: number
//     pageNumber: number
//     totalCount: number
//     numberPages: number
//   }
//   trades: IGBet[]
// }

// export type BetAction = "OPEN" | "CLOSE"

// export type Bet = IGBetTheGoodStuff & DataRow & {
//   date: Date

//   accountId: string
//   accountType: AccountType,
  
//   marketId: string
//   marketExpiry: string
//   marketName: string
//   marketAltName: string

//   action: BetAction
//   direction: Direction
//   currency: string
//   size: number
//   price: number

//   plConsideration: number
//   fees: number
//   plTotal: number
// }

// export async function loadAllBets(settings: Settings, session: SessionResult, log: SdkLogger, startDateIso: string, endDateIso: string) {
//   const pnls: Bet[] = []

//   log.info("Will load spread/cfd Bets")
//   for (const account of session.accounts) {
//     if (account.type !== 'cfd' && account.type !== 'spreadbet') {
//       log.info(`Skipping account ${account.accountId} as bet positions are not supported on "${account.type}" accounts`)
//       continue
//     }

//     const accountPnls = await loadBets(settings, account, log, startDateIso, endDateIso)

//     pnls.push(...accountPnls)
//   }

//   return _.sortBy(pnls, pnl => pnl.date.valueOf())
// }

// /** Load and sanitise all spread/cfd bets in a date range, converting all prices to the account currency (ie. GBP) and correcting any flaws in the data */
// export async function loadBets(settings: Settings, account: AccountResult, log: SdkLogger, startDateIso: string, endDateIso: string): Promise<Bet[]> {
//   const dateFrom = DateTime.fromISO(startDateIso).toFormat(dateFormat)
//   const dateTo = DateTime.fromISO(endDateIso).toFormat(dateFormat)

//   log.info(`Loading PNL for account ${account.accountId}`)
  
//   const result = await axios.get<ApiResponse>(
//     `/uk/myig/api/client-performance/charts/pnlDaily`,
//       {
//         headers: {
//           'Referrer': 'https://www.ig.com',
//           'Content-Type': 'application/json',
//           'CST': account.cst,
//           'IG-ACCOUNT-ID': account.accountId,
//           'Accept': 'application/json, text/plain, */*'
//         },
//         params: {
//           fromDate: dateFrom,
//           toDate: dateTo,
//           dealType: 'OPENED',
//           pageSize: 1000000,
//           pageNumber: 1
//         },
//         baseURL: settings.plugin.igApiUri,
//         validateStatus: status => status === 200
//       }
//     )

//     // TODO: check and iterate on pages

//     const bets = result.data.trades.map<IGBet>(bet => {
//       return {
//         ...bet,

//         // All stringified numbers
//         borrowing: float(bet.borrowing),
//         commission: float(bet.commission),
//         corrections: float(bet.corrections),
//         creditPremium: float(bet.creditPremium),
//         dividends: float(bet.dividends),
//         funding: float(bet.funding),
//         fxInterest: float(bet.fxInterest),
//         gst: float(bet.gst),
//         total: float(bet.total),
//         realisedProfitAndLoss: float(bet.realisedProfitAndLoss),

//         // All unix date numbers
//         openedDate: new Date(bet.openedDate),
//         modifiedDate: new Date(bet.modifiedDate),
//         createdDate: new Date(bet.createdDate),
//         closedDate: new Date(bet.closedDate),
//       }
//     })

//     return []

//     // const groupedBets = _.groupBy(bets, bet => bet.openingDealId)

//     // return result.data.trades.map(bet => {
//     //   const date = new Date(bet.createdDate)

//     //   const action: BetAction = bet.closingDealId === 'OPEN' ? 'OPEN' : 'CLOSE'

//     //   if (bet.currencySymbol !== 'GBP') {
//     //     // TODO: probably just remove this line 
//     //     throw "Not Implemented: Currency was not GBP, unsupported currency"
//     //   }

//     //   return { 
//     //     uniqueId: `${date.toISOString()}_${account.accountId}`,
//     //     date: date,
//     //     accountId: account.accountId,
//     //     accountType: account.type,

//     //     action: action,
//     //     direction: bet.direction,

//     //     marketId: bet.epic,
//     //     marketName: bet.marketName,
//     //     marketAltName: bet.presentationMarketName,
//     //     marketExpiry: bet.prompt.trim(),

//     //     borrowing: 0,
//     //     commission: 0,
//     //     creditPremium: 0,
//     //     fxInterest: 0,
//     //     funding: 0,
//     //     corrections: 0,
//     //     dividends: 0,
//     //     gst: 0,
        
//     //     size: 0,
//     //     sizeStillOpen: 0,
//     //     closingLevel: 0,
//     //     openingLevel: 0,
        
//     //     openedDate: new Date(bet.openedDate),
//     //     modifiedDate: new Date(bet.modifiedDate),
//     //     closedDate: new Date(bet.closedDate),
//     //     closingDealId: bet.closingDealId,
//     //     currencySymbol: bet.currencySymbol,

//     //   }
//     // })
// }
