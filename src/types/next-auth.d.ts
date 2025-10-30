/**
 * NextAuth Type Extensions
 *
 * Extends default NextAuth types to include custom user fields
 */

import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extend Session to include user ID
   */
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }

  /**
   * Extend User to match our Prisma User model
   */
  interface User {
    id: string;
    email: string;
    name?: string | null;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extend JWT to include user ID
   */
  interface JWT {
    id: string;
    email: string;
  }
}
