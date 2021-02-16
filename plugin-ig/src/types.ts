import { Settings as SdkSettings } from "@dataden/sdk";

export interface PluginSettings {
  igApiUri: string
  igAccountId: string
}

export interface PluginSecrets {
  igUsername: string
  igPassword: string
}

export type Settings = SdkSettings<PluginSettings, PluginSecrets>
