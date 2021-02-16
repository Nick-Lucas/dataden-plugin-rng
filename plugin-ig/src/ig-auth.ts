import axios from "axios";
import { Settings } from "./types";

export interface Account {
    accountId: string;
    accountName: string;
    accountType: string;
    status: string;
    siteType: string;
    preferred: boolean;
    canSetAsDefault: boolean;
    labels: any[];
    canSwitchTo: boolean;
    fundsTransferRestrictionType: string;
    productCode: string;
}

export interface FundsBreakDown {
    balance: number;
    exchangeRate: number;
    currencyCode: string;
    isocode: string;
}

export interface AccountInfo {
    balance: number;
    deposit: number;
    profitLoss: number;
    available: number;
    openPositions: number;
    bookCost: number;
    fundsBreakDown: FundsBreakDown[];
    settledAmount: number;
    unSettledAmount: number;
}

export interface Feature {
    feature: string;
    description: string;
    featureOn: boolean;
}

export interface SessionInfo {
    authenticationStatus: string;
    accounts: Account[];
    hasActiveCollateralLink: boolean;
    accountInfo: AccountInfo;
    siteType: string;
    webSiteId: string;
    clientLocale: string;
    clientId: string;
    clientType: string;
    currentAccountId: string;
    currentAccountCurrencyFid: string;
    currencyIsoCode: string;
    currencySymbol: string;
    igCompany: string;
    liveClientId: string;
    demoClientId: string;
    demoClient: boolean;
    encryptedLiveClientId: string;
    hasActiveDemoAccounts: boolean;
    hasActiveLiveAccounts: boolean;
    dealingEnabled: boolean;
    documentUploadEnabled: boolean;
    kycType: string;
    lightstreamerEndpoint: string;
    timezoneOffset: number;
    trackingId: string;
    alertsEnabled: boolean;
    tradingStatusSet: boolean;
    trailingStopsEnabled: boolean;
    controlledRisk: boolean;
    sprintMarketsEnabled: boolean;
    pendingRegistration: boolean;
    features: Feature[];
    formDetails: any[];
    chartFormat: string;
    cardMaintenanceAvailable: boolean;
    playDealerLogin: boolean;
    twoFactorAuthenticationClient: boolean;
    encrypted: boolean;
    paycassoEnabled: boolean;
}

export interface SessionResult {
  info: SessionInfo
  cst: string
  xSecurityToken: string
}

export async function getSession(settings: Settings): Promise<SessionResult> {
  try {
    const result = await axios.post<SessionInfo>("/clientsecurity/session", {
      username: settings.secrets.igUsername,
      password: settings.secrets.igPassword,
      enc: false
    }, {
      baseURL: settings.plugin.igApiUri,
      validateStatus: status => status == 200,
      headers: {
        'IG-Account-ID': settings.plugin.igAccountId,
        'ig-account-id': settings.plugin.igAccountId,
      }
    })

    const sessionInfo = result.data

    // await axios.post<SessionInfo>("/clientsecurity/session", {
    //   username: settings.secrets.igUsername,
    //   password: settings.secrets.igPassword,
    //   enc: false
    // }, {
    //   baseURL: settings.plugin.igApiUri,
    //   validateStatus: status => status == 200
    // })
    
    return {
      info: sessionInfo,
      cst: result.headers.cst,
      xSecurityToken: result.headers['x-security-token']
    }
  } catch (e) {
    throw e.response
  }
}
