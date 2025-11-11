// src/auth.ts - NextAuth v4 configuration

import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import prisma from "@/prisma/client"
import bcrypt from "bcrypt"
import { getServerSession } from "next-auth/next"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    // Credentials Provider (Email/Password)
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
    async signIn({ user, account, profile }) {
      // Pour OAuth (Google), créer l'utilisateur s'il n'existe pas
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! }
        })

        if (!existingUser) {
          // Créer un nouvel utilisateur pour Google OAuth
          const [firstName, ...lastNameParts] = (profile?.name || user.name || "").split(" ")
          const lastName = lastNameParts.join(" ") || firstName

          // Générer un password hash aléatoire pour OAuth (non utilisé)
          const randomPassword = Math.random().toString(36).slice(-16)
          const passwordHash = await bcrypt.hash(randomPassword, 10)

          await prisma.user.create({
            data: {
              email: user.email!,
              firstName,
              lastName,
              passwordHash, // Hash aléatoire (utilisateur OAuth ne l'utilise pas)
              role: "USER", // Rôle par défaut
              emailVerifiedAt: new Date(), // Email vérifié via Google
              isActive: true,
            }
          })

          console.log('✅ New user created via Google OAuth:', user.email)
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      } else if (token.email) {
        // Récupérer le rôle depuis la DB si pas dans user
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true }
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
        }
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