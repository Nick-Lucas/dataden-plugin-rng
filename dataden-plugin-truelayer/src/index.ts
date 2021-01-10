import { createPlugin, Settings, PluginAuth, DataRow } from "@dataden/sdk";
import _ from 'lodash'
import axios from "axios";
import { Account, getAccounts, getTransactions, Transaction } from "./api";

interface PluginSettings {
  
}

interface PluginSecrets extends Record<string, string> {
  truelayerClientId: string
  truelayerClientSecret: string
}

const TRUELAYER_AUTH_URI = "https://auth.truelayer.com/"
const TRUELAYER_TOKEN_URI = "https://auth.truelayer.com/connect/token"

interface Tokens {
  access_token: string
  expires_in: string
  token_type: string
  refresh_token: string
}

const exchangeForTokens = async (
  settings: Settings<PluginSettings, PluginSecrets>, 
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
        
      },
      secrets: {
        truelayerClientId: "",
        truelayerClientSecret: "",
      } 
    }
  },

  authMethod: {
    type: "oauth2_authorizationcode",
    getAuthUri: async (settings: Settings<PluginSettings, PluginSecrets>, params) => {
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
      settings: Settings<PluginSettings, PluginSecrets>, 
      receivedParams,
    ) => {
      return exchangeForTokens(settings, {
        grant_type: "authorization_code",
        code: receivedParams.code,
        redirect_uri: receivedParams.redirectUri
      })
    },
    updateAuthState: async (
      settings: Settings<PluginSettings, PluginSecrets>, 
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
      load:  async (settings: Settings<PluginSettings, PluginSecrets>, request, log) => {
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
      load: async (settings: Settings<PluginSettings, PluginSecrets>, request, log) => {
        if (!settings.secrets.truelayerClientId || !settings.secrets.truelayerClientSecret) {
          throw "Secrets not populated"
        }

        const tokens = (request.auth as unknown) as Tokens
        if (!tokens?.access_token) {
          throw "Auth credentials not provided"
        }

        const accounts = await getAccounts(tokens.access_token)
        log.info(`Loaded ${accounts.results.length} accounts`)

        const toDateISO = new Date().toISOString()

        type AccountTransaction = Transaction & DataRow & { account_id: string }
        let allTransactions: AccountTransaction[] = []
        for (const account of accounts.results) {
          console.log(`Account ${account.account_id} loading transactions`)

          // TODO: batch this up into batches of 6 months and roll across accounts and backwards until 400 returned, then return
          const transactions = await getTransactions(tokens.access_token, {
            account,
            fromDateISO: "2020-01-01T00:00:00Z", // request.lastSync.date,
            toDateISO
          })

          console.log(`Account ${account.account_id} loaded ${transactions.results.length} transactions`)

          allTransactions.push(...transactions.results.map(transaction => {
            const result = transaction as AccountTransaction

            result.uniqueId = result.transaction_id
            result.account_id = account.account_id

            return result
          }))
        }

        allTransactions = _(allTransactions)
          .sortBy(t => t.timestamp)
          .reverse()
          .value()

        const lastDate = allTransactions[0] ? allTransactions[0].timestamp : request.lastSync.rehydrationData.lastDate

        return {
          mode: 'append',
          data: allTransactions,
          syncInfo: {
            success: true,
            rehydrationData: {
              lastDate
            }
          }
        }
      }
    }
  ]
})
