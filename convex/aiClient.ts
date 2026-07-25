/**
 * Klien AI custom — memanggil provider AI (OpenAI-compatible) SECARA LANGSUNG,
 * tanpa lewat gateway AI Viktor.
 *
 * Fungsi `callTool` di sini punya signature yang SAMA persis dengan yang ada di
 * `viktorClient.ts`, jadi bisa dipakai sebagai pengganti tanpa mengubah kode
 * pemanggil di `prdActions.ts`. Yang didukung hanya role "ai_structured_output".
 *
 * Konfigurasi lewat environment variable:
 *   AI_API_KEY   -> API key provider (WAJIB), mis. key OpenAI.
 *   AI_BASE_URL  -> base URL API (opsional), default "https://api.openai.com/v1".
 *                   Bisa diarahkan ke provider lain yang OpenAI-compatible
 *                   (mis. OpenRouter, Groq, Together, Azure, dll).
 *   AI_MODEL     -> nama model (opsional), default "gpt-4o".
 */
declare const process: { env: Record<string, string | undefined> };

const AI_API_KEY = process.env.AI_API_KEY;
const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o";

type StructuredArgs = {
  prompt: string;
  output_schema: Record<string, unknown>;
  // Dipertahankan agar kompatibel dengan pemanggil lama; diabaikan di sini
  // karena model ditentukan lewat env AI_MODEL.
  intelligence_level?: string;
  // Batas token output (opsional). Berguna untuk membatasi ukuran respons per
  // panggilan agar tidak melebihi timeout gateway provider.
  max_tokens?: number;
};

// Bentuk hasil yang diharapkan pemanggil: { result, error }.
type AiResult<T> = { result: T | null; error: string | null };

/**
 * Pengganti drop-in untuk callTool dari viktorClient.
 * Hanya mendukung role "ai_structured_output".
 */
export async function callTool<T>(
  role: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (role !== "ai_structured_output") {
    throw new Error(
      `aiClient hanya mendukung role "ai_structured_output", bukan "${role}"`,
    );
  }
  return (await aiStructuredOutput(args as StructuredArgs)) as T;
}

/**
 * Panggil model AI dan minta output JSON yang sesuai output_schema.
 * Memakai endpoint Chat Completions (OpenAI-compatible) dengan mode JSON.
 */
async function aiStructuredOutput(
  args: StructuredArgs,
): Promise<AiResult<unknown>> {
  if (!AI_API_KEY) {
    return { result: null, error: "AI_API_KEY belum di-set di environment" };
  }

  const { prompt, output_schema, max_tokens } = args;

  // Sisipkan skema ke dalam prompt supaya model tahu bentuk JSON yang diminta.
  const systemMsg =
    "Kamu adalah asisten yang SELALU membalas dengan JSON valid sesuai skema " +
    "yang diberikan. Jangan tambahkan teks, penjelasan, atau markdown fence " +
    "di luar JSON.";
  const userMsg =
    `${prompt}\n\n` +
    "Balas HANYA dengan satu objek JSON valid yang mengikuti JSON Schema " +
    `berikut (tanpa teks lain di luar JSON):\n${JSON.stringify(output_schema)}`;

  // Provider AI kadang lambat/overload dan mengembalikan timeout (mis. 524 dari
  // Cloudflare) atau memutus koneksi. Coba ulang beberapa kali dengan backoff
  // supaya kegagalan sementara tidak langsung menggagalkan pembuatan PRD.
  const MAX_ATTEMPTS = 3;
  // Batas waktu per percobaan (ms). Sedikit di bawah batas aksi Convex.
  const PER_ATTEMPT_TIMEOUT_MS = 110_000;
  let lastError = "Gagal memanggil AI";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);
    try {
      const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          // Paksa output berupa objek JSON.
          response_format: { type: "json_object" },
          temperature: 0.7,
          ...(typeof max_tokens === "number" ? { max_tokens } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        // Ringkas pesan error HTML panjang (mis. halaman error Cloudflare).
        const brief = summarizeHttpError(response.status, text);
        // 429 (rate limit) & 5xx (server/timeout) layak dicoba ulang.
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < MAX_ATTEMPTS
        ) {
          lastError = brief;
          await sleep(backoffMs(attempt));
          continue;
        }
        return { result: null, error: brief };
      }

      const rawText = await response.text();
      let cleanText = rawText.trim();
      if (cleanText.includes("data: [DONE]")) {
        cleanText = cleanText.split("data: [DONE]")[0].trim();
      }

      const json = safeParseJson(cleanText) as
        | { choices?: { message?: { content?: string } }[] }
        | undefined;

      const content = json?.choices?.[0]?.message?.content;
      if (!content) {
        return { result: null, error: "Respons AI kosong" };
      }

      // Parse konten JSON dari model.
      const parsed = safeParseJson(content);
      if (parsed === undefined) {
        return {
          result: null,
          error: "Gagal mem-parsing JSON dari respons AI",
        };
      }
      return { result: parsed, error: null };
    } catch (e: unknown) {
      const aborted = e instanceof Error && e.name === "AbortError";
      lastError = aborted
        ? `Timeout: AI tidak merespons dalam ${Math.round(PER_ATTEMPT_TIMEOUT_MS / 1000)}s`
        : e instanceof Error
          ? e.message
          : String(e);
      // Error jaringan/timeout: coba ulang jika masih ada kesempatan.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return { result: null, error: lastError };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { result: null, error: lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Backoff bertahap: ~1s, 2s, 4s (+ sedikit jitter).
function backoffMs(attempt: number): number {
  return 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
}

// Buat pesan error HTTP yang ringkas & mudah dibaca; hindari membocorkan
// seluruh halaman HTML error (mis. Cloudflare 524).
function summarizeHttpError(status: number, body: string): string {
  const known: Record<number, string> = {
    429: "Terlalu banyak permintaan ke AI (rate limit). Coba lagi sebentar.",
    500: "Server AI bermasalah (500).",
    502: "Gateway AI bermasalah (502).",
    503: "Layanan AI sedang tidak tersedia (503).",
    504: "Gateway AI timeout (504).",
    524: "AI timeout — model terlalu lama merespons (524). Coba lagi atau pakai model yang lebih cepat.",
  };
  if (known[status]) return known[status];
  // Kalau body berupa HTML, jangan tampilkan mentah-mentah.
  const looksHtml = /<html|<!doctype/i.test(body);
  const snippet = looksHtml ? "" : `: ${body.slice(0, 200)}`;
  return `HTTP ${status}${snippet}`;
}

/**
 * Parse JSON dengan aman. Kalau model sempat membungkus dengan ```json ... ```,
 * fence-nya dilepas dulu.
 */
function safeParseJson(raw: string): unknown {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    // Coba ambil objek JSON pertama di dalam teks sebagai fallback.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
