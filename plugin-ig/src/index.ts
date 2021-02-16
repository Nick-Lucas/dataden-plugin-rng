import { createPlugin } from "@dataden/sdk";
import { Settings } from "./types";

import { getSession } from "./ig-auth";


export default createPlugin({
  getDefaultSettings: async () => {
    return ({
      plugin: {
        igApiUri: 'https://api.ig.com',
        igAccountId: ""
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
      name: 'trades',
      load: async (_settings, request, log) => {
        const settings = (_settings as unknown) as Settings

        const session = await getSession(settings as Settings)

        return {
          mode: 'append',
          data: [
            {
              uniqueId: 'a',
              session
            }
          ],
          syncInfo: {
            success: true,
            rehydrationData: {}
          }
        }
      }
    }
  ]
})
