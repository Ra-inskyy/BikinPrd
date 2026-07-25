import { useConvexAuth } from "convex/react";
import {
  ArrowRight,
  Check,
  FileText,
  GitBranch,
  ListChecks,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const MODELS = ["GPT-5.5", "Claude Opus 4.7", "Gemini 3", "DeepSeek V4"];

function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10 grid-bg [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />

      <div className="container flex flex-col items-center py-20 text-center md:py-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="font-mono uppercase tracking-widest text-muted-foreground">
            AI PRD generator
          </span>
        </div>

        <h1 className="mt-6 max-w-4xl font-heading text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          Dari ide jadi <span className="text-primary">PRD</span> yang siap
          dipakai <span className="text-primary">AI coding agent</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Deskripsikan idemu, dan biarkan AI menyusun PRD lengkap — ringkasan,
          spec fitur, sampai task teknis yang tinggal di-copy ke Cursor, Claude
          Code, atau agent favoritmu.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-12 px-7 text-base font-semibold" asChild>
            <Link to={isAuthenticated ? "/dashboard" : "/login"}>
              Mulai bikin PRD
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-7 text-base"
            asChild
          >
            <a href="#cara-kerja">Lihat cara kerjanya</a>
          </Button>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Pakai model YTTA
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {MODELS.map((m) => (
              <span
                key={m}
                className="rounded-md border border-border bg-card/50 px-3 py-1 font-mono text-xs text-muted-foreground"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    icon: Sparkles,
    title: "Tulis idemu",
    body: "Cukup jelaskan produk yang mau kamu bangun dalam beberapa kalimat. Tambahkan konteks kalau perlu.",
  },
  {
    n: "02",
    icon: Zap,
    title: "AI menyusun PRD",
    body: "Dalam hitungan detik: ringkasan, target user, goals, tech stack, dan fitur inti lengkap dengan spec.",
  },
  {
    n: "03",
    icon: ListChecks,
    title: "Copy ke AI coding",
    body: "Setiap fitur punya spec Markdown & daftar task yang bisa langsung ditempel ke AI coding agent.",
  },
];

const FEATURES = [
  {
    icon: FileText,
    title: "PRD terstruktur",
    body: "Ringkasan, masalah, target user, goals, non-goals, metrik, dan rekomendasi tech stack — semuanya rapi.",
  },
  {
    icon: GitBranch,
    title: "Spec per fitur",
    body: "Setiap fitur dipecah jadi user story, acceptance criteria, dan catatan teknis dalam format Markdown.",
  },
  {
    icon: ListChecks,
    title: "Task siap eksekusi",
    body: "Daftar task teknis berurutan untuk tiap fitur, langsung bisa diberikan ke coding agent satu per satu.",
  },
  {
    icon: MessageSquare,
    title: "Revisi lewat chat",
    body: "Tanya, minta saran, atau minta revisi. Asisten membaca konteks PRD dan memperbaruinya otomatis.",
  },
];

export function LandingPage() {
  const { isAuthenticated } = useConvexAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex-1">
      <Hero isAuthenticated={isAuthenticated} />

      {/* Cara kerja */}
      <section id="cara-kerja" className="border-b border-border py-20 md:py-28">
        <div className="container">
          <div className="mb-14 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              Cara kerja
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Tiga langkah, dari ide ke eksekusi
            </h2>
          </div>
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="relative rounded-2xl border border-border bg-card p-7"
              >
                <span className="font-mono text-sm text-primary">{s.n}</span>
                <div className="mt-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10">
                  <s.icon className="size-5 text-primary" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fitur */}
      <section className="border-b border-border py-20 md:py-28">
        <div className="container">
          <div className="mb-14 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              Fitur
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Semua yang kamu butuh untuk mulai ngoding
            </h2>
          </div>
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-7 transition-colors hover:border-primary/40"
              >
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10">
                  <f.icon className="size-5 text-primary" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-card p-10 text-center md:p-16">
            <div className="absolute inset-0 -z-10 grid-bg opacity-60" />
            <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Berhenti nulis PRD dari nol
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Bikin PRD pertamamu gratis. Ubah ide jadi dokumen yang siap
              dieksekusi AI coding agent hari ini.
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                size="lg"
                className="h-12 px-7 text-base font-semibold"
                asChild
              >
                <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                  Mulai sekarang
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> Tanpa setup
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> Output Bahasa Indonesia
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> Siap untuk AI coding
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
