import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * OmniMeet uses a display-name-only Credentials provider.
 * There is no password — users just supply a name and get a
 * short-lived JWT session. This eliminates the spoofable
 * sessionStorage approach while keeping the "no sign-up" UX.
 */
export const authOptions = {
  providers: [
    CredentialsProvider({
      id:   'display-name',
      name: 'Display Name',
      credentials: {
        name: { label: 'Your Name', type: 'text', placeholder: 'Enter your display name' },
      },
      async authorize(credentials) {
        const name = (credentials?.name || '').trim().slice(0, 50);
        if (!name || name.length < 1) return null;

        // Return a minimal user object — NextAuth will encode this into the JWT
        return { id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60, // 8 hours — matches typical meeting session length
  },

  jwt: {
    maxAge: 8 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      // Persist user.id into the token on first sign-in
      if (user) {
        token.userId = user.id;
        token.name   = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose userId and name on the client-side session object
      if (session.user) {
        session.user.id   = token.userId;
        session.user.name = token.name;
      }
      return session;
    },
  },

  pages: {
    signIn:  '/',   // Our landing page IS the sign-in page
    error:   '/',
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
