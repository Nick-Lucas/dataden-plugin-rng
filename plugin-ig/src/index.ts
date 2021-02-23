import { createPlugin, LoaderRequest, SdkLogger } from "@dataden/sdk";
import _ from 'lodash'

import { Settings, RehydrationData } from "./types";
import { generateBatches } from "./generateBatches";

import { getSession } from "./api/ig-auth";
import { Transaction, loadTransactions } from "./api/transactions";
import { Trade, loadTrades } from "./api/trades";

import { loadFunding } from "./loaders/loadFunding";
import { loadUser } from "./loaders/loadUser";
import { loadStockTrades } from "./loaders/loadStockTrades";
import { loadPortfolio } from "./loaders/loadPortfolio";


export default createPlugin({
  getDefaultSettings: async () => {
    return ({
      plugin: {
        igApiUri: 'https://api.ig.com',
        includeRawData: false,
        backdateToISO: "2000-01-01T00:00:00Z",
        batchLengthMonths: 2
      },
      schedule: {
        every: 1,
        grain: 'hour'
      },
      secrets: {
        igUsername: "",
        igPassword: ""
      }
    } as Settings) as any
  },
  loaders: [
    // {
    //   name: 'user',
    //   load: async (_settings, request, log) => {
    //     const settings = (_settings as unknown) as Settings

    //     const session = await getSession(settings as Settings, log)

    //     const user = await loadUser(session)

    //     return {
    //       mode: 'append',
    //       data: [
    //         {
    //           uniqueId: 'session',
    //           ...user
    //         }
    //       ],
    //       syncInfo: {
    //         success: true,
    //         rehydrationData: {}
    //       }
    //     }
    //   }
    // },
    // {
    //   name: 'funding',
    //   load: async (_settings, request, log) => {
    //     const settings = (_settings as unknown) as Settings

    //     const session = await getSession(settings as Settings, log)

    //     const funding = await loadFunding(settings, session, log)

    //     return {
    //       mode: 'append',
    //       data: funding,
    //       syncInfo: {
    //         success: true,
    //         rehydrationData: {}
    //       }
    //     }
    //   }
    // },
    {
      name: 'trades',
      load: async (_settings, request, log) => {
        const settings = (_settings as unknown) as Settings

        const session = await getSession(settings as Settings, log)

        let trades = []
        for (const account of session.accounts) {
          const accountTrades = await loadTrades(
            settings, 
            account, 
            settings.plugin.backdateToISO, 
            new Date().toISOString())

          trades.push(...accountTrades)
        }

        return {
          mode: 'append',
          data: trades,
          syncInfo: {
            success: true,
            rehydrationData: {}
          }
        }
      }
    },
    // {
    //   name: 'portfolio',
    //   load: async (_settings, request, log) => {
    //     const settings = (_settings as unknown) as Settings

    //     const session = await getSession(settings as Settings, log)

    //     const portfolio = await loadPortfolio(settings, session, log)

    //     return {
    //       mode: 'append',
    //       data: portfolio,
    //       syncInfo: {
    //         success: true,
    //         rehydrationData: {}
    //       }
    //     }
    //   }
    // },
    // {
    //   name: 'transactions',
    //   load: async (_settings, request, log) => {
    //     const settings = (_settings as unknown) as Settings

    //     const session = await getSession(settings as Settings, log)

    //     let rehydrationData = calculateBatches(settings, request, log);

    //     let allTransactions: Transaction[] = []
    //     const remainingBatches = _.sortBy(rehydrationData.pending, batch => batch.dateFromISO).reverse()
    //     while (remainingBatches.length > 0) {
    //       const batch = remainingBatches.pop()

    //       const transactions = await loadTransactions(settings, session, batch.dateFromISO, batch.dateToISO)

    //       allTransactions.push(...transactions)
    //     }

    //     rehydrationData.lastDate = (_.last(allTransactions)?.dateUtc ?? new Date()).toISOString()

    //     return {
    //       mode: 'append',
    //       data: allTransactions,
    //       syncInfo: {
    //         success: true,
    //         rehydrationData
    //       }
    //     }
    //   }
    // },
    // {
    //   name: 'trades',
    //   load: async (_settings, request, log) => {
    //     const settings = (_settings as unknown) as Settings

    //     const session = await getSession(settings as Settings, log)

    //     let rehydrationData = calculateBatches(settings, request, log);

    //     let allTrades: Trade[] = []
    //     const remainingBatches = _.sortBy(rehydrationData.pending, batch => batch.dateFromISO).reverse()
    //     while (remainingBatches.length > 0) {
    //       const batch = remainingBatches.pop()

    //       const trades = await loadTrades(settings, session, batch.dateFromISO, batch.dateToISO)

    //       allTrades.push(...trades)
    //     }

    //     rehydrationData.lastDate = (_.last(allTrades)?.tradeDate ?? new Date()).toISOString()

    //     return {
    //       mode: 'append',
    //       data: allTrades,
    //       syncInfo: {
    //         success: true,
    //         rehydrationData
    //       }
    //     }
    //   }
    // }
  ]
})

function calculateBatches(settings: Settings, request: LoaderRequest, log: SdkLogger): RehydrationData {
  const toDateISO = new Date().toISOString();
  
  let rehydrationData = request.lastSync.rehydrationData as RehydrationData;
  if (!rehydrationData || !rehydrationData.lastDate || !rehydrationData.pending) {
    log.info("Defaulting rehydration data since it is blank");

    rehydrationData = {
      lastDate: settings.plugin.backdateToISO,
      pending: generateBatches(
        settings.plugin.backdateToISO,
        toDateISO,
        settings.plugin.batchLengthMonths)
    }
  } else {
    const newBatches = generateBatches(
      rehydrationData.lastDate,
      toDateISO,
      settings.plugin.batchLengthMonths);

    rehydrationData.pending.push(...newBatches);
  }

  return rehydrationData;
}

