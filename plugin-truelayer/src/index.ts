import { createPlugin, Settings, PluginAuth, DataRow } from "@dataden/sdk";
import _ from 'lodash'
import axios from "axios";
import { DateTime, Duration } from "luxon";
import { Account, getAccounts, getTransactions, Transaction } from "./api";

interface PluginSettings extends Record<string, any> {
  backdateToISO: string
  batchLengthMonths: number
}

interface PluginSecrets extends Record<string, string> {
  truelayerClientId: string
  truelayerClientSecret: string
}

type TruelayerPluginSettings = Settings<PluginSettings, PluginSecrets>

const TRUELAYER_AUTH_URI = "https://auth.truelayer.com/"
const TRUELAYER_TOKEN_URI = "https://auth.truelayer.com/connect/token"

interface Tokens {
  access_token: string
  expires_in: string
  token_type: string
  refresh_token: string
}

const exchangeForTokens = async (
  settings: TruelayerPluginSettings, 
  receivedParams: 
    { grant_type: "authorization_code", code: string, redirect_uri: string } | 
    { grant_type: "refresh_token", refresh_token: string }
  ): Promise<Tokens> => {
  try {
    const response = await axios.post(TRUELAYER_TOKEN_URI, {
      client_id: settings.secrets.truelayerClientId,
      client_secret: settings.secrets.truelayerClientSecret,
      ...receivedParams,
    })
    
    return response.data as Tokens
  } catch (e) {
    throw e.response.status + ": "+ JSON.stringify(e.response.data, null, 2)
  }
}

export default createPlugin({
  getDefaultSettings: async (): Promise<Settings<PluginSettings, PluginSecrets>> => {
    return {
      schedule: {
        every: 1,
        grain: 'minute'
      },
      plugin: {
        backdateToISO: "2000-01-01T00:00:00Z",
        batchLengthMonths: 2
      },
      secrets: {
        truelayerClientId: "",
        truelayerClientSecret: "",
      } 
    }
  },

  authMethod: {
    type: "oauth2_authorizationcode",
    getAuthUri: async (settings: TruelayerPluginSettings, params) => {
      // TODO: what about reauthorization later?
      return axios.getUri({
        url: TRUELAYER_AUTH_URI,
        params: {
          response_type: "code",
          client_id: settings.secrets.truelayerClientId,
          redirect_uri: params.redirectUri,
          state: params.state,
          scope: "info accounts balance cards transactions direct_debits standing_orders offline_access"
        }
      })
    },
    exchangeAuthorizationForAuthState: async (
      settings: TruelayerPluginSettings, 
      receivedParams,
    ) => {
      return exchangeForTokens(settings, {
        grant_type: "authorization_code",
        code: receivedParams.code,
        redirect_uri: receivedParams.redirectUri
      })
    },
    updateAuthState: async (
      settings: TruelayerPluginSettings, 
      previousTokens: Tokens
    ) => {  
      try {
        return exchangeForTokens(settings, {
          grant_type: "refresh_token",
          refresh_token: previousTokens.refresh_token
        })
      } catch (e) {
        if (String(e).includes("403")) {
          return "reauthorization_required"
        } else {
          throw e
        }
      }
    }
  } as PluginAuth.OAuth2AuthMethod,

  loaders: [
    {
      name: 'accounts',
      load: async (_settings, request, log) => {
        const settings = _settings as TruelayerPluginSettings
        if (!settings.secrets.truelayerClientId || !settings.secrets.truelayerClientSecret) {
          throw "Secrets not populated"
        }

        const tokens = (request.auth as unknown) as Tokens
        if (!tokens?.access_token) {
          throw "Auth credentials not provided"
        }

        const accounts = await getAccounts(tokens.access_token)
        log.info(`Loaded ${accounts.results.length} accounts`)

        return {
          mode: 'append',
          data: accounts.results.map(account => {
            const result = account as DataRow & Account

            result.uniqueId = account.account_id

            return result
          }),
          syncInfo: {
            success: true,
            rehydrationData: {}
          }
        }
      }
    },
    {
      name: 'transactions',
      load: async (_settings, request, log) => {
        const settings = _settings as TruelayerPluginSettings
        if (!settings.secrets.truelayerClientId || !settings.secrets.truelayerClientSecret) {
          throw "Secrets not populated"
        }

        const tokens = (request.auth as unknown) as Tokens
        if (!tokens?.access_token) {
          throw "Auth credentials not provided"
        }

        const toDateISO = new Date().toISOString()
        let rehydrationData = request.lastSync.rehydrationData as RehydrationData
        if (!rehydrationData || !rehydrationData.lastDate || !rehydrationData.pending) {
          log.info("Defaulting rehydration data since it is blank")
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
            settings.plugin.batchLengthMonths)

          rehydrationData.pending.push(...newBatches)
        }

        const accounts = await getAccounts(tokens.access_token)
        log.info(`Loaded ${accounts.results.length} accounts`)

        type AccountTransaction = Transaction & DataRow & { account_id: string }
        let allTransactions: AccountTransaction[] = []
        const remainingBatches = _.sortBy(rehydrationData.pending, batch => batch.dateFromISO).reverse()
        while (remainingBatches.length > 0) {
          const batch = remainingBatches.shift()
          const batchId = batch.dateFromISO + "->" + batch.dateToISO

          log.info("Loading batch: " + batchId)

          try {
            const batchTransactions: Promise<AccountTransaction[]>[] = accounts.results.map(async account => {
              log.info(`Account ${account.account_id} loading transactions in batch ${batchId}`)
    
              const transactions = await getTransactions(tokens.access_token, {
                account,
                fromDateISO: batch.dateFromISO,
                toDateISO: batch.dateToISO,
              })
    
              log.info(`Account ${account.account_id} loaded ${transactions.results.length} transactions`)
    
              return transactions.results.map(transaction => {
                const result = transaction as AccountTransaction
    
                result.uniqueId = result.transaction_id
                result.account_id = account.account_id
    
                return result
              })
            })

  
            allTransactions.push(...(
              _.flatten(await Promise.all(batchTransactions))
            ))
          } catch(e) {
            const failCount = batch.failCount + 1

            log.error("Sync not fully complete, bailing with error: " + String(e) + " " + JSON.stringify(e?.response?.data ?? {}))
            log.error(`This batch (${batchId}) has now failed ${failCount} times. You may need to reauthenticate, but if this continues then your bank might not support going back this far. For more info visit https://truelayer.zendesk.com/hc/en-us/articles/360025108713`)

            rehydrationData.pending.unshift({
              ...batch,
              failCount
            })

            break
          }
        }

        allTransactions = _(allTransactions)
          .sortBy(t => t.timestamp)
          .reverse()
          .value()

        const lastDate = allTransactions[0] 
          ? allTransactions[0].timestamp 
          : rehydrationData.lastDate

        return {
          mode: 'append',
          data: allTransactions,
          syncInfo: {
            success: true,
            rehydrationData: {
              lastDate,
              pending: remainingBatches
            } as RehydrationData
          }
        }
      }
    }
  ]
})

interface RehydrationData {
  lastDate: string
  pending: Batch[]
}

interface Batch {
  dateFromISO: string
  dateToISO: string
  failCount: number
}

function generateBatches(fromDateISO: string, toDateISO: string, batchLengthMonths: number): Batch[] {
  const batches: Batch[] = []

  const grain = Duration.fromObject({
    months: batchLengthMonths
  })

  let left = DateTime.fromISO(fromDateISO)
  const toDate = DateTime.fromISO(toDateISO)

  while (left.valueOf() < toDate.valueOf()) {
    const right = DateTime.min(left.plus(grain), toDate)
    
    batches.push({
      dateFromISO: left.toISO(),
      dateToISO: right.toISO(),
      failCount: 0
    })

    left = right
  }

  return batches
}
