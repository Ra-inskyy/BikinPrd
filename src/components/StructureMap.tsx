import {
  Boxes,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Scan,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type StructureFeature = {
  name: string;
  description?: string;
  phase?: number;
  subFeatures: string[];
};

const PHASE_STYLES: Record<number, string> = {
  1: "bg-primary/15 text-primary border-primary/30",
  2: "bg-warning/15 text-warning border-warning/30",
  3: "bg-muted text-muted-foreground border-border",
};

function phaseStyle(phase?: number) {
  return PHASE_STYLES[phase ?? 1] || PHASE_STYLES[1];
}

// ---------------------------------------------------------------------------
// Geometri konektor — menggambar kurva bezier root->fitur dan fitur->subkartu
// ---------------------------------------------------------------------------

function useConnectors(count: number, scale = 1) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const subRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [paths, setPaths] = useState<{ rf: string[]; fs: string[] }>({
    rf: [],
    fs: [],
  });
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const root = rootRef.current;
    if (!container || !root) return;
    const c = container.getBoundingClientRect();
    // getBoundingClientRect returns coordinates in the CSS-scaled space; divide
    // by the current scale so the SVG paths (drawn in the unscaled coordinate
    // system of the container) stay aligned with the boxes at any zoom level.
    const k = scale || 1;
    const curve = (
      a: DOMRect,
      b: DOMRect,
      fromRight: boolean,
    ): string => {
      const sx = ((fromRight ? a.right : a.left) - c.left) / k;
      const sy = (a.top - c.top + a.height / 2) / k;
      const ex = (b.left - c.left) / k;
      const ey = (b.top - c.top + b.height / 2) / k;
      const dx = Math.max(24, (ex - sx) / 2);
      return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}`;
    };
    const rRect = root.getBoundingClientRect();
    const rf: string[] = [];
    const fs: string[] = [];
    for (let i = 0; i < count; i++) {
      const fEl = featureRefs.current[i];
      const sEl = subRefs.current[i];
      if (fEl) {
        const fRect = fEl.getBoundingClientRect();
        rf.push(curve(rRect, fRect, true));
        if (sEl) {
          const sRect = sEl.getBoundingClientRect();
          fs.push(curve(fRect, sRect, true));
        }
      }
    }
    setPaths((prev) => {
      const same =
        prev.rf.length === rf.length &&
        prev.fs.length === fs.length &&
        prev.rf.every((p, i) => p === rf[i]) &&
        prev.fs.every((p, i) => p === fs[i]);
      return same ? prev : { rf, fs };
    });
    setDims((prev) =>
      prev.w === container.scrollWidth && prev.h === container.scrollHeight
        ? prev
        : { w: container.scrollWidth, h: container.scrollHeight },
    );
  }, [count, scale]);

  // Hitung ulang setiap commit (dijaga oleh pengecekan kesetaraan di atas).
  useLayoutEffect(() => {
    recompute();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);
    if (rootRef.current) ro.observe(rootRef.current);
    for (const el of featureRefs.current) if (el) ro.observe(el);
    for (const el of subRefs.current) if (el) ro.observe(el);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute, count]);

  return { containerRef, rootRef, featureRefs, subRefs, paths, dims };
}

// ---------------------------------------------------------------------------

export function StructureMap({
  appName,
  features,
  editable = false,
  onChange,
}: {
  appName: string;
  features: StructureFeature[];
  editable?: boolean;
  onChange?: (features: StructureFeature[]) => void;
}) {
  const [scale, setScale] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const { containerRef, rootRef, featureRefs, subRefs, paths, dims } =
    useConnectors(features.length, scale);

  const fitToScreen = useCallback(() => {
    const viewport = viewportRef.current;
    const container = containerRef.current;
    if (!viewport || !container) return;

    const vWidth = viewport.clientWidth - 48;
    const vHeight = viewport.clientHeight - 48;
    const cWidth = container.scrollWidth;
    const cHeight = container.scrollHeight;

    if (vWidth <= 0 || vHeight <= 0 || cWidth <= 0 || cHeight <= 0) return;

    const scaleX = vWidth / cWidth;
    const scaleY = vHeight / cHeight;
    const fitScale = Math.min(scaleX, scaleY);
    const targetScale = Math.max(0.3, Math.min(1, +fitScale.toFixed(2)));

    setScale(targetScale);

    const scaledW = cWidth * targetScale;
    const scaledH = cHeight * targetScale;
    const offsetX = Math.max(16, Math.round((vWidth - scaledW) / 2 + 24));
    const offsetY = Math.max(16, Math.round((vHeight - scaledH) / 2 + 24));

    setPan({ x: offsetX, y: offsetY });
  }, []);

  const zoomIn = () => setScale((s) => Math.min(2, +(s + 0.1).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.2, +(s - 0.1).toFixed(2)));
  const zoom100 = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };
  const resetZoom = () => {
    fitToScreen();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fitToScreen();
    }, 80);
    return () => clearTimeout(timer);
  }, [features.length, fullscreen, fitToScreen]);

  // Drag untuk menggeser kanvas. Abaikan jika mulai dari elemen input/tombol
  // supaya edit teks & klik tetap berfungsi.
  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, button")) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({
      x: d.panX + (e.clientX - d.startX),
      y: d.panY + (e.clientY - d.startY),
    });
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Tutup fullscreen dengan tombol Escape.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const update = (next: StructureFeature[]) => onChange?.(next);
  const patchFeature = (i: number, patch: Partial<StructureFeature>) =>
    update(features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeFeature = (i: number) =>
    update(features.filter((_, idx) => idx !== i));
  const addFeature = () =>
    update([
      ...features,
      { name: "Fitur baru", phase: 1, subFeatures: ["Sub-fitur"] },
    ]);
  const patchSub = (fi: number, si: number, value: string) =>
    patchFeature(fi, {
      subFeatures: features[fi].subFeatures.map((s, idx) =>
        idx === si ? value : s,
      ),
    });
  const removeSub = (fi: number, si: number) =>
    patchFeature(fi, {
      subFeatures: features[fi].subFeatures.filter((_, idx) => idx !== si),
    });
  const addSub = (fi: number) =>
    patchFeature(fi, { subFeatures: [...features[fi].subFeatures, "Sub-fitur"] });

  const toolbar = (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={zoomOut}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        title="Perkecil"
      >
        <ZoomOut className="size-4" />
      </button>
      <span
        className="min-w-[2.5rem] px-1 text-center font-mono text-xs text-muted-foreground select-none"
        title="Skala saat ini"
      >
        {Math.round(scale * 100)}%
      </span>
      <button
        type="button"
        onClick={zoomIn}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        title="Perbesar"
      >
        <ZoomIn className="size-4" />
      </button>
      <div className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        onClick={zoom100}
        className={`rounded-md px-2 py-1 font-mono text-xs transition-colors ${
          scale === 1
            ? "bg-primary text-primary-foreground font-semibold"
            : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
        }`}
        title="Setel Zoom ke 100% (Ukuran Asli 1:1)"
      >
        100%
      </button>
      <button
        type="button"
        onClick={fitToScreen}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        title="Pas layar (Tampilkan semua fitur)"
      >
        <Scan className="size-3.5" />
        <span className="hidden sm:inline">Pas Layar</span>
      </button>
      <button
        type="button"
        onClick={resetZoom}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        title="Reset tampilan"
      >
        <RotateCcw className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setFullscreen((v) => !v)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        title={fullscreen ? "Keluar layar penuh" : "Layar penuh"}
      >
        {fullscreen ? (
          <Minimize2 className="size-4" />
        ) : (
          <Maximize2 className="size-4" />
        )}
      </button>
      <div className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        onClick={() => setShowToolbar(false)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        title="Sembunyikan kontrol"
      >
        <EyeOff className="size-4" />
      </button>
    </div>
  );

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background/98 p-4 backdrop-blur"
          : "relative"
      }
    >
      <div
        className={
          fullscreen
            ? "mb-3 flex items-center justify-end"
            : "absolute right-1 top-1 z-20"
        }
      >
        {showToolbar ? (
          toolbar
        ) : (
          <button
            type="button"
            onClick={() => setShowToolbar(true)}
            className="rounded-lg border border-border bg-card/95 p-1.5 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-primary/10 hover:text-primary"
            title="Tampilkan kontrol"
          >
            <Eye className="size-4" />
          </button>
        )}
      </div>
      <div
        ref={viewportRef}
        className={`relative overflow-hidden rounded-xl border border-border/60 ${
          fullscreen
            ? "flex-1"
            : "mt-12 h-[calc(100vh-240px)] min-h-[550px]"
        } ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in oklch, var(--color-border) 60%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div
          ref={containerRef}
          className="absolute left-0 top-0 w-max p-4"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
        {/* Overlay konektor SVG */}
        <svg
          className="pointer-events-none absolute inset-0 z-0"
          width={dims.w || "100%"}
          height={dims.h || "100%"}
          aria-hidden="true"
        >
          <title>Connectors</title>
          {[...paths.rf, ...paths.fs].map((d, i) => (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: static generated paths
              key={i}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="text-primary/35"
            />
          ))}
        </svg>

        {/* grid: root | fitur | sub-kartu */}
        <div
          className="relative z-10 grid items-stretch gap-x-14 gap-y-5"
          style={{
            gridTemplateColumns: "180px 230px 560px",
          }}
        >
          {/* node root membentang semua baris, rata tengah vertikal */}
          <div
            className="flex items-center"
            style={{ gridColumn: 1, gridRow: `1 / span ${Math.max(1, features.length)}` }}
          >
            <div
              ref={rootRef}
              className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-3.5 shadow-[0_0_25px_-8px] shadow-primary/40"
            >
              <div className="flex items-center gap-2">
                <Boxes className="size-4 shrink-0 text-primary" />
                <span className="truncate text-sm font-semibold" title={appName}>
                  {appName}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Perencanaan
              </p>
            </div>
          </div>

          {features.map((f, i) => (
            <FeatureRow
              key={i}
              index={i}
              feature={f}
              editable={editable}
              setFeatureRef={(el) => {
                featureRefs.current[i] = el;
              }}
              setSubRef={(el) => {
                subRefs.current[i] = el;
              }}
              onPatch={(p) => patchFeature(i, p)}
              onRemove={() => removeFeature(i)}
              onPatchSub={(si, v) => patchSub(i, si, v)}
              onRemoveSub={(si) => removeSub(i, si)}
              onAddSub={() => addSub(i)}
            />
          ))}
        </div>

        {editable && (
          <div className="relative z-10 mt-5">
            <button
              type="button"
              onClick={addFeature}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="size-4" /> Tambah fitur
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  index,
  feature,
  editable,
  setFeatureRef,
  setSubRef,
  onPatch,
  onRemove,
  onPatchSub,
  onRemoveSub,
  onAddSub,
}: {
  index: number;
  feature: StructureFeature;
  editable: boolean;
  setFeatureRef: (el: HTMLDivElement | null) => void;
  setSubRef: (el: HTMLDivElement | null) => void;
  onPatch: (patch: Partial<StructureFeature>) => void;
  onRemove: () => void;
  onPatchSub: (si: number, value: string) => void;
  onRemoveSub: (si: number) => void;
  onAddSub: () => void;
}) {
  return (
    <>
      {/* node fitur — kolom 2 */}
      <div
        className="flex items-center"
        style={{ gridColumn: 2, gridRow: index + 1 }}
      >
        <div
          ref={setFeatureRef}
          className="group w-full rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-primary/40"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Layers className="size-3.5 shrink-0 text-primary" />
              {editable ? (
                <input
                  value={feature.name}
                  onChange={(e) => onPatch({ name: e.target.value })}
                  className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none focus:text-primary"
                />
              ) : (
                <span className="truncate text-sm font-semibold">
                  {feature.name}
                </span>
              )}
            </div>
            {editable ? (
              <select
                value={feature.phase ?? 1}
                onChange={(e) => onPatch({ phase: Number(e.target.value) })}
                className={`shrink-0 cursor-pointer rounded-md border px-1 py-0.5 font-mono text-[10px] ${phaseStyle(
                  feature.phase,
                )}`}
              >
                <option value={1}>FASE 1</option>
                <option value={2}>FASE 2</option>
                <option value={3}>FASE 3</option>
              </select>
            ) : (
              <span
                className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${phaseStyle(
                  feature.phase,
                )}`}
              >
                FASE {feature.phase ?? 1}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Direncanakan
            </span>
            {editable && (
              <button
                type="button"
                onClick={onRemove}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                title="Hapus fitur"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* kartu sub-fitur — kolom 3 */}
      <div
        className="flex items-center"
        style={{ gridColumn: 3, gridRow: index + 1 }}
      >
        <div
          ref={setSubRef}
          className="w-full rounded-xl border border-border bg-card/70 p-3"
        >
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Boxes className="size-3" /> Sub fitur
          </p>
          <div className="flex flex-wrap gap-1.5">
            {feature.subFeatures.map((s, si) =>
              editable ? (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: editable list
                  key={si}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 pl-2 pr-1 py-1"
                >
                  <input
                    value={s}
                    onChange={(e) => onPatchSub(si, e.target.value)}
                    size={Math.max(6, s.length + 1)}
                    className="min-w-[120px] max-w-[480px] bg-transparent text-xs outline-none focus:text-primary"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveSub(si)}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    title="Hapus sub-fitur"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: static list
                  key={si}
                  className="rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-foreground/90"
                >
                  {s}
                </span>
              ),
            )}
            {editable && (
              <button
                type="button"
                onClick={onAddSub}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10"
              >
                <Plus className="size-3" /> Sub
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
