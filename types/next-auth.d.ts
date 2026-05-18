import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      universityId?: string;
      department?: string;
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
