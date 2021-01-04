import { createPlugin, Settings, PluginAuth } from "@dataden/sdk";
import * as uuid from 'uuid'
import axios from "axios";

interface PluginSettings {
  
}

interface PluginSecrets extends Record<string, string> {
  truelayerClientId: string
  truelayerClientSecret: string
}

// const api = axios.create({
//   baseURL: "https://auth.truelayer.com/connect/token"
// })

interface Tokens {
  access_token: string
  expires_in: string
  token_type: string
  refresh_token: string
}

const exchangeForTokens = async (
  settings: Settings<PluginSettings, PluginSecrets>, 
  receivedParams: 
    { grant_type: "authorization_code", code: string } | 
    { grant_type: "refresh_token", refresh_token: string }
  ): Promise<Tokens> => {
  try {
    const response = await axios.post("https://auth.truelayer.com/connect/token", {
      client_id: settings.secrets.truelayerClientId,
      client_secret: settings.secrets.truelayerClientSecret,
      ...receivedParams,
      redirect_uri: "https://console.truelayer.com/redirect-page",
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
        baseURL: "https://auth.truelayer.com/",
        params: {
          response_type: "code",
          client_id: settings.secrets.truelayerClientId,
          redirect_uri: params.redirectUri,
          state: params.state,
        }
      })
    },
    exchangeAuthorizationForAuthState: async (
      settings: Settings<PluginSettings, PluginSecrets>, 
      receivedParams: { code: string }
    ) => {
      return exchangeForTokens(settings, {
        grant_type: "authorization_code",
        code: receivedParams.code
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
      name: 'transactions',
      load: async (settings: Settings<PluginSettings, PluginSecrets>, request, log) => {
        if (!settings.secrets.bankCode || !settings.secrets.truelayerClientId || !settings.secrets.truelayerClientSecret) {
          throw "Secrets not populated"
        }
        
        return {
          lastDate: new Date().toISOString(),
          mode: 'append',
          data: [
            // {
            //   uniqueId: Date.now,
            //   number: Math.trunc((Math.random() * 1000)),
            //   randomUuid: uuid.v4(),
            //   instance: plugin.instanceId,
            //   loader: 1
            // }
          ]
        }
      }
    }
  ]
})
