import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
// Pakai klien AI custom (OpenAI-compatible) langsung, tanpa gateway AI Viktor.
// Untuk kembali memakai AI Viktor, ganti impor ini ke "./viktorClient".
import { callTool } from "./aiClient";

type AiResult<T> = { result: T | null; error: string | null };

// Label model yang ditampilkan di UI. Mengikuti AI_MODEL (klien AI custom).
declare const process: { env: Record<string, string | undefined> };
const MODEL_LABEL = process.env.AI_MODEL || "gpt-4o";

const PRD_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Nama produk / proyek yang ringkas dan menarik (maks 60 karakter).",
    },
    summary: {
      type: "string",
      description: "Ringkasan eksekutif 2-4 kalimat tentang produk ini.",
    },
    problem: {
      type: "string",
      description: "Masalah utama yang diselesaikan produk ini (2-4 kalimat).",
    },
    targetUsers: {
      type: "string",
      description: "Siapa target pengguna utama. Jelaskan personanya.",
    },
    goals: {
      type: "array",
      items: { type: "string" },
      description: "3-5 tujuan/goal produk yang jelas dan terukur.",
    },
    nonGoals: {
      type: "array",
      items: { type: "string" },
      description: "2-4 hal yang SENGAJA tidak dikerjakan (out of scope) untuk versi awal.",
    },
    techStack: {
      type: "array",
      items: { type: "string" },
      description: "Rekomendasi tech stack konkret (framework, database, hosting, dll).",
    },
    metrics: {
      type: "array",
      items: { type: "string" },
      description: "2-4 metrik keberhasilan (success metrics) yang terukur.",
    },
    features: {
      type: "array",
      description: "Daftar fitur inti. Buat 4-7 fitur yang benar-benar penting untuk MVP.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nama fitur yang singkat." },
          description: {
            type: "string",
            description: "Satu kalimat menjelaskan fitur ini.",
          },
          priority: {
            type: "string",
            enum: ["P0", "P1", "P2"],
            description: "Prioritas: P0 (wajib MVP), P1 (penting), P2 (nice to have).",
          },
          spec: {
            type: "string",
            description:
              "Spesifikasi fitur dalam format MARKDOWN yang detail dan siap dipakai AI coding agent. Sertakan: deskripsi, user story, kriteria penerimaan (acceptance criteria sebagai checklist), dan catatan teknis. Gunakan heading '###', bullet, dan checklist '- [ ]'.",
          },
          tasks: {
            type: "array",
            items: { type: "string" },
            description:
              "5-10 task teknis konkret dan berurutan untuk mengimplementasikan fitur ini, masing-masing bisa langsung diberikan ke AI coding agent.",
          },
        },
        required: ["name", "description", "priority", "spec", "tasks"],
      },
    },
  },
  required: [
    "title",
    "summary",
    "problem",
    "targetUsers",
    "goals",
    "nonGoals",
    "techStack",
    "metrics",
    "features",
  ],
};

// Skema ringan untuk "kerangka" PRD: semua field ringkas + daftar fitur TANPA
// spec/tasks yang berat. Dipakai di panggilan pertama generatePrd supaya cepat.
const PRD_OVERVIEW_SCHEMA = {
  type: "object",
  properties: {
    title: PRD_SCHEMA.properties.title,
    summary: PRD_SCHEMA.properties.summary,
    problem: PRD_SCHEMA.properties.problem,
    targetUsers: PRD_SCHEMA.properties.targetUsers,
    goals: PRD_SCHEMA.properties.goals,
    nonGoals: PRD_SCHEMA.properties.nonGoals,
    techStack: PRD_SCHEMA.properties.techStack,
    metrics: PRD_SCHEMA.properties.metrics,
    features: {
      type: "array",
      description:
        "Daftar fitur inti. Buat 4-7 fitur penting untuk MVP. HANYA nama, deskripsi singkat, dan prioritas — TANPA spec/tasks (itu dibuat terpisah).",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nama fitur yang singkat." },
          description: {
            type: "string",
            description: "Satu kalimat menjelaskan fitur ini.",
          },
          priority: {
            type: "string",
            enum: ["P0", "P1", "P2"],
            description:
              "Prioritas: P0 (wajib MVP), P1 (penting), P2 (nice to have).",
          },
        },
        required: ["name", "description", "priority"],
      },
    },
  },
  required: [
    "title",
    "summary",
    "problem",
    "targetUsers",
    "goals",
    "nonGoals",
    "techStack",
    "metrics",
    "features",
  ],
};

// Skema detail untuk SATU fitur: spec markdown + daftar task. Dipakai di
// panggilan per-fitur supaya tiap request kecil & cepat (hindari timeout).
const FEATURE_DETAIL_SCHEMA = {
  type: "object",
  properties: {
    spec: PRD_SCHEMA.properties.features.items.properties.spec,
    tasks: PRD_SCHEMA.properties.features.items.properties.tasks,
  },
  required: ["spec", "tasks"],
};

const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      description:
        "12-18 pertanyaan klarifikasi yang tajam dan spesifik untuk ide ini. Bagi ke dalam 5 kategori: 'requirement' (kebutuhan/fitur & batasan produk), 'backend' (arsitektur server, database, API, auth, keamanan, integrasi), 'frontend' (UI/UX, halaman, komponen, desain, state, responsif), 'preparation' (persiapan: tim, budget, akun/API, data), dan 'phase' (tahapan/fase pengerjaan & timeline). Sertakan minimal 2-3 pertanyaan tiap kategori.",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["requirement", "backend", "frontend", "preparation", "phase"],
            description:
              "Kategori pertanyaan: requirement (kebutuhan), backend (server/DB/API), frontend (UI/UX), preparation (persiapan), phase (tahapan).",
          },
          question: {
            type: "string",
            description:
              "Pertanyaan klarifikasi yang jelas, spesifik untuk ide ini, dalam Bahasa Indonesia.",
          },
          hint: {
            type: "string",
            description:
              "Contoh jawaban atau panduan singkat untuk membantu pengguna menjawab.",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description:
              "3-5 pilihan jawaban yang paling umum/masuk akal untuk pertanyaan ini, spesifik untuk ide produk (mis. pilihan tech stack, model bisnis, platform). Pengguna bisa memilih salah satu atau mengisi jawaban sendiri lewat opsi 'Lainnya'. WAJIB diisi untuk setiap pertanyaan.",
          },
        },
        required: ["category", "question", "hint", "options"],
      },
    },
  },
  required: ["questions"],
};

const STRUCTURE_SCHEMA = {
  type: "object",
  properties: {
    features: {
      type: "array",
      description:
        "6-9 fitur/modul utama aplikasi ini. Setiap fitur dipecah menjadi sub-fitur konkret (layar/aksi/kemampuan di dalamnya). Urutkan dari fondasi ke lanjutan.",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Nama fitur/modul yang singkat, mis. 'Manajemen Siswa'.",
          },
          description: {
            type: "string",
            description: "Satu kalimat menjelaskan fungsi fitur ini.",
          },
          phase: {
            type: "number",
            description:
              "Fase pengerjaan: 1 (fondasi/MVP inti), 2 (penting), 3 (lanjutan/nice-to-have).",
          },
          subFeatures: {
            type: "array",
            items: { type: "string" },
            description:
              "2-5 sub-fitur konkret di dalam fitur ini (mis. 'Daftar Siswa', 'Form Tambah/Ubah Siswa').",
          },
        },
        required: ["name", "description", "phase", "subFeatures"],
      },
    },
  },
  required: ["features"],
};

// Langkah 1 (Struktur): pecah ide menjadi struktur fitur -> sub-fitur.
export const generateStructure = action({
  args: { projectId: v.id("projects") },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const data = await ctx.runQuery(api.prd.getProjectInternal, { projectId });
    if (!data || data.project.userId !== userId) {
      throw new Error("Project not found");
    }

    const idea: string = data.project.idea;
    const context: string | undefined = data.project.context;

    await ctx.runMutation(internal.prd.setProjectStatus, {
      projectId,
      status: "structuring",
    });

    const prompt = `Kamu adalah Product Manager & software architect senior. Berdasarkan ide produk di bawah, susun STRUKTUR FITUR aplikasi: daftar fitur/modul utama, dan untuk tiap fitur pecah menjadi sub-fitur konkret (layar, aksi, atau kemampuan di dalamnya).

Aturan:
- Buat 6-9 fitur utama yang benar-benar relevan untuk aplikasi ini (bukan generik).
- Tiap fitur punya 2-5 sub-fitur yang spesifik dan actionable.
- Tetapkan 'phase' tiap fitur: 1 = fondasi/MVP inti, 2 = penting, 3 = lanjutan.
- Selalu sertakan fitur autentikasi/keamanan bila produk butuh akun pengguna.
- Semua teks dalam Bahasa Indonesia yang natural.

=== IDE PRODUK ===
${idea}
${context ? `\n=== KONTEKS TAMBAHAN (dari pengguna) ===\n${context}` : ""}`;

    try {
      const res = await callTool<AiResult<any>>("ai_structured_output", {
        prompt,
        output_schema: STRUCTURE_SCHEMA,
        intelligence_level: "smart",
      });
      if (res.error || !res.result) {
        throw new Error(res.error || "AI tidak mengembalikan hasil");
      }
      const structure = (res.result.features || [])
        .filter((f: any) => f && f.name)
        .map((f: any) => ({
          name: String(f.name),
          description: f.description ? String(f.description) : undefined,
          phase:
            typeof f.phase === "number" && f.phase >= 1 && f.phase <= 3
              ? Math.round(f.phase)
              : 1,
          subFeatures: Array.isArray(f.subFeatures)
            ? f.subFeatures.map((s: any) => String(s)).filter(Boolean)
            : [],
        }));
      if (structure.length === 0) {
        throw new Error("AI tidak menghasilkan struktur fitur");
      }
      await ctx.runMutation(internal.prd.applyStructure, { projectId, structure });
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || String(e);
      await ctx.runMutation(internal.prd.markProjectError, {
        projectId,
        error: msg,
      });
      return { ok: false, error: msg };
    }
  },
});

// Buat pertanyaan klarifikasi SEBELUM menyusun PRD. AI menanyakan ke user
// kebutuhan, persiapan, dan fase/tahapan apa saja yang diperlukan.
export const generateQuestions = action({
  args: { projectId: v.id("projects") },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const data = await ctx.runQuery(api.prd.getProjectInternal, { projectId });
    if (!data || data.project.userId !== userId) {
      throw new Error("Project not found");
    }

    const idea: string = data.project.idea;
    const context: string | undefined = data.project.context;

    await ctx.runMutation(internal.prd.setProjectStatus, {
      projectId,
      status: "preparing",
    });

    const prompt = `Kamu adalah Product Manager senior. Sebelum menyusun PRD lengkap, kamu perlu menggali detail dari pengguna dengan mengajukan pertanyaan klarifikasi yang tajam.

Berdasarkan ide produk di bawah, buat daftar pertanyaan yang penting dijawab dulu supaya PRD-nya akurat dan siap dipakai AI coding agent. Bagi pertanyaan ke dalam 5 kategori:
- "requirement": kebutuhan & fitur inti, target pengguna, batasan (constraint), platform, alur utama, dll.
- "backend": arsitektur server, pilihan database & model data, desain API/endpoint, autentikasi & otorisasi, keamanan & privasi data, skalabilitas, background jobs/cron, integrasi pihak ketiga.
- "frontend": kerangka UI, halaman/screen utama, komponen penting, desain & branding (warna, tema, gaya), state management, responsif/mobile, aksesibilitas, real-time/interaktivitas.
- "preparation": persiapan yang dibutuhkan — tim/skill, budget, akun/API pihak ketiga, data awal, aset desain.
- "phase": tahapan/fase pengerjaan, prioritas MVP vs lanjutan, target waktu/timeline.

Pertanyaan harus SPESIFIK untuk ide ini (bukan generik), dalam Bahasa Indonesia, dan sertakan 'hint' berupa contoh jawaban singkat. Buat 12-18 pertanyaan total, minimal 2-3 per kategori (terutama pastikan backend dan frontend tergali dalam).

Untuk SETIAP pertanyaan, WAJIB sertakan 'options': 3-5 pilihan jawaban yang paling umum & masuk akal, spesifik untuk ide produk ini (mis. pilihan tech stack, database, model bisnis, platform, gaya desain). Pilihan harus konkret dan langsung bisa dipilih. Pengguna nanti bisa memilih salah satu atau mengetik jawaban sendiri lewat opsi "Lainnya", jadi JANGAN tambahkan opsi "Lainnya" ke dalam 'options'.

=== IDE PRODUK ===
${idea}
${context ? `\n=== KONTEKS TAMBAHAN (dari pengguna) ===\n${context}` : ""}`;

    try {
      const res = await callTool<AiResult<any>>("ai_structured_output", {
        prompt,
        output_schema: QUESTIONS_SCHEMA,
        intelligence_level: "smart",
      });
      if (res.error || !res.result) {
        throw new Error(res.error || "AI tidak mengembalikan hasil");
      }
      const valid = ["requirement", "backend", "frontend", "preparation", "phase"];
      const questions = (res.result.questions || [])
        .filter((q: any) => q && q.question && valid.includes(q.category))
        .map((q: any) => ({
          category: q.category,
          question: String(q.question),
          hint: q.hint ? String(q.hint) : undefined,
          options: Array.isArray(q.options)
            ? q.options
                .map((o: any) => String(o).trim())
                .filter((o: string) => o.length > 0)
                .slice(0, 6)
            : undefined,
        }));
      if (questions.length === 0) {
        throw new Error("AI tidak menghasilkan pertanyaan");
      }
      await ctx.runMutation(internal.prd.applyQuestions, { projectId, questions });
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || String(e);
      await ctx.runMutation(internal.prd.markProjectError, {
        projectId,
        error: msg,
      });
      return { ok: false, error: msg };
    }
  },
});

export const generatePrd = action({
  args: { projectId: v.id("projects") },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const data = await ctx.runQuery(api.prd.getProjectInternal, { projectId });
    if (!data || data.project.userId !== userId) {
      throw new Error("Project not found");
    }

    const idea: string = data.project.idea;
    const context: string | undefined = data.project.context;

    await ctx.runMutation(internal.prd.setProjectStatus, {
      projectId,
      status: "generating",
    });

    // Susun blok struktur fitur yang sudah disetujui (dari langkah Struktur)
    const structure: Array<{
      name: string;
      description?: string;
      phase?: number;
      subFeatures: string[];
    }> = data.project.structure || [];
    let structBlock = "";
    if (structure.length > 0) {
      const lines = structure.map((f) => {
        const subs =
          f.subFeatures && f.subFeatures.length
            ? f.subFeatures.map((s) => `    - ${s}`).join("\n")
            : "    - (belum ada sub-fitur)";
        return `- ${f.name}${f.phase ? ` [Fase ${f.phase}]` : ""}${f.description ? ` — ${f.description}` : ""}\n${subs}`;
      });
      structBlock = `\n=== STRUKTUR FITUR (sudah disetujui pengguna) ===\nGunakan struktur ini sebagai KERANGKA fitur PRD. Setiap fitur di bawah harus menjadi satu fitur di PRD (pertahankan nama & urutan), dan spec + task-nya WAJIB mencakup semua sub-fitur yang tercantum. Tetapkan priority mengikuti fase (Fase 1 → P0, Fase 2 → P1, Fase 3 → P2).\n${lines.join("\n")}`;
    }

    // Susun blok tanya-jawab klarifikasi (dari generateQuestions + submitAnswers)
    const questions: Array<{ category: string; question: string }> =
      data.project.questions || [];
    const answers: string[] = data.project.answers || [];
    let qaBlock = "";
    if (questions.length > 0) {
      const answeredCount = answers.filter((a) => (a || "").trim()).length;
      const lines = questions.map((q, i) => {
        const a = (answers[i] || "").trim();
        return `- (${q.category}) ${q.question}\n  Jawaban: ${a || "(TIDAK DIJAWAB — tentukan sendiri default terbaiknya)"}`;
      });
      const guidance =
        answeredCount === 0
          ? `Pengguna TIDAK mengisi satu pun jawaban. JANGAN gagal atau mengosongkan bagian apa pun. Sebagai Product Manager & tech lead senior, tentukan sendiri default/asumsi yang paling masuk akal untuk SETIAP pertanyaan berdasarkan ide produk & konteks, lalu susun PRD lengkap seolah-olah jawaban itu berasal dari praktik terbaik industri. Cantumkan asumsi yang kamu buat.`
          : `Gunakan jawaban ini sebagai sumber kebenaran utama saat menyusun PRD. Untuk pertanyaan yang TIDAK DIJAWAB, JANGAN dikosongkan — tentukan sendiri default/asumsi terbaik berdasarkan ide produk & jawaban lain, lalu sebutkan asumsimu.`;
      qaBlock = `\n=== TANYA-JAWAB KLARIFIKASI (dari pengguna) ===\n${guidance}\n${lines.join("\n")}`;
    }

    const baseContext = `=== IDE PRODUK ===
${idea}
${context ? `\n=== KONTEKS TAMBAHAN (dari pengguna) ===\n${context}` : ""}${structBlock}${qaBlock}`;

    // Kita membuat PRD dalam DUA tahap agar setiap request ke AI kecil & cepat
    // (menghindari timeout gateway provider yang ~100 detik untuk output panjang):
    //   Tahap 1: kerangka PRD + daftar fitur (ringkas, tanpa spec/tasks).
    //   Tahap 2: untuk tiap fitur, buat spec markdown + task secara paralel.
    try {
      // --- Tahap 1: kerangka PRD ---
      const overviewPrompt = `Kamu adalah Product Manager senior sekaligus tech lead. Susun KERANGKA PRD (Product Requirements Document) untuk produk berikut.

Berpikirlah kritis: pilih scope MVP yang realistis, hormati kebutuhan & batasan pengguna, dan tentukan daftar fitur inti (4-7 fitur) beserta prioritasnya. JANGAN tulis spec detail atau task di tahap ini — cukup nama, deskripsi singkat, dan prioritas tiap fitur. Isi juga ringkasan, masalah, target pengguna, goals, non-goals, tech stack, dan metrik.

Tulis SEMUA output dalam Bahasa Indonesia yang natural dan profesional. Urutkan fitur mengikuti tahapan/fase yang diinginkan pengguna jika ada.

${baseContext}`;

      const overviewRes = await callTool<AiResult<any>>(
        "ai_structured_output",
        {
          prompt: overviewPrompt,
          output_schema: PRD_OVERVIEW_SCHEMA,
          intelligence_level: "smart",
          max_tokens: 2000,
        },
      );
      if (overviewRes.error || !overviewRes.result) {
        throw new Error(overviewRes.error || "AI tidak mengembalikan hasil");
      }
      const overview = overviewRes.result;

      const baseFeatures: Array<{
        name: string;
        description: string;
        priority: "P0" | "P1" | "P2";
      }> = (overview.features || [])
        .filter((f: any) => f && f.name)
        .map((f: any) => ({
          name: String(f.name || "Fitur"),
          description: String(f.description || ""),
          priority: (["P0", "P1", "P2"].includes(f.priority)
            ? f.priority
            : "P1") as "P0" | "P1" | "P2",
        }));

      if (baseFeatures.length === 0) {
        throw new Error("AI tidak menghasilkan daftar fitur");
      }

      const featureListBlock = baseFeatures
        .map((f, i) => `${i + 1}. ${f.name} (${f.priority}) — ${f.description}`)
        .join("\n");

      // --- Tahap 2: detail tiap fitur (sequensial untuk mencegah overload server AI) ---
      const detailResults: { spec: string; tasks: string[] }[] = [];
      for (const f of baseFeatures) {
        const detailPrompt = `Kamu adalah Product Manager senior sekaligus tech lead. Kamu sedang menyusun PRD dan sekarang fokus MENDETAILKAN SATU fitur saja agar LANGSUNG SIAP DIPAKAI AI coding agent (Cursor, Claude Code, dll).

FITUR YANG DIDETAILKAN: "${f.name}" (prioritas ${f.priority})
Deskripsi: ${f.description}

Konteks produk & daftar fitur lain (untuk keselarasan, JANGAN detailkan yang lain):
${featureListBlock}

${baseContext}

Tugas: tulis 'spec' fitur ini dalam Markdown yang detail (deskripsi, user story, acceptance criteria sebagai checklist '- [ ]', dan catatan teknis, pakai heading '###'), lalu 'tasks' berupa 5-10 task teknis konkret & berurutan yang bisa langsung dikerjakan. Semua dalam Bahasa Indonesia.`;

        const dRes = await callTool<AiResult<any>>("ai_structured_output", {
          prompt: detailPrompt,
          output_schema: FEATURE_DETAIL_SCHEMA,
          intelligence_level: "smart",
          max_tokens: 2500,
        });

        if (dRes.error || !dRes.result) {
          detailResults.push({
            spec: `### ${f.name}\n\n${f.description}\n\n_(Detail spesifikasi gagal dibuat otomatis: ${dRes.error || "tidak ada hasil"}. Silakan regenerasi atau lengkapi lewat chat.)_`,
            tasks: [] as string[],
          });
        } else {
          detailResults.push({
            spec: String(dRes.result.spec || ""),
            tasks: Array.isArray(dRes.result.tasks)
              ? dRes.result.tasks.map((t: any) => String(t)).filter(Boolean)
              : [],
          });
        }
      }

      const features = baseFeatures.map((f, i) => ({
        name: f.name,
        description: f.description,
        priority: f.priority,
        spec: detailResults[i].spec,
        tasks: detailResults[i].tasks,
      }));

      await ctx.runMutation(internal.prd.applyGeneratedPrd, {
        projectId,
        title: (overview.title || data.project.title).slice(0, 80),
        summary: overview.summary || "",
        problem: overview.problem || "",
        targetUsers: overview.targetUsers || "",
        goals: overview.goals || [],
        nonGoals: overview.nonGoals || [],
        techStack: overview.techStack || [],
        metrics: overview.metrics || [],
        features,
      });
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || String(e);
      await ctx.runMutation(internal.prd.markProjectError, {
        projectId,
        error: msg,
      });
      return { ok: false, error: msg };
    }
  },
});

const CHAT_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "Balasan untuk pengguna dalam Bahasa Indonesia. Jelaskan apa yang kamu ubah atau jawab pertanyaannya.",
    },
    updatePrd: {
      type: "boolean",
      description:
        "true jika pengguna meminta perubahan pada PRD dan kamu menghasilkan PRD baru yang diperbarui; false jika hanya menjawab/memberi saran.",
    },
    prd: {
      type: ["object", "null"],
      description:
        "Jika updatePrd true, isi dengan PRD LENGKAP yang sudah diperbarui (semua field & fitur). Jika false, null.",
      properties: PRD_SCHEMA.properties,
    },
  },
  required: ["reply", "updatePrd"],
};

export const chat = action({
  args: { projectId: v.id("projects"), message: v.string() },
  returns: v.object({ reply: v.string(), updated: v.boolean() }),
  handler: async (ctx, { projectId, message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const data = await ctx.runQuery(api.prd.getProjectInternal, { projectId });
    if (!data || data.project.userId !== userId) {
      throw new Error("Project not found");
    }

    await ctx.runMutation(internal.prd.addMessage, {
      projectId,
      userId: userId as Id<"users">,
      role: "user",
      content: message,
    });

    const p = data.project;
    const currentPrd = {
      title: p.title,
      summary: p.summary,
      problem: p.problem,
      targetUsers: p.targetUsers,
      goals: p.goals,
      nonGoals: p.nonGoals,
      techStack: p.techStack,
      metrics: p.metrics,
      features: data.features.map((f: any) => ({
        name: f.name,
        description: f.description,
        priority: f.priority,
        spec: f.spec,
        tasks: f.tasks,
      })),
    };

    const prompt = `Kamu adalah asisten Product Manager yang membantu pengguna menyempurnakan PRD mereka untuk AI coding. Berikut PRD saat ini (JSON):

${JSON.stringify(currentPrd, null, 2)}

${p.context ? `Konteks tambahan dari pengguna:\n${p.context}\n` : ""}
Pesan/permintaan pengguna:
"${message}"

Jika pengguna meminta perubahan (menambah/menghapus/mengubah fitur, mengubah scope, memperbaiki spec/task, dll), set updatePrd=true dan kembalikan PRD LENGKAP yang sudah diperbarui di field 'prd' (pertahankan bagian yang tidak diubah). Jika hanya bertanya atau minta saran, set updatePrd=false dan prd=null. Selalu balas dalam Bahasa Indonesia. Field 'spec' tetap dalam Markdown.`;

    try {
      const res = await callTool<AiResult<any>>("ai_structured_output", {
        prompt,
        output_schema: CHAT_SCHEMA,
        intelligence_level: "smart",
      });
      if (res.error || !res.result) {
        throw new Error(res.error || "AI tidak mengembalikan hasil");
      }
      const out = res.result;
      const reply: string = out.reply || "Selesai.";
      let updated = false;

      if (out.updatePrd && out.prd) {
        const prd = out.prd;
        await ctx.runMutation(internal.prd.applyGeneratedPrd, {
          projectId,
          title: (prd.title || p.title).slice(0, 80),
          summary: prd.summary || p.summary || "",
          problem: prd.problem || p.problem || "",
          targetUsers: prd.targetUsers || p.targetUsers || "",
          goals: prd.goals || p.goals || [],
          nonGoals: prd.nonGoals || p.nonGoals || [],
          techStack: prd.techStack || p.techStack || [],
          metrics: prd.metrics || p.metrics || [],
          features: (prd.features || []).map((f: any) => ({
            name: f.name || "Fitur",
            description: f.description || "",
            spec: f.spec || "",
            tasks: Array.isArray(f.tasks) ? f.tasks : [],
            priority: ["P0", "P1", "P2"].includes(f.priority) ? f.priority : "P1",
          })),
        });
        updated = true;
      }

      await ctx.runMutation(internal.prd.addMessage, {
        projectId,
        userId: userId as Id<"users">,
        role: "assistant",
        content: reply,
      });

      return { reply, updated };
    } catch (e: any) {
      const msg = e?.message || String(e);
      await ctx.runMutation(internal.prd.addMessage, {
        projectId,
        userId: userId as Id<"users">,
        role: "assistant",
        content: `Maaf, terjadi kesalahan: ${msg}`,
      });
      return { reply: `Maaf, terjadi kesalahan: ${msg}`, updated: false };
    }
  },
});

const SIMPLE_PLAN_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "Judul script / project plan sederhana yang ringkas dan jelas (maks 60 karakter).",
    },
    summary: {
      type: "string",
      description:
        "Ringkasan singkat 2-3 kalimat mengenai tujuan dan alur script/project ini.",
    },
    techStack: {
      type: "array",
      items: { type: "string" },
      description:
        "Daftar bahasa pemrograman, library, atau tools yang dibutuhkan (misal: Python, requests, BeautifulSoup, atau Node.js, Express, dotenv).",
    },
    steps: {
      type: "array",
      description:
        "3-6 langkah eksekusi utama yang terstruktur, berurutan, dan langsung ke sasaran.",
      items: {
        type: "object",
        properties: {
          stepNumber: {
            type: "number",
            description: "Nomor urut langkah (1, 2, 3, dst).",
          },
          title: {
            type: "string",
            description: "Judul langkah yang singkat.",
          },
          description: {
            type: "string",
            description:
              "Penjelasan detail apa yang dilakukan di langkah ini.",
          },
          codeSnippet: {
            type: "string",
            description:
              "Contoh potongan kode ringkas / fungsi utama untuk langkah ini (opsional).",
          },
        },
        required: ["stepNumber", "title", "description"],
      },
    },
    fullScriptSkeleton: {
      type: "string",
      description:
        "Kode/script lengkap skeleton (template dasar) yang dapat langsung dicopy dan dijalankan oleh pengguna atau AI agent.",
    },
    aiPrompt: {
      type: "string",
      description:
        "Prompt instruksi ringkas dan efisien untuk diberikan ke AI coding agent (Cursor / Claude Code / Copilot) agar dapat mengimplementasikan seluruh script dalam 1 perintah.",
    },
  },
  required: [
    "title",
    "summary",
    "techStack",
    "steps",
    "fullScriptSkeleton",
    "aiPrompt",
  ],
};

export const generateSimplePlan = action({
  args: { projectId: v.id("projects") },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const data = await ctx.runQuery(api.prd.getProjectInternal, { projectId });
    if (!data || data.project.userId !== userId) {
      throw new Error("Project not found");
    }

    const idea: string = data.project.idea;
    const context: string | undefined = data.project.context;

    await ctx.runMutation(internal.prd.setProjectStatus, {
      projectId,
      status: "generating",
    });

    const prompt = `Kamu adalah software engineer & prompt architect senior. Tugasmu adalah menyusun PLAN PROJECT / SCRIPT SEDERHANA (Lightweight Plan) berdasarkan permintaan ide di bawah.

PRINSIP UTAMA:
- HINDARI format PRD enterprise yang terlalu panjang/bertele-tele.
- Buat plan yang RINGKAS, PRAKTIS, dan SIAP DIEKSEKUSI langsung.
- Pecah menjadi 3-6 langkah eksekusi yang jelas.
- Berikan template/skeleton kode lengkap yang bersih dan rapi.
- Sertakan prompt siap pakai untuk AI Coding Agent (Cursor, Claude Code, Copilot, dll).
- Semua penjelasan dalam Bahasa Indonesia yang profesional dan to-the-point.

=== IDE PROJECT / SCRIPT ===
${idea}
${context ? `\n=== KONTEKS TAMBAHAN ===\n${context}` : ""}`;

    try {
      const res = await callTool<AiResult<any>>("ai_structured_output", {
        prompt,
        output_schema: SIMPLE_PLAN_SCHEMA,
        intelligence_level: "smart",
      });
      if (res.error || !res.result) {
        throw new Error(res.error || "AI tidak mengembalikan hasil");
      }

      const raw = res.result;
      const simplePlan = {
        title: String(raw.title || data.project.title).slice(0, 80),
        summary: String(raw.summary || ""),
        techStack: Array.isArray(raw.techStack)
          ? raw.techStack.map((t: any) => String(t))
          : [],
        steps: Array.isArray(raw.steps)
          ? raw.steps.map((s: any, idx: number) => ({
              stepNumber:
                typeof s.stepNumber === "number" ? s.stepNumber : idx + 1,
              title: String(s.title || `Langkah ${idx + 1}`),
              description: String(s.description || ""),
              codeSnippet: s.codeSnippet ? String(s.codeSnippet) : undefined,
            }))
          : [],
        fullScriptSkeleton: raw.fullScriptSkeleton
          ? String(raw.fullScriptSkeleton)
          : undefined,
        aiPrompt: String(raw.aiPrompt || ""),
      };

      await ctx.runMutation(internal.prd.applySimplePlan, {
        projectId,
        simplePlan,
      });
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || String(e);
      await ctx.runMutation(internal.prd.markProjectError, {
        projectId,
        error: msg,
      });
      return { ok: false, error: msg };
    }
  },
});

export const MODEL_INFO = MODEL_LABEL;
