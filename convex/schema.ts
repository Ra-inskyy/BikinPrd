import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    ...authTables.users.validator.fields,
    username: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_username", ["username"]),

  // Proyek PRD: satu ide produk -> PRD lengkap
  projects: defineTable({
    userId: v.id("users"),
    title: v.string(),
    idea: v.string(), // prompt ide asli dari user
    // field ringkasan hasil generate AI
    summary: v.optional(v.string()),
    problem: v.optional(v.string()),
    targetUsers: v.optional(v.string()),
    goals: v.optional(v.array(v.string())),
    nonGoals: v.optional(v.array(v.string())),
    techStack: v.optional(v.array(v.string())),
    metrics: v.optional(v.array(v.string())),
    // catatan konteks bebas yang dibaca agent saat (re)generate
    context: v.optional(v.string()),
    // pertanyaan klarifikasi hasil AI (ditanyakan sebelum menyusun PRD)
    questions: v.optional(
      v.array(
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
          // pilihan ganda yang disarankan AI (opsional)
          options: v.optional(v.array(v.string())),
        }),
      ),
    ),
    // jawaban user, dipetakan berdasarkan index ke `questions`
    answers: v.optional(v.array(v.string())),
    // bagaimana struktur fitur dibuat
    structureMode: v.optional(v.union(v.literal("ai"), v.literal("manual"))),
    // struktur fitur -> sub-fitur aplikasi (langkah "Struktur")
    structure: v.optional(
      v.array(
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          phase: v.optional(v.number()), // FASE 1/2/3
          subFeatures: v.array(v.string()),
        }),
      ),
    ),
    status: v.union(
      v.literal("choosing"), // pilih struktur generate-AI vs manual
      v.literal("structuring"), // AI sedang menyusun struktur fitur
      v.literal("structure_ready"), // struktur selesai, ditampilkan & bisa diedit
      v.literal("preparing"), // AI sedang membuat pertanyaan klarifikasi
      v.literal("questioning"), // pertanyaan siap, menunggu jawaban user
      v.literal("generating"), // sedang menyusun PRD
      v.literal("ready"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
    model: v.optional(v.string()),
    planType: v.optional(v.union(v.literal("standard"), v.literal("simple_script"))),
    simplePlan: v.optional(
      v.object({
        title: v.string(),
        summary: v.string(),
        techStack: v.array(v.string()),
        steps: v.array(
          v.object({
            stepNumber: v.number(),
            title: v.string(),
            description: v.string(),
            codeSnippet: v.optional(v.string()),
          }),
        ),
        fullScriptSkeleton: v.optional(v.string()),
        aiPrompt: v.string(),
      }),
    ),
  }).index("by_user", ["userId"]),

  // Fitur milik sebuah proyek, tiap fitur punya spec markdown + task
  features: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    order: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    spec: v.string(), // markdown
    tasks: v.array(v.string()),
    priority: v.optional(
      v.union(v.literal("P0"), v.literal("P1"), v.literal("P2")),
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_project_order", ["projectId", "order"]),

  // Log chat / revisi per proyek
  chatMessages: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }).index("by_project", ["projectId"]),

  // Lacak kuota harian pembuatan PRD (1 PRD per hari per user) & kredit bonus
  userQuotas: defineTable({
    userId: v.id("users"),
    lastCreatedDate: v.string(), // format "YYYY-MM-DD"
    countToday: v.number(),
    bonusCredits: v.optional(v.number()), // kredit tambahan dari top-up
  }).index("by_user", ["userId"]),

  // Riwayat transaksi top-up kredit
  transactions: defineTable({
    userId: v.id("users"),
    amount: v.number(), // harga dalam Rupiah
    creditsAdded: v.number(), // jumlah kredit didapat
    packageName: v.string(), // "Paket Hemat 5 PRD", dst.
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("failed")),
    paymentMethod: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});

export default schema;
