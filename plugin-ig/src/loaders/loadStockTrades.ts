import { SdkLogger, DataRow } from "@dataden/sdk"

import { Settings } from "../types"
import { SessionResult } from "../api/ig-auth"
import { Trade, loadTrades } from "../api/trades"
import { round } from "../converters";

export interface StockTrade extends DataRow {
  accountId: string
  date: Date

  stockId: string
  stockName: string
  stockDescription: string

  currency: string
  valueWithFees: number
  valueWithoutFees: number
  fees: number
  size: number
  pricePerShare: number

  exchange: {
    currency: string
    exchangeRateToFinalCurrency: number
    size: number
    price: number
    total: number
  }
}

export const loadStockTrades = async (settings: Settings, session: SessionResult, log: SdkLogger): Promise<StockTrade[]> => {
  log.info(`Loading Trades for Stockbroking accounts`)

  const stockTrades: StockTrade[] = []
  for (const account of session.accounts) {
    if (account.type !== 'stocks') {
      log.info(`Skipping account ${account.accountId} as "${account.type}" is not a supported type for stock trades`)
      continue
    }

    log.info(`Loading for account ${account.accountId}`)

    // TODO: just fetch since last fetch?
    const trades = await loadTrades(settings, account, settings.plugin.backdateToISO, new Date().toISOString())
    for (const trade of trades) {
      // delete trade.rawTrade
      const isBuy = trade.direction === '+'
      if (!isBuy && trade.direction !== '-') {
        throw new Error("Unexpected state, trade.direction must be +/- but was " + trade.direction)
      }

      const { amounts, convertOnCloseRate } = trade

      const totalAmount = amounts.find(am => am.amountType === 'TOTAL_AMOUNT')
      const considerationAmount = amounts.find(am => am.amountType === 'CONSIDERATION')

      // Due to an apparent bug, value directions need correcting as they are randomly opposite signed
      totalAmount.value = isBuy ? Math.abs(totalAmount.value) : -Math.abs(totalAmount.value)
      considerationAmount.value = isBuy ? Math.abs(considerationAmount.value) : -Math.abs(considerationAmount.value)

      const finalCurrency = totalAmount.currency
      const valueWithFees = round(totalAmount.value)
      const valueWithoutFees = round((considerationAmount.value * convertOnCloseRate))
      const fees = round(valueWithoutFees - valueWithFees)
      const pricePerShare = round(trade.price * convertOnCloseRate)

      stockTrades.push({
        uniqueId: trade.uniqueId,
        accountId: account.accountId,
        date: trade.tradeDateTime,

        stockId: trade.epic,
        stockName: trade.formalInstrumentName,
        stockDescription: trade.instrumentDesc,
        
        currency: finalCurrency,
        valueWithFees,
        valueWithoutFees,
        fees,
        size: trade.scaledSize,
        pricePerShare: pricePerShare,

        exchange: {
          currency: trade.currency,
          exchangeRateToFinalCurrency: convertOnCloseRate,
          price: trade.price,
          size: trade.scaledSize,
          total: considerationAmount.value
        },

        // raw: trade
      })
    }

    log.info(`Done for account ${account.accountId}`)
  }

  return stockTrades
}
      