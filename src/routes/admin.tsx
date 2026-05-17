import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bold,
  Check,
  ChevronDown,
  ChevronRight,
  Eraser,
  FileText,
  Image,
  Italic,
  LayoutDashboard,
  List,
  ListOrdered,
  Loader2,
  Lock,
  Palette,
  Play,
  Quote,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  Underline,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  ARTICLE_STATUS_LABELS,
  LIVE_STATUS_LABELS,
  PLATFORM_MODULES,
  ROLE_LABELS,
} from "@/lib/editorial.constants";
import { deriveYouTubeEmbedUrl, isLikelyVideoFileUrl } from "@/lib/security";
import {
  archiveArticle,
  completeFirstPasswordChange,
  deleteMediaAsset,
  discardExternalImport,
  getAdminSnapshot,
  logSystemProblem,
  promoteExternalImport,
  publishExternalImportLink,
  resetAdminPassword,
  runExternalImport,
  saveAdminUser,
  saveArticle,
  saveExternalSource,
  saveLiveStream,
  saveMediaAsset,
  saveSection,
  saveVertical,
  setAdminUserActive,
  updateExternalImport,
} from "@/lib/news.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin - ZEN NEWS" }] }),
  component: AdminPage,
});

type Panel =
  | "dashboard"
  | "articles"
  | "verticals"
  | "sections"
  | "live"
  | "media"
  | "external"
  | "users"
  | "appearance"
  | "audit"
  | "security"
  | "settings";

const panels: { id: Panel; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "articles", label: "Noticias", icon: FileText },
  { id: "verticals", label: "Verticales", icon: BarChart3 },
  { id: "sections", label: "Secciones", icon: Archive },
  { id: "live", label: "En vivo", icon: Radio },
  { id: "media", label: "Multimedia", icon: Image },
  { id: "external", label: "Contenido externo", icon: RefreshCw },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "appearance", label: "Apariencia", icon: Settings },
  { id: "audit", label: "Auditoria", icon: Activity },
  { id: "security", label: "Seguridad", icon: Shield },
  { id: "settings", label: "Configuracion", icon: Lock },
];

const blankArticle = {
  id: "",
  vertical_id: "",
  section_id: "",
  author_id: "",
  title: "",
  slug: "",
  subtitle: "",
  summary: "",
  content_html: "",
  cover_image_url: "",
  cover_image_alt: "",
  video_url: "",
  status: "draft",
  source_type: "original",
  external_url: "",
  external_source_name: "",
  seo_title: "",
  seo_description: "",
  tags: "",
  is_breaking: false,
  is_featured: false,
  is_week_main: false,
  is_sponsored: false,
};

function friendlyError(error: any) {
  const raw = error?.message ?? String(error ?? "Error desconocido.");
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => `${item.path?.join(".")}: ${item.message}`).join(" | ");
    }
  } catch {
    // Keep raw message.
  }
  return raw;
}

function plainTextFromHtml(html: string) {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return (holder.textContent ?? "").replace(/\s+/g, " ").trim();
}

function isProblemMessage(message: string) {
  return /(^no\s|no se pudo|error|selecciona|agrega|ingresa|solo\s|supera|obligatorio|must|invalid|falta|usa al menos|debe|hubo|no tienes|no se encontro|no pudo|rechazad)/i.test(
    message.trim(),
  );
}

function isImageAsset(asset: any) {
  return asset?.kind === "image" || String(asset?.mime_type ?? "").startsWith("image/");
}

function isVideoAsset(asset: any) {
  return asset?.kind === "video" || String(asset?.mime_type ?? "").startsWith("video/");
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi|mkv|ogv|ogg)$/i.test(file.name);
}

function flashGlobalBusy(duration = 450) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("zen-admin-busy", { detail: { delta: 1 } }));
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent("zen-admin-busy", { detail: { delta: -1 } }));
  }, duration);
}

function canBrowserPreviewVideo(file: File) {
  return new Promise<boolean>((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), 7000);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish(Number.isFinite(video.duration) || video.readyState > 0);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(false);
    };
    video.src = url;
  });
}

let ffmpegPromise: Promise<any> | null = null;

async function getFfmpeg() {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.9/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
    });
    return ffmpeg;
  })();
  return ffmpegPromise;
}

async function transcodeVideoForBrowser(file: File) {
  const [{ fetchFile }] = await Promise.all([import("@ffmpeg/util")]);
  const ffmpeg = await getFfmpeg();
  const cleanBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-") || "video";
  const inputExt =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "") || "mov";
  const inputName = `input-${Date.now()}.${inputExt}`;
  const outputName = `zen-${Date.now()}.mp4`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  const result = await ffmpeg.exec(
    [
      "-i",
      inputName,
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputName,
    ],
    360000,
  );
  if (result !== 0) throw new Error("No se pudo convertir el video a formato web.");

  const data = await ffmpeg.readFile(outputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
  return new File([bytes], `${cleanBase}.web.mp4`, { type: "video/mp4" });
}

async function prepareVideoFileForWeb(file: File, onStatus: (message: string) => void) {
  if (await canBrowserPreviewVideo(file)) return file;
  onStatus("Optimizando video para web...");
  const converted = await transcodeVideoForBrowser(file);
  if (!(await canBrowserPreviewVideo(converted))) {
    throw new Error("El video se convirtio, pero el navegador aun no pudo previsualizarlo.");
  }
  return converted;
}

function MediaPreview({
  imageUrl,
  videoUrl,
  title,
}: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  title?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [imageUrl, videoUrl]);
  const youtubeEmbed = deriveYouTubeEmbedUrl(videoUrl);
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2">
      <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">Previsualizacion</div>
      {imageUrl && !broken ? (
        <img
          src={imageUrl}
          alt={title ?? "Preview"}
          className="aspect-video w-full rounded-md object-cover"
          onError={() => setBroken(true)}
        />
      ) : imageUrl && broken ? (
        <div className="flex aspect-video items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 px-4 text-center text-xs text-destructive">
          No se pudo cargar la imagen
        </div>
      ) : youtubeEmbed ? (
        <iframe
          src={youtubeEmbed}
          title={title ?? "Video preview"}
          className="aspect-video w-full rounded-md bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : videoUrl && !broken ? (
        <video
          key={videoUrl}
          src={videoUrl}
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full rounded-md bg-black object-contain"
          onError={() => setBroken(true)}
        />
      ) : videoUrl && broken ? (
        <div className="flex aspect-video items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 px-4 text-center text-xs text-destructive">
          No se pudo previsualizar este video. Si es archivo local, el sistema intentara optimizarlo
          antes de subirlo.
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-md bg-background text-xs text-muted-foreground">
          Sin media seleccionada
        </div>
      )}
    </div>
  );
}

function ActionButton({
  loading,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  useEffect(() => {
    if (!loading || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("zen-admin-busy", { detail: { delta: 1 } }));
    return () => {
      window.dispatchEvent(new CustomEvent("zen-admin-busy", { detail: { delta: -1 } }));
    };
  }, [loading]);

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`${className} transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

type FeedbackState =
  | { type: "idle"; message?: string; id: number }
  | { type: "loading"; message: string; id: number }
  | { type: "success"; message: string; id: number }
  | { type: "error"; message: string; id: number };

function AdminFeedback({
  feedback,
  onDismiss,
}: {
  feedback: FeedbackState;
  onDismiss: () => void;
}) {
  const [busyCount, setBusyCount] = useState(0);

  useEffect(() => {
    function handleBusy(event: Event) {
      const delta = Number((event as CustomEvent).detail?.delta ?? 0);
      setBusyCount((current) => Math.max(0, current + delta));
    }
    window.addEventListener("zen-admin-busy", handleBusy);
    return () => window.removeEventListener("zen-admin-busy", handleBusy);
  }, []);

  useEffect(() => {
    if (feedback.type !== "success" && feedback.type !== "error") return;
    const timeout = window.setTimeout(onDismiss, feedback.type === "error" ? 4000 : 1600);
    return () => window.clearTimeout(timeout);
  }, [feedback, onDismiss]);

  const showLoader = busyCount > 0 || feedback.type === "loading";

  return (
    <>
      {(showLoader || feedback.type === "success") && (
        <div className="pointer-events-none fixed bottom-7 left-1/2 z-50 -translate-x-1/2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-background/90 shadow-2xl shadow-accent/20 backdrop-blur">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                feedback.type === "success"
                  ? "border-emerald-500 text-emerald-600"
                  : "animate-spin border-accent border-t-transparent"
              }`}
            >
              {feedback.type === "success" && <Check className="h-6 w-6" />}
            </div>
          </div>
        </div>
      )}

      {feedback.type === "error" && (
        <div
          onClick={onDismiss}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 p-4 text-left backdrop-blur-[2px]"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-lg border border-destructive/30 bg-background p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase text-destructive">
                  Problema detectado
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground">{feedback.message}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Quedo registrado en Auditoria para revisarlo despues.
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      onClick={loading ? undefined : onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-2xl"
      >
        <div className="text-xs font-bold uppercase text-accent">Confirmacion</div>
        <h2 className="mt-2 font-serif text-2xl font-bold">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="min-h-10 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>
          <ActionButton
            type="button"
            loading={loading}
            onClick={onConfirm}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" /> {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function RichTextEditor({
  label,
  name,
  plainName,
  defaultValue,
  minHeight = 180,
}: {
  label: string;
  name: string;
  plainName?: string;
  defaultValue?: string | null;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [html, setHtml] = useState(defaultValue ?? "");
  const [plain, setPlain] = useState(plainTextFromHtml(defaultValue ?? ""));

  useEffect(() => {
    const next = defaultValue ?? "";
    setHtml(next);
    setPlain(plainTextFromHtml(next));
    if (editorRef.current && editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next;
    }
  }, [defaultValue]);

  function syncFromEditor() {
    const nextHtml = editorRef.current?.innerHTML ?? "";
    setHtml(nextHtml);
    setPlain(plainTextFromHtml(nextHtml));
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || !selectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  }

  function run(command: string, value?: string) {
    restoreSelection();
    document.execCommand(command, false, value);
    syncFromEditor();
    saveSelection();
  }

  const toolbarButton =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95";

  return (
    <div className="block text-sm font-semibold">
      <div className="mb-2">{label}</div>
      <div className="rounded-md border border-input bg-background">
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
          <button
            type="button"
            title="Negrita"
            onMouseDown={(event) => {
              event.preventDefault();
              run("bold");
            }}
            className={toolbarButton}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Cursiva"
            onMouseDown={(event) => {
              event.preventDefault();
              run("italic");
            }}
            className={toolbarButton}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Subrayado"
            onMouseDown={(event) => {
              event.preventDefault();
              run("underline");
            }}
            className={toolbarButton}
          >
            <Underline className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Lista"
            onMouseDown={(event) => {
              event.preventDefault();
              run("insertUnorderedList");
            }}
            className={toolbarButton}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Lista numerada"
            onMouseDown={(event) => {
              event.preventDefault();
              run("insertOrderedList");
            }}
            className={toolbarButton}
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Cita"
            onMouseDown={(event) => {
              event.preventDefault();
              run("formatBlock", "blockquote");
            }}
            className={toolbarButton}
          >
            <Quote className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Limpiar formato"
            onMouseDown={(event) => {
              event.preventDefault();
              run("removeFormat");
            }}
            className={toolbarButton}
          >
            <Eraser className="h-4 w-4" />
          </button>

          <select
            aria-label="Tipo de bloque"
            onMouseDown={saveSelection}
            onChange={(event) => {
              run("formatBlock", event.target.value);
              event.currentTarget.value = "p";
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            defaultValue="p"
          >
            <option value="p">Parrafo</option>
            <option value="h2">Titulo 2</option>
            <option value="h3">Titulo 3</option>
            <option value="blockquote">Cita</option>
          </select>
          <select
            aria-label="Tipografia"
            onMouseDown={saveSelection}
            onChange={(event) => {
              if (event.target.value) run("fontName", event.target.value);
              event.currentTarget.value = "";
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            defaultValue=""
          >
            <option value="">Fuente</option>
            <option value="Inter">Inter</option>
            <option value="Fraunces">Fraunces</option>
            <option value="Georgia">Georgia</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times</option>
          </select>
          <select
            aria-label="Tamano"
            onMouseDown={saveSelection}
            onChange={(event) => {
              if (event.target.value) run("fontSize", event.target.value);
              event.currentTarget.value = "";
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            defaultValue=""
          >
            <option value="">Tamano</option>
            <option value="2">Pequeno</option>
            <option value="3">Normal</option>
            <option value="4">Mediano</option>
            <option value="5">Grande</option>
            <option value="6">Muy grande</option>
          </select>
          <label
            title="Color de letra"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground"
          >
            <Palette className="h-4 w-4" />
            <input
              type="color"
              onMouseDown={saveSelection}
              onChange={(event) => run("foreColor", event.target.value)}
              className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncFromEditor}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onBlur={syncFromEditor}
          className="prose-content max-h-[420px] w-full overflow-y-auto px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: defaultValue ?? "" }}
        />
      </div>
      <input type="hidden" name={name} value={html} />
      {plainName && <input type="hidden" name={plainName} value={plain} />}
      <div className="mt-1 text-xs text-muted-foreground">
        Si no aplicas formato, se usara el estilo editorial default.
      </div>
    </div>
  );
}

function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<Panel>("dashboard");
  const [feedback, setFeedback] = useState<FeedbackState>({ type: "idle", id: 0 });
  const [articleForm, setArticleForm] = useState<any>(blankArticle);
  const [verticalForm, setVerticalForm] = useState<any>(null);
  const [sectionForm, setSectionForm] = useState<any>({});
  const [liveForm, setLiveForm] = useState<any>({});
  const feedbackId = useRef(0);

  const clearFeedback = useCallback(() => {
    setFeedback({ type: "idle", id: ++feedbackId.current });
  }, []);

  const setMessage = useCallback(
    (nextMessage: string) => {
      const text = nextMessage.trim();
      if (!text) {
        clearFeedback();
        return;
      }

      if (/refrescando|cargando|importando|guardando|subiendo|actualizando/i.test(text)) {
        setFeedback({ type: "loading", message: text, id: ++feedbackId.current });
        return;
      }

      if (isProblemMessage(text)) {
        setFeedback({ type: "error", message: text, id: ++feedbackId.current });
        void logSystemProblem({
          data: {
            message: text,
            panel: activePanel,
            context: {
              path: typeof window !== "undefined" ? window.location.pathname : "/admin",
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            },
          },
        }).catch(() => undefined);
        return;
      }

      setFeedback({ type: "success", message: text, id: ++feedbackId.current });
    },
    [activePanel, clearFeedback],
  );

  async function loadSnapshot() {
    setMessage("");
    try {
      const data = await getAdminSnapshot();
      setSnapshot(data);
      if (!articleForm.vertical_id && data.verticals?.[0]) {
        setArticleForm((current: any) => ({ ...current, vertical_id: data.verticals[0].id }));
      }
      if (!verticalForm && data.verticals?.[0]) setVerticalForm(data.verticals[0]);
    } catch (error: any) {
      setMessage(error?.message ?? "No se pudo cargar el panel.");
    }
  }

  async function handleRefresh() {
    if (activePanel !== "external") {
      await loadSnapshot();
      return;
    }

    setMessage("Refrescando Google News RSS...");
    try {
      const result = await runExternalImport({ data: {} });
      await loadSnapshot();
      setMessage(
        `Google News actualizado. Nuevas: ${result.imported}. Duplicadas/omitidas: ${result.skipped}. Errores: ${result.errors.length}.`,
      );
    } catch (error: any) {
      setMessage(error?.message ?? "No se pudo refrescar Google News.");
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
      if (data.session) void loadSnapshot();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void loadSnapshot();
      else setSnapshot(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function captureRuntimeProblem(event: ErrorEvent | PromiseRejectionEvent) {
      const message =
        "reason" in event
          ? friendlyError(event.reason)
          : event.error?.message || event.message || "Error inesperado del panel.";
      setFeedback({ type: "error", message, id: ++feedbackId.current });
      void logSystemProblem({
        data: {
          message,
          panel: activePanel,
          context: {
            kind: "reason" in event ? "unhandledrejection" : "error",
            path: window.location.pathname,
          },
        },
      }).catch(() => undefined);
    }

    window.addEventListener("error", captureRuntimeProblem);
    window.addEventListener("unhandledrejection", captureRuntimeProblem);
    return () => {
      window.removeEventListener("error", captureRuntimeProblem);
      window.removeEventListener("unhandledrejection", captureRuntimeProblem);
    };
  }, [activePanel]);

  useEffect(() => {
    function handleAnyAdminButton(event: MouseEvent) {
      const target = event.target as Element | null;
      const button = target?.closest("button");
      if (!button || button.disabled) return;
      flashGlobalBusy();
    }

    window.addEventListener("click", handleAnyAdminButton, true);
    return () => window.removeEventListener("click", handleAnyAdminButton, true);
  }, []);

  const sectionsForArticle = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.sections.filter(
      (section: any) => !articleForm.vertical_id || section.vertical_id === articleForm.vertical_id,
    );
  }, [snapshot, articleForm.vertical_id]);

  if (checking) {
    return (
      <AdminShell>
        <div className="p-8 text-sm text-muted-foreground">Verificando sesion...</div>
      </AdminShell>
    );
  }

  if (!session) {
    return <LoginPanel message="" />;
  }

  const mustChangePassword = snapshot?.admin?.profile?.must_change_password;

  return (
    <AdminShell>
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border bg-card/60 xl:block">
          <div className="border-b border-border p-5">
            <div className="font-serif text-2xl font-black">ZEN NEWS</div>
            <div className="mt-1 text-xs font-bold uppercase text-muted-foreground">
              Enterprise CMS
            </div>
          </div>
          <nav className="space-y-1 p-3">
            {panels.map((panel) => {
              const Icon = panel.icon;
              return (
                <button
                  key={panel.id}
                  onClick={() => setActivePanel(panel.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold ${
                    activePanel === panel.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {panel.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
            <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
              <div>
                <div className="text-xs font-bold uppercase text-accent">Panel administrativo</div>
                <h1 className="font-serif text-3xl font-black">
                  {panels.find((panel) => panel.id === activePanel)?.label}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={activePanel}
                  onChange={(event) => setActivePanel(event.target.value as Panel)}
                  className="min-h-10 rounded-md border border-input bg-background px-3 text-sm xl:hidden"
                >
                  {panels.map((panel) => (
                    <option key={panel.id} value={panel.id}>
                      {panel.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void handleRefresh()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted"
                >
                  <RefreshCw className="h-4 w-4" /> Refrescar
                </button>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="min-h-10 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Salir
                </button>
              </div>
            </div>
          </header>

          {mustChangePassword && <PasswordChangePanel onDone={loadSnapshot} />}

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
            {!snapshot ? (
              <div className="rounded-md border border-border p-8 text-sm text-muted-foreground">
                Cargando datos administrativos...
              </div>
            ) : (
              <>
                {activePanel === "dashboard" && <DashboardPanel snapshot={snapshot} />}
                {activePanel === "articles" && (
                  <ArticlesPanel
                    snapshot={snapshot}
                    articleForm={articleForm}
                    setArticleForm={setArticleForm}
                    sectionsForArticle={sectionsForArticle}
                    onSaved={loadSnapshot}
                    setMessage={setMessage}
                  />
                )}
                {activePanel === "verticals" && (
                  <VerticalsPanel
                    snapshot={snapshot}
                    verticalForm={verticalForm}
                    setVerticalForm={setVerticalForm}
                    onSaved={loadSnapshot}
                    setMessage={setMessage}
                  />
                )}
                {activePanel === "sections" && (
                  <SectionsPanel
                    snapshot={snapshot}
                    sectionForm={sectionForm}
                    setSectionForm={setSectionForm}
                    onSaved={loadSnapshot}
                    setMessage={setMessage}
                  />
                )}
                {activePanel === "live" && (
                  <LivePanel
                    snapshot={snapshot}
                    liveForm={liveForm}
                    setLiveForm={setLiveForm}
                    onSaved={loadSnapshot}
                    setMessage={setMessage}
                  />
                )}
                {activePanel === "media" && (
                  <MediaPanel snapshot={snapshot} onSaved={loadSnapshot} setMessage={setMessage} />
                )}
                {activePanel === "external" && (
                  <ExternalPanel
                    snapshot={snapshot}
                    onSaved={loadSnapshot}
                    setMessage={setMessage}
                  />
                )}
                {activePanel === "users" && (
                  <UsersPanel snapshot={snapshot} onSaved={loadSnapshot} setMessage={setMessage} />
                )}
                {activePanel === "appearance" && <AppearancePanel />}
                {activePanel === "audit" && <AuditPanel snapshot={snapshot} />}
                {activePanel === "security" && <SecurityPanel snapshot={snapshot} />}
                {activePanel === "settings" && <SettingsPanel snapshot={snapshot} />}
              </>
            )}
          </main>
        </div>
      </div>
      <AdminFeedback feedback={feedback} onDismiss={clearFeedback} />
    </AdminShell>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  return <div className="h-screen overflow-hidden bg-background text-foreground">{children}</div>;
}

function LoginPanel({ message }: { message: string }) {
  const [error, setError] = useState(message);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginError) setError(loginError.message);
  }

  return (
    <AdminShell>
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <form onSubmit={handleLogin} className="w-full rounded-md border border-border p-6">
          <div className="font-serif text-3xl font-black">ZEN NEWS</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingreso administrativo protegido con Supabase Auth.
          </p>
          <label className="mt-6 block text-sm font-semibold">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Contrasena
            <input
              name="password"
              type="password"
              required
              className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          <button
            disabled={loading}
            className="mt-6 min-h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </main>
    </AdminShell>
  );
}

function PasswordChangePanel({ onDone }: { onDone: () => void }) {
  const [message, setMessage] = useState("");

  async function handleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password.length < 12) {
      setMessage("Usa al menos 12 caracteres.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      return;
    }
    await completeFirstPasswordChange();
    setMessage("Contrasena actualizada.");
    onDone();
  }

  return (
    <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-4 md:px-6">
      <form onSubmit={handleChange} className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <div className="text-xs font-bold uppercase text-destructive">Cambio obligatorio</div>
          <label className="mt-2 block text-sm font-semibold">
            Nueva contrasena
            <input
              name="password"
              type="password"
              minLength={12}
              required
              className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>
        <button className="min-h-10 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground">
          Actualizar
        </button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </form>
    </div>
  );
}

function DashboardPanel({ snapshot }: { snapshot: any }) {
  const kpis = [
    ["Publicadas", snapshot.counts.published],
    ["Borradores", snapshot.counts.draft],
    ["Revision", snapshot.counts.review],
    ["Programadas", snapshot.counts.scheduled],
    ["En vivo activas", snapshot.counts.activeLive],
    ["Imports pendientes", snapshot.counts.pendingImports],
    ["Admins activos", snapshot.counts.admins],
    ["Alertas seguridad", snapshot.counts.securityAlerts],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-md border border-border p-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
            <div className="mt-2 font-serif text-3xl font-black">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <DataBlock title="Actividad editorial reciente">
          <DenseTable
            rows={snapshot.articles.slice(0, 10)}
            columns={[
              ["Titulo", (row: any) => row.title],
              ["Estado", (row: any) => ARTICLE_STATUS_LABELS[row.status] ?? row.status],
              ["Vertical", (row: any) => row.verticals?.name],
              ["Actualizado", (row: any) => new Date(row.updated_at).toLocaleString("es-CR")],
            ]}
          />
        </DataBlock>
        <DataBlock title="Modulos del sistema">
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_MODULES.map((module) => (
              <div
                key={module}
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
              >
                {module}
              </div>
            ))}
          </div>
        </DataBlock>
      </div>
    </div>
  );
}

function ArticlesPanel({
  snapshot,
  articleForm,
  setArticleForm,
  sectionsForArticle,
  onSaved,
  setMessage,
}: any) {
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState("");
  const [preparingArticleVideo, setPreparingArticleVideo] = useState(false);
  const [pendingArticleMedia, setPendingArticleMedia] = useState<{
    file: File;
    url: string;
    kind: "image" | "video";
  } | null>(null);
  const [articleSearch, setArticleSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const filteredArticles = snapshot.articles.filter((article: any) => {
    const matchesText =
      `${article.title} ${article.sections?.name ?? ""} ${article.verticals?.name ?? ""}`
        .toLowerCase()
        .includes(articleSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || article.status === statusFilter;
    return matchesText && matchesStatus;
  });
  const filteredMedia = snapshot.mediaAssets
    .filter((asset: any) =>
      `${asset.alt_text ?? ""} ${asset.caption ?? ""}`
        .toLowerCase()
        .includes(mediaSearch.toLowerCase()),
    )
    .slice(0, 12);

  async function uploadArticleMedia(file: File, kind: "image" | "video") {
    if (!file || file.size === 0) return;
    if (kind === "video") {
      setUploadingMedia(kind);
      try {
        file = await prepareVideoFileForWeb(file, setMessage);
      } catch (error: any) {
        setUploadingMedia("");
        setMessage(friendlyError(error));
        return;
      }
    }
    const allowedImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const allowedVideo =
      ["video/mp4", "video/webm", "video/quicktime"].includes(file.type) ||
      /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (kind === "image" && !allowedImage) return setMessage("La foto debe ser JPG, PNG o WebP.");
    if (kind === "video" && !allowedVideo) return setMessage("El video debe ser MP4, WebM o MOV.");
    if (file.size > (kind === "image" ? 10 : 80) * 1024 * 1024) {
      return setMessage(kind === "image" ? "La foto supera 10 MB." : "El video supera 80 MB.");
    }

    setUploadingMedia(kind);
    try {
      const vertical = snapshot.verticals.find((item: any) => item.id === articleForm.vertical_id);
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const path = `${vertical?.slug ?? "news"}/${kind}s/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      await saveMediaAsset({
        data: {
          vertical_id: articleForm.vertical_id || null,
          url: data.publicUrl,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          alt_text: articleForm.cover_image_alt || articleForm.title || file.name,
          caption: articleForm.cover_image_alt || "",
          kind,
        },
      });
      setArticleForm((current: any) => ({
        ...current,
        ...(kind === "image"
          ? { cover_image_url: data.publicUrl }
          : { video_url: data.publicUrl, cover_image_url: "" }),
      }));
      setPendingArticleMedia(null);
      await onSaved();
      setMessage(
        kind === "image" ? "Foto cargada y seleccionada." : "Video cargado y seleccionado.",
      );
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setUploadingMedia("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const coverImageUrl = String(form.get("cover_image_url") || articleForm.cover_image_url || "");
    const videoUrl = String(form.get("video_url") || articleForm.video_url || "");
    if (!coverImageUrl && !videoUrl) {
      setMessage("Agrega una foto o un video antes de guardar la noticia.");
      return;
    }
    const payload = {
      id: articleForm.id || undefined,
      vertical_id: String(form.get("vertical_id")),
      section_id: String(form.get("section_id") || "") || null,
      author_id: String(form.get("author_id") || "") || null,
      title: String(form.get("title") || ""),
      slug: String(form.get("slug") || ""),
      subtitle: String(form.get("subtitle") || ""),
      summary: String(form.get("summary") || ""),
      lead_html: String(form.get("lead_html") || ""),
      content_html: String(form.get("content_html") || ""),
      cover_image_url: coverImageUrl || null,
      cover_image_alt: String(form.get("cover_image_alt") || ""),
      video_url: videoUrl || null,
      status: String(form.get("status") || "draft") as any,
      source_type: String(form.get("source_type") || "original") as any,
      external_url: String(form.get("external_url") || "") || null,
      external_source_name: String(form.get("external_source_name") || ""),
      seo_title: String(form.get("seo_title") || ""),
      seo_description: String(form.get("seo_description") || ""),
      tags: String(form.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      is_breaking: form.get("is_breaking") === "on",
      is_featured: form.get("is_featured") === "on",
      is_week_main: form.get("is_week_main") === "on",
      is_sponsored: form.get("is_sponsored") === "on",
    };
    try {
      setSaving(true);
      await saveArticle({ data: payload });
      setArticleForm(blankArticle);
      await onSaved();
      setMessage("Noticia guardada.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    try {
      await archiveArticle({ data: { id } });
      await onSaved();
    } catch (error: any) {
      setMessage(friendlyError(error));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1fr_540px]">
      <DataBlock title="Gestion de noticias">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
          <label className="block text-sm font-semibold">
            Buscar
            <div className="mt-2 flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={articleSearch}
                onChange={(event) => setArticleSearch(event.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Titulo, seccion, vertical"
              />
            </div>
          </label>
          <Select
            name="article_status_filter"
            label="Estado"
            defaultValue={statusFilter}
            onChange={setStatusFilter}
          >
            <option value="all">Todos</option>
            {Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <DenseTable
          rows={filteredArticles}
          columns={[
            ["Titulo", (row: any) => row.title],
            ["Estado", (row: any) => ARTICLE_STATUS_LABELS[row.status] ?? row.status],
            ["Vertical", (row: any) => row.verticals?.name],
            ["Vistas", (row: any) => row.views_count],
            [
              "Acciones",
              (row: any) => (
                <div className="flex gap-2">
                  <button
                    onClick={() => setArticleForm(row)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleArchive(row.id)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Archivar
                  </button>
                </div>
              ),
            ],
          ]}
        />
      </DataBlock>

      <DataBlock title={articleForm.id ? "Editar noticia" : "Crear noticia"}>
        <form key={articleForm.id || "new"} onSubmit={handleSubmit} className="space-y-3">
          <Field name="title" label="TITULO" defaultValue={articleForm.title} required />
          <Field name="slug" label="Slug editable" defaultValue={articleForm.slug} />
          <Textarea name="subtitle" label="Bajada" defaultValue={articleForm.subtitle} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              name="vertical_id"
              label="Vertical"
              defaultValue={articleForm.vertical_id}
              onChange={(value) =>
                setArticleForm((current: any) => ({ ...current, vertical_id: value }))
              }
            >
              {snapshot.verticals
                .filter((vertical: any) => vertical.slug !== "news")
                .map((vertical: any) => (
                  <option key={vertical.id} value={vertical.id}>
                    {vertical.name}
                  </option>
                ))}
            </Select>
            <Select name="section_id" label="Seccion" defaultValue={articleForm.section_id}>
              <option value="">Sin seccion</option>
              {sectionsForArticle.map((section: any) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </Select>
          </div>
          <Select name="author_id" label="Autor" defaultValue={articleForm.author_id}>
            <option value="">Sin autor</option>
            {snapshot.authors.map((author: any) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold">
              Foto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) {
                    setPendingArticleMedia({
                      file,
                      url: URL.createObjectURL(file),
                      kind: "image",
                    });
                  }
                }}
                className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Video
              <input
                type="file"
                accept="video/*,.mp4,.webm,.mov,.m4v,.avi,.mkv"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) {
                    setPreparingArticleVideo(true);
                    void prepareVideoFileForWeb(file, setMessage)
                      .then((readyFile) => {
                        setPendingArticleMedia({
                          file: readyFile,
                          url: URL.createObjectURL(readyFile),
                          kind: "video",
                        });
                        if (readyFile !== file) setMessage("Video optimizado para web.");
                      })
                      .catch((error: any) => setMessage(friendlyError(error)))
                      .finally(() => setPreparingArticleVideo(false));
                  }
                }}
                className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            URL de foto externa
            <input
              name="cover_image_url"
              value={articleForm.cover_image_url ?? ""}
              onChange={(event) =>
                setArticleForm((current: any) => ({
                  ...current,
                  cover_image_url: event.target.value,
                  video_url: event.target.value ? "" : current.video_url,
                }))
              }
              className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-sm font-semibold">
            Pie de foto
            <textarea
              name="cover_image_alt"
              value={articleForm.cover_image_alt ?? ""}
              onChange={(event) =>
                setArticleForm((current: any) => ({
                  ...current,
                  cover_image_alt: event.target.value,
                }))
              }
              rows={3}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-sm font-semibold">
            URL de YouTube o video externo
            <input
              name="video_url"
              value={articleForm.video_url ?? ""}
              onChange={(event) =>
                setArticleForm((current: any) => ({
                  ...current,
                  video_url: event.target.value,
                  cover_image_url: event.target.value ? "" : current.cover_image_url,
                }))
              }
              className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <MediaPreview
            imageUrl={
              pendingArticleMedia?.kind === "image"
                ? pendingArticleMedia.url
                : articleForm.cover_image_url
            }
            videoUrl={
              pendingArticleMedia?.kind === "video"
                ? pendingArticleMedia.url
                : articleForm.video_url
            }
            title={articleForm.title}
          />
          {preparingArticleVideo && (
            <div className="rounded-md border border-accent/30 bg-accent/10 p-3 text-xs font-semibold text-accent">
              Preparando video compatible para previsualizacion y publicacion...
            </div>
          )}
          {pendingArticleMedia && (
            <ActionButton
              type="button"
              loading={uploadingMedia === pendingArticleMedia.kind || preparingArticleVideo}
              onClick={() =>
                void uploadArticleMedia(pendingArticleMedia.file, pendingArticleMedia.kind)
              }
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold"
            >
              <Upload className="h-4 w-4" /> Subir media seleccionada
            </ActionButton>
          )}
          <RichTextEditor
            name="lead_html"
            plainName="summary"
            label="Lead"
            defaultValue={articleForm.content?.lead_html || articleForm.summary}
            minHeight={120}
          />
          <RichTextEditor
            name="content_html"
            label="Cuerpo"
            defaultValue={articleForm.content_html}
            minHeight={260}
          />
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <button
              type="button"
              onClick={() => setMediaLibraryOpen((current) => !current)}
              className="flex w-full items-center justify-between text-left text-sm font-bold uppercase text-muted-foreground"
            >
              Biblioteca multimedia
              {mediaLibraryOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {mediaLibraryOpen && (
              <div className="mt-3">
                <label className="mb-3 block text-sm font-semibold">
                  Filtrar biblioteca
                  <input
                    value={mediaSearch}
                    onChange={(event) => setMediaSearch(event.target.value)}
                    className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {filteredMedia.map((asset: any) => (
                    <div key={asset.id} className="rounded-md border border-border p-2">
                      {isImageAsset(asset) ? (
                        <img
                          src={asset.url}
                          alt={asset.alt_text ?? ""}
                          className="aspect-video w-full rounded-md object-cover"
                        />
                      ) : (
                        <video
                          key={asset.url}
                          src={asset.url}
                          className="aspect-video w-full rounded-md bg-black object-contain"
                          controls
                          preload="metadata"
                          playsInline
                        />
                      )}
                      <div className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                        {asset.alt_text || asset.caption || asset.kind}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setArticleForm((current: any) =>
                            isImageAsset(asset)
                              ? {
                                  ...current,
                                  cover_image_url: asset.url,
                                  cover_image_alt: current.cover_image_alt || asset.alt_text,
                                  video_url: "",
                                }
                              : { ...current, video_url: asset.url, cover_image_url: "" },
                          )
                        }
                        className="mt-2 min-h-8 w-full rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground"
                      >
                        Usar en noticia
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select name="status" label="Estado" defaultValue={articleForm.status}>
              {Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              name="source_type"
              label="Tipo de fuente"
              defaultValue={articleForm.source_type}
            >
              <option value="original">Original</option>
              <option value="external">Externa</option>
              <option value="sponsored">Patrocinada</option>
            </Select>
          </div>
          <Field
            name="external_source_name"
            label="Fuente externa"
            defaultValue={articleForm.external_source_name}
          />
          <Field name="external_url" label="URL externa" defaultValue={articleForm.external_url} />
          <Field name="seo_title" label="SEO title" defaultValue={articleForm.seo_title} />
          <Textarea
            name="seo_description"
            label="SEO description"
            defaultValue={articleForm.seo_description}
          />
          <Field name="tags" label="Etiquetas separadas por coma" defaultValue={articleForm.tags} />
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["is_breaking", "Ultima hora"],
              ["is_featured", "Destacada"],
              ["is_week_main", "Principal semana"],
              ["is_sponsored", "Patrocinada"],
            ].map(([name, label]) => (
              <label
                key={name}
                className="flex items-center gap-2 rounded-md border border-border p-2"
              >
                <input name={name} type="checkbox" defaultChecked={!!articleForm[name]} /> {label}
              </label>
            ))}
          </div>
          <ActionButton
            loading={saving || !!uploadingMedia}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Save className="h-4 w-4" /> Guardar
          </ActionButton>
        </form>
      </DataBlock>
    </div>
  );
}

function VerticalsPanel({ snapshot, verticalForm, setVerticalForm, onSaved, setMessage }: any) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await saveVertical({
        data: {
          id: verticalForm.id,
          name: String(form.get("name") || ""),
          tagline: String(form.get("tagline") || ""),
          description: String(form.get("description") || ""),
          mission: String(form.get("mission") || ""),
          vision: String(form.get("vision") || ""),
          primary_color: String(form.get("primary_color") || "#111827"),
          accent_color: String(form.get("accent_color") || "#c9a84c"),
          seo_title: String(form.get("seo_title") || ""),
          seo_description: String(form.get("seo_description") || ""),
          active: form.get("active") === "on",
          sort_order: Number(form.get("sort_order") || 0),
        },
      });
      await onSaved();
      setMessage("Vertical actualizada.");
    } catch (error: any) {
      setMessage(error?.message ?? "No se pudo guardar la vertical.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
      <DataBlock title="Verticales">
        <div className="space-y-2">
          {snapshot.verticals.map((vertical: any) => (
            <button
              key={vertical.id}
              onClick={() => setVerticalForm(vertical)}
              className="w-full rounded-md border border-border p-3 text-left hover:bg-muted"
            >
              <div className="font-semibold">{vertical.name}</div>
              <div className="text-xs text-muted-foreground">
                {vertical.slug} / {vertical.active ? "activa" : "inactiva"}
              </div>
            </button>
          ))}
        </div>
      </DataBlock>
      {verticalForm && (
        <DataBlock title="Configuracion de vertical">
          <form
            key={verticalForm.id}
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            <Field name="name" label="Nombre" defaultValue={verticalForm.name} required />
            <Field name="tagline" label="Tagline" defaultValue={verticalForm.tagline} />
            <Textarea
              name="description"
              label="Descripcion"
              defaultValue={verticalForm.description}
            />
            <Textarea name="mission" label="Mision" defaultValue={verticalForm.mission} />
            <Textarea name="vision" label="Vision" defaultValue={verticalForm.vision} />
            <Field
              name="primary_color"
              label="Color primario"
              defaultValue={verticalForm.primary_color}
            />
            <Field
              name="accent_color"
              label="Color acento"
              defaultValue={verticalForm.accent_color}
            />
            <Field
              name="sort_order"
              label="Orden"
              type="number"
              defaultValue={verticalForm.sort_order}
            />
            <Field name="seo_title" label="SEO title" defaultValue={verticalForm.seo_title} />
            <Textarea
              name="seo_description"
              label="SEO description"
              defaultValue={verticalForm.seo_description}
            />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input name="active" type="checkbox" defaultChecked={verticalForm.active} /> Activa
            </label>
            <div>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
                <Save className="h-4 w-4" /> Guardar vertical
              </button>
            </div>
          </form>
        </DataBlock>
      )}
    </div>
  );
}

function SectionsPanel({ snapshot, sectionForm, setSectionForm, onSaved, setMessage }: any) {
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    vertical: "all",
    active: "all",
    menu: "all",
    home: "all",
  });
  const filteredSections = snapshot.sections.filter((section: any) => {
    const q = `${section.name} ${section.slug} ${section.description ?? ""}`
      .toLowerCase()
      .includes(filters.q.toLowerCase());
    const vertical = filters.vertical === "all" || section.vertical_id === filters.vertical;
    const active = filters.active === "all" || String(section.active) === filters.active;
    const menu = filters.menu === "all" || String(section.show_in_menu) === filters.menu;
    const home = filters.home === "all" || String(section.show_in_home) === filters.home;
    return q && vertical && active && menu && home;
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setSaving(true);
      await saveSection({
        data: {
          id: sectionForm.id || undefined,
          vertical_id: String(form.get("vertical_id")),
          name: String(form.get("name") || ""),
          slug: String(form.get("slug") || ""),
          description: String(form.get("description") || ""),
          color: String(form.get("color") || ""),
          sort_order: Number(form.get("sort_order") || 0),
          show_in_menu: form.get("show_in_menu") === "on",
          show_in_home: form.get("show_in_home") === "on",
          active: form.get("active") === "on",
        },
      });
      setSectionForm({});
      await onSaved();
      setMessage("Seccion guardada.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
      <DataBlock title="Secciones administrables">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <Field
            name="section_q"
            label="Buscar"
            defaultValue={filters.q}
            onChange={(value: string) => setFilters((current) => ({ ...current, q: value }))}
          />
          <Select
            name="section_vertical"
            label="Vertical"
            defaultValue={filters.vertical}
            onChange={(value: string) => setFilters((current) => ({ ...current, vertical: value }))}
          >
            <option value="all">Todas</option>
            {snapshot.verticals
              .filter((vertical: any) => vertical.slug !== "news")
              .map((vertical: any) => (
                <option key={vertical.id} value={vertical.id}>
                  {vertical.name}
                </option>
              ))}
          </Select>
          <Select
            name="section_active"
            label="Activa"
            defaultValue={filters.active}
            onChange={(value: string) => setFilters((current) => ({ ...current, active: value }))}
          >
            <option value="all">Todas</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </Select>
          <Select
            name="section_menu"
            label="Menu"
            defaultValue={filters.menu}
            onChange={(value: string) => setFilters((current) => ({ ...current, menu: value }))}
          >
            <option value="all">Todo</option>
            <option value="true">Si</option>
            <option value="false">No</option>
          </Select>
          <Select
            name="section_home"
            label="Home"
            defaultValue={filters.home}
            onChange={(value: string) => setFilters((current) => ({ ...current, home: value }))}
          >
            <option value="all">Todo</option>
            <option value="true">Si</option>
            <option value="false">No</option>
          </Select>
        </div>
        <DenseTable
          rows={filteredSections}
          columns={[
            ["Nombre", (row: any) => row.name],
            ["Vertical", (row: any) => row.verticals?.name],
            ["Menu", (row: any) => (row.show_in_menu ? "Si" : "No")],
            ["Home", (row: any) => (row.show_in_home ? "Si" : "No")],
            [
              "",
              (row: any) => (
                <button
                  onClick={() => setSectionForm(row)}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                >
                  Editar
                </button>
              ),
            ],
          ]}
        />
      </DataBlock>
      <DataBlock title={sectionForm.id ? "Editar seccion" : "Crear seccion"}>
        <form key={sectionForm.id || "new-section"} onSubmit={handleSubmit} className="space-y-3">
          <Select
            name="vertical_id"
            label="Vertical"
            defaultValue={
              sectionForm.vertical_id || snapshot.verticals.find((v: any) => v.slug !== "news")?.id
            }
          >
            {snapshot.verticals
              .filter((vertical: any) => vertical.slug !== "news")
              .map((vertical: any) => (
                <option key={vertical.id} value={vertical.id}>
                  {vertical.name}
                </option>
              ))}
          </Select>
          <Field name="name" label="Nombre" defaultValue={sectionForm.name} required />
          <Field name="slug" label="Slug" defaultValue={sectionForm.slug} />
          <Field name="color" label="Color/icono" defaultValue={sectionForm.color} />
          <Field
            name="sort_order"
            label="Orden"
            type="number"
            defaultValue={sectionForm.sort_order ?? 0}
          />
          <Textarea name="description" label="Descripcion" defaultValue={sectionForm.description} />
          <label className="flex items-center gap-2 text-sm">
            <input
              name="show_in_menu"
              type="checkbox"
              defaultChecked={sectionForm.show_in_menu ?? true}
            />{" "}
            Aparece en menu
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="show_in_home"
              type="checkbox"
              defaultChecked={sectionForm.show_in_home ?? true}
            />{" "}
            Aparece en home
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked={sectionForm.active ?? true} />{" "}
            Activa
          </label>
          <ActionButton
            loading={saving}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Save className="h-4 w-4" /> Guardar
          </ActionButton>
        </form>
      </DataBlock>
    </div>
  );
}

function LivePanel({ snapshot, liveForm, setLiveForm, onSaved, setMessage }: any) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await saveLiveStream({
        data: {
          id: liveForm.id || undefined,
          vertical_id: String(form.get("vertical_id") || "") || null,
          title: String(form.get("title") || ""),
          description: String(form.get("description") || ""),
          platform: String(form.get("platform") || "youtube") as any,
          stream_url: String(form.get("stream_url") || ""),
          cover_image_url: String(form.get("cover_image_url") || "") || null,
          status: String(form.get("status") || "scheduled") as any,
          starts_at: String(form.get("starts_at") || "") || null,
          ends_at: String(form.get("ends_at") || "") || null,
          allow_live_button: form.get("allow_live_button") === "on",
        },
      });
      setLiveForm({});
      await onSaved();
      setMessage("Transmision guardada.");
    } catch (error: any) {
      setMessage(error?.message ?? "No se pudo guardar el en vivo.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_460px]">
      <DataBlock title="Transmisiones">
        <DenseTable
          rows={snapshot.liveStreams}
          columns={[
            ["Titulo", (row: any) => row.title],
            ["Estado", (row: any) => LIVE_STATUS_LABELS[row.status] ?? row.status],
            ["Plataforma", (row: any) => row.platform],
            ["Vertical", (row: any) => row.verticals?.name ?? "Global"],
            [
              "",
              (row: any) => (
                <button
                  onClick={() => setLiveForm(row)}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                >
                  Editar
                </button>
              ),
            ],
          ]}
        />
      </DataBlock>
      <DataBlock title={liveForm.id ? "Editar transmision" : "Crear transmision"}>
        <form key={liveForm.id || "new-live"} onSubmit={handleSubmit} className="space-y-3">
          <Field name="title" label="Titulo" defaultValue={liveForm.title} required />
          <Textarea name="description" label="Descripcion" defaultValue={liveForm.description} />
          <Select
            name="vertical_id"
            label="Vertical asociada"
            defaultValue={liveForm.vertical_id || ""}
          >
            <option value="">ZEN NEWS global</option>
            {snapshot.verticals
              .filter((vertical: any) => vertical.slug !== "news")
              .map((vertical: any) => (
                <option key={vertical.id} value={vertical.id}>
                  {vertical.name}
                </option>
              ))}
          </Select>
          <Select name="platform" label="Plataforma" defaultValue={liveForm.platform || "youtube"}>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="other">Otra</option>
          </Select>
          <Field
            name="stream_url"
            label="Link o embed"
            defaultValue={liveForm.stream_url}
            required
          />
          <Field name="cover_image_url" label="Portada" defaultValue={liveForm.cover_image_url} />
          <Select name="status" label="Estado" defaultValue={liveForm.status || "scheduled"}>
            {Object.entries(LIVE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Field name="starts_at" label="Inicio" type="datetime-local" />
          <Field name="ends_at" label="Finalizacion" type="datetime-local" />
          <label className="flex items-center gap-2 text-sm">
            <input
              name="allow_live_button"
              type="checkbox"
              defaultChecked={liveForm.allow_live_button ?? true}
            />{" "}
            Mostrar boton EN VIVO
          </label>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            <Save className="h-4 w-4" /> Guardar en vivo
          </button>
        </form>
      </DataBlock>
    </div>
  );
}

function MediaPanel({ snapshot, onSaved, setMessage }: any) {
  const [selectedPreview, setSelectedPreview] = useState<{
    url: string;
    kind: "image" | "video";
  } | null>(null);
  const [preparedUploadFile, setPreparedUploadFile] = useState<File | null>(null);
  const [externalMediaUrl, setExternalMediaUrl] = useState("");
  const [savingMedia, setSavingMedia] = useState(false);
  const [preparingMediaVideo, setPreparingMediaVideo] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState("");
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<any>(null);
  const [mediaFilter, setMediaFilter] = useState({ q: "", vertical: "all", kind: "all" });
  const filteredAssets = snapshot.mediaAssets.filter((asset: any) => {
    const text = `${asset.alt_text ?? ""} ${asset.caption ?? ""} ${asset.verticals?.name ?? ""}`
      .toLowerCase()
      .includes(mediaFilter.q.toLowerCase());
    const verticalOk = mediaFilter.vertical === "all" || asset.vertical_id === mediaFilter.vertical;
    const kindOk =
      mediaFilter.kind === "all" ||
      (mediaFilter.kind === "image" && isImageAsset(asset)) ||
      (mediaFilter.kind === "video" && isVideoAsset(asset));
    return text && verticalOk && kindOk;
  });

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedFile = form.get("file") as File;
    const file =
      preparedUploadFile && preparedUploadFile.size > 0 ? preparedUploadFile : selectedFile;
    const alt = String(form.get("alt_text") || "");
    const verticalId = String(form.get("vertical_id") || "") || null;
    if (!file || file.size === 0) return setMessage("Selecciona un archivo.");
    const kind = isVideoFile(file) ? "video" : "image";
    const allowed =
      ["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      ["video/mp4", "video/webm", "video/quicktime"].includes(file.type) ||
      /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (!allowed) return setMessage("Solo JPG, PNG, WebP, MP4, WebM o MOV.");
    if (file.size > (kind === "video" ? 80 : 10) * 1024 * 1024)
      return setMessage(kind === "video" ? "El video supera 80 MB." : "La imagen supera 10 MB.");
    if (alt.length < 3) return setMessage("El alt text es obligatorio.");

    setSavingMedia(true);
    try {
      const vertical = snapshot.verticals.find((item: any) => item.id === verticalId);
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const path = `${vertical?.slug ?? "news"}/${kind}s/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      await saveMediaAsset({
        data: {
          vertical_id: verticalId,
          url: data.publicUrl,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          alt_text: alt,
          caption: String(form.get("caption") || ""),
          kind,
        },
      });
      await onSaved();
      setSelectedPreview(null);
      setPreparedUploadFile(null);
      setMessage("Multimedia guardada en biblioteca.");
      event.currentTarget.reset();
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setSavingMedia(false);
    }
  }

  async function handleExternalMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get("external_url") || "");
    const alt = String(form.get("external_alt") || "");
    const verticalId = String(form.get("external_vertical_id") || "") || null;
    const kind = deriveYouTubeEmbedUrl(url) || isLikelyVideoFileUrl(url) ? "video" : "image";
    if (!url.startsWith("http")) return setMessage("Ingresa una URL valida.");
    if (alt.length < 3) return setMessage("El alt text es obligatorio.");

    setSavingMedia(true);
    try {
      await saveMediaAsset({
        data: {
          vertical_id: verticalId,
          url,
          storage_path: null,
          mime_type: kind === "video" ? "video/external" : "image/external",
          size_bytes: null,
          alt_text: alt,
          caption: String(form.get("external_caption") || ""),
          kind,
        },
      });
      await onSaved();
      setMessage("URL agregada a biblioteca.");
      setExternalMediaUrl("");
      event.currentTarget.reset();
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setSavingMedia(false);
    }
  }

  async function handleDeleteAsset(asset: any) {
    setDeletingAsset(asset.id);
    try {
      await deleteMediaAsset({ data: { id: asset.id } });
      await onSaved();
      setPendingDeleteAsset(null);
      setMessage("Multimedia eliminada.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setDeletingAsset("");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
      <DataBlock title="Subir multimedia">
        <form onSubmit={handleUpload} className="space-y-3">
          <Select name="vertical_id" label="Carpeta vertical" defaultValue="">
            <option value="">ZEN NEWS</option>
            {snapshot.verticals
              .filter((vertical: any) => vertical.slug !== "news")
              .map((vertical: any) => (
                <option key={vertical.id} value={vertical.id}>
                  {vertical.name}
                </option>
              ))}
          </Select>
          <Field name="alt_text" label="Alt text" required />
          <Field name="caption" label="Caption" />
          <label className="block text-sm font-semibold">
            Archivo
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/*,.mp4,.webm,.mov,.m4v,.avi,.mkv"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  const kind = isVideoFile(file) ? "video" : "image";
                  if (kind === "video") {
                    setPreparingMediaVideo(true);
                    void prepareVideoFileForWeb(file, setMessage)
                      .then((readyFile) => {
                        setPreparedUploadFile(readyFile);
                        setSelectedPreview({
                          url: URL.createObjectURL(readyFile),
                          kind: "video",
                        });
                        if (readyFile !== file) setMessage("Video optimizado para web.");
                      })
                      .catch((error: any) => setMessage(friendlyError(error)))
                      .finally(() => setPreparingMediaVideo(false));
                    return;
                  }
                  setPreparedUploadFile(file);
                  setSelectedPreview({ url: URL.createObjectURL(file), kind });
                }
              }}
              className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          {selectedPreview && (
            <MediaPreview
              imageUrl={selectedPreview.kind === "image" ? selectedPreview.url : ""}
              videoUrl={selectedPreview.kind === "video" ? selectedPreview.url : ""}
              title="Preview multimedia"
            />
          )}
          {preparingMediaVideo && (
            <div className="rounded-md border border-accent/30 bg-accent/10 p-3 text-xs font-semibold text-accent">
              Preparando video compatible para previsualizacion y publicacion...
            </div>
          )}
          <ActionButton
            loading={savingMedia || preparingMediaVideo}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Upload className="h-4 w-4" /> Subir
          </ActionButton>
        </form>

        <form onSubmit={handleExternalMedia} className="mt-6 space-y-3 border-t border-border pt-4">
          <Select name="external_vertical_id" label="Vertical" defaultValue="">
            <option value="">ZEN NEWS</option>
            {snapshot.verticals
              .filter((vertical: any) => vertical.slug !== "news")
              .map((vertical: any) => (
                <option key={vertical.id} value={vertical.id}>
                  {vertical.name}
                </option>
              ))}
          </Select>
          <Field
            name="external_url"
            label="URL imagen / YouTube / video"
            required
            onChange={setExternalMediaUrl}
          />
          <Field name="external_alt" label="Alt text" required />
          <Field name="external_caption" label="Caption" />
          {externalMediaUrl && (
            <MediaPreview
              imageUrl={
                deriveYouTubeEmbedUrl(externalMediaUrl) || isLikelyVideoFileUrl(externalMediaUrl)
                  ? ""
                  : externalMediaUrl
              }
              videoUrl={
                deriveYouTubeEmbedUrl(externalMediaUrl) || isLikelyVideoFileUrl(externalMediaUrl)
                  ? externalMediaUrl
                  : ""
              }
              title="Preview URL"
            />
          )}
          <ActionButton
            loading={savingMedia}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold"
          >
            <Play className="h-4 w-4" /> Guardar URL
          </ActionButton>
        </form>
      </DataBlock>
      <DataBlock title="Biblioteca">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field
            name="media_q"
            label="Buscar"
            defaultValue={mediaFilter.q}
            onChange={(value: string) => setMediaFilter((current) => ({ ...current, q: value }))}
          />
          <Select
            name="media_vertical"
            label="Vertical"
            defaultValue={mediaFilter.vertical}
            onChange={(value: string) =>
              setMediaFilter((current) => ({ ...current, vertical: value }))
            }
          >
            <option value="all">Todas</option>
            {snapshot.verticals.map((vertical: any) => (
              <option key={vertical.id} value={vertical.id}>
                {vertical.name}
              </option>
            ))}
          </Select>
          <Select
            name="media_kind"
            label="Tipo"
            defaultValue={mediaFilter.kind}
            onChange={(value: string) => setMediaFilter((current) => ({ ...current, kind: value }))}
          >
            <option value="all">Todo</option>
            <option value="image">Imagenes</option>
            <option value="video">Videos</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {filteredAssets.map((asset: any) => (
            <div key={asset.id} className="rounded-md border border-border p-2">
              {isImageAsset(asset) ? (
                <img
                  src={asset.url}
                  alt={asset.alt_text ?? ""}
                  className="aspect-video w-full rounded-md object-cover"
                />
              ) : (
                <video
                  key={asset.url}
                  src={asset.url}
                  controls
                  preload="metadata"
                  playsInline
                  className="aspect-video w-full rounded-md bg-black object-contain"
                />
              )}
              <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {asset.alt_text}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(asset.url);
                    setMessage("URL copiada.");
                  }}
                  className="min-h-8 rounded-md border border-border px-2 text-xs font-semibold"
                >
                  Copiar URL
                </button>
                <ActionButton
                  type="button"
                  loading={deletingAsset === asset.id}
                  onClick={() => setPendingDeleteAsset(asset)}
                  className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-destructive/40 px-2 text-xs font-semibold text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      </DataBlock>
      {pendingDeleteAsset && (
        <ConfirmDialog
          title="Eliminar multimedia"
          description="Se eliminara de la biblioteca y tambien del storage cuando aplique. Si esta usado en una noticia o transmision, el sistema lo va a bloquear para no romper contenido publicado."
          loading={deletingAsset === pendingDeleteAsset.id}
          confirmLabel="Eliminar"
          onCancel={() => setPendingDeleteAsset(null)}
          onConfirm={() => void handleDeleteAsset(pendingDeleteAsset)}
        />
      )}
    </div>
  );
}

function ExternalPanel({
  snapshot,
  onSaved,
  setMessage,
}: {
  snapshot: any;
  onSaved: () => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const defaultVertical = snapshot.verticals.find((vertical: any) => vertical.slug !== "news");
  const [sourceForm, setSourceForm] = useState<any>({
    id: "",
    name: "",
    kind: "google_news",
    url: "",
    query: "",
    language: "es",
    country: "",
    active: true,
  });
  const [importTarget, setImportTarget] = useState<any>({
    vertical_id: defaultVertical?.id ?? "",
    section_id: "",
    author_id: snapshot.authors?.[0]?.id ?? "",
    status: "draft",
  });
  const [selectedImport, setSelectedImport] = useState<any>(null);
  const [importMode, setImportMode] = useState<"detail" | "edit" | "convert" | "external">(
    "detail",
  );
  const [importForm, setImportForm] = useState<any>({
    title: "",
    summary: "",
    image_url: "",
    content_html: "",
    source_name: "",
    original_url: "",
  });
  const [externalFilters, setExternalFilters] = useState({
    q: "",
    source: "all",
    sourceActive: "all",
  });
  const [externalBusy, setExternalBusy] = useState("");

  const targetSections = snapshot.sections.filter(
    (section: any) => !importTarget.vertical_id || section.vertical_id === importTarget.vertical_id,
  );
  const filteredSources = snapshot.externalSources.filter((source: any) => {
    const q = `${source.name} ${source.config?.url ?? ""}`
      .toLowerCase()
      .includes(externalFilters.q.toLowerCase());
    const active =
      externalFilters.sourceActive === "all" ||
      String(source.active) === externalFilters.sourceActive;
    return q && active;
  });
  const filteredImports = snapshot.externalImports.filter((item: any) => {
    const q = `${item.title ?? ""} ${item.description ?? ""} ${item.source_name ?? ""}`
      .toLowerCase()
      .includes(externalFilters.q.toLowerCase());
    const source = externalFilters.source === "all" || item.source_id === externalFilters.source;
    return q && source;
  });

  function sectionForSource(row: any, verticalId: string) {
    const sectionSlug = row.external_sources?.config?.section_slug;
    return (
      snapshot.sections.find(
        (section: any) => section.vertical_id === verticalId && section.slug === sectionSlug,
      )?.id ?? ""
    );
  }

  function openImport(row: any, mode: "detail" | "edit" | "convert" | "external") {
    const verticalSlug = row.external_sources?.config?.vertical_slug;
    const sourceVertical =
      snapshot.verticals.find((vertical: any) => vertical.slug === verticalSlug) ?? defaultVertical;
    setSelectedImport(row);
    setImportMode(mode);
    setImportForm({
      title: row.title ?? "",
      summary: row.description ?? "",
      image_url: row.image_url ?? "",
      content_html: "",
      source_name: row.source_name ?? row.external_sources?.name ?? "",
      original_url: row.original_url ?? row.external_url ?? "",
    });
    setImportTarget((current: any) => ({
      ...current,
      vertical_id:
        sourceVertical?.slug === "news" ? (defaultVertical?.id ?? "") : sourceVertical?.id,
      section_id: sectionForSource(
        row,
        sourceVertical?.slug === "news" ? (defaultVertical?.id ?? "") : sourceVertical?.id,
      ),
      status: mode === "external" ? "published" : "draft",
    }));
  }

  async function handleSaveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    setExternalBusy("source");
    try {
      await saveExternalSource({
        data: {
          id: sourceForm.id || undefined,
          name: String(form.get("name") || ""),
          kind: "google_news",
          url: String(form.get("url") || ""),
          query: String(form.get("query") || ""),
          language: String(form.get("language") || "es"),
          country: String(form.get("country") || ""),
          active: form.get("active") === "on",
        },
      });
      setSourceForm({
        id: "",
        name: "",
        kind: "google_news",
        url: "",
        query: "",
        language: "es",
        country: "",
        active: true,
      });
      await onSaved();
      setMessage("Fuente externa guardada.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setExternalBusy("");
    }
  }

  async function handleRunImport(sourceId?: string) {
    setMessage("Refrescando Google News RSS...");
    setExternalBusy(sourceId ? `import-${sourceId}` : "import-all");
    try {
      const result = await runExternalImport({ data: sourceId ? { source_id: sourceId } : {} });
      await onSaved();
      setMessage(
        `Google News actualizado. Nuevas: ${result.imported}. Duplicadas/omitidas: ${result.skipped}. Errores: ${result.errors.length}.`,
      );
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setExternalBusy("");
    }
  }

  async function handleUpdateImport() {
    if (!selectedImport) return;
    setExternalBusy("edit-import");
    try {
      await updateExternalImport({
        data: {
          id: selectedImport.id,
          title: importForm.title,
          description: importForm.summary,
          image_url: importForm.image_url || null,
          source_name: importForm.source_name,
          original_url: importForm.original_url,
        },
      });
      await onSaved();
      setMessage("Import externo actualizado.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setExternalBusy("");
    }
  }

  async function handlePromote(importId: string) {
    if (!importTarget.vertical_id) {
      setMessage("Selecciona la vertical destino antes de convertir.");
      return;
    }
    setExternalBusy("convert");
    try {
      await promoteExternalImport({
        data: {
          id: importId,
          vertical_id: importTarget.vertical_id,
          section_id: importTarget.section_id || null,
          author_id: importTarget.author_id || null,
          title: importForm.title,
          summary: importForm.summary,
          image_url: importForm.image_url || null,
          content_html: importForm.content_html,
          source_name: importForm.source_name,
          original_url: importForm.original_url,
          status: importTarget.status,
        },
      });
      setSelectedImport(null);
      await onSaved();
      setMessage("Contenido convertido en noticia.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setExternalBusy("");
    }
  }

  async function handlePublishExternal(importId: string) {
    if (!importTarget.vertical_id) {
      setMessage("Selecciona la vertical destino antes de publicar.");
      return;
    }
    setExternalBusy("publish-link");
    try {
      await publishExternalImportLink({
        data: {
          id: importId,
          vertical_id: importTarget.vertical_id,
          section_id: importTarget.section_id || null,
          author_id: importTarget.author_id || null,
          title: importForm.title,
          summary: importForm.summary,
          image_url: importForm.image_url || null,
          source_name: importForm.source_name,
          original_url: importForm.original_url,
        },
      });
      setSelectedImport(null);
      await onSaved();
      setMessage("Enlace externo publicado.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setExternalBusy("");
    }
  }

  async function handleDiscard(importId: string) {
    setExternalBusy("reject");
    try {
      await discardExternalImport({ data: { id: importId } });
      setSelectedImport(null);
      await onSaved();
      setMessage("Contenido externo rechazado.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setExternalBusy("");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_1fr]">
      <DataBlock title={sourceForm.id ? "Editar Google News RSS" : "Nueva fuente Google News"}>
        <form key={sourceForm.id || "new-source"} onSubmit={handleSaveSource} className="space-y-3">
          <Field name="name" label="Nombre de la fuente" defaultValue={sourceForm.name} required />
          <Select name="kind" label="Tipo" defaultValue={sourceForm.kind}>
            <option value="google_news">Google News RSS</option>
          </Select>
          <Field name="url" label="URL RSS de Google News" defaultValue={sourceForm.url} required />
          <Field name="query" label="Etiqueta interna opcional" defaultValue={sourceForm.query} />
          <div className="grid grid-cols-2 gap-3">
            <Field name="language" label="Idioma" defaultValue={sourceForm.language} />
            <Field name="country" label="Pais" defaultValue={sourceForm.country} />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input name="active" type="checkbox" defaultChecked={sourceForm.active} />
            Fuente activa
          </label>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              loading={externalBusy === "source"}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Guardar fuente
            </ActionButton>
            {sourceForm.id && (
              <button
                type="button"
                onClick={() =>
                  setSourceForm({
                    id: "",
                    name: "",
                    kind: "google_news",
                    url: "",
                    query: "",
                    language: "es",
                    country: "",
                    active: true,
                  })
                }
                className="min-h-10 rounded-md border border-border px-4 text-sm font-semibold"
              >
                Nueva
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 border-t border-border pt-4">
          <ActionButton
            type="button"
            loading={externalBusy === "import-all"}
            onClick={() => void handleRunImport()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground"
          >
            Refrescar Google News ahora
          </ActionButton>
        </div>
      </DataBlock>

      <div className="space-y-6">
        <DataBlock title="Fuentes configuradas">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field
              name="external_q"
              label="Buscar"
              defaultValue={externalFilters.q}
              onChange={(value: string) =>
                setExternalFilters((current) => ({ ...current, q: value }))
              }
            />
            <Select
              name="external_source"
              label="Fuente"
              defaultValue={externalFilters.source}
              onChange={(value: string) =>
                setExternalFilters((current) => ({ ...current, source: value }))
              }
            >
              <option value="all">Todas</option>
              {snapshot.externalSources.map((source: any) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </Select>
            <Select
              name="source_active"
              label="Estado fuente"
              defaultValue={externalFilters.sourceActive}
              onChange={(value: string) =>
                setExternalFilters((current) => ({ ...current, sourceActive: value }))
              }
            >
              <option value="all">Todas</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </Select>
          </div>
          <DenseTable
            rows={filteredSources}
            columns={[
              ["Nombre", (row: any) => row.name],
              ["Tipo", (row: any) => row.kind],
              ["Estado", (row: any) => (row.active ? "activa" : "inactiva")],
              [
                "URL/Query",
                (row: any) => row.config?.url ?? row.config?.rss_url ?? row.config?.query ?? "-",
              ],
              [
                "Acciones",
                (row: any) => (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSourceForm({
                          id: row.id,
                          name: row.name,
                          kind: row.kind,
                          url: row.config?.url ?? row.config?.rss_url ?? "",
                          query: row.config?.query ?? "",
                          language: row.config?.language ?? "es",
                          country: row.config?.country ?? "",
                          active: row.active,
                        })
                      }
                      className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
                    >
                      Editar
                    </button>
                    <ActionButton
                      type="button"
                      loading={externalBusy === `import-${row.id}`}
                      onClick={() => void handleRunImport(row.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                    >
                      Importar
                    </ActionButton>
                  </div>
                ),
              ],
            ]}
          />
        </DataBlock>

        <DataBlock title="Integraciones preparadas">
          <DenseTable
            rows={snapshot.integrations}
            columns={[
              ["Proveedor", (row: any) => row.label],
              ["Estado", (row: any) => row.last_status],
              ["Variable", (row: any) => row.secret_env_key ?? "RSS/manual"],
            ]}
          />
        </DataBlock>

        <DataBlock title="Contenido externo pendiente">
          {selectedImport && (
            <div className="mb-5 rounded-md border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-accent">
                    {importMode === "detail" && "Detalle"}
                    {importMode === "edit" && "Editar insumo"}
                    {importMode === "convert" && "Convertir en noticia interna"}
                    {importMode === "external" && "Publicar como enlace externo"}
                  </div>
                  <h3 className="mt-1 font-serif text-xl font-bold">{selectedImport.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fuente: {importForm.source_name || selectedImport.external_sources?.name} ·{" "}
                    {selectedImport.published_at
                      ? new Date(selectedImport.published_at).toLocaleString("es-CR")
                      : "Sin fecha"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImport(null)}
                  className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>

              {importMode === "detail" ? (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
                  {importForm.image_url ? (
                    <img
                      src={importForm.image_url}
                      alt={importForm.title}
                      className="aspect-video w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-md bg-background text-xs text-muted-foreground">
                      Sin imagen
                    </div>
                  )}
                  <div className="text-sm leading-6">
                    <p>{importForm.summary || "Sin resumen."}</p>
                    <a
                      href={importForm.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block font-semibold text-accent"
                    >
                      Abrir fuente original
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-semibold">
                    Titulo editorial
                    <input
                      value={importForm.title}
                      onChange={(event) =>
                        setImportForm((current: any) => ({ ...current, title: event.target.value }))
                      }
                      className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Resumen
                    <textarea
                      value={importForm.summary}
                      onChange={(event) =>
                        setImportForm((current: any) => ({
                          ...current,
                          summary: event.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      Imagen
                      <input
                        value={importForm.image_url}
                        onChange={(event) =>
                          setImportForm((current: any) => ({
                            ...current,
                            image_url: event.target.value,
                          }))
                        }
                        className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Fuente original
                      <input
                        value={importForm.source_name}
                        onChange={(event) =>
                          setImportForm((current: any) => ({
                            ...current,
                            source_name: event.target.value,
                          }))
                        }
                        className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold">
                    URL original
                    <input
                      value={importForm.original_url}
                      onChange={(event) =>
                        setImportForm((current: any) => ({
                          ...current,
                          original_url: event.target.value,
                        }))
                      }
                      className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </label>

                  {(importMode === "convert" || importMode === "external") && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <Select
                        name="vertical_id"
                        label="Vertical destino"
                        defaultValue={importTarget.vertical_id}
                        onChange={(value: string) =>
                          setImportTarget((current: any) => ({
                            ...current,
                            vertical_id: value,
                            section_id: "",
                          }))
                        }
                      >
                        {snapshot.verticals
                          .filter((vertical: any) => vertical.slug !== "news")
                          .map((vertical: any) => (
                            <option key={vertical.id} value={vertical.id}>
                              {vertical.name}
                            </option>
                          ))}
                      </Select>
                      <Select
                        name="section_id"
                        label="Seccion"
                        defaultValue={importTarget.section_id}
                        onChange={(value: string) =>
                          setImportTarget((current: any) => ({ ...current, section_id: value }))
                        }
                      >
                        <option value="">Sin seccion</option>
                        {targetSections.map((section: any) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        name="author_id"
                        label="Autor"
                        defaultValue={importTarget.author_id}
                        onChange={(value: string) =>
                          setImportTarget((current: any) => ({ ...current, author_id: value }))
                        }
                      >
                        <option value="">Sin autor</option>
                        {snapshot.authors.map((author: any) => (
                          <option key={author.id} value={author.id}>
                            {author.name}
                          </option>
                        ))}
                      </Select>
                      {importMode === "convert" ? (
                        <Select
                          name="status"
                          label="Estado"
                          defaultValue={importTarget.status}
                          onChange={(value: string) =>
                            setImportTarget((current: any) => ({ ...current, status: value }))
                          }
                        >
                          <option value="draft">Borrador</option>
                          <option value="review">Revision</option>
                          <option value="published">Publicar</option>
                        </Select>
                      ) : (
                        <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                          Se publica como enlace externo.
                        </div>
                      )}
                    </div>
                  )}

                  {importMode === "convert" && (
                    <label className="block text-sm font-semibold">
                      Contenido editorial propio
                      <textarea
                        value={importForm.content_html}
                        onChange={(event) =>
                          setImportForm((current: any) => ({
                            ...current,
                            content_html: event.target.value,
                          }))
                        }
                        rows={6}
                        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="<p>Redaccion propia del equipo ZEN. No se copia el articulo externo completo.</p>"
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode("edit")}
                  className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
                >
                  Editar
                </button>
                {importMode === "edit" && (
                  <ActionButton
                    type="button"
                    loading={externalBusy === "edit-import"}
                    onClick={() => void handleUpdateImport()}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Guardar edicion
                  </ActionButton>
                )}
                {importMode !== "convert" && (
                  <button
                    type="button"
                    onClick={() => setImportMode("convert")}
                    className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Convertir en noticia interna
                  </button>
                )}
                <ActionButton
                  type="button"
                  loading={externalBusy === "publish-link"}
                  onClick={() =>
                    importMode === "external"
                      ? void handlePublishExternal(selectedImport.id)
                      : setImportMode("external")
                  }
                  className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
                >
                  {importMode === "external" ? "Publicar enlace externo" : "Publicar como enlace"}
                </ActionButton>
                {importMode === "convert" && (
                  <ActionButton
                    type="button"
                    loading={externalBusy === "convert"}
                    onClick={() => void handlePromote(selectedImport.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Crear noticia
                  </ActionButton>
                )}
                <ActionButton
                  type="button"
                  loading={externalBusy === "reject"}
                  onClick={() => void handleDiscard(selectedImport.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive"
                >
                  Rechazar
                </ActionButton>
              </div>
            </div>
          )}
          <DenseTable
            rows={filteredImports}
            columns={[
              ["Titulo", (row: any) => row.title ?? "Sin titulo"],
              ["Fuente", (row: any) => row.source_name ?? row.external_sources?.name],
              ["Estado", (row: any) => row.status],
              [
                "Acciones",
                (row: any) =>
                  row.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openImport(row, "detail")}
                        className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
                      >
                        Ver detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => openImport(row, "edit")}
                        className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => openImport(row, "convert")}
                        className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                      >
                        Convertir
                      </button>
                      <button
                        type="button"
                        onClick={() => openImport(row, "external")}
                        className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground"
                      >
                        Enlace externo
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDiscard(row.id)}
                        className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    "-"
                  ),
              ],
            ]}
          />
        </DataBlock>
      </div>
    </div>
  );
}

function UsersPanel({
  snapshot,
  onSaved,
  setMessage,
}: {
  snapshot: any;
  onSaved: () => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const blankUser = {
    id: "",
    email: "",
    full_name: "",
    role: "redactor",
    is_active: true,
  };
  const [userForm, setUserForm] = useState<any>(blankUser);
  const [resetForm, setResetForm] = useState<any>({ id: "", password: "" });
  const [savingUser, setSavingUser] = useState(false);
  const [togglingUser, setTogglingUser] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    setSavingUser(true);
    try {
      await saveAdminUser({
        data: {
          id: userForm.id || undefined,
          email: String(form.get("email") || ""),
          full_name: String(form.get("full_name") || ""),
          role: String(form.get("role") || "redactor") as any,
          password: password || undefined,
          is_active: form.get("is_active") === "on",
        },
      });
      setUserForm(blankUser);
      event.currentTarget.reset();
      await onSaved();
      setMessage(userForm.id ? "Administrador actualizado." : "Administrador creado.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setSavingUser(false);
    }
  }

  async function handleToggleUser(user: any) {
    setTogglingUser(user.id);
    try {
      await setAdminUserActive({ data: { id: user.id, is_active: !user.is_active } });
      await onSaved();
      setMessage(!user.is_active ? "Administrador activado." : "Administrador desactivado.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setTogglingUser("");
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("reset_password") || "");
    setResettingPassword(true);
    try {
      await resetAdminPassword({
        data: { id: resetForm.id, password },
      });
      setResetForm({ id: "", password: "" });
      await onSaved();
      setMessage("Contrasena temporal actualizada. El usuario debera cambiarla al entrar.");
    } catch (error: any) {
      setMessage(friendlyError(error));
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_1fr]">
      <DataBlock title={userForm.id ? "Editar administrador" : "Crear administrador"}>
        <form key={userForm.id || "new-user"} onSubmit={handleSaveUser} className="space-y-3">
          <Field name="email" label="Email" type="email" defaultValue={userForm.email} required />
          <Field name="full_name" label="Nombre" defaultValue={userForm.full_name} required />
          <Select name="role" label="Rol" defaultValue={userForm.role}>
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </Select>
          <Field
            name="password"
            label={userForm.id ? "Nueva contrasena temporal opcional" : "Contrasena temporal"}
            type="password"
            required={!userForm.id}
          />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input name="is_active" type="checkbox" defaultChecked={userForm.is_active} />
            Usuario activo
          </label>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              loading={savingUser}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Guardar administrador
            </ActionButton>
            {userForm.id && (
              <button
                type="button"
                onClick={() => setUserForm(blankUser)}
                className="min-h-10 rounded-md border border-border px-4 text-sm font-semibold"
              >
                Nuevo
              </button>
            )}
          </div>
        </form>

        <form onSubmit={handleResetPassword} className="mt-6 space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-bold uppercase text-muted-foreground">Resetear contrasena</h3>
          <Select
            name="reset_user"
            label="Usuario"
            defaultValue={resetForm.id}
            onChange={(value: string) =>
              setResetForm((current: any) => ({ ...current, id: value }))
            }
          >
            <option value="">Seleccionar</option>
            {snapshot.adminUsers.map((user: any) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </Select>
          <Field
            name="reset_password"
            label="Nueva temporal"
            type="password"
            defaultValue={resetForm.password}
          />
          <ActionButton
            type="submit"
            disabled={!resetForm.id}
            loading={resettingPassword}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            Aplicar reset
          </ActionButton>
        </form>
      </DataBlock>

      <DataBlock title="Usuarios administradores">
        <DenseTable
          rows={snapshot.adminUsers}
          columns={[
            ["Email", (row: any) => row.email],
            ["Nombre", (row: any) => row.full_name || "-"],
            [
              "Roles",
              (row: any) => row.roles.map((role: string) => ROLE_LABELS[role] ?? role).join(", "),
            ],
            ["Estado", (row: any) => (row.is_active ? "activo" : "desactivado")],
            ["Cambio pass", (row: any) => (row.must_change_password ? "pendiente" : "ok")],
            [
              "Acciones",
              (row: any) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setUserForm({
                        id: row.id,
                        email: row.email,
                        full_name: row.full_name,
                        role: row.roles[0] ?? "redactor",
                        is_active: row.is_active,
                      })
                    }
                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
                  >
                    Editar
                  </button>
                  <ActionButton
                    type="button"
                    loading={togglingUser === row.id}
                    onClick={() => void handleToggleUser(row)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                  >
                    {row.is_active ? "Desactivar" : "Activar"}
                  </ActionButton>
                </div>
              ),
            ],
          ]}
        />
      </DataBlock>
    </div>
  );
}

function AppearancePanel() {
  return (
    <DataBlock title="Apariencia editorial">
      <p className="text-sm leading-6 text-muted-foreground">
        Logos, colores, menus, footer, bloques de portada, anuncios y metadatos SEO se modelan en
        verticales, navigation_menus, menu_items, page_blocks, ads y site_settings. Las verticales y
        secciones ya son editables desde este panel.
      </p>
    </DataBlock>
  );
}

function AuditPanel({ snapshot }: { snapshot: any }) {
  const systemProblems = snapshot.auditLogs.filter((row: any) => row.action === "system_problem");
  return (
    <div className="space-y-6">
      <DataBlock title="Problemas del sistema">
        <DenseTable
          rows={systemProblems}
          columns={[
            ["Problema", (row: any) => row.metadata?.message ?? "-"],
            ["Panel", (row: any) => row.metadata?.panel ?? "-"],
            ["Fecha", (row: any) => new Date(row.created_at).toLocaleString("es-CR")],
          ]}
        />
      </DataBlock>
      <DataBlock title="Auditoria">
        <DenseTable
          rows={snapshot.auditLogs}
          columns={[
            ["Accion", (row: any) => row.action],
            ["Entidad", (row: any) => row.entity_type],
            ["Detalle", (row: any) => row.metadata?.message ?? row.metadata?.status ?? "-"],
            ["Fecha", (row: any) => new Date(row.created_at).toLocaleString("es-CR")],
          ]}
        />
      </DataBlock>
    </div>
  );
}

function SecurityPanel({ snapshot }: { snapshot: any }) {
  return (
    <DataBlock title="Seguridad">
      <DenseTable
        rows={snapshot.securityEvents}
        columns={[
          ["Evento", (row: any) => row.event_type],
          ["Severidad", (row: any) => row.severity],
          ["Email", (row: any) => row.email],
          ["Fecha", (row: any) => new Date(row.created_at).toLocaleString("es-CR")],
        ]}
      />
      {snapshot.counts.securityAlerts > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> Hay eventos de seguridad de alta prioridad.
        </div>
      )}
    </DataBlock>
  );
}

function SettingsPanel({ snapshot }: { snapshot: any }) {
  return (
    <DataBlock title="Configuracion global">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoTile label="Verticales" value={snapshot.verticals.length} />
        <InfoTile label="Secciones" value={snapshot.sections.length} />
        <InfoTile label="Integraciones" value={snapshot.integrations.length} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Las claves API deben configurarse como variables de entorno o secretos de Cloudflare, nunca
        desde el frontend.
      </p>
    </DataBlock>
  );
}

function DataBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="max-h-[calc(100vh-190px)] overflow-y-auto rounded-md border border-border bg-card p-5">
      <h2 className="sticky -top-5 z-10 mb-4 bg-card py-2 font-serif text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DenseTable({
  rows,
  columns,
}: {
  rows: any[];
  columns: [string, (row: any) => ReactNode][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map(([label]) => (
              <th key={label} className="px-3 py-2 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index} className="border-b border-border last:border-0">
              {columns.map(([label, render]) => (
                <td key={label} className="px-3 py-2 align-top">
                  {render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin datos.</div>}
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", required = false, onChange }: any) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function Textarea({ label, name, defaultValue, rows = 3 }: any) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={rows}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function Select({ label, name, defaultValue, children, onChange }: any) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {children}
      </select>
    </label>
  );
}

function InfoTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 font-serif text-3xl font-black">{value}</div>
    </div>
  );
}
