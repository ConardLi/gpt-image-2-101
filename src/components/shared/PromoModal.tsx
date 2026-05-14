import { useEffect, useState } from 'react';
import type { Route } from '../../types';
import './PromoModal.css';

const STORAGE_KEY = 'promo_modal_closed_v2';

interface Props {
  navigate: (r: Route) => void;
}

export function PromoModal({ navigate }: Props) {
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

  const onPlayground = () => {
    close();
    navigate({ name: 'playground' });
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
      aria-label="在线体验 GPT Image 2"
      onKeyDown={onKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="pm-card">
        <button className="pm-close" onClick={close} aria-label="关闭弹窗">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="pm-badge mono">NEW · 在线体验上线</div>

        <h2 className="pm-title">
          浏览器里直接玩<br />
          <span className="pm-title-em">GPT‑Image‑2</span>
        </h2>

        <p className="pm-desc">
          填一次自己的 API Key，即可在站内调用 <strong>创建</strong> 与 <strong>编辑</strong> 接口。
          所有 Key 与生成历史只存在你浏览器的 LocalStorage，
          <strong>不经过任何中间服务器</strong>。
        </p>

        <ul className="pm-features">
          <li><span className="pm-feat-icon" aria-hidden="true">✦</span>支持创建 / 编辑 / 蒙版编辑</li>
          <li><span className="pm-feat-icon" aria-hidden="true">✦</span>尺寸、质量、数量、背景、格式可调</li>
          <li><span className="pm-feat-icon" aria-hidden="true">✦</span>本地保存最近 12 条历史，可回看下载</li>
          <li><span className="pm-feat-icon" aria-hidden="true">✦</span>没有 Key？可在
            <a className="pm-inline-link" href="https://token.mmh1.top/" target="_blank" rel="noopener noreferrer sponsored"> token.mmh1.top </a>
            申请，国内直连、低至 0.6 折</li>
        </ul>

        <button className="pm-cta" onClick={onPlayground}>
          立即在线体验
          <span aria-hidden="true"> →</span>
        </button>

        <a
          className="pm-secondary"
          href="https://token.mmh1.top/"
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={close}
        >
          先去申请 API Key
          <span aria-hidden="true"> ↗</span>
        </a>

        <button className="pm-skip" onClick={close}>
          暂不需要，继续浏览案例
        </button>
      </div>
    </div>
  );
}
