import { Settings as SdkSettings } from "@dataden/sdk";
import { Batch } from "./generateBatches";

export interface PluginSettings {
  igApiUri: string
  backdateToISO: string
  batchLengthMonths: number
}

export interface PluginSecrets {
  igUsername: string
  igPassword: string
}

export type Settings = SdkSettings<PluginSettings, PluginSecrets>

export interface RehydrationData {
  lastDate: string
  pending: Batch[]
}
