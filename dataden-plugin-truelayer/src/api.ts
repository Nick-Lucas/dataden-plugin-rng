import axios from "axios"

const api = axios.create({
  baseURL: "https://api.truelayer.com/data"
})

export interface Results<T> {
  results: T[]
}

export interface Account {
  update_timestamp: string
  account_id: string
  account_type: string
  display_name: string
  currency: string
  account_number: {
    iban: string
    number: string
    sort_code: string
    swift_bic: string
  },
  provider: {
    provider_id: string
  }
}

export async function getAccounts(accessToken: string): Promise<Results<Account>> {
  const response = await api.get<Results<Account>>("/v1/accounts", {
    headers: {
      ...getHeaders(accessToken)
    },
    validateStatus: status => status === 200
  })

  return response.data
}

export interface GetTransactions {
  account: Account,
  fromDateISO: string
  toDateISO: string
}

export type TransactionCategory = 
  "ATM" |
  "BILL_PAYMENT" |
  "CASH" |
  "CASHBACK" |
  "CHEQUE" |
  "CORRECTION" |
  "CREDIT" |
  "DIRECT_DEBIT" |
  "DIVIDEND" |
  "FEE_CHARGE" |
  "INTEREST" |
  "OTHER" |
  "PURCHASE" |
  "STANDING_ORDER" |
  "TRANSFER" |
  "DEBIT" |
  "UNKNOWN"

export type TransactionClassification =
  "Income" |
  "Uncategorized" |
  "Entertainment" |
  "Education" |
  "Shopping" |
  "Personal Care" |
  "Health & Fitness" |
  "Food & Dining" |
  "Gifts & Donations" |
  "Investments" |
  "Bills and Utilities" |
  "Auto & Transport" |
  "Travel" |
  "Fees & Charges" |
  "Business Services" |
  "Personal Services" |
  "Taxes" |
  "Gambling" |
  "Home" |
  "Pension and insurances"

export interface Transaction {
  transaction_id: string
  timestamp: string
  description: string
  amount: number
  currency: string
  transaction_type: string
  transaction_category: TransactionCategory
  transaction_classification: TransactionClassification[],
  merchant_name: string
  running_balance: {
    amount: number
    currency: string
  },
  meta: Record<string, string>
}
export async function getTransactions(
  accessToken: string, 
  params: GetTransactions): Promise<Results<Transaction>> {
  const response = await api.get<Results<Transaction>>(
    "/v1/accounts/" + 
      encodeURIComponent(params.account.account_id)
      + `/transactions`, 
    {
      params: {
        from: params.fromDateISO,
        to: params.toDateISO
      },
      headers: {
        ...getHeaders(accessToken)
      },
      validateStatus: status => status === 200
    })

  return response.data
}


function getHeaders(accessToken: string) {
  return {
    "Authorization": "Bearer " + accessToken
  }
}
