/**
 * Layout extraction for https://ai.explore.poker/chat
 * Produces a visibility-filtered element dump with bounding boxes and an ASCII
 * layout map (visual substitute, since this session cannot view images).
 *
 * Usage: node scripts/extract-layout-ai-explore-poker-820d0558.mjs [--state <name>]
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const SITE_KEY = 'ai-explore-poker-820d0558';
const PAGE_KEY = 'chat-6ea4b827';
const URL = 'https://ai.explore.poker/chat';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP_ROOT = process.cwd();
const RESEARCH = path.join(APP_ROOT, 'docs/research', SITE_KEY, PAGE_KEY);
const SHOTS = path.join(APP_ROOT, 'docs/design-references', SITE_KEY, PAGE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STYLE_PROPS = [
  'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing', 'color',
  'backgroundColor', 'padding', 'margin', 'width', 'height', 'maxWidth', 'minWidth', 'maxHeight', 'minHeight',
  'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
  'gridTemplateColumns', 'borderRadius', 'border', 'boxShadow', 'overflow',
  'position', 'top', 'right', 'bottom', 'left', 'zIndex', 'opacity', 'transform', 'transition', 'cursor',
  'whiteSpace', 'backdropFilter', 'filter',
];

const COLLECT_JS = `(opts) => {
  const props = ${JSON.stringify(STYLE_PROPS)};
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const out = [];
  const seen = new Set();
  // Walk whole tree, collect elements that are visible and either have text,
  // are interactive, or have a non-default background/border/shadow.
  const walk = (el) => {
    if (el.nodeType !== 1) return;
    if (!isVisible(el)) return;
    const tag = el.tagName.toLowerCase();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const hasText = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && el.textContent.trim();
    const interactive = ['button', 'input', 'textarea', 'select', 'a', 'label'].includes(tag);
    const styled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || (cs.border && cs.border !== '0px none rgb(0, 0, 0)') || cs.boxShadow !== 'none';
    const isLeafText = hasText || (tag === 'svg');
    const area = r.width * r.height;
    const skip = tag === 'div' && !styled && !hasText && !interactive && area < 2000;
    if (!skip && (isLeafText || interactive || styled) && area > 0) {
      const key = tag + '|' + (el.className?.toString().slice(0, 60) || '') + '|' + (el.textContent?.trim().slice(0, 40) || '');
      if (seen.has(key)) return;
      seen.add(key);
      const styles = {};
      props.forEach((p) => { const v = cs[p]; if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)' && v !== '0px none rgb(0, 0, 0)') styles[p] = v; });
      out.push({
        tag, cls: el.className?.toString().slice(0, 160) || '',
        text: el.textContent.trim().slice(0, 120) || null,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        styles,
      });
    }
    for (const c of el.children) walk(c);
  };
  walk(document.body);
  return out;
}`;

const ASCII_JS = `() => {
  const COLS = 150, ROWS = 40;
  const vw = innerWidth, vh = innerHeight;
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
  const labels = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Significant elements: visible, on-screen, with text or bg or border or interactive
  const sig = [];
  const walk = (el) => {
    if (el.nodeType !== 1) return;
    if (!isVisible(el)) return;
    const tag = el.tagName.toLowerCase();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const txt = el.textContent.trim();
    const hasText = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && txt;
    const interactive = ['button', 'input', 'textarea', 'select', 'a', 'label'].includes(tag);
    const styled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.border !== '0px none rgb(0, 0, 0)' || cs.boxShadow !== 'none';
    if ((hasText || interactive || styled || tag === 'svg') && r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) {
      sig.push({ el, r, tag, txt, hasText, interactive, styled, z: Number(cs.zIndex) || 0 });
    }
    for (const c of el.children) walk(c);
  };
  walk(document.body);
  // Sort by z-index ascending then DOM order so later ones paint on top
  sig.sort((a, b) => a.z - b.z || 0);
  let idx = 0;
  const used = new Set();
  for (const s of sig) {
    const col1 = Math.max(0, Math.floor((s.r.left / vw) * COLS));
    const col2 = Math.min(COLS - 1, Math.ceil((s.r.right / vw) * COLS));
    const row1 = Math.max(0, Math.floor((s.r.top / vh) * ROWS));
    const row2 = Math.min(ROWS - 1, Math.ceil((s.r.bottom / vh) * ROWS));
    if (col2 - col1 < 1 || row2 - row1 < 1) continue;
    if (used.has(s.el)) continue;
    used.add(s.el);
    const letter = letters[idx % letters.length];
    idx++;
    for (let r = row1; r <= row2; r++) {
      for (let c = col1; c <= col2; c++) {
        if (grid[r][c] === ' ') grid[r][c] = letter;
      }
    }
    const label = s.txt ? s.txt.slice(0, 30) : '<' + s.tag + '>';
    const bg = s.el.getBoundingClientRect();
    labels.push({ letter, x: Math.round(bg.left), y: Math.round(bg.top), w: Math.round(bg.width), h: Math.round(bg.height), tag: s.tag, cls: s.el.className?.toString().slice(0, 80) || '', text: label, z: s.z });
  }
  return { grid, labels };
}`;

async function main() {
  const stateName = process.argv.find((a) => a.startsWith('--state='))?.split('=')[1] || 'initial';
  fs.mkdirSync(RESEARCH, { recursive: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  console.log('Launching Edge...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    // --edge-skip-compat-layer-relaunch: Edge 151 会自重启进程导致 puppeteer 连接失败（Code: 0）
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900', '--edge-skip-compat-layer-relaunch'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    console.log('Navigating...');
    try {
      await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) { console.log('nav warn:', e.message.slice(0, 120)); }

    // Wait for app init
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      const st = await page.evaluate(() => ({ loading: (document.body.innerText || '').includes('Initializing Explore'), btns: document.querySelectorAll('button').length }));
      if (!st.loading && st.btns > 0) { console.log(`app ready at ${i * 2}s`); break; }
    }
    await sleep(2000);

    // Press Escape to close any auto-opened modals
    await page.keyboard.press('Escape');
    await sleep(800);
    await page.keyboard.press('Escape');
    await sleep(800);

    // CSS-force-hide modal backdrops to reveal the mounted main UI (onboarding wizard
    // cannot be closed via its Next button — React state does not advance)
    await page.evaluate(() => {
      const st = document.createElement('style');
      st.textContent = 'div[class*="bg-overlay-modal"], div[class*="bg-black/60"], div[class*="bg-black bg-opacity-50"] { display: none !important; }';
      document.head.appendChild(st);
    });
    await sleep(600);

    const state = await page.evaluate(() => ({ text: document.body.innerText.slice(0, 1500), buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim().slice(0, 40)).filter(Boolean).slice(0, 60) }));
    console.log('\n=== VISIBLE TEXT ===\n' + state.text);
    console.log('\n=== VISIBLE BUTTONS ===\n' + JSON.stringify(state.buttons, null, 1));

    const ascii = await page.evaluate('(' + ASCII_JS + ')()');
    console.log('\n=== ASCII LAYOUT MAP (1440x900) ===');
    console.log(ascii.grid.map((r) => r.join('')).join('\n'));
    const legend = ascii.labels.map((l) => `${l.letter} [z${l.z}] <${l.tag}> "${l.text}" cls="${l.cls}" @(${l.x},${l.y} ${l.w}x${l.h})`).join('\n');
    fs.writeFileSync(path.join(RESEARCH, `layout-${stateName}-legend.txt`), legend);
    fs.writeFileSync(path.join(RESEARCH, `layout-${stateName}-map.txt`), ascii.grid.map((r) => r.join('')).join('\n'));
    console.log('\n=== LEGEND (first 60) ===');
    console.log(legend.split('\n').slice(0, 60).join('\n'));

    const elements = await page.evaluate('(' + COLLECT_JS + ')({})');
    fs.writeFileSync(path.join(RESEARCH, `layout-${stateName}-elements.json`), JSON.stringify(elements, null, 1));
    console.log(`\nCollected ${elements.length} significant elements -> layout-${stateName}-elements.json`);

    await page.screenshot({ path: path.join(SHOTS, `state-${stateName}-1440.png`) });
    await page.screenshot({ path: path.join(SHOTS, `state-${stateName}-1440-full.png`), fullPage: true });
    console.log('Screenshots saved.');
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
