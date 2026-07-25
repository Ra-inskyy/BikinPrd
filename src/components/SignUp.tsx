import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import { AlertTriangle, ArrowLeft, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function isTestEmail(email: string): boolean {
  return email.endsWith("@test.local");
}

type Step = "signUp" | { email: string };

export function SignUp({
  onStepChange,
}: {
  onStepChange?: (step: "signUp" | "otp") => void;
}) {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const [step, setStep] = useState<Step>("signUp");
  const [error, setError] = useState("");
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStepChange = (newStep: Step) => {
    setStep(newStep);
    onStepChange?.(typeof newStep === "string" ? newStep : "otp");
  };

  if (step === "signUp") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setIsExistingAccount(false);
              setLoading(true);

              const formData = new FormData(e.currentTarget);
              const email = formData.get("email") as string;

              if (!isTestEmail(email)) {
                try {
                  const exists = await convex.query(api.users.checkEmailExists, {
                    email,
                  });
                  if (exists) {
                    setIsExistingAccount(true);
                    setError(
                      "Email ini sudah terdaftar. Silakan Sign In untuk masuk ke akun kamu.",
                    );
                    setLoading(false);
                    return;
                  }
                } catch {
                  // If query fails, fall through to default flow
                }
              }

              const provider = isTestEmail(email) ? "test" : "password";
              try {
                await signIn(provider, formData);
                if (!isTestEmail(email)) {
                  handleStepChange({ email });
                }
              } catch {
                setError("Could not create account. Please try again.");
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Your name"
                autoComplete="name"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={6}
                autoComplete="new-password"
                className="h-11"
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>
            <input name="flow" value="signUp" type="hidden" />
            {error && (
              <div className="space-y-2">
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {isExistingAccount && (
                  <Button
                    variant="outline"
                    className="w-full h-10 border-primary/40 text-primary font-medium"
                    asChild
                  >
                    <Link to="/login">Ke Halaman Sign In / Login</Link>
                  </Button>
                )}
              </div>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Creating account..." : "Create Account"}
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
          <div className="mx-auto size-12 rounded-full bg-primary flex items-center justify-center mb-4">
            <Mail className="size-6 text-primary-foreground" />
          </div>
          <h2 className="font-semibold text-lg">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a verification code to {step.email}
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
              setError("Invalid or expired code. Please try again.");
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
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
          <input name="flow" value="email-verification" type="hidden" />
          <input name="email" value={step.email} type="hidden" />
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Verifying..." : "Verify Email"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => handleStepChange("signUp")}
          >
            <ArrowLeft className="size-4" />
            Back to sign up
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
