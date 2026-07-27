import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  Download,
  FileCode,
  FileText,
  GitBranch,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Network,
  Palette,
  PencilRuler,
  RefreshCw,
  Rocket,
  Send,
  Server,
  Sparkles,
  StickyNote,
  Target,
  Terminal,
  Trash2,
  TriangleAlert,
  Wand2,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";
import {
  StructureMap,
  type StructureFeature,
} from "@/components/StructureMap";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// ---------- helper ----------

function copyText(text: string, label = "Disalin ke clipboard") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Gagal menyalin"),
  );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "prd"
  );
}

// biome-ignore lint/suspicious/noExplicitAny: convex docs are dynamic here
function prdToMarkdown(project: any, features: any[]): string {
  const lines: string[] = [];
  lines.push(`# PRD: ${project.title}`, "");
  if (project.summary) lines.push("## Ringkasan", project.summary, "");
  if (project.problem) lines.push("## Masalah", project.problem, "");
  if (project.targetUsers)
    lines.push("## Target Pengguna", project.targetUsers, "");
  if (project.goals?.length) {
    lines.push("## Goals");
    for (const g of project.goals) lines.push(`- ${g}`);
    lines.push("");
  }
  if (project.nonGoals?.length) {
    lines.push("## Non-Goals");
    for (const g of project.nonGoals) lines.push(`- ${g}`);
    lines.push("");
  }
  if (project.techStack?.length) {
    lines.push("## Tech Stack");
    for (const t of project.techStack) lines.push(`- ${t}`);
    lines.push("");
  }
  if (project.metrics?.length) {
    lines.push("## Metrik Keberhasilan");
    for (const m of project.metrics) lines.push(`- ${m}`);
    lines.push("");
  }
  lines.push("## Fitur", "");
  features.forEach((f, idx) => {
    lines.push(`### ${idx + 1}. ${f.name} \`[${f.priority}]\``, "");
    if (f.description) lines.push(f.description, "");
    if (f.spec) lines.push(f.spec, "");
    if (f.tasks?.length) {
      lines.push("**Tasks:**");
      for (const t of f.tasks) lines.push(`- [ ] ${t}`);
      lines.push("");
    }
  });
  return lines.join("\n");
}

// biome-ignore lint/suspicious/noExplicitAny: convex doc
function featureToMarkdown(f: any, idx: number): string {
  const lines: string[] = [`## ${idx + 1}. ${f.name} [${f.priority}]`, ""];
  if (f.description) lines.push(f.description, "");
  if (f.spec) lines.push(f.spec, "");
  if (f.tasks?.length) {
    lines.push("### Tasks");
    for (const t of f.tasks) lines.push(`- [ ] ${t}`);
  }
  return lines.join("\n");
}

// biome-ignore lint/suspicious/noExplicitAny: convex doc
function simplePlanToMarkdown(project: any): string {
  const plan = project.simplePlan;
  if (!plan) return "";
  const lines: string[] = [];
  lines.push(`# Plan Project / Script Sederhana: ${plan.title || project.title}`, "");
  if (plan.summary) lines.push("## Ringkasan", plan.summary, "");
  if (plan.techStack?.length) {
    lines.push("## Tech Stack / Tools");
    for (const t of plan.techStack) lines.push(`- ${t}`);
    lines.push("");
  }
  if (plan.steps?.length) {
    lines.push("## Alur Langkah Eksekusi", "");
    for (const s of plan.steps) {
      lines.push(`### Langkah ${s.stepNumber || 1}: ${s.title}`);
      lines.push(s.description, "");
      if (s.codeSnippet) {
        lines.push("```python", s.codeSnippet, "```", "");
      }
    }
  }
  if (plan.fullScriptSkeleton) {
    lines.push("## Script Skeleton / Template Code", "");
    lines.push("```python", plan.fullScriptSkeleton, "```", "");
  }
  if (plan.aiPrompt) {
    lines.push("## Prompt untuk AI Coding Agent", "");
    lines.push("```text", plan.aiPrompt, "```", "");
  }
  return lines.join("\n");
}

const PRIORITY_STYLES: Record<string, string> = {
  P0: "bg-destructive/15 text-destructive border-destructive/30",
  P1: "bg-primary/15 text-primary border-primary/30",
  P2: "bg-muted text-muted-foreground border-border",
};

function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        copyText(text, `${label} disalin`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <Check className="size-3.5 text-primary" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {label}
    </Button>
  );
}

// ---------- tab ringkasan ----------

function ListCard({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items?: string[];
}) {
  if (!items?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: convex docs
function OverviewTab({ project }: { project: any }) {
  return (
    <div className="space-y-4">
      {project.summary && (
        <div className="rounded-xl border border-primary/20 bg-card p-5">
          <h3 className="mb-2 font-heading text-sm font-semibold text-primary">
            Ringkasan
          </h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            {project.summary}
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {project.problem && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-2 font-heading text-sm font-semibold">Masalah</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {project.problem}
            </p>
          </div>
        )}
        {project.targetUsers && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-2 font-heading text-sm font-semibold">
              Target Pengguna
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {project.targetUsers}
            </p>
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListCard icon={Target} title="Goals" items={project.goals} />
        <ListCard icon={Target} title="Non-Goals" items={project.nonGoals} />
        <ListCard
          icon={LayoutGrid}
          title="Tech Stack"
          items={project.techStack}
        />
        <ListCard
          icon={Sparkles}
          title="Metrik Keberhasilan"
          items={project.metrics}
        />
      </div>
    </div>
  );
}

// ---------- tab fitur ----------

// biome-ignore lint/suspicious/noExplicitAny: convex docs
function FeaturesTab({ features }: { features: any[] }) {
  const [active, setActive] = useState(0);
  if (!features.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada fitur.
      </p>
    );
  }
  const f = features[active];
  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      {/* daftar fitur */}
      <div className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
        {features.map((feat, i) => (
          <button
            type="button"
            key={feat._id}
            onClick={() => setActive(i)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors md:shrink ${
              i === active
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <span className="font-mono text-xs opacity-60">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="truncate font-medium">{feat.name}</span>
          </button>
        ))}
      </div>

      {/* detail fitur */}
      <div className="min-w-0 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg font-semibold">{f.name}</h3>
              <span
                className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                  PRIORITY_STYLES[f.priority] || PRIORITY_STYLES.P1
                }`}
              >
                {f.priority}
              </span>
            </div>
            {f.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {f.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <CopyButton
              text={featureToMarkdown(f, active)}
              label="Copy fitur"
            />
          </div>
        </div>

        {f.spec && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Spec
              </span>
              <CopyButton text={f.spec} label="Copy spec" />
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <Markdown content={f.spec} />
            </div>
          </div>
        )}

        {f.tasks?.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Tasks ({f.tasks.length})
              </span>
              <CopyButton
                text={f.tasks.map((t: string) => `- [ ] ${t}`).join("\n")}
                label="Copy tasks"
              />
            </div>
            <ul className="space-y-1.5">
              {f.tasks.map((t: string, i: number) => (
                <li
                  key={`${t}-${i}`}
                  className="flex items-start gap-2.5 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm"
                >
                  <span className="mt-0.5 font-mono text-xs text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- tab plan sederhana ----------

function SimplePlanTab({
  project,
  onGenerateSimplePlan,
  generating,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: convex doc
  project: any;
  onGenerateSimplePlan: () => Promise<void>;
  generating: boolean;
}) {
  const plan = project.simplePlan;

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10">
          <Zap className="size-6 text-primary" />
        </div>
        <h3 className="font-heading text-lg font-semibold">
          Belum ada Plan Project / Script Sederhana
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          Buat plan ringkas 1 halaman yang berfokus pada alur eksekusi, skeleton script code, dan prompt AI tanpa dokumen PRD bertele-tele.
        </p>
        <Button
          onClick={onGenerateSimplePlan}
          disabled={generating}
          className="mt-5 h-10 px-5 font-medium"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Menyusun Plan…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Generate Plan Sederhana
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview & Action Header */}
      <div className="rounded-xl border border-primary/20 bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <h2 className="font-heading text-lg font-bold">
                {plan.title || project.title}
              </h2>
            </div>
            {plan.summary && (
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                {plan.summary}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              text={simplePlanToMarkdown(project)}
              label="Salin Plan Markdown"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  `${slugify(plan.title || project.title)}-plan.md`,
                  simplePlanToMarkdown(project),
                )
              }
            >
              <Download className="size-3.5" /> Download (.md)
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={generating}
              onClick={onGenerateSimplePlan}
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Regenerasi
            </Button>
          </div>
        </div>

        {/* Tech Stack Pills */}
        {plan.techStack?.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Tech Stack:
            </span>
            {plan.techStack.map((tech: string) => (
              <span
                key={tech}
                className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-medium text-primary"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Execution Steps */}
      {plan.steps?.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-heading text-md flex items-center gap-2 font-semibold">
            <Terminal className="size-4 text-primary" />
            Alur Langkah Eksekusi ({plan.steps.length} Step)
          </h3>
          <div className="grid gap-4">
            {plan.steps.map((s: any, idx: number) => (
              <div
                key={s.stepNumber || idx}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
                      0{s.stepNumber || idx + 1}
                    </span>
                    <h4 className="font-heading text-base font-semibold">
                      {s.title}
                    </h4>
                  </div>
                  {s.codeSnippet && (
                    <CopyButton text={s.codeSnippet} label="Salin Kode" />
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
                {s.codeSnippet && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-xs text-foreground">
                    <pre>{s.codeSnippet}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Script Skeleton Code */}
      {plan.fullScriptSkeleton && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="size-4 text-primary" />
              <h3 className="font-heading text-md font-semibold">
                Script Skeleton / Template Code
              </h3>
            </div>
            <CopyButton
              text={plan.fullScriptSkeleton}
              label="Salin Kode Template"
            />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Template kode dasar ini dapat langsung kamu gunakan sebagai titik awal file script milikmu.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-background/90 p-4 font-mono text-xs text-foreground leading-relaxed">
            <pre>{plan.fullScriptSkeleton}</pre>
          </div>
        </div>
      )}

      {/* Prompt AI Coding Agent */}
      {plan.aiPrompt && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="font-heading text-md font-semibold text-foreground">
                Prompt Eksekusi untuk AI Coding Agent
              </h3>
            </div>
            <CopyButton text={plan.aiPrompt} label="Salin Prompt AI" />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Copy prompt ini langsung ke **Cursor**, **Claude Code**, atau **GitHub Copilot** agar agent menyelesaikan seluruh script secara otomatis!
          </p>
          <div className="rounded-lg border border-primary/20 bg-background/80 p-3.5 font-mono text-xs text-foreground/90 whitespace-pre-wrap">
            {plan.aiPrompt}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- tab konteks ----------

function ContextTab({
  projectId,
  initial,
}: {
  projectId: Id<"projects">;
  initial: string;
}) {
  const update = useMutation(api.prd.updateContext);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <StickyNote className="size-4 text-primary" />
        <h3 className="font-heading text-sm font-semibold">Konteks</h3>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Catatan ini dibaca asisten saat menyusun & merevisi PRD lewat chat.
        Tambahkan batasan, referensi, atau detail penting.
      </p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tulis catatan bebas… (misal: harus support bahasa Indonesia, budget hosting kecil, integrasi dengan Midtrans, dll)"
        className="min-h-[220px] resize-y text-sm"
      />
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={saving || value === initial}
          onClick={async () => {
            setSaving(true);
            try {
              await update({ projectId, context: value });
              toast.success("Konteks disimpan");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Simpan konteks
        </Button>
      </div>
    </div>
  );
}

// ---------- tab chat ----------

function ChatTab({
  projectId,
  // biome-ignore lint/suspicious/noExplicitAny: convex docs
  messages,
}: {
  projectId: Id<"projects">;
  messages: any[];
}) {
  const chat = useAction(api.prdActions.chat);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new msg
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    try {
      const res = await chat({ projectId, message: msg });
      if (res.updated) toast.success("PRD diperbarui");
    } catch {
      toast.error("Gagal mengirim pesan");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[60vh] flex-col rounded-xl border border-border bg-card">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare className="size-5 text-primary" />
            </div>
            <p className="font-medium">Tanya atau minta revisi</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Contoh: "Tambah fitur notifikasi push", "Bikin task fitur login
              lebih detail", atau "Ganti tech stack ke Next.js".
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m._id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background/60"
              }`}
            >
              {m.role === "assistant" ? (
                <Markdown content={m.content} />
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/60 px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Berpikir…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya atau minta revisi…"
            className="max-h-32 min-h-[44px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button
            onClick={send}
            disabled={sending || !input.trim()}
            className="h-11 shrink-0"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- pertanyaan klarifikasi ----------

const CATEGORY_META: Record<
  string,
  {
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  requirement: {
    label: "Kebutuhan",
    desc: "Fitur inti, target pengguna & batasan produk",
    icon: ClipboardList,
  },
  backend: {
    label: "Backend",
    desc: "Server, database, API, auth, keamanan & integrasi",
    icon: Server,
  },
  frontend: {
    label: "Frontend",
    desc: "UI/UX, halaman, komponen, desain & responsif",
    icon: Palette,
  },
  preparation: {
    label: "Persiapan",
    desc: "Tim, budget, akun/API & data",
    icon: Rocket,
  },
  phase: {
    label: "Tahapan",
    desc: "Fase pengerjaan, prioritas & timeline",
    icon: GitBranch,
  },
};

const CATEGORY_ORDER = [
  "requirement",
  "backend",
  "frontend",
  "preparation",
  "phase",
] as const;

function PreparingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <ClipboardList className="size-7 animate-pulse text-primary" />
        </div>
      </div>
      <h2 className="font-heading text-xl font-semibold">
        Menyiapkan pertanyaan…
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        AI sedang menganalisis idemu dan menyiapkan pertanyaan klarifikasi soal
        kebutuhan, persiapan, dan tahapan pengerjaan.
      </p>
    </div>
  );
}

const OTHER_VALUE = "__other__";

function QuestionsForm({
  // biome-ignore lint/suspicious/noExplicitAny: convex docs
  questions,
  onSubmit,
  submitting,
}: {
  questions: any[];
  onSubmit: (answers: string[]) => Promise<void>;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => ""),
  );
  // untuk pertanyaan pilihan ganda: menandai baris yang memilih "Lainnya"
  const [otherMode, setOtherMode] = useState<boolean[]>(() =>
    questions.map(() => false),
  );

  const answeredCount = answers.filter((a) => a.trim()).length;

  const setAnswerAt = (idx: number, value: string) =>
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });

  const setOtherAt = (idx: number, value: boolean) =>
    setOtherMode((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="w-full space-y-6">
      <div className="rounded-xl border border-primary/20 bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="font-heading text-lg font-semibold">
            Beberapa pertanyaan dulu
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sebelum menyusun PRD, pilih jawaban yang paling sesuai atau isi
          sendiri lewat opsi "Lainnya". Boleh dikosongkan, AI akan pakai
          asumsi terbaik untuk yang tidak dijawab.
        </p>
      </div>

      {grouped.map(({ cat, items }) => {
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        return (
          <div
            key={cat}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <div className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-sm font-semibold">
                  {meta.label}
                </h3>
                <p className="text-xs text-muted-foreground">{meta.desc}</p>
              </div>
            </div>
            <div className="space-y-5">
              {items.map(({ q, idx }) => {
                const options: string[] = Array.isArray(q.options)
                  ? q.options
                  : [];
                const hasOptions = options.length > 0;
                const isOther = otherMode[idx];
                // nilai radio yang terpilih saat ini
                const radioValue = isOther
                  ? OTHER_VALUE
                  : options.includes(answers[idx])
                    ? answers[idx]
                    : "";
                return (
                  <div key={idx}>
                    <label
                      htmlFor={`q-${idx}`}
                      className="mb-2 block text-sm font-medium text-foreground/90"
                    >
                      {q.question}
                    </label>

                    {hasOptions ? (
                      <>
                        <RadioGroup
                          value={radioValue}
                          onValueChange={(val) => {
                            if (val === OTHER_VALUE) {
                              setOtherAt(idx, true);
                              setAnswerAt(idx, "");
                            } else {
                              setOtherAt(idx, false);
                              setAnswerAt(idx, val);
                            }
                          }}
                          className="gap-2"
                        >
                          {options.map((opt: string, oi: number) => (
                            <label
                              key={oi}
                              htmlFor={`q-${idx}-opt-${oi}`}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                                radioValue === opt
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted/40"
                              }`}
                            >
                              <RadioGroupItem
                                id={`q-${idx}-opt-${oi}`}
                                value={opt}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                          <label
                            htmlFor={`q-${idx}-opt-other`}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                              isOther
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/40"
                            }`}
                          >
                            <RadioGroupItem
                              id={`q-${idx}-opt-other`}
                              value={OTHER_VALUE}
                            />
                            <span>Lainnya…</span>
                          </label>
                        </RadioGroup>
                        {isOther && (
                          <Textarea
                            id={`q-${idx}`}
                            value={answers[idx]}
                            onChange={(e) => setAnswerAt(idx, e.target.value)}
                            placeholder={
                              q.hint
                                ? `Contoh: ${String(q.hint).replace(/^contoh:\s*/i, "")}`
                                : "Tulis jawabanmu…"
                            }
                            className="mt-2 min-h-[64px] resize-y text-sm"
                          />
                        )}
                      </>
                    ) : (
                      <Textarea
                        id={`q-${idx}`}
                        value={answers[idx]}
                        onChange={(e) => setAnswerAt(idx, e.target.value)}
                        placeholder={
                          q.hint
                            ? `Contoh: ${String(q.hint).replace(/^contoh:\s*/i, "")}`
                            : "Jawabanmu…"
                        }
                        className="min-h-[64px] resize-y text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-4 backdrop-blur">
        <span className="font-mono text-xs text-muted-foreground">
          {answeredCount}/{questions.length} dijawab
        </span>
        <Button
          onClick={() => onSubmit(answers)}
          disabled={submitting}
          className="h-11 px-6 font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Menyusun PRD…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Bikin PRD
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------- langkah struktur ----------

const FLOW_STEPS = [
  { key: "struktur", label: "Struktur" },
  { key: "prd", label: "PRD" },
  { key: "task", label: "Task" },
] as const;

function FlowStepper({ current }: { current: "struktur" | "prd" | "task" }) {
  const activeIdx = FLOW_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2">
      {FLOW_STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                i <= activeIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`text-sm font-medium ${
                i === activeIdx
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < FLOW_STEPS.length - 1 && (
            <span className="h-px w-8 bg-border sm:w-12" />
          )}
        </div>
      ))}
    </div>
  );
}

function StructureModeChoice({
  onChoose,
  busy,
}: {
  onChoose: (mode: "ai" | "manual") => void;
  busy: boolean;
}) {
  return (
    <div className="w-full space-y-6">
      <div className="mb-6 text-center">
        <h2 className="font-heading text-xl font-semibold">
          Bagaimana mau menyusun struktur fitur?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pilih AI untuk generate struktur fitur & sub-fitur otomatis, atau
          susun sendiri secara manual.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose("ai")}
          className="group flex flex-col items-start rounded-2xl border border-primary/30 bg-card p-6 text-left transition-colors hover:border-primary/60 disabled:opacity-60"
        >
          <div className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <Wand2 className="size-5 text-primary" />
          </div>
          <h3 className="mt-4 font-heading text-lg font-semibold">
            Generate dengan AI
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            AI memecah idemu jadi fitur utama + sub-fitur lengkap dengan fase.
            Bisa kamu edit setelahnya.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Pilih AI
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose("manual")}
          className="group flex flex-col items-start rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
        >
          <div className="inline-flex size-11 items-center justify-center rounded-xl bg-secondary">
            <PencilRuler className="size-5 text-foreground" />
          </div>
          <h3 className="mt-4 font-heading text-lg font-semibold">
            Susun manual
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Buat sendiri daftar fitur & sub-fitur dari nol. Cocok kalau kamu
            sudah punya gambaran jelas.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <PencilRuler className="size-4" /> Susun manual
          </span>
        </button>
      </div>
    </div>
  );
}

function StructuringState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Network className="size-7 animate-pulse text-primary" />
        </div>
      </div>
      <h2 className="font-heading text-xl font-semibold">
        Menyusun struktur fitur…
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        AI sedang memecah idemu menjadi fitur utama dan sub-fitur beserta
        fasenya.
      </p>
    </div>
  );
}

function StructureView({
  projectId,
  appName,
  initial,
  mode,
  onProceed,
  proceeding,
}: {
  projectId: Id<"projects">;
  appName: string;
  initial: StructureFeature[];
  mode?: "ai" | "manual";
  onProceed: (structure: StructureFeature[]) => Promise<void>;
  proceeding: boolean;
}) {
  const save = useMutation(api.prd.saveStructure);
  const [structure, setStructure] = useState<StructureFeature[]>(initial);
  const [editing, setEditing] = useState(mode === "manual");
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  // Sinkron saat struktur di backend berubah (mis. AI selesai).
  useEffect(() => {
    if (!dirty.current) setStructure(initial);
  }, [initial]);

  const change = (next: StructureFeature[]) => {
    dirty.current = true;
    setStructure(next);
  };

  const persist = async () => {
    setSaving(true);
    try {
      const cleaned = structure
        .map((f) => ({
          ...f,
          name: f.name.trim() || "Fitur",
          subFeatures: f.subFeatures.map((s) => s.trim()).filter(Boolean),
        }))
        .filter((f) => f.name);
      await save({ projectId, structure: cleaned });
      setStructure(cleaned);
      dirty.current = false;
      toast.success("Struktur disimpan");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const empty = structure.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Struktur fitur</h2>
          <p className="text-sm text-muted-foreground">
            {editing
              ? "Susun fitur & sub-fitur aplikasimu. Klik simpan kalau sudah pas."
              : "Peta fitur & sub-fitur aplikasimu. Lanjut ke PRD kalau sudah oke."}
          </p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <Button size="sm" onClick={persist} disabled={saving}>
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Simpan
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              <PencilRuler className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {empty && !editing ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada fitur. Klik Edit untuk mulai menyusun.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-background/40 p-4 sm:p-6">
          <StructureMap
            appName={appName}
            features={structure}
            editable={editing}
            onChange={change}
          />
        </div>
      )}

      <div className="sticky bottom-4 z-30 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <span className="text-xs text-muted-foreground">
          {structure.length} fitur ·{" "}
          {structure.reduce((n, f) => n + f.subFeatures.length, 0)} sub-fitur
        </span>
        <Button
          onClick={async () => {
            const cleaned = structure
              .map((f) => ({
                ...f,
                name: f.name.trim() || "Fitur",
                subFeatures: f.subFeatures.map((s) => s.trim()).filter(Boolean),
              }))
              .filter((f) => f.name);
            await onProceed(cleaned);
          }}
          disabled={proceeding || empty}
          className="h-11 px-6 font-semibold"
        >
          {proceeding ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Menyiapkan…
            </>
          ) : (
            <>
              Lanjut ke PRD <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------- status generating / error ----------

function GeneratingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="size-7 animate-pulse text-primary" />
        </div>
      </div>
      <h2 className="font-heading text-xl font-semibold">Menyusun PRD…</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        AI sedang menganalisis idemu dan menyusun ringkasan, fitur, spec, dan
        task. Biasanya butuh 15–40 detik.
      </p>
    </div>
  );
}

function GeneratingSimplePlanState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Zap className="size-7 animate-pulse text-primary" />
        </div>
      </div>
      <h2 className="font-heading text-xl font-semibold">
        Menyusun Plan Script / Sederhana…
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        AI sedang menganalisis idemu dan menyusun alur eksekusi, script skeleton, serta prompt AI agent.
      </p>
    </div>
  );
}

// ---------- utama ----------

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id as Id<"projects">;
  const navigate = useNavigate();
  const data = useQuery(api.prd.getProject, { projectId });
  const generate = useAction(api.prdActions.generatePrd);
  const generateStructure = useAction(api.prdActions.generateStructure);
  const generateQuestions = useAction(api.prdActions.generateQuestions);
  const generateSimplePlanAction = useAction(api.prdActions.generateSimplePlan);
  const chooseMode = useMutation(api.prd.chooseStructureMode);
  const resetStatus = useMutation(api.prd.resetProjectStatus);
  const proceedToQuestions = useMutation(api.prd.proceedToQuestions);
  const submitAnswers = useMutation(api.prd.submitAnswers);
  const deleteProject = useMutation(api.prd.deleteProject);
  const structTriggered = useRef(false);
  const questionTriggered = useRef(false);
  const simplePlanTriggered = useRef(false);
  const prdTriggered = useRef(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingSimplePlan, setGeneratingSimplePlan] = useState(false);
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const [choosingMode, setChoosingMode] = useState(false);
  const [proceeding, setProceeding] = useState(false);

  const project = data?.project;
  const features = data?.features || [];
  const messages = data?.messages || [];
  const status = project?.status;
  const structureMode = project?.structureMode;

  const handleGenerateSimplePlan = async () => {
    setGeneratingSimplePlan(true);
    try {
      const res = await generateSimplePlanAction({ projectId });
      if (res.ok) {
        toast.success("Plan Sederhana berhasil dibuat!");
      } else {
        toast.error(res.error || "Gagal membuat Plan Sederhana");
      }
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat Plan Sederhana");
    } finally {
      setGeneratingSimplePlan(false);
    }
  };

  // Mulai otomatis generate struktur AI, lalu generate pertanyaan / plan sederhana.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run on status change
  useEffect(() => {
    if (!project) return;

    if (
      project.planType === "simple_script" &&
      !project.simplePlan &&
      !simplePlanTriggered.current
    ) {
      simplePlanTriggered.current = true;
      handleGenerateSimplePlan();
      return;
    }

    if (
      status === "structuring" &&
      structureMode === "ai" &&
      !structTriggered.current
    ) {
      structTriggered.current = true;
      generateStructure({ projectId }).catch(() => {});
    }
    if (status === "preparing" && !questionTriggered.current) {
      questionTriggered.current = true;
      generateQuestions({ projectId }).catch(() => {});
    }
    if (
      status === "generating" &&
      !prdTriggered.current &&
      !project.simplePlan &&
      !project.summary
    ) {
      prdTriggered.current = true;
      generate({ projectId }).catch(() => {});
    }
  }, [status, structureMode, project?.planType, project?.simplePlan, project?.summary]);

  const handleChooseMode = async (mode: "ai" | "manual") => {
    setChoosingMode(true);
    try {
      structTriggered.current = false;
      await chooseMode({ projectId, mode });
    } catch {
      toast.error("Gagal memproses. Coba lagi.");
    } finally {
      setChoosingMode(false);
    }
  };

  const handleProceed = async (structure: StructureFeature[]) => {
    setProceeding(true);
    try {
      questionTriggered.current = false;
      await proceedToQuestions({ projectId, structure });
    } catch {
      toast.error("Gagal melanjutkan. Coba lagi.");
    } finally {
      setProceeding(false);
    }
  };

  const handleSubmitAnswers = async (answers: string[]) => {
    setSubmittingAnswers(true);
    try {
      await submitAnswers({ projectId, answers });
      await generate({ projectId });
    } catch {
      toast.error("Gagal menyusun PRD. Coba lagi.");
    } finally {
      setSubmittingAnswers(false);
    }
  };

  if (data === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (data === null || !project) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">PRD tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard")}>
          Kembali
        </Button>
      </div>
    );
  }

  const runGenerate = async () => {
    setRegenerating(true);
    try {
      await generate({ projectId });
    } finally {
      setRegenerating(false);
    }
  };

  const handleRetry = async () => {
    // Reset triggers agar useEffect / action tidak terhalang
    structTriggered.current = false;
    questionTriggered.current = false;
    simplePlanTriggered.current = false;
    prdTriggered.current = false;

    try {
      await resetStatus({ projectId });
    } catch (e: any) {
      toast.error("Gagal mereset status proyek.");
      return;
    }

    if (project.planType === "simple_script") {
      handleGenerateSimplePlan();
      return;
    }
    // Langkah struktur gagal (mode AI, belum ada struktur) → susun ulang struktur.
    if (project.structureMode === "ai" && !(project.structure?.length)) {
      structTriggered.current = true;
      setRegenerating(true);
      try {
        await generateStructure({ projectId });
      } catch (e: any) {
        toast.error(e?.message || "Gagal menyusun struktur");
      } finally {
        setRegenerating(false);
      }
      return;
    }
    // Jika gagal sebelum mengumpulkan jawaban, ulangi langkah pertanyaan.
    if (!project.answers || project.answers.length === 0) {
      questionTriggered.current = true;
      setRegenerating(true);
      try {
        await generateQuestions({ projectId });
      } catch (e: any) {
        toast.error(e?.message || "Gagal membuat pertanyaan");
      } finally {
        setRegenerating(false);
      }
      return;
    }
    await runGenerate();
  };

  const defaultTab =
    project.planType === "simple_script" || project.simplePlan
      ? "simplePlan"
      : "prd";

  return (
    <div className="w-full space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Semua PRD
          </button>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {project.title}
          </h1>
        </div>
        {(project.status === "ready" || project.simplePlan) && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={generatingSimplePlan}
              onClick={handleGenerateSimplePlan}
            >
              {generatingSimplePlan ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                <Zap className="size-3.5 text-primary" />
              )}
              {project.simplePlan ? "Regen Plan Sederhana" : "Buat Plan Sederhana"}
            </Button>

            {project.status === "ready" && (
              <>
                <CopyButton
                  text={prdToMarkdown(project, features)}
                  label="Copy PRD"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadText(
                      `${slugify(project.title)}.md`,
                      prdToMarkdown(project, features),
                    )
                  }
                >
                  <Download className="size-3.5" /> Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={regenerating}
                  onClick={runGenerate}
                >
                  {regenerating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Regenerate PRD
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                if (!confirm("Hapus PRD ini?")) return;
                await deleteProject({ projectId });
                navigate("/dashboard");
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* stepper alur (disembunyikan setelah PRD/Plan siap atau jika mode simple_script) */}
      {project.planType !== "simple_script" &&
        project.status !== "ready" &&
        project.status !== "error" && (
          <div className="rounded-xl border border-border bg-card/60 py-3">
            <FlowStepper
              current={
                project.status === "choosing" ||
                project.status === "structuring" ||
                project.status === "structure_ready"
                  ? "struktur"
                  : "prd"
              }
            />
          </div>
        )}

      {/* isi */}
      {generatingSimplePlan ? (
        <GeneratingSimplePlanState />
      ) : project.planType === "simple_script" && project.simplePlan ? (
        <SimplePlanTab
          project={project}
          onGenerateSimplePlan={handleGenerateSimplePlan}
          generating={generatingSimplePlan}
        />
      ) : project.status === "choosing" ? (
        <StructureModeChoice onChoose={handleChooseMode} busy={choosingMode} />
      ) : project.status === "structuring" && !regenerating ? (
        <StructuringState />
      ) : project.status === "structure_ready" ? (
        <StructureView
          projectId={projectId}
          appName={project.title}
          initial={(project.structure || []) as StructureFeature[]}
          mode={project.structureMode}
          onProceed={handleProceed}
          proceeding={proceeding}
        />
      ) : project.status === "preparing" ? (
        <PreparingState />
      ) : project.status === "questioning" ? (
        <QuestionsForm
          questions={project.questions || []}
          onSubmit={handleSubmitAnswers}
          submitting={submittingAnswers}
        />
      ) : project.status === "generating" && !regenerating ? (
        <GeneratingState />
      ) : project.status === "error" ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
            <TriangleAlert className="size-6 text-destructive" />
          </div>
          <h2 className="font-heading text-lg font-semibold">
            Gagal menyusun plan
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {project.error || "Terjadi kesalahan saat memanggil AI."}
          </p>
          <Button className="mt-5" onClick={handleRetry} disabled={regenerating || generatingSimplePlan}>
            {regenerating || generatingSimplePlan ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Coba lagi
          </Button>
        </div>
      ) : regenerating ? (
        <GeneratingState />
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList
            className={`grid w-full ${
              project.simplePlan && project.structure?.length
                ? "max-w-2xl grid-cols-6"
                : project.simplePlan || project.structure?.length
                  ? "max-w-xl grid-cols-5"
                  : "max-w-md grid-cols-4"
            }`}
          >
            <TabsTrigger value="simplePlan">
              <Zap className="size-4 text-primary" />
              <span className="hidden sm:inline">Plan Sederhana</span>
            </TabsTrigger>
            <TabsTrigger value="prd">
              <FileText className="size-4" />
              <span className="hidden sm:inline">PRD</span>
            </TabsTrigger>
            {project.structure?.length ? (
              <TabsTrigger value="structure">
                <Network className="size-4" />
                <span className="hidden sm:inline">Struktur</span>
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="features">
              <LayoutGrid className="size-4" />
              <span className="hidden sm:inline">Fitur</span>
            </TabsTrigger>
            <TabsTrigger value="context">
              <StickyNote className="size-4" />
              <span className="hidden sm:inline">Konteks</span>
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="size-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simplePlan" className="mt-5">
            <SimplePlanTab
              project={project}
              onGenerateSimplePlan={handleGenerateSimplePlan}
              generating={generatingSimplePlan}
            />
          </TabsContent>
          <TabsContent value="prd" className="mt-5">
            <OverviewTab project={project} />
          </TabsContent>
          {project.structure?.length ? (
            <TabsContent value="structure" className="mt-5">
              <div className="rounded-2xl border border-border bg-background/40 p-4 sm:p-6">
                <StructureMap
                  appName={project.title}
                  features={project.structure as StructureFeature[]}
                />
              </div>
            </TabsContent>
          ) : null}
          <TabsContent value="features" className="mt-5">
            <FeaturesTab features={features} />
          </TabsContent>
          <TabsContent value="context" className="mt-5">
            <ContextTab projectId={projectId} initial={project.context || ""} />
          </TabsContent>
          <TabsContent value="chat" className="mt-5">
            <ChatTab projectId={projectId} messages={messages} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
