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
    const trades = loadTrades(settings, account, "", "")

    apiRespondsWith(simpleFromApi)

    expect(await trades).toEqual(simpleSanitised)
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
        "value": 0,
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
    "orderSize": "-0.12",
    "orderType": "AT_QUOTE",
    "price": "22373.88",
    "scaledSize": "-12",
    "settlementDate": "25/02/2019",
    "settlementStatus": "SETTLED",
    "summaryCode": "30001",
    "summaryCodeDescription": "Order",
    "amounts": [
      {
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
    "tradeValue": "-2684.8656",
    "venue": "XLON",
    "tradeType": "TRADE"
  }
]

const simpleSanitised: Trade[] = [
  {
    "accountId": "1",
    "convertOnCloseRate": 0.7352395,
    "currency": "USD",
    "isBuy": true,
    "epic": "SA.D.AMD.CASH.IP",
    "formalInstrumentName": "Advanced Micro Devices Inc",
    "instrumentDesc": "Advanced Micro Devices Inc (All Sessions)",
    "orderID": "ORDER_ID_FIELD",
    "orderSize": 0.08,
    "price": 84.91,
    "scaledSize": 8,
    "amounts": {
      consideration: {
        "value": -679.28,
        "currency": "USD",
        "amountType": "CONSIDERATION",
        "transactionToBaseCcyRate": null
      },
      commission: {
        "value": 0,
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
    "tradeValue": 6.7928,
    "tradeType": "TRADE",
    "uniqueId": "ORDER_ID_FIELD",
  },
  {
    "accountId": "1",
    "convertOnCloseRate": 1,
    "currency": "GBP",
    "isBuy": false,
    "epic": "KA.D.EQQQLN.CASH.IP",
    "formalInstrumentName": "Invesco EQQQ NASDAQ-100 UCITS ETF",
    "instrumentDesc": "Invesco EQQQ NASDAQ-100 UCITS ETF",
    "orderID": "NASDAQ_ORDERID",
    "orderSize": -0.12,
    "price": 22373.88,
    "scaledSize": -12,
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
        "value": -2681.87,
        "currency": "GBP",
        "amountType": "TOTAL_AMOUNT",
        "transactionToBaseCcyRate": null
      }
    },
    "tradeValue": -2684.8656,
    "tradeType": "TRADE",
    "uniqueId": "NASDAQ_ORDERID",
    "tradeDateTime": new Date("2019-02-23T14:45:48.000Z"),
  }
]
