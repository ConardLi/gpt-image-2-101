import { useEffect, useMemo, useState } from 'react';
import type { Route } from '../../types';
import { cases, ORDERED_CATEGORIES } from '../../lib/data';
import './SkillsPage.css';

interface Props {
  navigate: (r: Route) => void;
}

const REPO_URL = 'https://github.com/ConardLi/garden-skills';
const SKILL_TREE_URL = `${REPO_URL}/tree/main/skills/gpt-image-2`;

const MODES = [
  {
    tag: 'A',
    name: 'Garden 本地',
    eyebrow: 'FULL CONTROL',
    trigger: (
      <>
        <code>ENABLE_GARDEN_IMAGEGEN=1</code>
        <span className="and">AND</span>
        <code>OPENAI_API_KEY</code>
      </>
    ),
    body: '完整跑通 选模板 → 渲染 prompt → 调脚本 → 出图落盘。Skill 是真正的图像工具持有者。',
    flow: [
      'scripts/check-mode.js',
      'references/<cat>/<tpl>.md',
      'scripts/generate.js · scripts/edit.js',
      'garden-gpt-image-2/image/*.png',
    ],
  },
  {
    tag: 'B',
    name: 'Host‑Native',
    eyebrow: 'DELEGATED',
    trigger: (
      <>
        <code>ENABLE_GARDEN_IMAGEGEN</code>
        <span className="and">未启用</span>
        <span>·</span>
        <span>宿主自带 image_generation</span>
      </>
    ),
    body: '本 Skill 退化成提示词工程指引；最终 prompt 交给 ChatGPT / Codex / Gemini / Cursor 等宿主自己的 image 工具。',
    flow: [
      'scripts/check-mode.js',
      'references/<cat>/<tpl>.md',
      '宿主 image_generation()',
      '由宿主决定保存位置',
    ],
  },
  {
    tag: 'C',
    name: 'Advisor 顾问',
    eyebrow: 'PROMPT ONLY',
    trigger: (
      <>
        <code>ENABLE_GARDEN_IMAGEGEN</code>
        <span className="and">未启用</span>
        <span>·</span>
        <span>宿主无图像工具</span>
      </>
    ),
    body: '退化成 prompt 顾问。最终 prompt 写好后，交给用户在 ChatGPT / Midjourney / DALL·E / Sora / Nano Banana 等任意工具中执行。',
    flow: [
      'scripts/check-mode.js',
      'references/<cat>/<tpl>.md',
      '渲染后的 prompt（保存 + 展示）',
      '由用户拿去执行',
    ],
  },
];

const STEPS = [
  {
    n: '01',
    title: '探测运行模式',
    body: '任何任务的第一步：跑 check-mode.js，得到 A / B / C，决定后续走哪条分支。',
    code: 'node skills/gpt-image-2/scripts/check-mode.js --json',
  },
  {
    n: '02',
    title: '识别视觉类型',
    body: '判断任务属于 18 个分类中的哪一个（海报 / UI / 产品 / 学术图 / 信息图 / 编辑工作流 …）。',
    code: null,
  },
  {
    n: '03',
    title: '只读最近的一份模板',
    body: '从 references/ 中按 <category>/<template>.md 的层级，仅打开当前任务最贴近的那一份模板。',
    code: 'references/poster-and-campaigns/banner-hero.md',
  },
  {
    n: '04',
    title: '把用户输入映射到字段',
    body: 'JSON 模板里 {argument …} 是可填空位；用户给了什么填什么，default 可兜底，关键信息缺失时才发起精确询问。',
    code: null,
  },
  {
    n: '05',
    title: '渲染最终 prompt',
    body: '拍平 JSON 或保留结构化自然语言段落（部分 hand-drawn / scientific 模板），输出可直接喂给图像模型的字符串。',
    code: null,
  },
  {
    n: '06',
    title: '按模式分叉执行',
    body: 'Mode A 调脚本出图、Mode B 调宿主工具、Mode C 把 prompt 给用户。一句话总结：当前模式 / prompt 落点 / 图片落点。',
    code: null,
  },
];

const CONSTRAINTS = [
  {
    eyebrow: '保持',
    title: '严格按模板格式渲染',
    body: 'JSON 模板就按 JSON 输出；结构化自然语言模板按段落输出。不要把 SKILL.md 里的"模式说明"塞进最终 prompt——那是给 Agent 看的元信息。',
  },
  {
    eyebrow: '禁止',
    title: '虚构定量数据',
    body: '学术配图 / 技术图示中，数值、坐标轴、等值线、色标范围、公式必须真实，没有数据就直接交白图、不杜撰。',
  },
  {
    eyebrow: '推荐',
    title: '只读取最近的一份模板',
    body: '不要一次性读整个 references/。按 <category>/<template>.md 的两级层级，只打开当前任务最贴近的那一份。',
  },
  {
    eyebrow: '推荐',
    title: 'Prompt 永远落盘',
    body: 'A 必须、B 推荐、C 必须，命名形如 garden-gpt-image-2/prompt/<task-slug>-<YYYYMMDD-HHMMSS>.md，方便复用与版本管理。',
  },
];

export function SkillsPage({ navigate }: Props) {
  const [activeMode, setActiveMode] = useState<'A' | 'B' | 'C'>('A');

  useEffect(() => {
    document.title = 'Skill · GPT‑IMAGE 2 Toolkit';
    return () => {
      document.title = 'GPT-IMAGE 2 · The Visual Production Model';
    };
  }, []);

  const tplsByCat = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of Object.values(cases.templates)) {
      (map[t.category] ||= []).push(t.label);
    }
    return map;
  }, []);

  return (
    <main className="sp">
      {/* === HERO === */}
      <header className="sp-hero">
        <button className="sp-back" onClick={() => navigate({ name: 'home' })}>
          <span aria-hidden="true">←</span> Back to Gallery
        </button>

        <div className="sp-hero-meta mono">
          <span>03 / SKILL DOCS</span>
          <span className="sp-meta-sep" />
          <span>GPT‑IMAGE 2 TOOLKIT</span>
          <span className="sp-meta-sep" />
          <span>v1 · {new Date().getFullYear()}</span>
          <span className="sp-meta-sep" />
          <a
            className="sp-hero-source"
            href={SKILL_TREE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub: ConardLi/garden-skills"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            <span>SOURCE · ConardLi/garden-skills</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <h1 className="sp-hero-title serif">
          A <span className="serif-italic">focused</span> Skill
          <br />
          for one model. Three runtimes.
        </h1>

        <p className="sp-hero-lede">
          这是一个面向 GPT‑Image‑2 的<strong>聚焦型</strong>技能。它只做两件事——
          生成 (<code className="mono">/images/generations</code>) 和编辑
          (<code className="mono">/images/edits</code>)；
          但能在 Garden 本地、Host‑Native 委托、Advisor 顾问 三种环境下自适应地工作，
          并把 {Object.keys(cases.categories).length} 大类、{cases.summary.templates}+ 个结构化模板沉淀到 <code className="mono">references/</code> 里。
        </p>

        <dl className="sp-hero-stats">
          <div className="sp-hero-stat">
            <dt className="mono">RUNTIME MODES</dt>
            <dd className="serif">3</dd>
          </div>
          <div className="sp-hero-stat">
            <dt className="mono">CATEGORIES</dt>
            <dd className="serif">{Object.keys(cases.categories).length}</dd>
          </div>
          <div className="sp-hero-stat">
            <dt className="mono">TEMPLATES</dt>
            <dd className="serif">{cases.summary.templates}</dd>
          </div>
          <div className="sp-hero-stat">
            <dt className="mono">CASES SHIPPED</dt>
            <dd className="serif">{cases.summary.cases}</dd>
          </div>
        </dl>

        <div className="sp-hero-divider" />

        <p className="sp-hero-quote serif-italic">
          “最终交给图像模型的，永远是渲染后的 prompt 字符串本身——
          可以是拍平的 JSON，也可以是结构化自然语言段落。”
        </p>
      </header>

      {/* === MODES === */}
      <section className="sp-section sp-modes">
        <div className="sp-section-head">
          <span className="eyebrow">01 · RUNTIME MODES</span>
          <h2 className="serif sp-section-title">第一步永远是 check‑mode.js</h2>
          <p className="sp-section-sub">
            同一份 Skill，在三种环境下行为差异显著。模式由两个环境变量与宿主能力共同决定，
            check‑mode.js 给出 <code className="mono">mode = A / A? / B-or-C</code> 与建议下一步。
          </p>
        </div>

        <div className="sp-mode-tabs" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.tag}
              role="tab"
              aria-selected={activeMode === m.tag}
              className={`sp-mode-tab ${activeMode === m.tag ? 'sp-mode-tab-on' : ''}`}
              onClick={() => setActiveMode(m.tag as 'A' | 'B' | 'C')}
            >
              <span className="sp-mode-tab-tag mono">MODE {m.tag}</span>
              <span className="sp-mode-tab-name">{m.name}</span>
            </button>
          ))}
        </div>

        <div className="sp-mode-cards">
          {MODES.map((m) => (
            <article
              key={m.tag}
              className={`sp-mode-card ${activeMode === m.tag ? 'sp-mode-card-on' : ''}`}
              onMouseEnter={() => setActiveMode(m.tag as 'A' | 'B' | 'C')}
            >
              <header className="sp-mode-card-head">
                <span className="sp-mode-card-tag mono">{m.tag}</span>
                <div>
                  <div className="mono sp-mode-card-eyebrow">{m.eyebrow}</div>
                  <div className="serif sp-mode-card-name">{m.name}</div>
                </div>
              </header>
              <div className="sp-mode-card-trigger mono">{m.trigger}</div>
              <p className="sp-mode-card-body">{m.body}</p>
              <ol className="sp-mode-card-flow">
                {m.flow.map((step, i) => (
                  <li key={i} className="sp-mode-card-flow-item">
                    <span className="mono sp-mode-card-flow-n">{String(i + 1).padStart(2, '0')}</span>
                    <code className="mono">{step}</code>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      {/* === WORKFLOW === */}
      <section className="sp-section sp-workflow">
        <div className="sp-section-head">
          <span className="eyebrow">02 · WORKFLOW</span>
          <h2 className="serif sp-section-title">六步通用 · 第七步分叉</h2>
          <p className="sp-section-sub">
            无论 A / B / C，前 6 步完全一致；区别只在第 7‑8 步如何把渲染好的 prompt
            送进图像模型，以及落盘到哪里。
          </p>
        </div>

        <ol className="sp-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="sp-step">
              <div className="sp-step-meta">
                <span className="mono sp-step-n">{s.n}</span>
                <span className="sp-step-line" />
              </div>
              <div className="sp-step-body">
                <h3 className="serif sp-step-title">{s.title}</h3>
                <p className="sp-step-desc">{s.body}</p>
                {s.code && (
                  <pre className="mono sp-step-code"><code>{s.code}</code></pre>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="sp-fork">
          <div className="sp-fork-head">
            <span className="eyebrow">FORK · STEP 07</span>
            <h3 className="serif sp-fork-title">prompt 渲染好之后，按模式分发</h3>
          </div>
          <div className="sp-fork-grid">
            <div className="sp-fork-cell">
              <span className="mono sp-fork-tag">07‑A</span>
              <h4 className="serif sp-fork-name">保存 + 调脚本</h4>
              <p>把最终 prompt 保存到 <code className="mono">prompt/</code>，调 <code className="mono">generate.js</code> / <code className="mono">edit.js</code>，图片落到 <code className="mono">image/</code>。</p>
            </div>
            <div className="sp-fork-cell">
              <span className="mono sp-fork-tag">07‑B</span>
              <h4 className="serif sp-fork-name">交给宿主工具</h4>
              <p>不要调 <code className="mono">generate.js</code>（必失败）。直接把 prompt 喂进宿主自带的 <code className="mono">image_generation</code> 类工具。</p>
            </div>
            <div className="sp-fork-cell">
              <span className="mono sp-fork-tag">07‑C</span>
              <h4 className="serif sp-fork-name">写给用户</h4>
              <p>必须保存 prompt 到 <code className="mono">prompt/</code> 并在对话中完整展示，附一句"如何使用 / 推荐工具"。</p>
            </div>
          </div>
        </div>
      </section>

      {/* === TEMPLATE INDEX === */}
      <section className="sp-section sp-index">
        <div className="sp-section-head">
          <span className="eyebrow">03 · TEMPLATE INDEX</span>
          <h2 className="serif sp-section-title">
            {Object.keys(cases.categories).length} 个分类 · {cases.summary.templates} 个结构化模板
          </h2>
          <p className="sp-section-sub">
            每个模板都是一份 Markdown 文件，里面定义了 JSON / 结构化自然语言模板、
            参数表、变体说明、典型案例。点任意模板可以跳到使用了它的图集。
          </p>
        </div>

        <div className="sp-index-grid">
          {ORDERED_CATEGORIES.map((catKey, idx) => {
            const cat = cases.categories[catKey];
            if (!cat) return null;
            const tpls = tplsByCat[catKey] || [];
            return (
              <article
                key={catKey}
                className="sp-cat"
                style={{ '--cat-acc': cat.accent } as React.CSSProperties}
              >
                <header className="sp-cat-head">
                  <span className="mono sp-cat-n">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="sp-cat-stack">
                    <h3 className="serif sp-cat-name">{cat.cn}</h3>
                    <span className="mono sp-cat-en">{cat.label}</span>
                  </div>
                  <div className="sp-cat-stat mono">
                    <span className="sp-cat-stat-num">{tpls.length}</span>
                    <span className="sp-cat-stat-x">×</span>
                    <span className="sp-cat-stat-num">{cat.total}</span>
                  </div>
                </header>
                <ul className="sp-cat-tpls">
                  {tpls.map((t) => (
                    <li key={t} className="sp-cat-tpl">
                      <span className="sp-cat-tpl-bullet" />
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* === CONSTRAINTS === */}
      <section className="sp-section sp-rules">
        <div className="sp-section-head">
          <span className="eyebrow">04 · GUARDRAILS</span>
          <h2 className="serif sp-section-title">让 Skill 始终保持稳定的几条硬约束</h2>
        </div>
        <div className="sp-rules-grid">
          {CONSTRAINTS.map((c, i) => (
            <article key={i} className="sp-rule">
              <span className="mono sp-rule-eyebrow">{c.eyebrow}</span>
              <h3 className="serif sp-rule-title">{c.title}</h3>
              <p className="sp-rule-body">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* === CTA === */}
      <section className="sp-cta">
        <div className="sp-cta-text">
          <h3 className="serif sp-cta-title">
            准备好了？回去看 <span className="serif-italic">{cases.summary.cases} 张</span> 已经跑通的图。
          </h3>
          <p className="sp-cta-sub">
            想自己跑这个 Skill？源码 / 模板 / 三种运行模式都开源在 <code className="mono">ConardLi/garden-skills</code>。
          </p>
        </div>
        <div className="sp-cta-actions">
          <button
            className="sp-cta-btn"
            onClick={() => navigate({ name: 'home' })}
          >
            <span>浏览图集</span>
            <span className="sp-cta-btn-arrow" aria-hidden="true">→</span>
          </button>
          <a
            className="sp-cta-btn sp-cta-btn-ghost"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            <span>Star on GitHub</span>
            <span className="sp-cta-btn-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </main>
  );
}
