import { pluginInstanceIsValid, SdkLogger } from "@dataden/sdk";
import axios from "axios";
import { Settings } from "./types";

type IGProductCode = "IGISA" | "IGSTK" | "IGFSB" | "IGCFD" | '_other_'

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
    productCode: IGProductCode
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

export type AccountType = "stocks" | "spreadbet" | "cfd" | "unsupported"
function getAccountType(code: IGProductCode): AccountType {
  switch (code) {
    case "IGISA": 
      return "stocks"
    case "IGSTK":
      return "stocks"
    case "IGFSB":
      return "spreadbet"
    case "IGCFD":
      return "cfd"
    default:
      return 'unsupported'
  }
}

export interface AccountResult {
  accountId: string
  name: string
  type: AccountType
  cst: string
  xSecurityToken: string
}
export interface SessionResult {
  info: SessionInfo
  accounts: AccountResult[]
}

export interface TokenHeaders {
  cst: string
  'x-security-token': string
}

export async function getSession(settings: Settings, log: SdkLogger): Promise<SessionResult> {
  try {
    log.info(`Signing in as account: ${settings.secrets.igUsername}`)

    const authResult = await axios.post<SessionInfo>("/clientsecurity/session", {
      username: settings.secrets.igUsername,
      password: settings.secrets.igPassword,
      enc: false
    }, {
      baseURL: settings.plugin.igApiUri,
      validateStatus: status => status == 200,
      headers: {
        Host: 'api.ig.com',
        Origin: 'https://www.ig.com',
        // Forces all accounts to be included in the list
        'x-device-user-agent': "vendor=IG Group | applicationType=ig | platform=iOS | deviceType=phone | version=9.1430.0"
      }
    })
    const authTokens = authResult.headers as TokenHeaders

    let accounts: AccountResult[] = []
    log.info(`Fetching tokens for up to ${authResult.data.accounts.length} discovered accounts`)
    for (const account of authResult.data.accounts) {
      const accountId = account.accountId
      const type = getAccountType(account.productCode)
      if (type === 'unsupported') {
        log.info(`Skipping account ${accountId} (${account.accountName}) as its product code (${account.productCode}) is not support`)
        continue
      }

      log.info(`Fetching tokens for account ${accountId} (${account.accountName})`)

      const tokensResult = await axios.get("/clientsecurity/session/tokens", {
        baseURL: settings.plugin.igApiUri,
        validateStatus: status => status == 204,
        params: {
          accountId: accountId
        },
        headers: {
          Host: 'api.ig.com',
          Origin: 'https://www.ig.com',
          CST: authTokens.cst,
          'X-SECURITY-TOKEN': authTokens['x-security-token'],
        }
      })
  
      const tokens = tokensResult.headers as TokenHeaders

      accounts.push({
        accountId,
        name: account.accountName,
        type,
        cst: tokens.cst,
        xSecurityToken: tokens["x-security-token"]
      })
    }

    log.info(`All session info fetched.`)
    
    return {
      info: authResult.data,
      accounts
    }
  } catch (e) {
    if (e.response) {
      throw e.response
    } else {
      throw e
    }
  }
}
