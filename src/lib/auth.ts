import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = credentials.username as string;
        const password = credentials.password as string;

        const user = await db.user.findFirst({
          where: {
            OR: [{ username }, { email: username }],
            status: "ACTIVE",
          },
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
            userSchools: {
              include: {
                school: {
                  select: { id: true, name: true, logoUrl: true },
                },
              },
            },
          },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const roles = user.userRoles.map((ur) => ur.role.name);
        const permissions = [
          ...new Set(
            user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
          ),
        ];

        // Determine active school: default school, or first assigned school
        const schools = user.userSchools.map((us) => ({
          id: us.school.id,
          name: us.school.name,
          logoUrl: us.school.logoUrl,
          isDefault: us.isDefault,
        }));
        const defaultSchool = schools.find((s) => s.isDefault) ?? schools[0] ?? null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          image: user.avatarUrl ?? undefined,
          roles,
          permissions,
          schoolId: defaultSchool?.id ?? null,
          schoolName: defaultSchool?.name ?? null,
          schools,
        } as unknown as import("next-auth").User;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.roles = (user as unknown as Record<string, unknown>).roles as string[];
        token.permissions = (user as unknown as Record<string, unknown>).permissions as string[];
        token.schoolId = (user as unknown as Record<string, unknown>).schoolId as string | null;
        token.schoolName = (user as unknown as Record<string, unknown>).schoolName as string | null;
        token.schools = (user as unknown as Record<string, unknown>).schools;
      }
      // Allow school switching via session update
      if (trigger === "update" && session?.schoolId) {
        token.schoolId = session.schoolId;
        token.schoolName = session.schoolName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).roles = token.roles;
        (session.user as unknown as Record<string, unknown>).permissions = token.permissions;
        (session.user as unknown as Record<string, unknown>).schoolId = token.schoolId;
        (session.user as unknown as Record<string, unknown>).schoolName = token.schoolName;
        (session.user as unknown as Record<string, unknown>).schools = token.schools;
      }
      return session;
    },
  },
});
