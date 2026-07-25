import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new Error("Not authenticated");
  return userId as Id<"users">;
}

// Validator bersama
const statusValidator = v.union(
  v.literal("choosing"),
  v.literal("structuring"),
  v.literal("structure_ready"),
  v.literal("preparing"),
  v.literal("questioning"),
  v.literal("generating"),
  v.literal("ready"),
  v.literal("error"),
);

const structureItemValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  phase: v.optional(v.number()),
  subFeatures: v.array(v.string()),
});

// ---------------------------------------------------------------------------
// Proyek
// ---------------------------------------------------------------------------

export const listProjects = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      title: v.string(),
      idea: v.string(),
      summary: v.optional(v.string()),
      status: statusValidator,
      featureCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const results = [];
    for (const p of projects) {
      const features = await ctx.db
        .query("features")
        .withIndex("by_project", (q) => q.eq("projectId", p._id))
        .collect();
      results.push({
        _id: p._id,
        _creationTime: p._creationTime,
        title: p.title,
        idea: p.idea,
        summary: p.summary,
        status: p.status,
        featureCount: features.length,
      });
    }
    return results;
  },
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      project: v.any(),
      features: v.array(v.any()),
      messages: v.array(v.any()),
    }),
    v.null(),
  ),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) return null;

    const features = await ctx.db
      .query("features")
      .withIndex("by_project_order", (q) => q.eq("projectId", projectId))
      .collect();
    features.sort((a, b) => a.order - b.order);

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    messages.sort((a, b) => a._creationTime - b._creationTime);

    return { project, features, messages };
  },
});

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export const getUserQuota = query({
  args: {},
  returns: v.object({
    countToday: v.number(),
    maxDailyLimit: v.number(),
    remainingToday: v.number(),
    bonusCredits: v.number(),
    totalAvailable: v.number(),
    lastCreatedDate: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const today = getTodayDateString();
    if (!userId) {
      return {
        countToday: 0,
        maxDailyLimit: 1,
        remainingToday: 1,
        bonusCredits: 0,
        totalAvailable: 1,
      };
    }
    const quota = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const isToday = quota?.lastCreatedDate === today;
    const countToday = isToday ? quota.countToday : 0;
    const remainingToday = Math.max(0, 1 - countToday);
    const bonusCredits = quota?.bonusCredits ?? 0;

    return {
      countToday,
      maxDailyLimit: 1,
      remainingToday,
      bonusCredits,
      totalAvailable: remainingToday + bonusCredits,
      lastCreatedDate: quota?.lastCreatedDate,
    };
  },
});

export const createDraftProject = mutation({
  args: { idea: v.string(), context: v.optional(v.string()) },
  returns: v.id("projects"),
  handler: async (ctx, { idea, context }) => {
    const userId = await requireUser(ctx);
    const trimmed = idea.trim();
    if (!trimmed) throw new Error("Ide tidak boleh kosong");

    const today = getTodayDateString();

    const quota = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const isToday = quota?.lastCreatedDate === today;
    const countToday = isToday ? quota.countToday : 0;
    const bonusCredits = quota?.bonusCredits ?? 0;

    // Prioritas 1: Pakai Kuota Harian (1/1)
    if (countToday < 1) {
      if (quota) {
        await ctx.db.patch(quota._id, {
          lastCreatedDate: today,
          countToday: 1,
        });
      } else {
        await ctx.db.insert("userQuotas", {
          userId,
          lastCreatedDate: today,
          countToday: 1,
          bonusCredits: 0,
        });
      }
    }
    // Prioritas 2: Kuota Harian habis -> Pakai Kredit Bonus
    else if (bonusCredits > 0) {
      if (quota) {
        await ctx.db.patch(quota._id, {
          bonusCredits: bonusCredits - 1,
        });
      }
    }
    // Tidak ada kuota maupun kredit bonus
    else {
      throw new Error(
        "Kuota harian kamu sudah habis (1/1 PRD hari ini) dan kamu belum memiliki Kredit Bonus. Silakan Top-Up kredit untuk membuat PRD baru!",
      );
    }

    const title = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
    return await ctx.db.insert("projects", {
      userId,
      title,
      idea: trimmed,
      context: context?.trim() || undefined,
      status: "choosing",
    });
  },
});

export const topUpCredits = mutation({
  args: {
    packageName: v.string(),
    amount: v.number(),
    creditsAdded: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    newBonusCredits: v.number(),
  }),
  handler: async (ctx, { packageName, amount, creditsAdded }) => {
    const userId = await requireUser(ctx);

    // Catat transaksi sebagai FAILED/DENIED
    await ctx.db.insert("transactions", {
      userId,
      packageName,
      amount,
      creditsAdded,
      status: "failed",
      paymentMethod: "QRIS / E-Wallet (Simulasi)",
    });

    // Fitur Top-Up ditolak — selalu denied
    throw new ConvexError(
      "Maaf, fitur Top-Up Kredit sedang tidak tersedia. Silakan coba lagi nanti."
    );
  },
});

export const listTransactions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("transactions"),
      _creationTime: v.number(),
      packageName: v.string(),
      amount: v.number(),
      creditsAdded: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("failed"),
      ),
      paymentMethod: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return txs.map((t) => ({
      _id: t._id,
      _creationTime: t._creationTime,
      packageName: t.packageName,
      amount: t.amount,
      creditsAdded: t.creditsAdded,
      status: t.status,
      paymentMethod: t.paymentMethod,
    }));
  },
});

// Langkah 1 (Struktur): user memilih cara menyusun struktur fitur.
// "ai" -> ubah ke "structuring" agar action generateStructure bisa jalan.
// "manual" -> langsung ke peta struktur (kosong) yang bisa diedit.
export const chooseStructureMode = mutation({
  args: {
    projectId: v.id("projects"),
    mode: v.union(v.literal("ai"), v.literal("manual")),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, mode }) => {
    const userId = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    if (mode === "ai") {
      await ctx.db.patch(projectId, {
        structureMode: "ai",
        status: "structuring",
        error: undefined,
      });
    } else {
      await ctx.db.patch(projectId, {
        structureMode: "manual",
        status: "structure_ready",
        structure: project.structure ?? [],
        error: undefined,
      });
    }
    return null;
  },
});

// Simpan perubahan struktur (dipakai editor manual & setelah generate AI).
export const saveStructure = mutation({
  args: {
    projectId: v.id("projects"),
    structure: v.array(structureItemValidator),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, structure }) => {
    const userId = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(projectId, { structure });
    return null;
  },
});

// Konfirmasi struktur lalu lanjut ke langkah pertanyaan klarifikasi.
export const proceedToQuestions = mutation({
  args: {
    projectId: v.id("projects"),
    structure: v.optional(v.array(structureItemValidator)),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, structure }) => {
    const userId = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(projectId, {
      ...(structure ? { structure } : {}),
      status: "preparing",
      error: undefined,
    });
    return null;
  },
});

// Simpan jawaban user atas pertanyaan klarifikasi, lalu ubah
// proyek ke "generating" agar action PRD bisa menyusun dari jawaban itu.
export const submitAnswers = mutation({
  args: { projectId: v.id("projects"), answers: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { projectId, answers }) => {
    const userId = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(projectId, {
      answers,
      status: "generating",
      error: undefined,
    });
    return null;
  },
});

export const deleteProject = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, { projectId }) => {
    const userId = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");

    const features = await ctx.db
      .query("features")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const f of features) await ctx.db.delete(f._id);

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const m of messages) await ctx.db.delete(m._id);

    await ctx.db.delete(projectId);
    return null;
  },
});

export const updateContext = mutation({
  args: { projectId: v.id("projects"), context: v.string() },
  returns: v.null(),
  handler: async (ctx, { projectId, context }) => {
    const userId = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(projectId, { context });
    return null;
  },
});

export const updateFeature = mutation({
  args: {
    featureId: v.id("features"),
    name: v.optional(v.string()),
    spec: v.optional(v.string()),
    tasks: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, { featureId, name, spec, tasks }) => {
    const userId = await requireUser(ctx);
    const feature = await ctx.db.get(featureId);
    if (!feature || feature.userId !== userId) throw new Error("Not found");
    const patch: Partial<Doc<"features">> = {};
    if (name !== undefined) patch.name = name;
    if (spec !== undefined) patch.spec = spec;
    if (tasks !== undefined) patch.tasks = tasks;
    await ctx.db.patch(featureId, patch);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Mutation internal yang dipakai oleh actions (prdActions.ts)
// ---------------------------------------------------------------------------

export const applyGeneratedPrd = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    summary: v.string(),
    problem: v.string(),
    targetUsers: v.string(),
    goals: v.array(v.string()),
    nonGoals: v.array(v.string()),
    techStack: v.array(v.string()),
    metrics: v.array(v.string()),
    features: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        spec: v.string(),
        tasks: v.array(v.string()),
        priority: v.union(
          v.literal("P0"),
          v.literal("P1"),
          v.literal("P2"),
        ),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    // Hapus fitur yang ada (kasus regenerasi)
    const existing = await ctx.db
      .query("features")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const f of existing) await ctx.db.delete(f._id);

    await ctx.db.patch(args.projectId, {
      title: args.title,
      summary: args.summary,
      problem: args.problem,
      targetUsers: args.targetUsers,
      goals: args.goals,
      nonGoals: args.nonGoals,
      techStack: args.techStack,
      metrics: args.metrics,
      status: "ready",
      error: undefined,
    });

    let order = 0;
    for (const feat of args.features) {
      await ctx.db.insert("features", {
        projectId: args.projectId,
        userId: project.userId,
        order: order++,
        name: feat.name,
        description: feat.description,
        spec: feat.spec,
        tasks: feat.tasks,
        priority: feat.priority,
      });
    }
    return null;
  },
});

export const applyStructure = internalMutation({
  args: {
    projectId: v.id("projects"),
    structure: v.array(structureItemValidator),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, structure }) => {
    const project = await ctx.db.get(projectId);
    if (!project) return null;
    await ctx.db.patch(projectId, {
      structure,
      status: "structure_ready",
      error: undefined,
    });
    return null;
  },
});

export const applyQuestions = internalMutation({
  args: {
    projectId: v.id("projects"),
    questions: v.array(
      v.object({
        category: v.union(
          v.literal("requirement"),
          v.literal("backend"),
          v.literal("frontend"),
          v.literal("preparation"),
          v.literal("phase"),
        ),
        question: v.string(),
        hint: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, questions }) => {
    const project = await ctx.db.get(projectId);
    if (!project) return null;
    await ctx.db.patch(projectId, {
      questions,
      status: "questioning",
      error: undefined,
    });
    return null;
  },
});

export const markProjectError = internalMutation({
  args: { projectId: v.id("projects"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { projectId, error }) => {
    await ctx.db.patch(projectId, { status: "error", error });
    return null;
  },
});

export const addMessage = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      projectId: args.projectId,
      userId: args.userId,
      role: args.role,
      content: args.content,
    });
    return null;
  },
});

export const getProjectInternal = query({
  args: { projectId: v.id("projects") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project) return null;
    const features = await ctx.db
      .query("features")
      .withIndex("by_project_order", (q) => q.eq("projectId", projectId))
      .collect();
    features.sort((a, b) => a.order - b.order);
    return { project, features };
  },
});
