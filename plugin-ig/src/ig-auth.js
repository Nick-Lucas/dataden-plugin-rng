
const axios = require('axios').default
const crypto = require("crypto")

const baseUri = "https://api.ig.com"

// async function getEncryptionPublicKey() {
//   const result = await axios.get("/clientsecurity/encryptionkey", {
//     baseURL: baseUri,
//     validateStatus: status => status === 200
//   })

//   console.log("GOT" , result.data)
//   let buff = Buffer.from(result.data.encryptionKey, 'base64')
//   let encryptionKey = buff.toString('ascii')
//   console.log("DECODE" , encryptionKey)

//   return {
//     encryptionKey,
//     timeStamp: result.data.timestamp
//   }
// }

// function encrypt(plaintext, pubKey) {
  
//   return crypto.publicEncrypt({
//     key: pubKey,
    
//   }, Buffer.from(plaintext))
// }

async function getSession({ username, password }) {
  // const pubKey = await getEncryptionPublicKey()
  // if (pubKey.encryptionKey) {
  //   throw "No encryptionKey"
  // }

  // password = encrypt(password, pubKey.encryptionKey)

  return axios.post("/clientsecurity/session", {
    username,
    password,
    enc: false
  }, {
    baseURL: baseUri
  })
}

async function getTransactions({CST}) {
  return axios.get("/deal/v2/history/transactions/2592000000/fromcodes?pageNumber=1&pageSize=10&codes=ALL",
  {
    baseURL: baseUri,
    headers: {
      CST: CST,
      'IG-Account-ID': process.env.AC
    }
  })  
}

// function encryptPassword() {

// }

async function run() {
  // const pubKey = await getEncryptionPublicKey()
  // console.log("Public Key", pubKey.status, pubKey.data)

  const session = await getSession({ 
    username: process.env.UN,
    password: process.env.PW
  })
  const CST = session.headers.cst
  console.log("Session", session.status, session.data, session.headers)

  const transactions = await getTransactions({CST})
  console.log("Transactions", transactions.status, transactions.data)
}
run()
