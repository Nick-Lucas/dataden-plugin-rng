import { createDataLoader, DataPayload } from "@mydata/sdk";

export default createDataLoader({
  every: 1,
  grain: 'minute'
},
async (request) => {
  return {
    lastDate: new Date(),
    mode: 'append',
    data: [
      {
        uniqueId: Date.now,
        number: Math.trunc((Math.random() * 1000))
      }
    ]
  }
})
