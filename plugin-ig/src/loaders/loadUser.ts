import { Settings } from "../types"
import { SdkLogger, DataRow } from "@dataden/sdk"

import { SessionResult } from "../api/ig-auth"

export type User = SessionResult

export const loadUser = async (session: SessionResult): Promise<User> => {

  // Remove sensitive data
  for (const account of session.accounts) {
    delete account.cst
    delete account.xSecurityToken
  }
  
  return session
}
