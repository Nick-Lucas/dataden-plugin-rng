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
}

export async function getSession(settings: Settings): Promise<SessionResult> {
  try {
    const result = await axios.post<SessionInfo>("/clientsecurity/session", {
      username: settings.secrets.igUsername,
      password: settings.secrets.igPassword,
      enc: false
    }, {
      baseURL: settings.plugin.igApiUri,
      validateStatus: status => status == 200
    })

    const sessionInfo = result.data
  
    return {
      info: sessionInfo,
      cst: result.headers.cst
    }
  } catch (e) {
    throw e.response
  }
}

// async function getTransactions({CST}) {
//   return axios.get("/deal/v2/history/transactions/2592000000/fromcodes?pageNumber=1&pageSize=10&codes=ALL",
//   {
//     baseURL: baseUri,
//     headers: {
//       CST: CST,
//       'IG-Account-ID': process.env.AC
//     }
//   })  
// }
