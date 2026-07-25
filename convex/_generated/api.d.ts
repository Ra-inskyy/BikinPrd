/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ViktorSpacesEmail from "../ViktorSpacesEmail.js";
import type * as aiClient from "../aiClient.js";
import type * as auth from "../auth.js";
import type * as constants from "../constants.js";
import type * as http from "../http.js";
import type * as prd from "../prd.js";
import type * as prdActions from "../prdActions.js";
import type * as seedTestUser from "../seedTestUser.js";
import type * as testAuth from "../testAuth.js";
import type * as users from "../users.js";
import type * as viktorClient from "../viktorClient.js";
import type * as viktorSpaceAuthConfig from "../viktorSpaceAuthConfig.js";
import type * as viktorSpaceAuthEnv from "../viktorSpaceAuthEnv.js";
import type * as viktorTools from "../viktorTools.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ViktorSpacesEmail: typeof ViktorSpacesEmail;
  aiClient: typeof aiClient;
  auth: typeof auth;
  constants: typeof constants;
  http: typeof http;
  prd: typeof prd;
  prdActions: typeof prdActions;
  seedTestUser: typeof seedTestUser;
  testAuth: typeof testAuth;
  users: typeof users;
  viktorClient: typeof viktorClient;
  viktorSpaceAuthConfig: typeof viktorSpaceAuthConfig;
  viktorSpaceAuthEnv: typeof viktorSpaceAuthEnv;
  viktorTools: typeof viktorTools;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
