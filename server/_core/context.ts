import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { isSessionAuthenticationError, sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  authFailure?: "dependency" | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let authFailure: TrpcContext["authFailure"] = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    if (isSessionAuthenticationError(error)) {
      // Authentication is optional for public procedures. A missing/invalid
      // session remains a normal anonymous context.
      user = null;
    } else {
      // Do not collapse a DB/OAuth dependency failure into "logged out".
      // Protected procedures and auth.me can surface a retryable server error.
      console.error("[Auth] Authentication dependency failure", error);
      authFailure = "dependency";
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    authFailure,
  };
}
