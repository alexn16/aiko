/**
 * NextAuth configuration for AÏKO.
 *
 * Authentication layer: Sign in with Google identifies the user inside AÏKO.
 * It does NOT automatically connect ChatGPT, Claude, or any other AI provider.
 * Each AI brain must be connected separately in /connect-ai.
 */

import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { db } from '@/lib/db/client'

// Extend NextAuth session type to include our internal user id
declare module 'next-auth' {
  interface Session {
    user: {
      id: string         // our UUID from users table
      email: string
      name?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],

  // ── Callbacks ──────────────────────────────────────────────────────────────

  callbacks: {
    /**
     * Called after a successful OAuth sign-in.
     * Upserts the user into our `users` table.
     */
    async signIn({ user, account }) {
      if (!user.email) return false

      try {
        await db.query(
          `INSERT INTO users (email, name, google_sub, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (email) DO UPDATE
             SET name       = EXCLUDED.name,
                 google_sub = EXCLUDED.google_sub,
                 updated_at = NOW()`,
          [user.email, user.name ?? null, account?.providerAccountId ?? null]
        )
        return true
      } catch (err) {
        console.error('[auth] signIn upsert failed:', err)
        return false
      }
    },

    /**
     * Attach our internal user ID to the JWT so we can use it in sessions
     * without a database round-trip on every request.
     */
    async jwt({ token, user, trigger }) {
      // On first sign-in (user object present) or explicit session refresh
      if (user || trigger === 'signIn' || !token.userId) {
        if (token.email) {
          try {
            const res = await db.query(
              'SELECT id FROM users WHERE email = $1',
              [token.email]
            )
            if (res.rows[0]) {
              token.userId = res.rows[0].id as string
            }
          } catch {
            // non-fatal — session will lack id but auth still works
          }
        }
      }
      return token
    },

    /** Expose our user id on the client-accessible session object. */
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId
      }
      return session
    },
  },

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  // ── Session strategy ───────────────────────────────────────────────────────

  session: {
    strategy: 'jwt',
  },

  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
}
