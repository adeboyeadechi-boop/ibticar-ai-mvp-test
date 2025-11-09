// Type definitions for NextAuth.js
// Extends the default NextAuth types to include custom fields

import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  /**
   * Extend the built-in session types
   */
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession["user"]
  }

  /**
   * Extend the built-in user types
   */
  interface User extends DefaultUser {
    id: string
    role: string
  }
}

declare module "next-auth/jwt" {
  /**
   * Extend the built-in JWT types
   */
  interface JWT extends DefaultJWT {
    id: string
    role: string
  }
}
