import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new ConvexError("Harus login terlebih dahulu");
  return userId as Id<"users">;
}

export const listAgentSessions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("agentSessions"),
      _creationTime: v.number(),
      title: v.string(),
      goal: v.string(),
      status: v.union(
        v.literal("idle"),
        v.literal("thinking"),
        v.literal("ready"),
        v.literal("error"),
      ),
      fileCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const sessions = await ctx.db
      .query("agentSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return sessions.map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      title: s.title,
      goal: s.goal,
      status: s.status,
      fileCount: s.files.length,
    }));
  },
});

export const getAgentSession = query({
  args: { sessionId: v.id("agentSessions") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) return null;

    return session;
  },
});

export const createAgentSession = mutation({
  args: {
    goal: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.id("agentSessions"),
  handler: async (ctx, { goal, projectId }) => {
    const userId = await requireUser(ctx);
    const trimmed = goal.trim();
    if (!trimmed) throw new ConvexError("Goal agent tidak boleh kosong");

    const title = trimmed.length > 50 ? `${trimmed.slice(0, 50)}…` : trimmed;

    const sessionId = await ctx.db.insert("agentSessions", {
      userId,
      projectId,
      title,
      goal: trimmed,
      status: "idle",
      files: [],
      logs: [
        {
          timestamp: Date.now(),
          type: "system",
          message: `Sesi agent dibuat. Goal: "${trimmed}"`,
        },
      ],
    });

    return sessionId;
  },
});

export const deleteAgentSession = mutation({
  args: { sessionId: v.id("agentSessions") },
  returns: v.null(),
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new ConvexError("Sesi agent tidak ditemukan");
    }
    await ctx.db.delete(sessionId);
    return null;
  },
});

export const applyAgentResult = internalMutation({
  args: {
    sessionId: v.id("agentSessions"),
    status: v.union(
      v.literal("idle"),
      v.literal("thinking"),
      v.literal("ready"),
      v.literal("error"),
    ),
    files: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
        language: v.optional(v.string()),
      }),
    ),
    logs: v.array(
      v.object({
        timestamp: v.number(),
        type: v.union(
          v.literal("system"),
          v.literal("thought"),
          v.literal("tool"),
          v.literal("output"),
          v.literal("error"),
        ),
        message: v.string(),
      }),
    ),
    lastOutput: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    await ctx.db.patch(args.sessionId, {
      status: args.status,
      files: args.files,
      logs: args.logs,
      lastOutput: args.lastOutput ?? session.lastOutput,
    });
    return null;
  },
});
