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

export const clearAllTestData = mutation({
  args: {},
  handler: async ctx => {
    // 1. Delete all projects, features, chatMessages, userQuotas, transactions
    const projects = await ctx.db.query("projects").collect();
    for (const p of projects) {
      await ctx.db.delete(p._id);
    }

    const features = await ctx.db.query("features").collect();
    for (const f of features) {
      await ctx.db.delete(f._id);
    }

    const chatMessages = await ctx.db.query("chatMessages").collect();
    for (const m of chatMessages) {
      await ctx.db.delete(m._id);
    }

    const userQuotas = await ctx.db.query("userQuotas").collect();
    for (const q of userQuotas) {
      await ctx.db.delete(q._id);
    }

    const transactions = await ctx.db.query("transactions").collect();
    for (const t of transactions) {
      await ctx.db.delete(t._id);
    }

    // 2. Delete all users, authAccounts, authSessions, authVerificationCodes
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      await ctx.db.delete(u._id);
    }

    const accounts = await ctx.db.query("authAccounts").collect();
    for (const a of accounts) {
      await ctx.db.delete(a._id);
    }

    const sessions = await ctx.db.query("authSessions").collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }

    const codes = await ctx.db.query("authVerificationCodes").collect();
    for (const c of codes) {
      await ctx.db.delete(c._id);
    }

    return {
      success: true,
      deletedCount: {
        projects: projects.length,
        features: features.length,
        chatMessages: chatMessages.length,
        users: users.length,
        accounts: accounts.length,
        sessions: sessions.length,
      },
    };
  },
});
