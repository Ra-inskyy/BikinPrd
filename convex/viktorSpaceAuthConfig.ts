import Google from "@auth/core/providers/google";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import type { AuthProviderConfig } from "@convex-dev/auth/server";
import { createViktorAuthJsProvider } from "../src/lib/viktor-spaces-access/authjs";
import { TestCredentials } from "./testAuth";
import { configuredProductAuthEnabled } from "./viktorSpaceAuthEnv";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_AUTH_PROVIDER_NAMES = ["email_password", "viktor"] as const;
type AuthProviderName = (typeof DEFAULT_AUTH_PROVIDER_NAMES)[number];

const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY,
  maxAge: 60 * 10, // 10 menit
  async generateVerificationToken() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },
  async sendVerificationRequest({
    identifier: email,
    token,
  }: {
    identifier: string;
    token: string;
  }) {
    const apiKey = process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("AUTH_RESEND_KEY is missing");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BikinPRD <noreply@rainsky.web.id>",
        to: [email],
        subject: `Kode OTP BikinPRD: ${token}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0;">Kode Verifikasi OTP</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.5;">Gunakan kode OTP 6-digit berikut untuk mengonfirmasi pendaftaran akun BikinPRD kamu:</p>
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563eb;">${token}</span>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Kode OTP ini berlaku selama 10 menit. Jaga kerahasiaan kode ini dan jangan bagikan kepada siapa pun.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to send email OTP via Resend: ${errText}`);
    }
  },
});

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
    const resendProvider = resendApiKey ? ResendOTP : undefined;

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
