// src/auth.ts

import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import prisma from "@/prisma/client" // <-- AJOUTEZ
import bcrypt from "bcrypt"


export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" }, // Nous utilisons des JWT
  trustHost: true, // IMPORTANT pour le déploiement découplé
  providers: [
    Credentials({
      name: "Email et mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.passwordHash) {
          // L'utilisateur n'existe pas ou n'a pas de mot de passe (ex: compte social)
          return null
        }

        // Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash)

        if (isPasswordValid) {
          // Mot de passe correct !
          return user
        } else {
          // Mot de passe incorrect
          return null
        }
      }
    })
    // ... Vous pouvez ajouter d'autres providers (Google, Facebook...) ici
  ],
  callbacks: {
    // Ce callback ajoute l'ID et le rôle au JWT
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role // Le type 'User' de base n'a pas 'role'
      }
      return token
    },
    // Ce callback ajoute l'ID et le rôle à l'objet session
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  }
})