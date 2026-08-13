/**
 * Interactive probe for https://ai.explore.poker/chat
 * Chainable action runner for state extraction.
 *
 * Usage: node scripts/probe-ai-explore-poker-820d0558.mjs --actions "load,wait:2000,esc,extract:main"
 *
 * Actions:
 *   load              — goto URL, wait for app init
 *   wait:<ms>         — sleep
 *   esc[:n]           — press Escape n times (default 1)
 *   click:<text>      — click the first visible element whose textContent contains <text>
 *   clickSel:<css>    — click first match of css selector (visible)
 *   type:<text>       — type into the focused element
 *   extract:<name>    — dump visible text, buttons, ASCII map, elements to research dir
 *   shot:<name>       — viewport screenshot
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

const ASCII_JS = `() => {
  const COLS = 150, ROWS = 38;
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
    for (let r = row1; r <= row2; r++) for (let c = col1; c <= col2; c++) if (grid[r][c] === ' ') grid[r][c] = letter;
    const label = s.txt ? s.txt.slice(0, 30) : '<' + s.tag + '>';
    const bg = s.r;
    labels.push({ letter, x: Math.round(bg.left), y: Math.round(bg.top), w: Math.round(bg.width), h: Math.round(bg.height), tag: s.tag, cls: s.el.className?.toString().slice(0, 80) || '', text: label, z: s.z });
  }
  return { grid, labels };
}`;

async function extractState(page, name) {
  fs.mkdirSync(RESEARCH, { recursive: true });
  const state = await page.evaluate(() => ({ text: document.body.innerText.slice(0, 4000) }));
  console.log(`\n=== [${name}] VISIBLE TEXT ===\n` + state.text);
  const ascii = await page.evaluate('(' + ASCII_JS + ')()');
  const mapTxt = ascii.grid.map((r) => r.join('')).join('\n');
  const legend = ascii.labels.map((l) => `${l.letter} <${l.tag}> "${l.text}" cls="${l.cls}" @(${l.x},${l.y} ${l.w}x${l.h})`).join('\n');
  fs.writeFileSync(path.join(RESEARCH, `state-${name}-map.txt`), mapTxt);
  fs.writeFileSync(path.join(RESEARCH, `state-${name}-legend.txt`), legend);
  console.log(`\n=== [${name}] ASCII MAP ===`);
  console.log(mapTxt);
  console.log(`\n=== [${name}] LEGEND ===`);
  console.log(legend.split('\n').slice(0, 70).join('\n'));
  await page.screenshot({ path: path.join(SHOTS, `state-${name}.png`) });
  console.log(`\n[${name}] saved.`);
}

async function clickVisible(page, text, index = 0) {
  const ok = await page.evaluate((t, i) => {
    const els = [...document.querySelectorAll('button, a, li, div, span')].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      return el.textContent.trim().includes(t);
    });
    const el = els[i];
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, text, index);
  if (!ok) console.log(`  !! click "${text}" not found`);
  return ok;
}

async function main() {
  const argv = process.argv.slice(2);
  const eqArg = argv.find((a) => a.startsWith('--actions='));
  const spArg = argv.indexOf('--actions');
  const actionsArg = eqArg ? eqArg.split('=')[1] : (spArg >= 0 ? argv[spArg + 1] : null);
  const actions = (actionsArg ? actionsArg : 'load,extract:main').split(',');
  const vpArg = argv.find((a) => a.startsWith('--vp='))?.split('=')[1];
  const [VP_W, VP_H] = vpArg ? vpArg.split('x').map(Number) : [1440, 900];
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
    await page.setViewport({ width: VP_W, height: VP_H, deviceScaleFactor: 1 });
    // seed the COMPLETE settings-storage the app itself writes after onboarding
    // (missing keys like language trigger the Choose Theme wizard at boot)
    await page.evaluateOnNewDocument((seed) => {
      try { localStorage.setItem('settings-storage', seed); } catch (e) {}
    }, JSON.stringify({
      state: {
        settingsSchemaVersion: 3,
        builtinChatListFingerprint: 'builtin:aiping/deepseek-v4-flash-0731/chat\nbuiltin:aiping/deepseek-v4-flash-0731/reasoner\nbuiltin:aiping/Step-3.5-Flash',
        builtinModelTier: 'free',
        byokModels: [],
        chatModelIds: ['builtin:aiping/deepseek-v4-flash-0731/chat', 'builtin:aiping/deepseek-v4-flash-0731/reasoner', 'builtin:aiping/Step-3.5-Flash'],
        activeModelId: 'builtin:aiping/deepseek-v4-flash-0731/chat',
        functionalModelId: 'builtin:tencent-tokenhub/qwen3.5-flash/reasoner',
        imageModelId: 'builtin:tencent-tokenhub/qwen3.5-flash/chat',
        isWebSearchEnabled: false,
        forceMobileLayout: null,
        theme: 'Default (暗色)',
        language: 'en',
        autoCitationEnabled: true, autoCitationBefore: 1, autoCitationAfter: 0,
        autoTitleEnabled: true, autoTitleInterval: 5,
        allowAiMessageEditing: false,
        uiZoom: 1, uiZoomDefaultGeneration: 2,
        sendShortcut: 'ctrl-enter',
        knowledgeBackground: '', educationLevel: '',
      }, version: 0,
    }));

    for (const action of actions) {
      const [op, arg] = action.split(':');
      switch (op) {
        case 'load': {
          console.log('Navigating...');
          try { await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 }); } catch (e) { console.log('  nav warn:', e.message.slice(0, 100)); }
          for (let i = 0; i < 60; i++) {
            await sleep(2000);
            const st = await page.evaluate(() => ({ loading: (document.body.innerText || '').includes('Initializing Explore'), btns: document.querySelectorAll('button').length }));
            if (!st.loading && st.btns > 0) { console.log(`  app ready at ${i * 2}s`); break; }
          }
          await sleep(2000);
          break;
        }
        case 'wait': await sleep(Number(arg) || 1000); break;
        case 'esc': {
          const n = Number(arg) || 1;
          for (let i = 0; i < n; i++) { await page.keyboard.press('Escape'); await sleep(400); }
          break;
        }
        case 'click': await clickVisible(page, arg); await sleep(1200); break;
        case 'clickSel': {
          const ok = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            el.click();
            return true;
          }, arg);
          console.log(`  clickSel ${arg}: ${ok}`);
          await sleep(1200);
          break;
        }
        case 'clickAt': {
          const [x, y] = arg.split('_').map(Number);
          await page.mouse.click(x, y);
          console.log(`  clicked at (${x}, ${y})`);
          await sleep(1200);
          break;
        }
        case 'hover': {
          const [x, y] = arg.split('_').map(Number);
          await page.mouse.move(x, y);
          await sleep(600);
          break;
        }
        case 'type': {
          await page.keyboard.type(arg, { delay: 5 });
          await sleep(300);
          break;
        }
        case 'enter': { await page.keyboard.press('Enter'); await sleep(800); break; }
        case 'ctrlenter': {
          await page.keyboard.down('Control');
          await page.keyboard.press('Enter');
          await page.keyboard.up('Control');
          await sleep(800);
          break;
        }
        case 'extract': await extractState(page, arg); break;
        case 'scan': {
          // elementFromPoint grid scan — reveals which layer is actually on top
          const scan = await page.evaluate((step) => {
            const out = [];
            for (let y = 0; y < innerHeight; y += step) {
              const row = [];
              for (let x = 0; x < innerWidth; x += step) {
                const el = document.elementFromPoint(x, y);
                let desc = '';
                if (el) {
                  const cs = getComputedStyle(el);
                  let cls = el.className?.toString().slice(0, 50) || '';
                  if (!cls) cls = el.tagName;
                  desc = cls + '|bg=' + cs.backgroundColor;
                }
                row.push(desc);
              }
              out.push(row);
            }
            return out;
          }, 80);
          const legend = new Map();
          let li = 0;
          const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          const grid = scan.map((row) => row.map((d) => {
            if (!d) return ' ';
            if (!legend.has(d)) legend.set(d, letters[li++ % letters.length]);
            return legend.get(d);
          }).join(''));
          console.log(`\n=== [scan] elementFromPoint grid (step 80) ===`);
          console.log(grid.join('\n'));
          console.log('\n=== scan legend ===');
          legend.forEach((l, d) => console.log(`${l}  ${d}`));
          fs.writeFileSync(path.join(RESEARCH, 'scan-layers.txt'), grid.join('\n') + '\n\n' + [...legend.entries()].map(([d, l]) => `${l}  ${d}`).join('\n'));
          break;
        }
        case 'shot': {
          await page.screenshot({ path: path.join(SHOTS, `state-${arg}.png`) });
          break;
        }
        case 'ls': {
          const dump = await page.evaluate(() => {
            const out = {};
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              out[k] = localStorage.getItem(k);
            }
            return out;
          });
          fs.writeFileSync(path.join(RESEARCH, `ls-${arg || 'dump'}.json`), JSON.stringify(dump, null, 2));
          console.log(`\n=== localStorage (${Object.keys(dump).length} keys) -> ls-${arg || 'dump'}.json ===`);
          for (const [k, v] of Object.entries(dump)) console.log(`  ${k}: ${(v || '').slice(0, 120)}`);
          break;
        }
        case 'hideov': {
          // CSS-force-hide all modal backdrops (bg-overlay-modal / bg-black/60 / bg-black bg-opacity-50)
          // to reveal the mounted main UI underneath. Modal cards are children of these backdrops.
          await page.evaluate(() => {
            const st = document.createElement('style');
            st.id = 'probe-hide-overlays';
            st.textContent = 'div[class*="bg-overlay-modal"], div[class*="bg-black/60"], div[class*="bg-black bg-opacity-50"] { display: none !important; }';
            document.head.appendChild(st);
          });
          console.log('  overlays hidden via CSS');
          await sleep(500);
          break;
        }
        case 'ov': {
          const ov = await page.evaluate(() => {
            const out = [];
            for (const el of document.querySelectorAll('div')) {
              const cs = getComputedStyle(el);
              if (cs.position !== 'fixed') continue;
              const r = el.getBoundingClientRect();
              if (r.width < 500 || r.height < 300) continue;
              const cls = el.className.toString();
              const open = cs.opacity === '1' && cs.pointerEvents !== 'none' && !cls.includes('opacity-0');
              out.push({ z: cs.zIndex, open, cls: cls.slice(0, 110), r: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`, pe: cs.pointerEvents });
            }
            // what's actually under the cursor at sample points
            const pts = [[20, 450], [720, 450], [911, 594], [483, 400], [207 + 513, 129 + 320]];
            const top = pts.map(([x, y]) => {
              const el = document.elementFromPoint(x, y);
              return [x, y, el ? (el.className?.toString().slice(0, 80) || el.tagName) : null];
            });
            return { overlays: out.sort((a, b) => Number(b.z) - Number(a.z)), top };
          });
          console.log('\n=== overlay stack (by z desc) ===');
          for (const o of ov.overlays) console.log(`  z=${o.z} open=${o.open} ${o.r} pe=${o.pe} "${o.cls}"`);
          console.log('=== elementFromPoint samples ===');
          for (const t of ov.top) console.log(`  (${t[0]},${t[1]}) -> ${t[2]}`);
          break;
        }
        case 'radio': {
          // click the radio/label whose associated text matches arg
          const ok = await page.evaluate((txt) => {
            const labels = [...document.querySelectorAll('label')].filter((l) => l.textContent.includes(txt) && l.querySelector('input[type=radio]'));
            if (!labels.length) return 'no label';
            const label = labels[0];
            const input = label.querySelector('input[type=radio]');
            input.click();
            label.click();
            return `clicked ${label.textContent.trim().slice(0, 40)} checked=${input.checked}`;
          }, arg);
          console.log(`  radio ${arg}: ${ok}`);
          await sleep(1000);
          break;
        }
        default: console.log(`  unknown action: ${op}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
