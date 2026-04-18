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
        // Encode super_admin as the wildcard "*" rather than listing every
        // permission in the JWT — with ~380 permission codes the cookie blows
        // past the browser's header-size limit and the server returns HTTP 431.
        // `requirePermission` / `denyPermission` / `hasPermission` already treat
        // "*" as "all permissions".
        const permissions = roles.includes("super_admin")
          ? ["*"]
          : [
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
        };
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
        token.roles = user.roles;
        token.permissions = user.permissions;
        token.schoolId = user.schoolId;
        token.schoolName = user.schoolName;
        token.schools = user.schools;
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
        session.user.roles = token.roles as string[];
        session.user.permissions = token.permissions as string[];
        session.user.schoolId = token.schoolId as string | null;
        session.user.schoolName = token.schoolName as string | null;
        session.user.schools = token.schools as typeof session.user.schools;
      }
      return session;
    },
  },
});
