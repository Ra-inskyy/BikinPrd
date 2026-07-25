import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";

function AuthFormSkeleton() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Skeleton className="h-9 w-32 mx-auto mb-8" />
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-32" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-48" />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-4 w-48 mx-auto mt-4" />
      </div>
    </div>
  );
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const user = useQuery(api.auth.currentUser);
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (isAuthenticated && user === null) {
      void signOut();
    }
  }, [isAuthenticated, user, signOut]);

  if (isAuthLoading || (isAuthenticated && user === undefined)) {
    return <AuthFormSkeleton />;
  }

  if (isAuthenticated && user !== null) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
