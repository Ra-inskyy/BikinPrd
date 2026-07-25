import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const checkEmailExists = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    if (!normalizedEmail) return false;

    // Check authAccounts table for providerAccountId matching normalized email
    const account = await ctx.db
      .query("authAccounts")
      .filter(q => q.eq(q.field("providerAccountId"), normalizedEmail))
      .first();

    if (account) return true;

    // Check users table for email field
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("email"), normalizedEmail))
      .first();

    return user !== null;
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
