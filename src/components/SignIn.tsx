import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function isTestEmail(email: string): boolean {
  return email.endsWith("@test.local");
}

type Step =
  | "signIn"
  | { type: "forgot"; email?: string }
  | { type: "reset-code"; email: string }
  | { type: "new-password"; email: string; code: string };

export function SignIn({
  onStepChange,
}: {
  onStepChange?: (step: "signIn" | "reset") => void;
}) {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const [step, setStep] = useState<Step>("signIn");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStepChange = (newStep: Step) => {
    setStep(newStep);
    onStepChange?.(newStep === "signIn" ? "signIn" : "reset");
  };

  if (step === "signIn") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setLoading(true);

              const formData = new FormData(e.currentTarget);
              const rawIdentifier = (formData.get("email") as string) || "";
              let resolvedEmail = rawIdentifier;

              if (rawIdentifier && !isTestEmail(rawIdentifier)) {
                try {
                  resolvedEmail = await convex.query(
                    api.users.resolveEmailFromUsernameOrEmail,
                    { identifier: rawIdentifier },
                  );
                } catch {
                  // Fallback to raw value
                }
              }

              formData.set("email", resolvedEmail);

              const provider = isTestEmail(resolvedEmail) ? "test" : "password";
              try {
                await signIn(provider, formData);
              } catch {
                setError("Invalid username/email or password");
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Username or Email</Label>
              <Input
                id="email"
                name="email"
                type="text"
                placeholder="username atau email@example.com"
                autoComplete="username"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                  onClick={() => handleStepChange({ type: "forgot" })}
                >
                  Forgot password?
                </Button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-11"
                required
              />
            </div>
            <input name="flow" value="signIn" type="hidden" />
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step.type === "forgot") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <h2 className="font-semibold text-lg">Reset Password</h2>
            <p className="text-sm text-muted-foreground">
              Enter your email to receive a reset code
            </p>
          </div>
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setLoading(true);

              const formData = new FormData(e.currentTarget);
              const rawIdentifier = (formData.get("email") as string) || "";
              let resolvedEmail = rawIdentifier;

              if (rawIdentifier && !isTestEmail(rawIdentifier)) {
                try {
                  resolvedEmail = await convex.query(
                    api.users.resolveEmailFromUsernameOrEmail,
                    { identifier: rawIdentifier },
                  );
                } catch {
                  // Fallback to raw value
                }
              }

              formData.set("email", resolvedEmail);

              try {
                await signIn("password", formData);
                handleStepChange({ type: "reset-code", email: resolvedEmail });
              } catch {
                setError("Could not send reset code. Please try again.");
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Username or Email</Label>
              <Input
                id="email"
                name="email"
                type="text"
                placeholder="username atau email@example.com"
                defaultValue={step.email}
                autoComplete="username"
                className="h-11"
                required
              />
            </div>
            <input name="flow" value="reset" type="hidden" />
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Sending..." : "Send Reset Code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("signIn")}
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step.type === "reset-code") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <div className="mx-auto size-12 rounded-full bg-primary flex items-center justify-center mb-4">
              <Mail className="size-6 text-primary-foreground" />
            </div>
            <h2 className="font-semibold text-lg">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a code to {step.email}
            </p>
          </div>
          <form
            onSubmit={e => {
              e.preventDefault();
              setError("");
              const formData = new FormData(e.currentTarget);
              const code = formData.get("code") as string;
              setStep({ type: "new-password", email: step.email, code });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="code">Reset Code</Label>
              <Input
                id="code"
                name="code"
                type="text"
                placeholder="Enter code"
                autoComplete="one-time-code"
                className="h-11 text-center tracking-[0.5em] font-mono"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11">
              Continue
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep({ type: "forgot", email: step.email })}
            >
              Resend code
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardContent className="pt-6">
        <div className="text-center mb-6">
          <h2 className="font-semibold text-lg">Set New Password</h2>
          <p className="text-sm text-muted-foreground">
            Choose a strong password
          </p>
        </div>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setError("");
            setLoading(true);

            const formData = new FormData(e.currentTarget);
            try {
              await signIn("password", formData);
            } catch {
              setError("Could not reset password. Code may be expired.");
              setStep({ type: "forgot", email: step.email });
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="••••••••"
              minLength={6}
              autoComplete="new-password"
              className="h-11"
              required
            />
          </div>
          <input name="flow" value="reset-verification" type="hidden" />
          <input name="email" value={step.email} type="hidden" />
          <input name="code" value={step.code} type="hidden" />
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setStep("signIn")}
          >
            <ArrowLeft className="size-4" />
            Cancel
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
