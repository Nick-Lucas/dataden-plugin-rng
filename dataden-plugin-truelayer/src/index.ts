import { createPlugin, Settings } from "@dataden/sdk";
import * as uuid from 'uuid'
import axios from "axios";

interface PluginSettings {
  
}

interface PluginSecrets extends Record<string, string> {
  truelayerClientId: string
  truelayerClientSecret: string
  bankCode: string
}

async function getAccessToken(secrets: PluginSecrets) {
  try {
    const response = await axios.post("https://auth.truelayer.com/connect/token", {
      client_id: secrets.truelayerClientId,
      client_secret: secrets.truelayerClientSecret,
      code: secrets.bankCode,
      grant_type: "authorization_code",
      redirect_uri: "https://console.truelayer.com/redirect-page",
    })
    return response.data
  } catch (e) {
    return e.response.status + ": "+ JSON.stringify(e.response.data, null, 2)
  }
}

// const api = axios.create({
//   baseURL: "https://auth.truelayer.com/connect/token"
// })

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
        bankCode: ""
      } 
    }
  },
  loaders: [
    {
      name: 'transactions',
      load: async (settings: Settings<PluginSettings, PluginSecrets>, request, log) => {
        if (!settings.secrets.bankCode || !settings.secrets.truelayerClientId || !settings.secrets.truelayerClientSecret) {
          throw "Secrets not populated"
        }
        const accessResponse = await getAccessToken(settings.secrets)

        log.info("TOKEN RESPONSE\n", accessResponse)

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
