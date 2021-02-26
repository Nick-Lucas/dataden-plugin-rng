import mockAxios from 'jest-mock-axios'
import { Settings } from '../types'
import { AccountResult } from './ig-auth'
import { IGLedgerHistoryResponse, IGTrade, Trade, loadTrades } from "./trades"

describe("api trades", () => {
  const apiRespondsWith = (data: IGTrade<string, string>[]) => {
    mockAxios.mockResponse({
      status: 200,
      data: {
        success: true,
        payload: {
          accountID: "1",
          pagination: {
            page: 1,
            pageCount: 1,
            recordsPerPage: 1000,
            totalRecordCount: 1000
          },
          startDate: "__",
          endDate: "__",
          txnHistory: data
        }
      } as IGLedgerHistoryResponse
    })
  }

  it("should load and parse data", async () => {
    const promise = loadTrades(settings, account, "", "")
    apiRespondsWith(simpleFromApi)
    const trades = await promise

    expect(trades).toEqual(simpleSanitised)
    for (const trade of trades) {
      // Amounts are negative for buys since they are the cost applied to the account
      // We flip the amount to check the price/size data because a buy is a positive size, sell is negative size, and price is always positive
      expect(trade.price * trade.size)
        .toBeCloseTo(-trade.amounts.consideration.value, 1)
    }
  })
})

const settings: Settings = {
  plugin: {
    backdateToISO: new Date(2010).toISOString(),
    batchLengthMonths: 2,
    igApiUri: "",
    includeRawData: false
  },
  schedule: {
    every: 1,
    grain: "week"
  },
  secrets: {
    igPassword: "",
    igUsername: ""
  }
}

const account: AccountResult = {
  accountId: "1",
  name: "One",
  type: "stocks",
  cst: "",
  xSecurityToken: ""
}


const simpleFromApi: IGTrade<string, string>[] = [
  {
    "accountId": "1",
    "convertOnCloseRate": "0.7352395",
    "currency": "USD",
    "direction": "+",
    "entryType": "ASSET",
    "epic": "SA.D.AMD.CASH.IP",
    "formalInstrumentName": "Advanced Micro Devices Inc",
    "instrumentDesc": "Advanced Micro Devices Inc (All Sessions)",
    "narrative": "AMD Narrative",
    "orderID": "ORDER_ID_FIELD",
    "orderSize": "0.08",
    "orderType": "LIMIT",
    "price": "84.91",
    "scaledSize": "8",
    "settlementDate": "03/02/2019",
    "settlementStatus": "SETTLED",
    "summaryCode": "30001",
    "summaryCodeDescription": "Order",
    "amounts": [
      {
        "value": -679.28,
        "currency": "USD",
        "amountType": "CONSIDERATION",
        "transactionToBaseCcyRate": null
      },
      {
        "value": -3,
        "currency": "USD",
        "amountType": "COMMISSION",
        "transactionToBaseCcyRate": null
      },
      {
        "value": 0,
        "currency": "USD",
        "amountType": "TOTAL_CHARGE",
        "transactionToBaseCcyRate": null
      },
      {
        "value": -499.43,
        "currency": "GBP",
        "amountType": "TOTAL_AMOUNT",
        "transactionToBaseCcyRate": null
      }
    ],
    "tradeDate": "01/02/2019",
    "tradeTime": "14:57:12",
    "tradeValue": "6.7928",
    "venue": "XOFF",
    "tradeType": "TRADE"
  },
  {
    "accountId": "1",
    "convertOnCloseRate": "1.0000000",
    "currency": "GBP",
    "direction": "-",
    "entryType": "ASSET",
    "epic": "KA.D.EQQQLN.CASH.IP",
    "formalInstrumentName": "Invesco EQQQ NASDAQ-100 UCITS ETF",
    "instrumentDesc": "Invesco EQQQ NASDAQ-100 UCITS ETF",
    "narrative": "NASDAQ NARRATIVE",
    "orderID": "NASDAQ_ORDERID",
    "orderType": "AT_QUOTE",
    
    // IG BUG: compared to the other item, these numbers are scaled wrong
    // orderSize and scaledSize should be normalised into one and the price recalculated
    "orderSize": "-0.12",
    "price": "22373.88",
    "scaledSize": "-12",
    "tradeValue": "-2684.8656",

    "settlementDate": "25/02/2019",
    "settlementStatus": "SETTLED",
    "summaryCode": "30001",
    "summaryCodeDescription": "Order",
    "amounts": [
      {
        // IG BUG: this sign is wrong and it's straight from the API
        // This should be normalised
        "value": 2684.87,
        "currency": "GBP",
        "amountType": "CONSIDERATION",
        "transactionToBaseCcyRate": null
      },
      {
        "value": -3,
        "currency": "GBP",
        "amountType": "COMMISSION",
        "transactionToBaseCcyRate": null
      },
      {
        "value": 0,
        "currency": "GBP",
        "amountType": "TOTAL_CHARGE",
        "transactionToBaseCcyRate": null
      },
      {
        "value": -2681.87,
        "currency": "GBP",
        "amountType": "TOTAL_AMOUNT",
        "transactionToBaseCcyRate": null
      }
    ],
    "tradeDate": "23/02/2019",
    "tradeTime": "14:45:48",
    "venue": "XLON",
    "tradeType": "TRADE"
  }
]

const simpleSanitised: Trade[] = [
  {
    "accountId": "1",
    "currency": "GBP",
    "direction": "buy",
    "stockId": "SA.D.AMD.CASH.IP",
    "stockName": "Advanced Micro Devices Inc",
    "stockAltName": "Advanced Micro Devices Inc (All Sessions)",
    "orderID": "ORDER_ID_FIELD",
    "price": 62.43,
    "size": 8,
    "amounts": {
      consideration: {
        "value": -499.43348756,
        "currency": "GBP",
        "amountType": "CONSIDERATION",
        "transactionToBaseCcyRate": null
      },
      commission: {
        "value": -2.2057185,
        "currency": "GBP",
        "amountType": "COMMISSION",
        "transactionToBaseCcyRate": null
      },
      charges: {
        "value": 0,
        "currency": "GBP",
        "amountType": "TOTAL_CHARGE",
        "transactionToBaseCcyRate": null
      },
      total: {
        "value": -499.43,
        "currency": "GBP",
        "amountType": "TOTAL_AMOUNT",
        "transactionToBaseCcyRate": null
      }
    },
    "tradeDateTime": new Date("2019-02-01T14:57:12.000Z"),
    "tradeType": "TRADE",
    "uniqueId": "ORDER_ID_FIELD",
  },
  {
    "accountId": "1",
    "currency": "GBP",
    "direction": "sell",
    "stockId": "KA.D.EQQQLN.CASH.IP",
    "stockName": "Invesco EQQQ NASDAQ-100 UCITS ETF",
    "stockAltName": "Invesco EQQQ NASDAQ-100 UCITS ETF",
    "orderID": "NASDAQ_ORDERID",
    "price": 223.74,
    "size": -12,
    "amounts": {
      consideration: {
        "value": 2684.87,
        "currency": "GBP",
        "amountType": "CONSIDERATION",
        "transactionToBaseCcyRate": null
      },
      commission: {
        "value": -3,
        "currency": "GBP",
        "amountType": "COMMISSION",
        "transactionToBaseCcyRate": null
      },
      charges: {
        "value": 0,
        "currency": "GBP",
        "amountType": "TOTAL_CHARGE",
        "transactionToBaseCcyRate": null
      },
      total: {
        "value": 2681.87,
        "currency": "GBP",
        "amountType": "TOTAL_AMOUNT",
        "transactionToBaseCcyRate": null
      }
    },
    "tradeType": "TRADE",
    "uniqueId": "NASDAQ_ORDERID",
    "tradeDateTime": new Date("2019-02-23T14:45:48.000Z"),
  }
]
