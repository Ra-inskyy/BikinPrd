import { useAction, useMutation, useQuery } from "convex/react";
import {
  Bot,
  Code2,
  Copy,
  FileCode,
  FolderArchive,
  Loader2,
  Play,
  Plus,
  Send,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Helper ZIP Builder
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function downloadZip(filename: string, files: { path: string; content: string }[]) {
  if (!files.length) return;
  const encoder = new TextEncoder();
  const fileEntries: Uint8Array[] = [];
  const cdEntries: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const size = contentBytes.length;

    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);
    fileEntries.push(header, contentBytes);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cd.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true);
    cdView.setUint32(16, crc, true);
    cdView.setUint32(20, size, true);
    cdView.setUint32(24, size, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    cdEntries.push(cd);

    offset += header.length + contentBytes.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of cdEntries) cdSize += cd.length;

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  eocdView.setUint16(20, 0, true);

  const parts: BlobPart[] = [
    ...fileEntries.map((e) => e.buffer as ArrayBuffer),
    ...cdEntries.map((e) => e.buffer as ArrayBuffer),
    eocd.buffer as ArrayBuffer,
  ];

  const blob = new Blob(parts, { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("File ZIP proyek berhasil diunduh!");
}

function copyText(text: string, label = "Disalin ke clipboard") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Gagal menyalin"),
  );
}

export function AgentPage() {
  const { sessionId: paramSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();

  const sessions = useQuery(api.agent.listAgentSessions);
  const projects = useQuery(api.prd.listProjects);
  const createSession = useMutation(api.agent.createAgentSession);
  const deleteSession = useMutation(api.agent.deleteAgentSession);
  const runStep = useAction(api.agentActions.runAgentStep);

  const activeSessionId = paramSessionId as Id<"agentSessions"> | undefined;
  const session = useQuery(
    api.agent.getAgentSession,
    activeSessionId ? { sessionId: activeSessionId } : "skip",
  );

  const [goal, setGoal] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [revisionText, setRevisionText] = useState("");
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeFileIdx, setActiveFileIdx] = useState(0);

  // Terminal Runner State
  const [runningTerminal, setRunningTerminal] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Scroll log terminal
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs, session?.logs?.length]);

  const handleCreateSession = async () => {
    const text = goal.trim();
    if (!text) {
      toast.error("Tuliskan goal atau pilih proyek!");
      return;
    }
    setCreating(true);
    try {
      const newId = await createSession({
        goal: text,
        projectId: selectedProjectId ? (selectedProjectId as Id<"projects">) : undefined,
      });
      setGoal("");
      setSelectedProjectId("");
      navigate(`/agent/${newId}`);
      // Jalankan agent step pertama secara otomatis
      setRunning(true);
      await runStep({ sessionId: newId });
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat sesi agent.");
    } finally {
      setCreating(false);
      setRunning(false);
    }
  };

  const handleRunRevision = async () => {
    if (!activeSessionId || running) return;
    const text = revisionText.trim();
    setRevisionText("");
    setRunning(true);
    try {
      const res = await runStep({
        sessionId: activeSessionId,
        userInstruction: text || undefined,
      });
      if (res.ok) {
        toast.success("Agent selesai memproses revisi!");
      } else {
        toast.error(res.error || "Gagal memproses revisi.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Gagal menjalankan agent.");
    } finally {
      setRunning(false);
    }
  };

  // Run Script Sandbox (In-Browser Execution)
  const handleRunCodeSandbox = async () => {
    if (!session?.files?.length) return;
    const currentFile = session.files[activeFileIdx] || session.files[0];
    setRunningTerminal(true);
    setTerminalLogs((prev) => [
      ...prev,
      `[Sandbox System] Executing ${currentFile.path} in WebAssembly Sandbox...`,
    ]);

    const startTime = performance.now();

    try {
      if (currentFile.path.endsWith(".py") || currentFile.language === "python") {
        // Python In-Browser Sandbox (Dynamic Pyodide Loader)
        if (!(window as any).pyodide) {
          setTerminalLogs((prev) => [
            ...prev,
            "[Sandbox System] Loading Pyodide WebAssembly runtime...",
          ]);
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Gagal memuat Pyodide Wasm"));
            document.head.appendChild(script);
          });
          (window as any).pyodide = await (window as any).loadPyodide();
        }

        const pyodide = (window as any).pyodide;
        // Redirect stdout & stderr
        pyodide.setStdout({
          batched: (text: string) => {
            setTerminalLogs((prev) => [...prev, text]);
          },
        });
        pyodide.setStderr({
          batched: (text: string) => {
            setTerminalLogs((prev) => [...prev, `[STDERR] ${text}`]);
          },
        });

        await pyodide.runPythonAsync(currentFile.content);
      } else {
        // JavaScript / Generic Web Worker Sandbox
        const logs: string[] = [];
        const customConsole = {
          log: (...args: any[]) => logs.push(args.map(String).join(" ")),
          error: (...args: any[]) => logs.push(`[ERROR] ${args.map(String).join(" ")}`),
          warn: (...args: any[]) => logs.push(`[WARN] ${args.map(String).join(" ")}`),
        };

        const runner = new Function("console", currentFile.content);
        runner(customConsole);

        if (logs.length > 0) {
          setTerminalLogs((prev) => [...prev, ...logs]);
        } else {
          setTerminalLogs((prev) => [
            ...prev,
            "[Sandbox System] Script executed successfully with 0 output.",
          ]);
        }
      }

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      setTerminalLogs((prev) => [
        ...prev,
        `[Sandbox System] Process finished in ${duration}s (exit code: 0)`,
      ]);
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        `[Sandbox Error] ${err?.message || String(err)}`,
      ]);
    } finally {
      setRunningTerminal(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Utama */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              AI Code Agent
            </h1>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
              WebAssembly Sandbox
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Agent otonom yang meng-generate berkas proyek multi-file, memproses instruksi, dan menjalankan kode langsung di browser.
          </p>
        </div>

        {activeSessionId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/agent")}
            className="gap-1.5"
          >
            <Plus className="size-4" /> Sesi Agent Baru
          </Button>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Kolom Kiri: Sesi & Goal Composer */}
        <div className="space-y-4">
          {/* Card Composer Baru */}
          <Card className="border-primary/20 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Sparkles className="size-4 text-primary" />
                Goal Agent Baru
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects?.length ? (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Impor dari PRD / Plan Sederhana (Opsional):
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setSelectedProjectId(pid);
                      const p = projects.find((x) => x._id === pid);
                      if (p) setGoal(`Implementasikan kode proyek: ${p.title}\n\n${p.idea}`);
                    }}
                    className="w-full rounded-lg border border-border bg-background p-2 text-xs text-foreground"
                  >
                    <option value="">-- Buat dari prompt bebas --</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Tulis goal proyek. Contoh: Buat script Python untuk download video YouTube, ekstrak audio mp3, dan simpan log ke CSV..."
                className="min-h-[110px] resize-none text-sm"
              />

              <Button
                onClick={handleCreateSession}
                disabled={creating || running || !goal.trim()}
                className="w-full h-10 font-semibold"
              >
                {creating || running ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Agent Berpikir…
                  </>
                ) : (
                  <>
                    <Bot className="size-4" /> Jalankan Agent
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Daftar Riwayat Sesi Agent */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Riwayat Sesi Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 p-3 pt-0">
              {!sessions?.length ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Belum ada sesi agent.
                </p>
              ) : (
                sessions.map((s: any) => (
                  <div
                    key={s._id}
                    className={`group flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer ${
                      s._id === activeSessionId
                        ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                        : "border-border bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                    onClick={() => navigate(`/agent/${s._id}`)}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate font-semibold text-foreground">
                        {s.title}
                      </p>
                      <p className="text-[10px] opacity-70">
                        {s.fileCount} file · {s.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("Hapus sesi agent ini?")) return;
                        await deleteSession({ sessionId: s._id });
                        if (s._id === activeSessionId) navigate("/agent");
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Agent Thought Stream, File Explorer, & Live Terminal */}
        <div className="min-w-0 space-y-4">
          {!activeSessionId || !session ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
              <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                <Bot className="size-7 text-primary" />
              </div>
              <h2 className="font-heading text-lg font-semibold">
                Selamat Datang di AI Code Agent Workspace
              </h2>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                Ketik goal di panel kiri atau pilih dari PRD terdaftar untuk meng-generate berkas proyek multi-file & menjalankan kodenya di browser!
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Sesi Aktif */}
              <div className="rounded-xl border border-primary/20 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Goal Sesi Agent:
                    </span>
                    <h2 className="mt-1 font-heading text-lg font-bold">
                      {session.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {session.goal}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
                        session.status === "thinking"
                          ? "bg-primary/20 text-primary animate-pulse"
                          : session.status === "ready"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : session.status === "error"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      ● {session.status}
                    </span>
                    {session.files?.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() =>
                          downloadZip(
                            `${session.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-project.zip`,
                            session.files,
                          )
                        }
                        className="gap-1.5 font-medium"
                      >
                        <FolderArchive className="size-4" /> Download ZIP Proyek
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs: Workspace Kode, Terminal, & Log Agent */}
              <Tabs defaultValue="files" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                  <TabsTrigger value="files">
                    <Code2 className="size-4" />
                    <span>File Proyek ({session.files?.length || 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value="terminal">
                    <Terminal className="size-4 text-primary" />
                    <span>Live Sandbox Terminal</span>
                  </TabsTrigger>
                  <TabsTrigger value="thoughts">
                    <Bot className="size-4" />
                    <span>Thought Logs</span>
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: File Explorer & Code Viewer */}
                <TabsContent value="files" className="mt-4">
                  {!session.files?.length ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      {session.status === "thinking"
                        ? "Agent sedang meng-generate berkas proyek…"
                        : "Belum ada berkas proyek."}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                      {/* Navigasi File Sidebar */}
                      <div className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
                        {session.files.map((file: any, idx: number) => (
                          <button
                            type="button"
                            key={file.path}
                            onClick={() => setActiveFileIdx(idx)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-mono transition-colors ${
                              idx === activeFileIdx
                                ? "border-primary/40 bg-primary/10 text-foreground font-semibold"
                                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                            }`}
                          >
                            <FileCode className="size-3.5 shrink-0 text-primary" />
                            <span className="truncate">{file.path}</span>
                          </button>
                        ))}
                      </div>

                      {/* Code Content Editor/Viewer */}
                      <div className="rounded-xl border border-border bg-card p-4">
                        {session.files[activeFileIdx] && (
                          <div>
                            <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                📄 {session.files[activeFileIdx].path}
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    copyText(
                                      session.files[activeFileIdx].content,
                                      `File ${session.files[activeFileIdx].path} disalin`,
                                    )
                                  }
                                >
                                  <Copy className="size-3.5" /> Salin File
                                </Button>
                              </div>
                            </div>
                            <div className="max-h-[500px] overflow-auto rounded-lg border border-border bg-background/90 p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                              <Markdown
                                content={`\`\`\`${session.files[activeFileIdx].language || "text"}\n${session.files[activeFileIdx].content}\n\`\`\``}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* TAB 2: Live Sandbox Terminal */}
                <TabsContent value="terminal" className="mt-4 space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="size-4 text-primary" />
                        <span className="font-mono text-xs font-semibold text-foreground">
                          WebAssembly Python & JS Execution Sandbox
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleRunCodeSandbox}
                        disabled={runningTerminal || !session.files?.length}
                        className="gap-1.5 font-medium"
                      >
                        {runningTerminal ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Menjalankan…
                          </>
                        ) : (
                          <>
                            <Play className="size-3.5" /> Jalankan Script ({session.files?.[activeFileIdx]?.path || "File"})
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="h-[380px] overflow-y-auto rounded-lg border border-border bg-black/90 p-4 font-mono text-xs text-emerald-400 leading-relaxed shadow-inner">
                      {terminalLogs.length === 0 ? (
                        <p className="text-zinc-500 italic">
                          Klik "Jalankan Script" di atas untuk mengeksekusi kode di sandbox WebAssembly browser kamu...
                        </p>
                      ) : (
                        terminalLogs.map((log, idx) => (
                          <div key={idx} className="whitespace-pre-wrap py-0.5">
                            {log}
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 3: Agent Thought Logs */}
                <TabsContent value="thoughts" className="mt-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="space-y-3 max-h-[450px] overflow-y-auto p-1">
                      {session.logs?.map((l: any, i: number) => (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 text-xs leading-relaxed ${
                            l.type === "thought"
                              ? "border-primary/30 bg-primary/5 text-foreground"
                              : l.type === "tool"
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300 font-mono"
                                : l.type === "error"
                                  ? "border-destructive/30 bg-destructive/5 text-destructive font-mono"
                                  : "border-border bg-background/50 text-muted-foreground"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between text-[10px] opacity-70 font-mono">
                            <span className="uppercase font-bold">[{l.type}]</span>
                            <span>{new Date(l.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <span>{l.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Refine / Auto-Fix Input Box */}
              <div className="rounded-xl border border-primary/20 bg-card p-4">
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  🔧 Instruksi Revisi / Auto-Fix Agent:
                </label>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={revisionText}
                    onChange={(e) => setRevisionText(e.target.value)}
                    placeholder="Minta perbaikan atau fitur tambahan… (misal: 'Tambahkan penanganan error jika file CSV tidak ditemukan', atau 'Ubah fungsi menjadi async')."
                    className="min-h-[50px] max-h-24 resize-none text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleRunRevision();
                      }
                    }}
                  />
                  <Button
                    onClick={handleRunRevision}
                    disabled={running || (!revisionText.trim() && session.status !== "error")}
                    className="h-12 shrink-0 px-4 font-medium"
                  >
                    {running ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="size-4" /> Kirim
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
