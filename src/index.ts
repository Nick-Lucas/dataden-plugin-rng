import { createPlugin } from "@dataden/sdk";
import * as uuid from 'uuid'

interface PluginSettings {
  instanceId: string
}

export default createPlugin({
  getDefaultSettings: async () => {
    return {
      plugin: {
        instanceId: 'a'
      } as PluginSettings,
      schedule: {
        every: 1,
        grain: 'minute'
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
      load: async (settings, request, log) => {
        const plugin = settings.plugin as PluginSettings

        log.warn("Credentials expiring soon")
  
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
