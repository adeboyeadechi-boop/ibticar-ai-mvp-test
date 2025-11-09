// src/auth.ts - NextAuth v4 configuration

import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "@/prisma/client"
import bcrypt from "bcrypt"
import { getServerSession } from "next-auth/next"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email et mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        console.log('🔐 Authorize called with:', { email: credentials?.email, hasPassword: !!credentials?.password })

        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials')
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          console.log('❌ User not found')
          return null
        }

        if (!user.passwordHash) {
          console.log('❌ User has no password hash')
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash)
        console.log('🔑 Password validation:', isPasswordValid)

        if (isPasswordValid) {
          console.log('✅ Authentication successful for:', user.email)
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            name: `${user.firstName} ${user.lastName}`
          }
        }

        console.log('❌ Invalid password')
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
}

// Helper function to get session in app directory
export function auth() {
  return getServerSession(authOptions)
}