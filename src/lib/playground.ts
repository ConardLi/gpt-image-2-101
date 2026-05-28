// Client-side helpers for the Playground module.
//
// All requests are sent directly from the browser to the user-configured
// OpenAI-compatible relay (defaults to https://api.mmh1.top/). Nothing
// is proxied through a backend — the API key never leaves localStorage.

export interface PlaygroundSettings {
  apiKey: string;
  baseURL: string;
  model: string;
}

export const DEFAULT_SETTINGS: PlaygroundSettings = {
  apiKey: '',
  baseURL: 'https://api.mmh1.top/',
  model: 'gpt-image-2-c',
};

export const SETTINGS_KEY = 'playground_settings_v1';
export const HISTORY_KEY = 'playground_history_v1';
export const HISTORY_LIMIT = 12;

export type GenSize = 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
export type GenQuality = 'auto' | 'low' | 'medium' | 'high';
export type GenBackground = 'auto' | 'transparent' | 'opaque';
export type GenFormat = 'png' | 'jpeg' | 'webp';

export interface CommonParams {
  size: GenSize;
  quality: GenQuality;
  n: number;
  background: GenBackground;
  format: GenFormat;
}

export const DEFAULT_PARAMS: CommonParams = {
  size: 'auto',
  quality: 'auto',
  n: 1,
  background: 'auto',
  format: 'png',
};

export interface HistoryEntry {
  id: string;
  ts: number;
  mode: 'generate' | 'edit';
  prompt: string;
  params: CommonParams;
  /** base64 image strings (no data: prefix), in same order as the API returned. */
  images: string[];
  /** Mime type derived from `params.format` so we can build data URLs cheaply. */
  mime: string;
  /** Optional reference thumbnail for `edit` entries (data URL). */
  refThumb?: string;
}

// --- settings ----------------------------------------------------------

export function loadSettings(): PlaygroundSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PlaygroundSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: PlaygroundSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// --- history -----------------------------------------------------------

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr as HistoryEntry[];
  } catch {
    return [];
  }
}

/**
 * Persist the new history list, trimming oldest entries until the localStorage
 * write succeeds. Image base64 payloads can run to several MB so we treat
 * QuotaExceededError as the normal exit condition for an over-large list.
 */
export function saveHistory(list: HistoryEntry[]): HistoryEntry[] {
  let working = list.slice(0, HISTORY_LIMIT);
  while (working.length > 0) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(working));
      return working;
    } catch {
      working = working.slice(0, working.length - 1);
    }
  }
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// --- API calls ---------------------------------------------------------

function normalizeBase(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, '');
  if (!trimmed) return 'https://api.mmh1.top/';
  if (/\/v\d+$/.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

function mimeFor(fmt: GenFormat): string {
  switch (fmt) {
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

async function readError(res: Response): Promise<string> {
  let body = '';
  try {
    body = await res.text();
  } catch {
    /* ignore */
  }
  if (body) {
    try {
      const j = JSON.parse(body);
      const msg = j?.error?.message ?? j?.message ?? null;
      if (msg) return `${res.status} · ${msg}`;
    } catch {
      /* keep raw body */
    }
  }
  return body
    ? `${res.status} · ${body.slice(0, 280)}`
    : `${res.status} · ${res.statusText || 'Request failed'}`;
}

interface ApiImage {
  b64_json?: string;
  url?: string;
}

interface ApiResponse {
  data?: ApiImage[];
}

async function apiImageToBase64(img: ApiImage): Promise<string> {
  if (img.b64_json) return img.b64_json;
  if (img.url) {
    const res = await fetch(img.url);
    const blob = await res.blob();
    return await blobToBase64(blob);
  }
  throw new Error('API 返回的图像既没有 b64_json 也没有 url');
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:<mime>;base64," prefix
      const idx = result.indexOf(',');
      resolve(idx === -1 ? result : result.slice(idx + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsDataURL(blob);
  });
}

export interface GenerateInput {
  settings: PlaygroundSettings;
  prompt: string;
  params: CommonParams;
  signal?: AbortSignal;
}

export interface GenerateOutput {
  images: string[]; // base64 strings
  mime: string;
}

export async function generateImage(input: GenerateInput): Promise<GenerateOutput> {
  const { settings, prompt, params, signal } = input;
  if (!settings.apiKey.trim()) throw new Error('请先在「设置」中填入 API Key');
  if (!prompt.trim()) throw new Error('请输入提示词 (prompt)');

  const url = `${normalizeBase(settings.baseURL)}/images/generations`;
  const body: Record<string, unknown> = {
    model: settings.model || 'gpt-image-2-c',
    prompt: prompt.trim(),
    n: params.n,
  };
  if (params.size !== 'auto') body.size = params.size;
  if (params.quality !== 'auto') body.quality = params.quality;
  if (params.background !== 'auto') body.background = params.background;
  body.output_format = params.format;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new Error(await readError(res));

  const json = (await res.json()) as ApiResponse;
  const data = json.data ?? [];
  if (data.length === 0) throw new Error('API 返回为空，未生成任何图像');

  const images = await Promise.all(data.map(apiImageToBase64));
  return { images, mime: mimeFor(params.format) };
}

export interface EditInput {
  settings: PlaygroundSettings;
  prompt: string;
  params: CommonParams;
  image: File;
  mask?: File | null;
  signal?: AbortSignal;
}

export async function editImage(input: EditInput): Promise<GenerateOutput> {
  const { settings, prompt, params, image, mask, signal } = input;
  if (!settings.apiKey.trim()) throw new Error('请先在「设置」中填入 API Key');
  if (!prompt.trim()) throw new Error('请输入提示词 (prompt)');
  if (!image) throw new Error('请上传需要编辑的图像');

  const url = `${normalizeBase(settings.baseURL)}/images/edits`;
  const fd = new FormData();
  fd.append('model', settings.model || 'gpt-image-2-c');
  fd.append('prompt', prompt.trim());
  fd.append('image', image);
  if (mask) fd.append('mask', mask);
  fd.append('n', String(params.n));
  if (params.size !== 'auto') fd.append('size', params.size);
  if (params.quality !== 'auto') fd.append('quality', params.quality);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: fd,
    signal,
  });

  if (!res.ok) throw new Error(await readError(res));

  const json = (await res.json()) as ApiResponse;
  const data = json.data ?? [];
  if (data.length === 0) throw new Error('API 返回为空，未生成任何图像');

  const images = await Promise.all(data.map(apiImageToBase64));
  // Edits API doesn't honor output_format yet on most relays, so trust mime
  // from the configured format but fall back to png.
  return { images, mime: mimeFor(params.format) };
}

// --- helpers -----------------------------------------------------------

export function dataUrl(base64: string, mime: string): string {
  return `data:${mime};base64,${base64}`;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Resize a File into a small jpeg data URL (used for edit-history thumbs). */
export async function makeRefThumb(file: File, max = 256): Promise<string | undefined> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('thumb decode failed'));
      i.src = url;
    });
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return undefined;
    }
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return undefined;
  }
}
