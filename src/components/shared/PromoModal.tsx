import { useEffect, useState } from 'react';
import './PromoModal.css';

const STORAGE_KEY = 'promo_modal_closed_v1';

export function PromoModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Slight delay so page paint finishes first
      const t = window.setTimeout(() => setVisible(true), 600);
      return () => window.clearTimeout(t);
    }
  }, []);

  const close = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  if (!visible) return null;

  return (
    <div
      className="pm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="国内调用渠道推广"
      onKeyDown={onKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="pm-card">
        <button className="pm-close" onClick={close} aria-label="关闭弹窗">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="pm-badge mono">推荐渠道</div>

        <h2 className="pm-title">
          国内低价调用<br />
          <span className="pm-title-em">GPT‑Image‑2 / GPT‑5.5</span>
        </h2>

        <p className="pm-desc">
          无需翻墙，直接在国内使用 OpenAI 最新模型。
          计费透明，低至 <strong>0.6 折</strong>，按量付费无月费。
        </p>

        <ul className="pm-features">
          <li><span className="pm-feat-icon" aria-hidden="true">✦</span>GPT‑Image‑2 图像生成 / 编辑</li>
          <li><span className="pm-feat-icon" aria-hidden="true">✦</span>GPT‑5.5 最新对话模型</li>
          <li><span className="pm-feat-icon" aria-hidden="true">✦</span>兼容 OpenAI API 格式，零改造接入</li>
          <li><span className="pm-feat-icon" aria-hidden="true">✦</span>国内直连，无需代理</li>
        </ul>

        <a
          className="pm-cta"
          href="https://token.mmh1.top/"
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={close}
        >
          立即前往 token.mmh1.top
          <span aria-hidden="true"> ↗</span>
        </a>

        <button className="pm-skip" onClick={close}>
          暂不需要，继续浏览
        </button>
      </div>
    </div>
  );
}
