import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

const EXAMPLES = [
  "Aplikasi mobile untuk mencatat pengeluaran harian dengan kategori otomatis",
  "Marketplace jasa les privat yang mempertemukan guru dan murid",
  "Dashboard analitik untuk toko online di Shopee & Tokopedia",
  "Tools SaaS untuk menjadwalkan postingan Instagram otomatis",
];

function NewPrdComposer({ projectCount = 0 }: { projectCount?: number }) {
  const navigate = useNavigate();
  const createDraft = useMutation(api.prd.createDraftProject);
  const [idea, setIdea] = useState("");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isLimitReached = projectCount >= 5;

  const handleSubmit = async () => {
    if (isLimitReached) {
      toast.error("Batas kuota 5 PRD tercapai. Hapus PRD lama untuk membuat baru.");
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
      });
      navigate(`/project/${projectId}`, { state: { autostart: true } });
    } catch (e: any) {
      const msg = e?.message || "Gagal membuat PRD. Coba lagi.";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Sparkles className="size-5 text-primary" />
            Ide produk baru
          </CardTitle>
          <span
            className={`font-mono text-xs px-2.5 py-1 rounded-full border ${
              isLimitReached
                ? "bg-destructive/10 border-destructive/30 text-destructive font-semibold"
                : "bg-secondary border-border text-muted-foreground"
            }`}
          >
            Kuota: {projectCount}/5 PRD
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLimitReached && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0" />
            <span>
              Kamu sudah mencapai batas maksimal 5 PRD. Hapus PRD lama untuk membuat PRD baru.
            </span>
          </div>
        )}

        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          disabled={isLimitReached}
          placeholder={
            isLimitReached
              ? "Batas 5 PRD tercapai. Hapus PRD lama terlebih dahulu untuk membuat PRD baru."
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

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={isLimitReached}
              onClick={() => setIdea(ex)}
              className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
            >
              {ex.length > 42 ? `${ex.slice(0, 42)}…` : ex}
            </button>
          ))}
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

      <NewPrdComposer projectCount={projects?.length ?? 0} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">PRD kamu</h2>
          {projects !== undefined && (
            <span className="font-mono text-xs text-muted-foreground">
              {projects.length}/5 PRD
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
            {projects.map((p) => (
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
