import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopUpModal } from "@/components/TopUpModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

const PRD_EXAMPLES_POOL = [
  "Aplikasi mobile untuk mencatat pengeluaran harian dengan kategori otomatis",
  "Marketplace jasa les privat yang mempertemukan guru dan murid",
  "Dashboard analitik untuk toko online di Shopee & Tokopedia",
  "Tools SaaS untuk menjadwalkan postingan Instagram & TikTok otomatis",
  "Aplikasi Kasir POS Toko Kelontong Berbasis Web Offline-First",
  "Platform E-Learning Interaktif dengan Kuis & Sertifikat Otomatis",
  "Aplikasi Reservasi Meja Restoran & Order Makanan via QR Code",
  "Portal Pencari Kerja Freelance Khusus Developer & Designer",
  "Aplikasi Habit Tracker & Pemantau Kesehatan dengan Gamifikasi",
  "Sistem Manajemen Stok & Inventaris Gudang Berbasis Barcode",
];

const SCRIPT_EXAMPLES_POOL = [
  "Script Python otomatis download video YouTube & ekstrak audio MP3",
  "Script Web Scraper harga produk Shopee/Tokopedia kirim alert Telegram",
  "Script Otomasi Backup Database MySQL ke Google Drive harian",
  "Bot Telegram pemantau status uptime website & alarm error",
  "Script Python pengubah berkas PDF banyak halaman ke gambar PNG",
  "CLI Tool konversi massal gambar WebP ke PNG & kompres otomatis",
  "Script Python auto unfollow akun Twitter/X non-aktif via API",
  "Script Node.js parser file CSV laporan keuangan ke Excel otomatis",
  "Script Python pemisah vokal & instrumen musik dengan AI Spleeter",
  "Script CLI utilitas rename ribuan file foto berdasarkan tanggal EXIF",
];

function getRandomExamples(type: "standard" | "simple_script") {
  const pool = type === "simple_script" ? SCRIPT_EXAMPLES_POOL : PRD_EXAMPLES_POOL;
  return [...pool].sort(() => 0.5 - Math.random()).slice(0, 4);
}

function NewPrdComposer({
  quota,
}: {
  quota?: {
    countToday: number;
    maxDailyLimit: number;
    remainingToday: number;
    bonusCredits: number;
    totalAvailable: number;
  };
}) {
  const navigate = useNavigate();
  const createDraft = useMutation(api.prd.createDraftProject);
  const [idea, setIdea] = useState("");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [planType, setPlanType] = useState<"standard" | "simple_script">("standard");
  const [submitting, setSubmitting] = useState(false);
  const [examples, setExamples] = useState<string[]>([]);

  useEffect(() => {
    setExamples(getRandomExamples(planType));
  }, [planType]);

  const shuffleCurrentExamples = () => {
    setExamples(getRandomExamples(planType));
  };

  const countToday = quota?.countToday ?? 0;
  const bonusCredits = quota?.bonusCredits ?? 0;
  const totalAvailable = quota?.totalAvailable ?? 1;
  const isLimitReached = totalAvailable === 0;

  const handleSubmit = async () => {
    if (isLimitReached) {
      toast.error("Kuota harian kamu sudah habis & belum ada Kredit Bonus. Silakan Top-Up kredit!");
      return;
    }
    if (!idea.trim()) {
      toast.error("Tulis dulu ide produkmu");
      return;
    }
    setSubmitting(true);
    try {
      const projectId = await createDraft({
        idea: idea.trim(),
        context: context.trim() || undefined,
        planType,
      });
      navigate(`/project/${projectId}`, { state: { autostart: true } });
    } catch (e: any) {
      const msg =
        typeof e?.data === "string"
          ? e.data
          : e?.message || "Gagal membuat PRD. Coba lagi.";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Sparkles className="size-5 text-primary" />
            Ide produk baru
          </CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-xs px-2.5 py-1 rounded-full border ${
                isLimitReached
                  ? "bg-destructive/10 border-destructive/30 text-destructive font-semibold"
                  : "bg-secondary border-border text-muted-foreground"
              }`}
            >
              Hari ini: {countToday}/1
              {bonusCredits > 0 && (
                <span className="ml-1 text-primary font-bold">
                  (+{bonusCredits} Bonus)
                </span>
              )}
            </span>
            <TopUpModal triggerText="Beli Kredit" size="sm" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLimitReached && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-xs text-destructive flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <TriangleAlert className="size-5 shrink-0 text-destructive" />
              <span>
                Kuota harian gratis kamu (1/1 PRD) sudah habis hari ini. Ingin buat PRD baru sekarang?
              </span>
            </div>
            <TopUpModal triggerText="Top-Up Kredit (+5 PRD)" variant="default" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isLimitReached}
            onClick={() => setPlanType("standard")}
            className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
              planType === "standard"
                ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
              📘 PRD Standar & Detail
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">
              Untuk Web App & Aplikasi Kompleks (Fitur, Spec, Architecture & Tasks)
            </span>
          </button>
          <button
            type="button"
            disabled={isLimitReached}
            onClick={() => setPlanType("simple_script")}
            className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
              planType === "simple_script"
                ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <span className="font-semibold text-sm flex items-center gap-1.5 text-primary font-mono">
              ⚡ Plan Script / Project Sederhana
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">
              Untuk Script, Otomasi & Small Project (Ringkas, Skeleton Code & Prompt AI)
            </span>
          </button>
        </div>

        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          disabled={isLimitReached}
          placeholder={
            isLimitReached
              ? "Kuota harian (1/1 PRD hari ini) telah habis. Klik 'Top-Up Kredit' di atas untuk menambah kredit instan!"
              : planType === "simple_script"
                ? "Ceritakan script/project sederhana kamu. Contoh: Script Python untuk download video YouTube & ekstrak audio mp3 secara otomatis…"
                : "Ceritakan produk yang mau kamu bangun. Contoh: Aplikasi untuk membantu freelancer mengelola invoice dan mengingatkan klien yang belum bayar…"
          }
          className="min-h-[120px] resize-none text-base disabled:opacity-60"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
          }}
        />

        {showContext ? (
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={isLimitReached}
            placeholder="Konteks tambahan (opsional): target user spesifik, batasan teknis, referensi produk, dll."
            className="min-h-[80px] resize-none text-sm disabled:opacity-60"
          />
        ) : (
          <button
            type="button"
            disabled={isLimitReached}
            onClick={() => setShowContext(true)}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            + Tambah konteks (opsional)
          </button>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              💡 Contoh saran {planType === "simple_script" ? "script / otomasi" : "ide aplikasi"}:
            </span>
            <button
              type="button"
              disabled={isLimitReached}
              onClick={shuffleCurrentExamples}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
            >
              <RefreshCw className="size-3" /> Acak saran
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={isLimitReached}
                onClick={() => setIdea(ex)}
                className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
              >
                {ex.length > 48 ? `${ex.slice(0, 48)}…` : ex}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            ⌘/Ctrl + Enter untuk generate
          </span>
          <Button
            onClick={handleSubmit}
            disabled={submitting || isLimitReached}
            className="ml-auto h-11 px-6 font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Menyiapkan…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Bikin PRD
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "choosing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
        Pilih struktur
      </span>
    );
  }
  if (status === "structuring") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
        <Loader2 className="size-3 animate-spin" /> Menyusun struktur
      </span>
    );
  }
  if (status === "structure_ready") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
        Struktur siap
      </span>
    );
  }
  if (status === "preparing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
        <Loader2 className="size-3 animate-spin" /> Menyiapkan
      </span>
    );
  }
  if (status === "questioning") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
        Perlu dijawab
      </span>
    );
  }
  if (status === "generating") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
        <Loader2 className="size-3 animate-spin" /> Membuat
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
        <TriangleAlert className="size-3" /> Gagal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
      Siap
    </span>
  );
}

export function DashboardPage() {
  const user = useQuery(api.auth.currentUser);
  const projects = useQuery(api.prd.listProjects);
  const userQuota = useQuery(api.prd.getUserQuota);
  const deleteProject = useMutation(api.prd.deleteProject);
  const navigate = useNavigate();

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
          Halo{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Ubah idemu jadi PRD lengkap yang siap dipakai AI coding agent.
        </p>
      </div>

      <NewPrdComposer quota={userQuota} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">PRD kamu</h2>
          {projects !== undefined && (
            <span className="font-mono text-xs text-muted-foreground">
              {projects.length} PRD tersimpan
            </span>
          )}
        </div>

        {projects === undefined ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center">
            <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="size-6 text-primary" />
            </div>
            <p className="font-medium">Belum ada PRD</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tulis ide pertamamu di atas untuk mulai.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p: any) => (
              <button
                type="button"
                key={p._id}
                onClick={() => navigate(`/project/${p._id}`)}
                className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
              >
                <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{p.title}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {p.summary || p.idea}
                  </p>
                  {p.status === "ready" && (
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {p.featureCount} fitur
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Hapus PRD ini?")) return;
                      await deleteProject({ projectId: p._id });
                      toast.success("PRD dihapus");
                    }}
                    onKeyDown={() => {}}
                    className="rounded-md p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
