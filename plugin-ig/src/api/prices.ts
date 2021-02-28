import axios from 'axios'
import { DateTime } from "luxon"
import _ from 'lodash'
import { DataRow, SdkLogger } from "@dataden/sdk"

import { AccountResult, SessionResult } from "./ig-auth"
import { Settings } from "../types"
import { date } from "../converters";

const dateFormat = "yyyy-MM-dd"

export type PriceKey = "ask" | "bid" | "lastTraded"

export type IGDataPointPrice = {
  [key in PriceKey]: number
}

export interface IGDataPoint<TDate=Date> {
  timestamp: TDate
  lastTradedVolume: number
  openPrice: IGDataPointPrice
  closePrice: IGDataPointPrice
  highPrice: IGDataPointPrice
  lowPrice: IGDataPointPrice
}

export interface IGPrice<TDate=Date> {
  startTimestamp: TDate
  endTimestamp: TDate
  tickCount: number
  dataPoints: IGDataPoint<TDate>[]
}

export interface ApiResponse {
  transactionId: string
  consolidated: boolean
  intervalsDataPoints: IGPrice<number>[]
}

export interface Price {
  startDate: Date
  endDate: Date
  open: number
  close: number
  high: number
  low: number
}

export async function loadPrices(
    settings: Settings, 
    log: SdkLogger, 
    xSecurityToken: string, 
    startDateIso: string, 
    endDateIso: string, 
    priceType: "buy" | "sell", 
    epics: string[]): Promise<Record<string, Price[]>> {

  log.info(`Loading historical prices for ${epics.length} markets between: ${startDateIso} and ${endDateIso}`)

  const priceKey: PriceKey = priceType === 'buy' ? 'ask' : 'bid'

  const batches: {epic: string, yearStart: number, yearEnd: number}[] = []
  const startYear = DateTime.fromISO(startDateIso).year
  const endYear = DateTime.fromISO(endDateIso).startOf("year").plus({ year: 1 }).year
  const yearsInBatch = 2
  for (let i = endYear; i >= startYear; i -= yearsInBatch) {
    for (const epic of epics) {
      batches.push({
        epic: epic,
        yearStart: i - yearsInBatch,
        yearEnd: i
      })
    }
  }

  const priceBatchPromises = batches.map<Promise<[epic: string, prices: Price[]]>>(async ({ epic, yearStart, yearEnd }) => {
    const result = await apiRequest(settings, xSecurityToken, epic, yearStart, yearEnd)
    
    const prices = result.data.intervalsDataPoints
      .map<Price>(day => {
        if (!day.dataPoints?.length) {
          return null
        }

        return {
          startDate: new Date(day.startTimestamp),
          endDate: new Date(day.endTimestamp),
          open: day.dataPoints[0].openPrice[priceKey] / 100,
          close: day.dataPoints[0].closePrice[priceKey] / 100,
          high: day.dataPoints[0].highPrice[priceKey] / 100,
          low: day.dataPoints[0].lowPrice[priceKey] / 100,
        }
      })
      .filter(Boolean)

    return [
      epic,
      prices
    ]
  })

  const priceBatches = await Promise.all(priceBatchPromises)
  
  // Collect up prices into final object
  const pricesByEpic: Record<string, Price[]> = {}
  for (const [epic, prices] of priceBatches) {
    if (!pricesByEpic[epic]) {
      pricesByEpic[epic] = []
    }
    pricesByEpic[epic].push(...prices)
  }

  // Ensure that all prices are sorted
  for (const epic of epics) {
    if (!pricesByEpic[epic]) {
      // Just for safety
      pricesByEpic[epic] = []
    }

    pricesByEpic[epic] = _.sortBy(pricesByEpic[epic], price => price.startDate.valueOf())
  }

  return pricesByEpic
}


function apiRequest(settings: Settings, xSecurityToken: string, epic: string, yearStart: number, yearEnd: number, { grain = "DAY" } = {}) {
  return axios.get<ApiResponse>(
    `/chart/snapshot/${epic}/1/${grain}/batch/start/${yearStart}/1/1/1/0/0/0/end/${yearEnd}/1/1/1/0/0/0`,
     {
       headers: {
         'X-SECURITY-TOKEN': xSecurityToken
       },
       params: {
         format: "json",
         version: 3
       },
       baseURL: settings.plugin.igApiUri,
       validateStatus: status => status === 200
     }
   )
}
