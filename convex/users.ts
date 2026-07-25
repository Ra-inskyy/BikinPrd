import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const checkUserOrEmailExists = query({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const normalizedName = args.name.trim().toLowerCase();

    if (!normalizedEmail && !normalizedName) {
      return { exists: false, field: null };
    }

    // Check authAccounts table for providerAccountId matching normalized email
    if (normalizedEmail) {
      const account = await ctx.db
        .query("authAccounts")
        .filter(q => q.eq(q.field("providerAccountId"), normalizedEmail))
        .first();

      if (account) return { exists: true, field: "email" };
    }

    // Check users table for email or name field
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) {
      if (
        normalizedEmail &&
        u.email &&
        u.email.trim().toLowerCase() === normalizedEmail
      ) {
        return { exists: true, field: "email" };
      }
      if (
        normalizedName &&
        u.name &&
        u.name.trim().toLowerCase() === normalizedName
      ) {
        return { exists: true, field: "name" };
      }
    }

    return { exists: false, field: null };
  },
});

export const resolveEmailFromUsernameOrEmail = query({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.identifier.trim();
    if (!trimmed) return "";

    if (trimmed.includes("@")) {
      return trimmed.toLowerCase();
    }

    const normalizedName = trimmed.toLowerCase();

    // Check by_username index
    const userByUsername = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", normalizedName))
      .first();

    if (userByUsername?.email) {
      return userByUsername.email.toLowerCase();
    }

    // Scan users table for matching name or username
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) {
      if (
        (u.username && u.username.trim().toLowerCase() === normalizedName) ||
        (u.name && u.name.trim().toLowerCase() === normalizedName)
      ) {
        if (u.email) return u.email.toLowerCase();
      }
    }

    return trimmed;
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }

    const authSessions = await ctx.db
      .query("authSessions")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    for (const session of authSessions) {
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(userId);

    return { success: true };
  },
});
