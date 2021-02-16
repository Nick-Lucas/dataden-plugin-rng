import axios from "axios";
import { Settings } from "./types";

export async function getSession(settings: Settings) {
  return axios.post("/clientsecurity/session", {
    username: settings.secrets.igUsername,
    password: settings.secrets.igPassword,
    enc: false
  }, {
    baseURL: settings.plugin.igApiUri
  })
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
