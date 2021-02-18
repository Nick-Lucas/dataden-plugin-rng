import { pluginInstanceIsValid, SdkLogger } from "@dataden/sdk";
import axios from "axios";
import { Settings } from "./types";

export interface Account {
    accountId: string
    accountName: string
    accountType: string
    status: string
    siteType: string
    preferred: boolean
    canSetAsDefault: boolean
    labels: any[]
    canSwitchTo: boolean
    fundsTransferRestrictionType: string
    productCode: string
}

export interface FundsBreakDown {
    balance: number
    exchangeRate: number
    currencyCode: string
    isocode: string
}

export interface AccountInfo {
    balance: number
    deposit: number
    profitLoss: number
    available: number
    openPositions: number
    bookCost: number
    fundsBreakDown: FundsBreakDown[]
    settledAmount: number
    unSettledAmount: number
}

export interface Feature {
    feature: string
    description: string
    featureOn: boolean
}

export interface SessionInfo {
    authenticationStatus: string
    accounts: Account[]
    hasActiveCollateralLink: boolean
    accountInfo: AccountInfo
    siteType: string
    webSiteId: string
    clientLocale: string
    clientId: string
    clientType: string
    currentAccountId: string
    currentAccountCurrencyFid: string
    currencyIsoCode: string
    currencySymbol: string
    igCompany: string
    liveClientId: string
    demoClientId: string
    demoClient: boolean
    encryptedLiveClientId: string
    hasActiveDemoAccounts: boolean
    hasActiveLiveAccounts: boolean
    dealingEnabled: boolean
    documentUploadEnabled: boolean
    kycType: string
    lightstreamerEndpoint: string
    timezoneOffset: number
    trackingId: string
    alertsEnabled: boolean
    tradingStatusSet: boolean
    trailingStopsEnabled: boolean
    controlledRisk: boolean
    sprintMarketsEnabled: boolean
    pendingRegistration: boolean
    features: Feature[]
    formDetails: any[]
    chartFormat: string
    cardMaintenanceAvailable: boolean
    playDealerLogin: boolean
    twoFactorAuthenticationClient: boolean
    encrypted: boolean
    paycassoEnabled: boolean
}

export interface SessionResult {
  info: SessionInfo
  accountId: string
  cst: string
  xSecurityToken: string
}

export interface TokenHeaders {
  cst: string
  'x-security-token': string
}

export async function getSession(settings: Settings, log: SdkLogger): Promise<SessionResult> {
  try {
    log.info(`Signing in as account: ${settings.plugin.igAccountId}`)

    const sessionResult = await axios.post<SessionInfo>("/clientsecurity/session", {
      username: settings.secrets.igUsername,
      password: settings.secrets.igPassword,
      enc: false
    }, {
      baseURL: settings.plugin.igApiUri,
      validateStatus: status => status == 200
    })

    log.info(`Getting tokens for accountId: ${settings.plugin.igAccountId}`)

    const tokensResult = await axios.get("/clientsecurity/session/tokens", {
      baseURL: settings.plugin.igApiUri,
      validateStatus: status => status == 204,
      params: {
        accountId: settings.plugin.igAccountId
      },
      headers: {
        Host: 'api.ig.com',
        Origin: 'https://www.ig.com',
        CST: sessionResult.headers.cst,
        'X-SECURITY-TOKEN': sessionResult.headers['x-security-token'],
      }
    })

    const tokens = tokensResult.headers as TokenHeaders

    log.info(`Getting session info for accountId: ${settings.plugin.igAccountId}`)

    const currentSession = await axios.get<SessionInfo>("/clientsecurity/session", {
      baseURL: settings.plugin.igApiUri,
      validateStatus: status => status == 200,
      headers: {
        Host: 'api.ig.com',
        Origin: 'https://www.ig.com',
        CST: tokens.cst,
        'X-SECURITY-TOKEN': tokens["x-security-token"]
      }
    })

    if (currentSession.data.currentAccountId !== settings.plugin.igAccountId) {
      log.error(`Could not switch session to accountId: ${settings.plugin.igAccountId}. Recieved: ${currentSession.data.currentAccountId}`)
      throw currentSession
    }
    
    return {
      info: currentSession.data,
      accountId: settings.plugin.igAccountId,
      cst: tokens.cst,
      xSecurityToken: tokens["x-security-token"]
    }
  } catch (e) {
    if (e.response) {
      throw e.response
    } else {
      throw e
    }
  }
}
