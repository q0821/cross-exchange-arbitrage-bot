/**
 * NextAuth.js Configuration
 *
 * Implements email/password authentication using Credentials Provider
 * Session stored in JWT (HttpOnly cookies)
 * Session expiry: 24 hours (as per FR-006)
 *
 * Based on research.md Decision #1: NextAuth.js v5
 */

import NextAuth, { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logger } from '@/src/lib/logger';

const prisma = new PrismaClient();

/**
 * NextAuth Configuration
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'user@example.com',
        },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials?.email || !credentials?.password) {
          logger.warn('Login attempt with missing credentials');
          throw new Error('Email and password are required');
        }

        try {
          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            logger.warn(
              { email: credentials.email },
              'Login attempt for non-existent user',
            );
            throw new Error('Invalid email or password');
          }

          // Verify password with bcrypt
          const isValidPassword = await bcrypt.compare(
            credentials.password,
            user.password,
          );

          if (!isValidPassword) {
            logger.warn(
              { userId: user.id, email: user.email },
              'Login attempt with incorrect password',
            );
            throw new Error('Invalid email or password');
          }

          logger.info({ userId: user.id, email: user.email }, 'User logged in');

          // Return user object for session
          return {
            id: user.id,
            email: user.email,
            name: user.email, // Use email as name (no separate name field in MVP)
          };
        } catch (error) {
          if (error instanceof Error) {
            logger.error(
              { error: error.message, email: credentials.email },
              'Login authorization error',
            );
          }
          throw error;
        }
      },
    }),
  ],

  // JWT-based sessions (stored in HttpOnly cookies)
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours (as per FR-006)
  },

  // JWT token configuration
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },

  // Callback functions
  callbacks: {
    /**
     * JWT Callback
     * Called whenever a JWT is created or updated
     */
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },

    /**
     * Session Callback
     * Expose user ID and email to client-side session
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },

  // Custom pages
  pages: {
    signIn: '/login', // Custom login page
    error: '/login', // Error page redirects to login
  },

  // Security options
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
      },
    },
  },

  // Logging
  debug: process.env.NODE_ENV === 'development',

  // Secret for JWT signing (required)
  secret: process.env.NEXTAUTH_SECRET,
};

// Export NextAuth handlers
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
