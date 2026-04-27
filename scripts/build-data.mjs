#!/usr/bin/env node
// Reads website/public/case/_mapping.json + each case's prompt content + each
// template's MD source, and emits src/data/cases.json (a flat, embedded manifest).
//
// Cases live under `website/public/case/` so that Vite serves them directly
// from `/case/...` in both dev and production builds (lazy loaded by the
// browser). Run via `npm run build:data` (also fires on predev / prebuild).

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const WEBSITE_ROOT = resolve(__dirname, '..');
// Case assets now live under website/public/case so they get bundled into
// the static site automatically. URLs are served at /case/<...>.
const CASES_ROOT = resolve(WEBSITE_ROOT, 'public', 'case');
const CASES_URL_PREFIX = '/case';
const SKILL_ROOT = resolve(ROOT, '.claude', 'skills', 'gpt-image-2');
const OUT = resolve(__dirname, '..', 'src', 'data', 'cases.json');

const CATEGORY_META = {
  'ui-mockups': { label: 'UI Mockups', cn: '界面样机', accent: '#1F6FB2' },
  'product-visuals': { label: 'Product Visuals', cn: '产品视觉', accent: '#C7522A' },
  'maps': { label: 'Maps', cn: '地图', accent: '#3B7A57' },
  'slides-and-visual-docs': { label: 'Slides & Docs', cn: '视觉文档', accent: '#6A4C93' },
  'poster-and-campaigns': { label: 'Posters & Campaigns', cn: '海报营销', accent: '#E8472C' },
  'portraits-and-characters': { label: 'Portraits', cn: '人物视觉', accent: '#8B4513' },
  'scenes-and-illustrations': { label: 'Scenes', cn: '氛围插画', accent: '#5E8B7E' },
  'editing-workflows': { label: 'Editing', cn: '图像编辑', accent: '#4A6FA5' },
  'avatars-and-profile': { label: 'Avatars', cn: '头像人设', accent: '#D08C60' },
  'storyboards-and-sequences': { label: 'Storyboards', cn: '叙事序列', accent: '#A23E48' },
  'grids-and-collages': { label: 'Grids & Collages', cn: '网格拼贴', accent: '#2E7D8B' },
  'branding-and-packaging': { label: 'Branding', cn: '品牌包装', accent: '#B8860B' },
  'typography-and-text-layout': { label: 'Typography', cn: '字体版式', accent: '#4F4F4F' },
  'assets-and-props': { label: 'Assets & Props', cn: '素材资产', accent: '#6B5B95' },
  'academic-figures': { label: 'Academic', cn: '学术配图', accent: '#1A4E8A' },
  'infographics': { label: 'Infographics', cn: '信息图', accent: '#D4665A' },
  'technical-diagrams': { label: 'Technical Diagrams', cn: '技术图示', accent: '#0A6E96' },
};

async function readSafe(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function extractTemplateSummary(md) {
  if (!md) return { description: null, signature: null };
  // Find first heading after frontmatter
  const lines = md.split('\n');
  let body = lines.slice(0);
  // strip frontmatter
  if (body[0] && body[0].trim() === '---') {
    let end = -1;
    for (let i = 1; i < body.length; i++) {
      if (body[i].trim() === '---') { end = i; break; }
    }
    if (end > 0) body = body.slice(end + 1);
  }
  const text = body.join('\n').trim();
  // Take first paragraph after the first heading
  const headingIdx = text.indexOf('\n## ');
  let intro;
  if (headingIdx >= 0) {
    const before = text.slice(0, headingIdx).trim();
    intro = before
      .replace(/^#\s+.+$/m, '')
      .split('\n').filter(l => l.trim() && !l.startsWith('#')).slice(0, 4).join('\n').trim();
  } else {
    intro = text.split('\n').filter(l => l.trim()).slice(0, 4).join('\n').trim();
  }
  return { description: intro || null, signature: null };
}

async function main() {
  const mapping = JSON.parse(await readFile(resolve(CASES_ROOT, '_mapping.json'), 'utf8'));
  const out = {
    generated_at: new Date().toISOString(),
    summary: mapping.summary,
    categories: {},
    cases: [],
    templates: {},
  };

  for (const item of mapping.items) {
    const cat = item.category;
    out.categories[cat] = out.categories[cat] || {
      key: cat,
      ...CATEGORY_META[cat],
      templates: [],
      total: 0,
      ready: 0,
    };

    const tplKey = `${cat}/${item.template_basename}`;
    const tplMd = await readSafe(resolve(ROOT, '.claude', 'skills', 'gpt-image-2', 'references', cat, `${item.template_basename}.md`));
    const summary = extractTemplateSummary(tplMd);

    out.templates[tplKey] = {
      key: tplKey,
      category: cat,
      name: item.template_basename,
      label: item.template_basename
        .split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' '),
      md_path: item.template_md,
      description: summary.description,
      // Embed the full template MD so detail page can render it.
      content: tplMd,
      cases_count: item.cases.length,
    };
    out.categories[cat].templates.push(tplKey);

    for (const c of item.cases) {
      const promptPath = resolve(CASES_ROOT, c.file);
      const baseName = c.file.replace(/\.(json|txt)$/, '');
      const imagePath = resolve(CASES_ROOT, baseName + '.png');
      const hasImage = await exists(imagePath);
      const promptContent = await readSafe(promptPath);

      out.categories[cat].total += 1;
      if (hasImage) out.categories[cat].ready += 1;

      out.cases.push({
        id: `${cat}/${item.template_basename}/${c.idx}`,
        category: cat,
        category_label: CATEGORY_META[cat]?.cn || cat,
        category_accent: CATEGORY_META[cat]?.accent || '#666',
        template_key: tplKey,
        template_label: out.templates[tplKey].label,
        idx: c.idx,
        title: c.title,
        brief: c.brief,
        format: c.format,
        prompt_path: c.file,
        prompt_url: `${CASES_URL_PREFIX}/${c.file}`,
        prompt_content: promptContent,
        image_url: hasImage ? `${CASES_URL_PREFIX}/${baseName}.png` : null,
        has_image: hasImage,
      });
    }
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2));

  // Also pull skill SKILL.md content for the skills page
  const skillMd = await readSafe(resolve(SKILL_ROOT, 'SKILL.md'));
  const introMd = await readSafe(resolve(ROOT, 'doc', 'img2.md'));
  const meta = {
    skill_md: skillMd,
    intro_md: introMd,
    generated_at: out.generated_at,
  };
  await writeFile(resolve(__dirname, '..', 'src', 'data', 'docs.json'), JSON.stringify(meta, null, 2));

  console.log(`✔ wrote ${OUT}`);
  console.log(`  ${out.cases.length} cases, ${Object.keys(out.templates).length} templates`);
  const ready = out.cases.filter(c => c.has_image).length;
  console.log(`  ${ready} / ${out.cases.length} have images`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
