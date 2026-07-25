import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Password } from "@convex-dev/auth/providers/Password";
import type { AuthProviderConfig } from "@convex-dev/auth/server";
import { createViktorAuthJsProvider } from "../src/lib/viktor-spaces-access/authjs";
import { TestCredentials } from "./testAuth";
import { configuredProductAuthEnabled } from "./viktorSpaceAuthEnv";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_AUTH_PROVIDER_NAMES = ["email_password", "viktor"] as const;
type AuthProviderName = (typeof DEFAULT_AUTH_PROVIDER_NAMES)[number];

function configuredAuthProviderNames(): Set<AuthProviderName> {
  const configured =
    process.env.VIKTOR_SPACES_AUTH_PROVIDERS ||
    process.env.VITE_VIKTOR_SPACES_AUTH_PROVIDERS;
  if (!configured) {
    return new Set(DEFAULT_AUTH_PROVIDER_NAMES);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configured);
  } catch {
    throw new Error(`Invalid VIKTOR_SPACES_AUTH_PROVIDERS: ${configured}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Invalid VIKTOR_SPACES_AUTH_PROVIDERS: ${configured}`);
  }

  const providerNames = new Set<AuthProviderName>();
  for (const provider of parsed) {
    if (provider !== "email_password" && provider !== "viktor") {
      throw new Error(`Invalid VIKTOR_SPACES_AUTH_PROVIDERS: ${configured}`);
    }
    if (providerNames.has(provider)) {
      throw new Error(`Invalid VIKTOR_SPACES_AUTH_PROVIDERS: ${configured}`);
    }
    providerNames.add(provider);
  }
  return providerNames;
}

function viktorWorkspaceSignInProviders(): AuthProviderConfig[] {
  const resourceId =
    process.env.VIKTOR_AUTH_RESOURCE_ID ||
    process.env.VITE_VIKTOR_AUTH_RESOURCE_ID;
  const baseUrl =
    process.env.VIKTOR_AUTH_BASE_URL ||
    process.env.VITE_VIKTOR_SPACES_API_URL;
  if (!resourceId || !baseUrl) return [];

  return [
    createViktorAuthJsProvider({
      resourceId,
      viktorAuthBaseUrl: baseUrl,
      clientId: process.env.VITE_VIKTOR_AUTH_CLIENT_ID || "",
    }),
  ];
}

function configuredSpaceAuthProviders(): AuthProviderConfig[] {
  const providerNames = configuredAuthProviderNames();
  const isPreview =
    process.env.VIKTOR_SPACES_IS_PREVIEW === "true" ||
    process.env.VIKTOR_SPACES_IS_PREVIEW === undefined ||
    process.env.NODE_ENV !== "production";
  const providers: AuthProviderConfig[] = [Google];
  if (providerNames.has("email_password")) {
    const resendApiKey =
      process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY;
    const resendProvider = resendApiKey
      ? Resend({
          apiKey: resendApiKey,
          from: "BikinPRD <noreply@rainsky.web.id>",
        })
      : undefined;

    providers.push(
      Password({
        verify: resendProvider,
        reset: resendProvider,
      }),
    );
  }
  if (providerNames.has("viktor")) {
    const viktorProviders = viktorWorkspaceSignInProviders();
    if (
      viktorProviders.length === 0 &&
      !providerNames.has("email_password") &&
      !isPreview
    ) {
      throw new Error(
        "Viktor sign-in is the only configured provider but the Viktor OAuth " +
          "deployment env (VIKTOR_AUTH_RESOURCE_ID, VIKTOR_AUTH_BASE_URL) is " +
          "missing. Configure it or include email_password in auth.providers.",
      );
    }
    providers.push(...viktorProviders);
  }
  if (isPreview) {
    providers.push(TestCredentials);
  }
  return providers;
}

export function configuredAuthProviders(): AuthProviderConfig[] {
  return configuredProductAuthEnabled() ? configuredSpaceAuthProviders() : [];
}
