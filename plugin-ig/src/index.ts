import { createPlugin, LoaderRequest, SdkLogger } from "@dataden/sdk";
import _ from 'lodash'

import { Settings, RehydrationData } from "./types";
import { generateBatches } from "./generateBatches";

import { getSession } from "./ig-auth";
// import { Transaction, loadTransactions } from "./transactions";
// import { Trade, loadTrades } from "./trades";


export default createPlugin({
  getDefaultSettings: async () => {
    return ({
      plugin: {
        igApiUri: 'https://api.ig.com',
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
    {
      name: 'session_info',
      load: async (_settings, request, log) => {
        const settings = (_settings as unknown) as Settings

        const session = await getSession(settings as Settings, log)

        return {
          mode: 'append',
          data: [
            {
              uniqueId: 'session',
              ...session
            }
          ],
          syncInfo: {
            success: true,
            rehydrationData: {}
          }
        }
      }
    },
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

