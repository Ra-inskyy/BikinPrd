import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { callTool } from "./aiClient";

type AiResult<T> = { result: T | null; error: string | null };

const AGENT_STEP_SCHEMA = {
  type: "object",
  properties: {
    thoughts: {
      type: "array",
      items: { type: "string" },
      description:
        "Langkah-langkah analitis & pemikiran kritis agent saat menyusun arsitektur dan berkas proyek (2-4 poin).",
    },
    files: {
      type: "array",
      description:
        "Daftar berkas proyek lengkap (multi-file) yang siap dieksekusi atau digunakan.",
      items: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Nama atau path file (misal: main.py, utils.py, requirements.txt, README.md, index.js, config.json).",
          },
          content: {
            type: "string",
            description:
              "Kode sumber atau konten file yang lengkap, bersih, siap pakai, tanpa placeholder.",
          },
          language: {
            type: "string",
            description:
              "Bahasa pemrograman (python, javascript, json, markdown, bash, html, dll).",
          },
        },
        required: ["path", "content"],
      },
    },
    summary: {
      type: "string",
      description:
        "Ringkasan singkat hasil eksekusi agent dan panduan cara menjalankannya.",
    },
  },
  required: ["thoughts", "files", "summary"],
};

export const runAgentStep = action({
  args: {
    sessionId: v.id("agentSessions"),
    userInstruction: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, { sessionId, userInstruction }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.runQuery(api.agent.getAgentSession, { sessionId });
    if (!session || session.userId !== userId) {
      throw new Error("Agent session not found");
    }

    const currentFiles = session.files || [];
    const currentLogs = [...(session.logs || [])];

    currentLogs.push({
      timestamp: Date.now(),
      type: "system",
      message: userInstruction
        ? `Menjalankan revisi agent: "${userInstruction}"`
        : "Memulai analisis & eksekusi agent…",
    });

    // Update status ke 'thinking'
    await ctx.runMutation(internal.agent.applyAgentResult, {
      sessionId,
      status: "thinking",
      files: currentFiles,
      logs: currentLogs,
    });

    let prdDocumentContext = "";
    if (session.projectId) {
      try {
        const prdData = await ctx.runQuery(api.prd.getProjectInternal, {
          projectId: session.projectId,
        });
        if (prdData && prdData.project) {
          const p = prdData.project;
          const features = prdData.features || [];
          const docLines: string[] = [];

          docLines.push(`# DOKUMEN UTAMA: ${p.title}`);
          if (p.summary) docLines.push(`## Ringkasan Proyek\n${p.summary}`);
          if (p.problem) docLines.push(`## Masalah Utama\n${p.problem}`);
          if (p.targetUsers) docLines.push(`## Target Pengguna\n${p.targetUsers}`);

          if (p.goals?.length) {
            docLines.push(`## Goals Proyek:\n${p.goals.map((g: string) => `- ${g}`).join("\n")}`);
          }
          if (p.nonGoals?.length) {
            docLines.push(`## Non-Goals:\n${p.nonGoals.map((ng: string) => `- ${ng}`).join("\n")}`);
          }
          if (p.techStack?.length) {
            docLines.push(`## Rekomendasi Tech Stack:\n${p.techStack.map((t: string) => `- ${t}`).join("\n")}`);
          }
          if (p.metrics?.length) {
            docLines.push(`## Metrik Keberhasilan:\n${p.metrics.map((m: string) => `- ${m}`).join("\n")}`);
          }

          if (features.length > 0) {
            docLines.push("## DAFTAR FITUR & SPESIFIKASI DETAIL:");
            for (const f of features) {
              docLines.push(`### Fitur: ${f.name} [Prioritas ${f.priority}]\n${f.description || ""}\n\nSpesifikasi:\n${f.spec || ""}`);
              if (f.tasks?.length) {
                docLines.push("Tasks Teknis:\n" + f.tasks.map((t: string) => `- [ ] ${t}`).join("\n"));
              }
            }
          }

          if (p.simplePlan) {
            const plan = p.simplePlan;
            docLines.push(`## PLAN SEDERHANA: ${plan.title || p.title}`);
            if (plan.summary) docLines.push(plan.summary);
            if (plan.steps?.length) {
              docLines.push("Alur Langkah Eksekusi:\n" + plan.steps.map((s: any) => `- Langkah ${s.stepNumber || 1}: ${s.title} — ${s.description}`).join("\n"));
            }
            if (plan.fullScriptSkeleton) {
              docLines.push(`Template Kode Skeleton:\n\`\`\`\n${plan.fullScriptSkeleton}\n\`\`\``);
            }
            if (plan.aiPrompt) {
              docLines.push(`Prompt Instruksi AI Original:\n${plan.aiPrompt}`);
            }
          }

          prdDocumentContext = `\n=== DOKUMEN PRD / PLAN LENGKAP PROYEK (FULL DOCUMENT) ===\n${docLines.join("\n\n")}`;
        }
      } catch (err) {
        console.error("Gagal memuat konteks dokumen PRD lengkap:", err);
      }
    }

    const fileContext =
      currentFiles.length > 0
        ? `\n=== BERKAS PROYEK SAAT INI ===\n${JSON.stringify(currentFiles, null, 2)}`
        : "";

    const prompt = `Kamu adalah Autonomous AI Code Agent & Software Architect senior.
Tugasmu adalah merealisasikan goal proyek pengguna dengan menghasilkan BERKAS PROYEK LENGKAP (multi-file) yang siap dieksekusi di lingkungan Sandbox (Python / JS Worker / Wasm).

=== GOAL AGENT ===
${session.goal}${prdDocumentContext}
${userInstruction ? `\n=== INSTRUKSI TAMBAHAN / REVISI DARI PENGGUNA ===\n${userInstruction}` : ""}${fileContext}

PETUNJUK EKSEKUSI:
1. Analisis goal & dokumen PRD lengkap di atas. Susun struktur file yang paling optimal (misal untuk Python: sertakan main.py, requirements.txt, README.md, dan modul pembantu jika diperlukan).
2. Tulis kode yang BENAR-BENAR BERJALAN, bersih, lengkap, tanpa dummy comment atau placeholder "// todo".
3. Sertakan penanganan error yang baik dan keluaran stdout yang jelas agar mudah diamati saat dijalankan di terminal.
4. Semua pemikiran & ringkasan dalam Bahasa Indonesia.`;

    try {
      const res = await callTool<AiResult<any>>("ai_structured_output", {
        prompt,
        output_schema: AGENT_STEP_SCHEMA,
        intelligence_level: "smart",
        max_tokens: 4000,
      });

      if (res.error || !res.result) {
        throw new Error(res.error || "AI Agent tidak mengembalikan hasil");
      }

      const raw = res.result || {};
      const thoughts: string[] = Array.isArray(raw.thoughts)
        ? raw.thoughts.map((t: any) => String(t))
        : [String(raw.summary || "Agent telah menganalisis instruksi.")];

      let newFiles = Array.isArray(raw.files)
        ? raw.files
            .filter((f: any) => f && (f.path || f.content))
            .map((f: any) => ({
              path: String(f.path || "main.py"),
              content: String(f.content || ""),
              language: f.language ? String(f.language) : "python",
            }))
        : [];

      if (newFiles.length === 0 && raw.code) {
        newFiles = [
          {
            path: "main.py",
            content: String(raw.code),
            language: "python",
          },
        ];
      }

      const summary = String(raw.summary || "Selesai menyusun kode.");

      // Catat log pemikiran agent
      for (const thought of thoughts) {
        currentLogs.push({
          timestamp: Date.now(),
          type: "thought",
          message: thought,
        });
      }

      currentLogs.push({
        timestamp: Date.now(),
        type: "tool",
        message: `Agent berhasil membuat/memperbarui ${newFiles.length} berkas proyek.`,
      });

      currentLogs.push({
        timestamp: Date.now(),
        type: "system",
        message: summary,
      });

      await ctx.runMutation(internal.agent.applyAgentResult, {
        sessionId,
        status: "ready",
        files: newFiles.length > 0 ? newFiles : currentFiles,
        logs: currentLogs,
        lastOutput: summary,
      });

      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || String(e);
      currentLogs.push({
        timestamp: Date.now(),
        type: "error",
        message: `Gagal: ${msg}`,
      });

      await ctx.runMutation(internal.agent.applyAgentResult, {
        sessionId,
        status: "error",
        files: currentFiles,
        logs: currentLogs,
      });

      return { ok: false, error: msg };
    }
  },
});
