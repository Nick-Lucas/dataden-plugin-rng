import { createPlugin, Settings } from "@dataden/sdk";
import * as uuid from 'uuid'

interface PluginSettings {
  instanceId: string
}

interface PluginSecrets extends Record<string, string> {
  testSecret: string
}

export default createPlugin({
  getDefaultSettings: async (): Promise<Settings<PluginSettings, PluginSecrets>> => {
    return {
      schedule: {
        every: 1,
        grain: 'minute'
      },
      plugin: {
        instanceId: 'a'
      } ,
      secrets: {
        testSecret: 'test-value'
      } 
    }
  },
  loaders: [
    {
      name: 'numbers1',
      load: async (settings, request, log) => {
        const plugin = settings.plugin as PluginSettings

        log.info("Data loaded, returning")

        return {
          lastDate: new Date().toISOString(),
          mode: 'append',
          data: [
            {
              uniqueId: Date.now,
              number: Math.trunc((Math.random() * 1000)),
              randomUuid: uuid.v4(),
              instance: plugin.instanceId,
              loader: 1
            }
          ]
        }
      }
    },
    {
      name: 'numbers2',
      load: async (settings: Settings<PluginSettings, PluginSecrets>, request, log) => {
        const plugin = settings.plugin

        if (settings.secrets.testSecret) {
          log.warn("Credentials expiring soon")
        } else {
          throw "Credentials not provided"
        }
  
        return {
          lastDate: new Date().toISOString(),
          mode: 'append',
          data: [
            {
              uniqueId: Date.now,
              number: Math.trunc((Math.random() * 1000)),
              randomUuid: uuid.v4(),
              instance: plugin.instanceId,
              loader: 2
            }
          ]
        }
      }
    }
  ]
})
