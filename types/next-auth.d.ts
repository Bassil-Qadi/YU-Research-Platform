import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      universityId?: string;
      department?: string;
      name?: string | null
      email?: string | null
      image?: string | null
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    universityId?: string;
    department?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    universityId?: string;
    department?: string;
  }
}
