import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../../types';
import { getCase } from '../../lib/data';
import {
  DEFAULT_PARAMS,
  DEFAULT_SETTINGS,
  type CommonParams,
  type GenBackground,
  type GenFormat,
  type GenQuality,
  type GenSize,
  type HistoryEntry,
  type PlaygroundSettings,
  clearHistory,
  dataUrl,
  editImage,
  generateImage,
  loadHistory,
  loadSettings,
  makeId,
  makeRefThumb,
  saveHistory,
  saveSettings,
} from '../../lib/playground';
import './PlaygroundPage.css';

interface Props {
  route: Extract<Route, { name: 'playground' }>;
  navigate: (r: Route) => void;
}

type Mode = 'generate' | 'edit';

const SIZE_OPTIONS: { value: GenSize; label: string; hint: string }[] = [
  { value: 'auto', label: '自动', hint: '由模型按提示词决定' },
  { value: '1024x1024', label: '1:1', hint: '1024 × 1024' },
  { value: '1536x1024', label: '3:2', hint: '1536 × 1024 横版' },
  { value: '1024x1536', label: '2:3', hint: '1024 × 1536 竖版' },
];

const QUALITY_OPTIONS: { value: GenQuality; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

const BG_OPTIONS: { value: GenBackground; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'opaque', label: '不透明' },
  { value: 'transparent', label: '透明' },
];

const FORMAT_OPTIONS: { value: GenFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WEBP' },
];

const PROMO_URL = 'https://token.mmh1.top/';

const SAMPLE_PROMPTS = [
  '一张 16:9 的复古胶片摄影海报：黄昏的东京小巷，霓虹灯倒影落在湿漉漉的柏油路上，左上方留出标题排版区域，整体青橙色调',
  'isometric 等距插画，一台漂浮的复古机械相机被花藤缠绕，风格学院派工业插画，米白底，左下角浅红印章排版',
  '手绘水彩信息图：蘑菇生长周期，中文标注，4 个步骤纵向排列，浅米黄背景，强调古法植物图鉴质感',
];

export function PlaygroundPage({ route, navigate }: Props) {
  const [settings, setSettings] = useState<PlaygroundSettings>(() => loadSettings());
  const [settingsDraft, setSettingsDraft] = useState<PlaygroundSettings>(settings);
  const [showSettings, setShowSettings] = useState(() => !loadSettings().apiKey);
  const [showKey, setShowKey] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [mode, setMode] = useState<Mode>('generate');
  const [prompt, setPrompt] = useState('');
  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS);

  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [maskPreview, setMaskPreview] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const abortRef = useRef<AbortController | null>(null);

  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const sourceCase = useMemo(
    () => (route.caseId ? getCase(route.caseId) : null),
    [route.caseId],
  );

  // sync drafts back when settings change externally (rare)
  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!sourceCase?.prompt_content) return;
    setPrompt(sourceCase.prompt_content);
    setMode('generate');
    setError(null);
    window.requestAnimationFrame(() => {
      document.getElementById('pg-prompt')?.focus();
    });
  }, [sourceCase?.id, sourceCase?.prompt_content]);

  useEffect(() => {
    if (!editFile) {
      setEditPreview(null);
      return;
    }
    const url = URL.createObjectURL(editFile);
    setEditPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editFile]);

  useEffect(() => {
    if (!maskFile) {
      setMaskPreview(null);
      return;
    }
    const url = URL.createObjectURL(maskFile);
    setMaskPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [maskFile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightbox) setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  // ⌘/Ctrl + Enter triggers submit from anywhere on the page. Use a ref so the
  // global handler doesn't need to be re-bound every state change.
  const submitRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const apiKeyConfigured = settings.apiKey.trim().length > 0;

  const onSaveSettings = () => {
    const cleaned: PlaygroundSettings = {
      apiKey: settingsDraft.apiKey.trim(),
      baseURL: settingsDraft.baseURL.trim() || DEFAULT_SETTINGS.baseURL,
      model: settingsDraft.model.trim() || DEFAULT_SETTINGS.model,
    };
    saveSettings(cleaned);
    setSettings(cleaned);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    if (cleaned.apiKey) setShowSettings(false);
  };

  const onResetSettings = () => {
    setSettingsDraft({ ...DEFAULT_SETTINGS, apiKey: settingsDraft.apiKey });
  };

  const onPickEdit = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择图像文件');
      return;
    }
    setError(null);
    setEditFile(file);
  };

  const onPickMask = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('蒙版需要是图像文件');
      return;
    }
    setError(null);
    setMaskFile(file);
  };

  const useResultAsEdit = async (b64: string, mime: string) => {
    try {
      const blob = await (await fetch(dataUrl(b64, mime))).blob();
      const ext = mime.split('/')[1] || 'png';
      const f = new File([blob], `result.${ext}`, { type: mime });
      setEditFile(f);
      setMaskFile(null);
      setMode('edit');
      setError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('转换为编辑输入失败');
    }
  };

  const downloadImage = (b64: string, mime: string, idx: number) => {
    const a = document.createElement('a');
    a.href = dataUrl(b64, mime);
    const ext = mime.split('/')[1] || 'png';
    a.download = `gpt-image-${Date.now()}-${idx + 1}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!apiKeyConfigured) {
      setError('请先在「设置」中填入你的 API Key');
      setShowSettings(true);
      return;
    }
    if (!prompt.trim()) {
      setError('请输入提示词 (prompt)');
      return;
    }
    if (mode === 'edit' && !editFile) {
      setError('请上传需要编辑的图像');
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    try {
      const out =
        mode === 'generate'
          ? await generateImage({ settings, prompt, params, signal: ctrl.signal })
          : await editImage({
              settings,
              prompt,
              params,
              image: editFile as File,
              mask: maskFile,
              signal: ctrl.signal,
            });

      const refThumb =
        mode === 'edit' && editFile ? await makeRefThumb(editFile) : undefined;

      const entry: HistoryEntry = {
        id: makeId(),
        ts: Date.now(),
        mode,
        prompt: prompt.trim(),
        params: { ...params },
        images: out.images,
        mime: out.mime,
        refThumb,
      };
      setLatest(entry);
      const trimmed = saveHistory([entry, ...history]);
      setHistory(trimmed);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // user cancelled
      } else {
        setError((err as Error).message || '请求失败');
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  // Keep the global ⌘+Enter shortcut pointed at the latest submit closure.
  submitRef.current = submit;

  const onClearHistory = () => {
    if (!history.length) return;
    if (!window.confirm('确认清空所有本地历史记录？此操作不可撤销。')) return;
    clearHistory();
    setHistory([]);
  };

  const onPickHistory = (entry: HistoryEntry) => {
    setLatest(entry);
    document.getElementById('pg-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const obscuredKey = useMemo(() => {
    const k = settings.apiKey;
    if (!k) return '未配置';
    if (k.length <= 8) return '••••';
    return `${k.slice(0, 4)}••••${k.slice(-4)}`;
  }, [settings.apiKey]);

  return (
    <div className="pg">
      {/* === HEADER === */}
      <header className="pg-hero">
        <button className="pg-back" onClick={() => navigate({ name: 'home' })}>
          <span aria-hidden="true">←</span> 返回首页
        </button>
        <div className="pg-hero-meta mono">
          <span>BETA</span>
          <span className="pg-meta-sep" />
          <span>NO BACKEND · LOCAL ONLY</span>
          <span className="pg-meta-sep" />
          <span>YOUR KEY · YOUR DATA</span>
        </div>
        <h1 className="pg-hero-title serif">
          在线体验 <span className="serif-italic">GPT‑Image‑2</span>
        </h1>
        <p className="pg-hero-lede">
          配置一次自己的 API Key（可前往{' '}
          <a className="pg-inline-link" href={PROMO_URL} target="_blank" rel="noopener noreferrer">
            token.mmh1.top
          </a>{' '}
          申请，国内直连、低至 <strong>0.6 折</strong>），
          即可在浏览器内直接调用 <strong>创建</strong> 与 <strong>编辑</strong> 接口。
          所有 Key 与生成历史仅保存在本地 LocalStorage，不经过任何中间服务器。
        </p>

        <div className="pg-hero-actions">
          <button
            className="pg-btn pg-btn-ghost"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
          >
            <span className={`pg-keydot ${apiKeyConfigured ? 'pg-keydot-on' : 'pg-keydot-off'}`} />
            {apiKeyConfigured ? `已配置 · ${obscuredKey}` : '未配置 API Key'}
            <span aria-hidden="true">{showSettings ? '↑' : '↓'}</span>
          </button>
          <a className="pg-btn pg-btn-link" href={PROMO_URL} target="_blank" rel="noopener noreferrer sponsored">
            申请 API Key <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      {/* === SETTINGS === */}
      {showSettings && (
        <section className="pg-settings">
          <div className="pg-settings-head">
            <h2 className="pg-section-title serif">设置</h2>
            <p className="pg-section-sub">
              所有信息只保存在浏览器 LocalStorage（key:{' '}
              <code>playground_settings_v1</code>）。
            </p>
          </div>
          <div className="pg-form-grid">
            <label className="pg-field pg-field-wide">
              <span className="pg-field-label mono">API KEY *</span>
              <div className="pg-input-wrap">
                <input
                  className="pg-input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  autoComplete="off"
                  spellCheck={false}
                  value={settingsDraft.apiKey}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, apiKey: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="pg-input-toggle"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? '隐藏 Key' : '显示 Key'}
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
            </label>
            <label className="pg-field">
              <span className="pg-field-label mono">BASE URL</span>
              <input
                className="pg-input"
                type="text"
                value={settingsDraft.baseURL}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, baseURL: e.target.value })
                }
                placeholder="https://api.mmh1.top/"
                spellCheck={false}
              />
            </label>
            <label className="pg-field">
              <span className="pg-field-label mono">MODEL</span>
              <input
                className="pg-input"
                type="text"
                value={settingsDraft.model}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, model: e.target.value })
                }
                placeholder="gpt-image-2-c"
                spellCheck={false}
              />
            </label>
          </div>
          <div className="pg-settings-actions">
            <button className="pg-btn pg-btn-ghost" onClick={onResetSettings}>
              恢复默认 URL / 模型
            </button>
            <div className="pg-settings-actions-right">
              {savedFlash && <span className="pg-flash mono">已保存</span>}
              <button className="pg-btn pg-btn-primary" onClick={onSaveSettings}>
                保存配置
              </button>
            </div>
          </div>
        </section>
      )}

      {sourceCase && (
        <section className="pg-source">
          <div>
            <div className="mono pg-source-label">已载入案例 Prompt</div>
            <div className="pg-source-title">{sourceCase.title}</div>
            <p className="pg-source-brief">{sourceCase.brief}</p>
          </div>
          <button
            className="pg-btn pg-btn-ghost"
            onClick={() => navigate({ name: 'case', id: sourceCase.id })}
          >
            返回案例
            <span aria-hidden="true">→</span>
          </button>
        </section>
      )}

      {/* === MAIN GRID === */}
      <div className="pg-main">
        {/* LEFT: composer */}
        <section className="pg-composer">
          <div className="pg-mode-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'generate'}
              className={`pg-mode-tab ${mode === 'generate' ? 'pg-mode-tab-on' : ''}`}
              onClick={() => setMode('generate')}
            >
              <span className="pg-mode-tab-tag mono">A</span>
              <span>创建图像</span>
            </button>
            <button
              role="tab"
              aria-selected={mode === 'edit'}
              className={`pg-mode-tab ${mode === 'edit' ? 'pg-mode-tab-on' : ''}`}
              onClick={() => setMode('edit')}
            >
              <span className="pg-mode-tab-tag mono">B</span>
              <span>编辑图像</span>
            </button>
          </div>

          {mode === 'edit' && (
            <div className="pg-uploads">
              <FileDrop
                label="参考图（必填）"
                accept="image/*"
                preview={editPreview}
                fileName={editFile?.name}
                fileSize={editFile?.size}
                onPick={onPickEdit}
                onClear={() => setEditFile(null)}
                hint="支持 PNG / JPEG / WEBP，建议小于 4MB"
              />
              <FileDrop
                label="蒙版（可选 · 透明区域=编辑区）"
                accept="image/png"
                preview={maskPreview}
                fileName={maskFile?.name}
                fileSize={maskFile?.size}
                onPick={onPickMask}
                onClear={() => setMaskFile(null)}
                hint="必须是与原图同尺寸的 PNG"
              />
            </div>
          )}

          <div className="pg-prompt-wrap">
            <div className="pg-prompt-head">
              <label className="pg-field-label mono" htmlFor="pg-prompt">
                提示词 (PROMPT) *
              </label>
              <span className="pg-prompt-count mono">
                {prompt.length} 字符
              </span>
            </div>
            <textarea
              id="pg-prompt"
              className="pg-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'generate'
                  ? '描述你想生成的图像。GPT-Image-2 擅长理解复杂版式、文字渲染与多语言 typography。'
                  : '描述如何编辑这张图。例：把背景换成樱花树下，保留主体姿态。'
              }
              rows={6}
              spellCheck={false}
            />
            <div className="pg-prompt-samples">
              <span className="pg-prompt-samples-label mono">参考</span>
              {SAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  className="pg-prompt-sample"
                  onClick={() => setPrompt(p)}
                  title={p}
                >
                  示例 {i + 1}
                </button>
              ))}
              {prompt && (
                <button
                  className="pg-prompt-sample pg-prompt-sample-clear"
                  onClick={() => setPrompt('')}
                >
                  清空
                </button>
              )}
            </div>
          </div>

          <div className="pg-params">
            <ParamRow label="尺寸" hint="不选=由模型按提示词决定">
              <SegGroup
                value={params.size}
                onChange={(v) => setParams({ ...params, size: v as GenSize })}
                options={SIZE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                  title: o.hint,
                }))}
              />
            </ParamRow>
            <ParamRow label="质量">
              <SegGroup
                value={params.quality}
                onChange={(v) => setParams({ ...params, quality: v as GenQuality })}
                options={QUALITY_OPTIONS}
              />
            </ParamRow>
            <ParamRow label="数量 (n)" hint="一次生成的图片数">
              <SegGroup
                value={String(params.n)}
                onChange={(v) => setParams({ ...params, n: parseInt(v, 10) })}
                options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </ParamRow>
            {mode === 'generate' && (
              <ParamRow label="背景" hint="透明背景需配合 PNG / WEBP">
                <SegGroup
                  value={params.background}
                  onChange={(v) =>
                    setParams({ ...params, background: v as GenBackground })
                  }
                  options={BG_OPTIONS}
                />
              </ParamRow>
            )}
            {mode === 'generate' && (
              <ParamRow label="格式">
                <SegGroup
                  value={params.format}
                  onChange={(v) => setParams({ ...params, format: v as GenFormat })}
                  options={FORMAT_OPTIONS}
                />
              </ParamRow>
            )}
          </div>

          {error && (
            <div className="pg-error" role="alert">
              <strong>请求失败：</strong> {error}
            </div>
          )}

          <div className="pg-submit-row">
            <button
              className="pg-btn pg-btn-primary pg-btn-lg"
              onClick={submit}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="pg-spin" aria-hidden="true" />
                  正在生成…
                </>
              ) : (
                <>
                  <span aria-hidden="true">✦</span>
                  {mode === 'generate' ? '生成图像' : '执行编辑'}
                </>
              )}
            </button>
            {busy && (
              <button className="pg-btn pg-btn-ghost" onClick={cancel}>
                取消
              </button>
            )}
            <span className="pg-submit-hint mono">
              ⌘ + ↵ 也可以触发
            </span>
          </div>
        </section>

        {/* RIGHT: result + history */}
        <aside className="pg-aside">
          <section className="pg-result" id="pg-result">
            <div className="pg-result-head">
              <h2 className="pg-section-title serif">结果</h2>
              {latest && (
                <span className="pg-result-meta mono">
                  {new Date(latest.ts).toLocaleString('zh-CN')}
                </span>
              )}
            </div>

            {busy && !latest && (
              <div className="pg-result-grid">
                {Array.from({ length: params.n }).map((_, i) => (
                  <div key={i} className="pg-result-tile pg-result-tile-skel">
                    <div className="pg-skel-glow" />
                    <span className="mono">RENDERING · {i + 1}</span>
                  </div>
                ))}
              </div>
            )}

            {!busy && !latest && (
              <div className="pg-result-empty">
                <div className="pg-empty-art" aria-hidden="true">
                  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="8" y="14" width="48" height="36" rx="3" />
                    <circle cx="22" cy="28" r="3.5" />
                    <path d="M8 42l14-14 12 10 10-8 12 12" />
                  </svg>
                </div>
                <p className="pg-empty-title">等你的第一张图</p>
                <p className="pg-empty-sub">填好提示词，按上方的 <strong>生成图像</strong> 即可。</p>
              </div>
            )}

            {latest && (
              <>
                <div className={`pg-result-grid pg-result-grid-${latest.images.length}`}>
                  {latest.images.map((b64, i) => {
                    const src = dataUrl(b64, latest.mime);
                    return (
                      <figure key={i} className="pg-result-tile">
                        <button
                          className="pg-result-img-btn"
                          onClick={() => setLightbox({ src, alt: latest.prompt })}
                          aria-label="放大查看"
                        >
                          <img src={src} alt={latest.prompt} />
                        </button>
                        <div className="pg-result-actions">
                          <button
                            className="pg-chip"
                            onClick={() => downloadImage(b64, latest.mime, i)}
                          >
                            下载
                          </button>
                          <button
                            className="pg-chip"
                            onClick={() => useResultAsEdit(b64, latest.mime)}
                          >
                            作为编辑输入
                          </button>
                        </div>
                      </figure>
                    );
                  })}
                </div>
                <details className="pg-result-meta-block">
                  <summary>本次参数 · prompt 详情</summary>
                  <p className="pg-result-prompt">{latest.prompt}</p>
                  <ul className="pg-result-params">
                    <li><span className="mono">MODE</span>{latest.mode === 'generate' ? '创建' : '编辑'}</li>
                    <li><span className="mono">SIZE</span>{latest.params.size}</li>
                    <li><span className="mono">QUALITY</span>{latest.params.quality}</li>
                    <li><span className="mono">N</span>{latest.params.n}</li>
                    {latest.mode === 'generate' && (
                      <>
                        <li><span className="mono">BACKGROUND</span>{latest.params.background}</li>
                        <li><span className="mono">FORMAT</span>{latest.params.format}</li>
                      </>
                    )}
                  </ul>
                </details>
              </>
            )}
          </section>

          <section className="pg-history">
            <div className="pg-history-head">
              <h2 className="pg-section-title serif">历史记录</h2>
              <div className="pg-history-actions">
                <span className="pg-history-count mono">
                  {history.length} / 12
                </span>
                {history.length > 0 && (
                  <button className="pg-text-btn" onClick={onClearHistory}>
                    清空
                  </button>
                )}
              </div>
            </div>
            {history.length === 0 ? (
              <p className="pg-history-empty">每次生成会自动保存最近 12 条到本地。</p>
            ) : (
              <ul className="pg-history-list">
                {history.map((h) => (
                  <li key={h.id}>
                    <button className="pg-history-item" onClick={() => onPickHistory(h)}>
                      <div className="pg-history-thumbs">
                        {h.images.slice(0, 2).map((b, i) => (
                          <img
                            key={i}
                            src={dataUrl(b, h.mime)}
                            alt=""
                            loading="lazy"
                          />
                        ))}
                        {h.images.length > 2 && (
                          <span className="pg-history-more mono">+{h.images.length - 2}</span>
                        )}
                      </div>
                      <div className="pg-history-meta">
                        <div className="pg-history-mode mono">
                          {h.mode === 'generate' ? '创建' : '编辑'} · {h.images.length} 张
                        </div>
                        <div className="pg-history-prompt">{h.prompt}</div>
                        <div className="pg-history-time mono">
                          {timeAgo(h.ts)}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* === LIGHTBOX === */}
      {lightbox && (
        <div
          className="pg-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <img src={lightbox.src} alt={lightbox.alt} />
          <button className="pg-lightbox-close" aria-label="关闭">×</button>
        </div>
      )}
    </div>
  );
}

// --- subcomponents ---------------------------------------------------------

interface FileDropProps {
  label: string;
  accept: string;
  preview: string | null;
  fileName?: string;
  fileSize?: number;
  hint: string;
  onPick: (file: File | null) => void;
  onClear: () => void;
}

function FileDrop({
  label,
  accept,
  preview,
  fileName,
  fileSize,
  hint,
  onPick,
  onClear,
}: FileDropProps) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      // Allow user to drag text/image directly from clipboard inspector
      onPick(f);
      return;
    }
    // Fallback: try image data
    const items = e.dataTransfer.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file') {
        const f2 = it.getAsFile();
        if (f2) {
          onPick(f2);
          return;
        }
      }
    }
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          // Pasted clipboard files have a generic 'image.png' name; rename so
          // the UI shows something readable.
          const blob = await f.arrayBuffer();
          const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          const named = new File([blob], `pasted-${Date.now()}.${ext}`, {
            type: f.type,
          });
          onPick(named);
          return;
        }
      }
    }
  };

  return (
    <div
      className={`pg-drop ${drag ? 'pg-drop-on' : ''} ${preview ? 'pg-drop-has' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onPaste={onPaste}
      tabIndex={0}
    >
      <span className="pg-field-label mono pg-drop-label">{label}</span>
      {preview ? (
        <div className="pg-drop-preview">
          <img src={preview} alt="" />
          <div className="pg-drop-meta">
            <div className="pg-drop-name">{fileName ?? 'image'}</div>
            <div className="pg-drop-size mono">{prettySize(fileSize ?? 0)}</div>
          </div>
          <div className="pg-drop-actions">
            <button className="pg-chip" onClick={() => inputRef.current?.click()}>
              替换
            </button>
            <button className="pg-chip pg-chip-ghost" onClick={onClear}>
              移除
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="pg-drop-empty"
          onClick={() => inputRef.current?.click()}
        >
          <span className="pg-drop-icon" aria-hidden="true">＋</span>
          <span className="pg-drop-cta">点击 / 拖拽 / 粘贴上传</span>
          <span className="pg-drop-hint">{hint}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

interface SegOption {
  value: string;
  label: string;
  title?: string;
}
interface SegGroupProps {
  value: string;
  options: SegOption[];
  onChange: (v: string) => void;
}
function SegGroup({ value, options, onChange }: SegGroupProps) {
  return (
    <div className="pg-seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`pg-seg-item ${value === o.value ? 'pg-seg-item-on' : ''}`}
          onClick={() => onChange(o.value)}
          title={o.title}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ParamRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}
function ParamRow({ label, hint, children }: ParamRowProps) {
  return (
    <div className="pg-param-row">
      <div className="pg-param-label">
        <span className="pg-field-label mono">{label}</span>
        {hint && <span className="pg-param-hint">{hint}</span>}
      </div>
      <div className="pg-param-control">{children}</div>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

function prettySize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}
