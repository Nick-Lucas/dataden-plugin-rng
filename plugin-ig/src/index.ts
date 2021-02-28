import { createPlugin, LoaderRequest, SdkLogger } from "@dataden/sdk";
import _ from 'lodash'

import { Settings, RehydrationData } from "./types";
import { generateBatches } from "./generateBatches";

import { getSession } from "./api/ig-auth";
import { Transaction, loadTransactions } from "./api/transactions";
import { loadAllBetsPNL } from "./api/bets-pnl";

import { loadFunding } from "./loaders/loadFunding";
import { loadUser } from "./loaders/loadUser";
import { loadPortfolioSummary } from "./loaders/loadPortfolioSummary";


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
    {
      name: 'user',
      load: async (_settings, request, log) => {
        const settings = (_settings as unknown) as Settings

        const session = await getSession(settings as Settings, log)

        const user = await loadUser(session)

        return {
          mode: 'replace',
          data: [
            {
              uniqueId: 'session',
              ...user
            }
          ],
          syncInfo: {
            success: true,
            rehydrationData: {}
          }
        }
      }
    },
    {
      name: 'portfolio_summary',
      load: async (_settings, request, log) => {
        const settings = (_settings as unknown) as Settings

        const session = await getSession(settings as Settings, log)

        const summary = await loadPortfolioSummary(settings, session, log, new Date())

        return {
          mode: 'replace',
          data: summary,
          syncInfo: {
            success: true,
            rehydrationData: {}
          }
        }
      }
    },
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

