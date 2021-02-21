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

  isBuy: boolean
  currency: string
  plWithFees: number
  plWithoutFees: number
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
      const isBuy = trade.scaledSize > 0
      
      const { amounts, convertOnCloseRate } = trade

      const totalAmount = amounts.find(am => am.amountType === 'TOTAL_AMOUNT')
      const considerationAmount = amounts.find(am => am.amountType === 'CONSIDERATION')

      // IG BUGFIX: Due to an apparent bug, value directions need correcting as they are randomly opposite signed
      totalAmount.value = isBuy ? -Math.abs(totalAmount.value) : Math.abs(totalAmount.value)
      considerationAmount.value = isBuy ? -Math.abs(considerationAmount.value) : Math.abs(considerationAmount.value)

      const finalCurrency = totalAmount.currency
      const plWithFees = round(totalAmount.value)
      const plWithoutFees = round((considerationAmount.value * convertOnCloseRate))
      const fees = round(plWithoutFees - plWithFees)

      // IG BUGFIX: Due to an apparent bug, different instruments have different scaling needs, but scaledSize is always whole shares
      //            so we recalculate pricePerShare for both home currency and exchange currency
      const size = trade.scaledSize
      const pricePerShare = round(Math.abs(plWithoutFees) / size)
      const pricePerShareExchange = round(Math.abs(considerationAmount.value) / size)

      stockTrades.push({
        uniqueId: trade.uniqueId,
        accountId: account.accountId,
        date: trade.tradeDateTime,

        stockId: trade.epic,
        stockName: trade.formalInstrumentName,
        stockDescription: trade.instrumentDesc,
        
        isBuy,
        currency: finalCurrency,
        plWithFees: plWithFees,
        plWithoutFees: plWithoutFees,
        fees,
        size: trade.scaledSize,
        pricePerShare: pricePerShare,

        exchange: {
          currency: trade.currency,
          exchangeRateToFinalCurrency: convertOnCloseRate,
          price: pricePerShareExchange,
          size: trade.scaledSize,
          total: considerationAmount.value
        },

        raw: settings.plugin.includeRawData ? trade : undefined
      })
    }

    log.info(`Done for account ${account.accountId}`)
  }

  return stockTrades
}
      