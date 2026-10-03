import assert from "node:assert/strict";
import fs from "node:fs";

const sdk = fs.readFileSync("server/_core/sdk.ts", "utf8");
const context = fs.readFileSync("server/_core/context.ts", "utf8");
const trpc = fs.readFileSync("server/_core/trpc.ts", "utf8");
const authRouter = fs.readFileSync("server/routers/auth/auth.router.ts", "utf8");
const main = fs.readFileSync("client/src/main.tsx", "utf8");
const useAuth = fs.readFileSync("client/src/_core/hooks/useAuth.ts", "utf8");
const layout = fs.readFileSync("client/src/components/layout/DashboardLayout.tsx", "utf8");
const index = fs.readFileSync("server/_core/index.ts", "utf8");
const constants = fs.readFileSync("shared/const.ts", "utf8");

// Definitive session failures are typed separately from DB/OAuth dependency failures.
assert.match(sdk, /export class SessionAuthenticationError extends Error/);
assert.match(sdk, /isSessionAuthenticationError/);
assert.match(sdk, /throw new SessionAuthenticationError\("Invalid session cookie"\)/);
assert.match(sdk, /throw new SessionAuthenticationError\("User not found"\)/);
assert.match(sdk, /Failed to sync user from OAuth:[\s\S]*throw error;/);

// lastSignedIn remains a real sign-in audit field, not a per-request DB write.
const authenticateBlock = sdk.slice(
  sdk.indexOf("async authenticateRequest"),
  sdk.indexOf("export const sdk")
);
assert.doesNotMatch(authenticateBlock, /updateLastSignedIn/);
assert.match(authRouter, /await db\.updateLastSignedIn\(user\.openId\)/);

// tRPC context preserves dependency failures so protected procedures do not emit false UNAUTHORIZED.
assert.match(context, /authFailure\?: "dependency" \| null/);
assert.match(context, /isSessionAuthenticationError\(error\)/);
assert.match(context, /authFailure = "dependency"/);
assert.match(trpc, /ctx\.authFailure === "dependency"/);
assert.match(trpc, /code: "INTERNAL_SERVER_ERROR"/);
assert.match(trpc, /code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG/);
assert.match(authRouter, /opts\.ctx\.authFailure === "dependency"/);
assert.match(constants, /AUTH_TEMPORARILY_UNAVAILABLE_ERR_MSG/);

// Client only redirects on a confirmed canonical UNAUTHORIZED response.
assert.match(main, /error\.data\?\.code === "UNAUTHORIZED" && error\.message === UNAUTHED_ERR_MSG/);
assert.match(useAuth, /if \(meQuery\.error\) return;/);
assert.match(layout, /تعذر التحقق من الجلسة مؤقتًا/);
assert.match(layout, /لم يتم تسجيل خروجك/);
assert.match(layout, /onClick=\{\(\) => void refresh\(\)\}/);

// Non-tRPC protected HTTP routes also return 503 for auth dependency outages, not 401.
assert.match(index, /isSessionAuthenticationError/);
assert.match(index, /res\.status\(503\)/);

console.log("Auth session stability hotfix regression: PASS");
