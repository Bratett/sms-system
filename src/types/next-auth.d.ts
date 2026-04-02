import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      roles: string[];
      permissions: string[];
      schoolId: string | null;
      schoolName: string | null;
      schools: Array<{
        id: string;
        name: string;
        logoUrl: string | null;
        isDefault: boolean;
      }>;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string;
    roles: string[];
    permissions: string[];
    schoolId: string | null;
    schoolName: string | null;
    schools: Array<{
      id: string;
      name: string;
      logoUrl: string | null;
      isDefault: boolean;
    }>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roles: string[];
    permissions: string[];
    schoolId: string | null;
    schoolName: string | null;
    schools: Array<{
      id: string;
      name: string;
      logoUrl: string | null;
      isDefault: boolean;
    }>;
  }
}
