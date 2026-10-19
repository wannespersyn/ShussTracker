import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Google only hands out verified addresses, so linking by email is safe —
  // and needed when a user row exists without its Google `account` row
  // (e.g. a database restored from a dump without the auth tables).
  providers: [Google({ allowDangerousEmailAccountLinking: true })],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/onboarding",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
