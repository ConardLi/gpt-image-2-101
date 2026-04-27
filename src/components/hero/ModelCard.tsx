import { useEffect } from 'react';
import './ModelCard.css';

interface Props {
  expanded: boolean;
  onClose: () => void;
}

const STRENGTHS = [
  {
    n: '01',
    title: '文字渲染',
    en: 'Text Rendering',
    body: '海报、菜单、招牌、UI 标签、信息图——画面里的中文 / 日文 / 韩文 / 印地文都被当作核心能力训练，告别上一代 AI 图最大的「文字翻车」问题。',
  },
  {
    n: '02',
    title: '指令遵循',
    en: 'Instruction Following',
    body: '可以非常具体地告诉它：主体放哪里、文案怎么排、风格偏杂志还是电商、哪些元素必须保留。比上一代真正接近"按 brief 出图"。',
  },
  {
    n: '03',
    title: '编辑能力',
    en: 'Image Editing',
    body: '吃进参考图、产品图、Logo、草稿，做背景替换、局部重绘、风格统一、Logo / 包装保留——是「视觉工作流引擎」而不只是抽卡。',
  },
  {
    n: '04',
    title: '尺寸自由',
    en: 'Resolution Flexibility',
    body: '1024 方图 · 1536×1024 · 1024×1536 · 2K · 4K 横竖图都可。超过 2560×1440 的输出仍标为实验性（experimental）。',
  },
];

const SURFACES = [
  { name: 'ChatGPT', tag: 'Images 2.0', body: '所有计划可用；Images with Thinking 需要 Plus / Pro / Business。' },
  { name: 'OpenAI API', tag: 'gpt-image-2', body: '/images/generations & /images/edits，能接进自己的产品。' },
  { name: 'Codex', tag: 'via tooling', body: '取决于环境是否接入图像工具；可让 Codex 写 prompt + 调用工具一气呵成。' },
  { name: 'Lovart', tag: 'design-grade', body: '商业视觉、UI mockup、多语言海报等工作流，包装为设计平台。' },
  { name: 'OpenRouter', tag: 'gpt-5.4-image-2', body: '把 GPT-5.4 推理 + Image 2 图像组合起来的对话式生成。' },
  { name: '302.ai', tag: '兼容网关', body: '提供 gpt-image-2 的生成 / 编辑接口，第三方网关入口。' },
];

export function ModelCard({ expanded, onClose }: Props) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expanded) onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [expanded, onClose]);

  return (
    <div className={`mc-overlay ${expanded ? 'mc-overlay-open' : ''}`}>
      <button
        className="mc-backdrop"
        onClick={onClose}
        aria-label="Close model card"
      />
      <div className="mc-card" role="dialog" aria-modal="true" aria-labelledby="mc-title">
        <header className="mc-head">
          <div>
            <div className="mono mc-eyebrow">MODEL CARD · 2026 EDITION</div>
            <h2 id="mc-title" className="mc-title serif">
              <span className="serif-italic">gpt</span>‑image‑2
            </h2>
            <p className="mc-sub">
              OpenAI 2026 年 4 月 21 日发布的视觉生产模型。它强的地方不是「更炫」，
              而是「更能用」——把文字渲染、参考图编辑、跨语言版式、灵活尺寸打包
              成一个能塞进真实工作流的多模态图像模型。
            </p>
          </div>
          <button className="mc-close" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <section className="mc-section">
          <div className="mc-sec-label mono">01 · 关键能力</div>
          <div className="mc-strengths">
            {STRENGTHS.map((s) => (
              <article key={s.n} className="mc-strength">
                <div className="mc-strength-head">
                  <span className="mono mc-strength-n">{s.n}</span>
                  <h3 className="mc-strength-title serif">{s.title}</h3>
                  <span className="mono mc-strength-en">/ {s.en}</span>
                </div>
                <p className="mc-strength-body">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mc-section">
          <div className="mc-sec-label mono">02 · 入口分布</div>
          <div className="mc-surfaces">
            {SURFACES.map((s) => (
              <article key={s.name} className="mc-surface">
                <div className="mc-surface-head">
                  <span className="mc-surface-name">{s.name}</span>
                  <span className="mono mc-surface-tag">{s.tag}</span>
                </div>
                <p className="mc-surface-body">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mc-section">
          <div className="mc-sec-label mono">03 · 一句话总结</div>
          <blockquote className="mc-quote serif">
            <span className="mc-quote-mark">"</span>
            <span>
              GPT-Image-2 的强，不只是「画得更像」，而是它开始接近一个能理解
              <span className="mc-em">文案、布局、品牌、参考图和最终用途</span>
              的视觉生产模型。
            </span>
          </blockquote>
        </section>

        <footer className="mc-foot">
          <div className="mono mc-foot-info">
            <span>SOURCE</span>
            <span>OpenAI Platform · Image API · Lovart</span>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            <span>收起卡片</span>
            <span className="btn-arrow">↑</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
