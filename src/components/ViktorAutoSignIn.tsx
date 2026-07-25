import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  hasFreshViktorSignInAttempt,
  markViktorSignInAttempt,
  OAUTH_CALLBACK_PATH,
  pageLoadRequestedAutoSignIn,
} from "@/auth/oauthReturn";
import { getViktorSignInAvailable } from "@/lib/viktor-spaces-access/config";

export type AutoSignInAction = "start_sign_in" | "enter_app" | "none";

export function getAutoSignInAvailability(): boolean {
  try {
    return getViktorSignInAvailable();
  } catch {
    // An invalid provider list must never trigger OAuth. The login page owns
    // the visible configuration error while this automatic path stays inert.
    return false;
  }
}

/**
 * Pure decision for the auto sign-in intent param (`viktor_sign_in=auto`).
 *
 * Only links from Viktor surfaces carry the param, so the visitor is almost
 * certainly a signed-in workspace member and the OAuth round trip will
 * complete invisibly. The attempt is still loop-proof: it fires at most once
 * per page load, never while a recent attempt is in flight, and the return
 * leg of the round trip lands on a URL without the param — a denial ends on
 * the login page with the explicit failure message, never in a retry.
 */
export function resolveAutoSignInAction(state: {
  requestedAutoSignIn: boolean;
  signInAvailable: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRecentAttempt: boolean;
}): AutoSignInAction {
  if (!state.requestedAutoSignIn) return "none";
  // Wait for Convex Auth to restore any existing session before deciding.
  if (state.isLoading) return "none";
  // Already signed in (a returning member re-opening a shared link): honor
  // the intent by entering the app instead of restarting the OAuth flow.
  if (state.isAuthenticated) return "enter_app";
  if (!state.signInAvailable) return "none";
  if (state.hasRecentAttempt) return "none";
  return "start_sign_in";
}

/**
 * Acts on the auto sign-in intent param. Mounted once inside the Convex Auth
 * provider (outside the routes) so it works no matter which page a shared
 * link lands on. Renders a full-screen signing-in overlay while the OAuth
 * redirect is leaving; renders nothing otherwise.
 */
export function ViktorAutoSignIn({
  requestedAutoSignIn = pageLoadRequestedAutoSignIn(),
}: {
  requestedAutoSignIn?: boolean;
}) {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const actedRef = useRef(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Backing out of the OAuth redirect can restore this page from the
    // back-forward cache with its JS state frozen mid-attempt: the
    // signing-in overlay stuck on screen and `actedRef` blocking any further
    // action. On restore, drop the overlay and re-arm. This cannot restart
    // the OAuth flow by itself (the decision effect re-runs only when auth
    // state changes, and the fresh attempt marker vetoes a restart anyway) —
    // it just lets a completed sign-in proceed into the app.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      actedRef.current = false;
      setRedirecting(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    if (actedRef.current) return;
    const action = resolveAutoSignInAction({
      requestedAutoSignIn,
      signInAvailable: getAutoSignInAvailability(),
      isAuthenticated,
      isLoading,
      hasRecentAttempt: hasFreshViktorSignInAttempt(),
    });
    if (action === "none") return;
    actedRef.current = true;
    if (action === "enter_app") {
      navigate("/dashboard", { replace: true });
      return;
    }
    setRedirecting(true);
    markViktorSignInAttempt();
    signIn("viktor", { redirectTo: OAUTH_CALLBACK_PATH }).catch(() => {
      // Couldn't even start the redirect (misconfiguration, network): drop
      // the overlay and let the page render normally — the login page still
      // offers the manual button.
      setRedirecting(false);
    });
  }, [requestedAutoSignIn, isAuthenticated, isLoading, navigate, signIn]);

  if (!redirecting) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  );
}
