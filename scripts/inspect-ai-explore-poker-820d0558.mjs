/**
 * Browser inspection script for https://ai.explore.poker/chat
 * Drives local Microsoft Edge via puppeteer-core (no browser MCP available in this session).
 *
 * Usage: node scripts/inspect-ai-explore-poker-820d0558.mjs
 *
 * Outputs:
 *   docs/design-references/ai-explore-poker-820d0558/chat-6ea4b827/*.png   — screenshots
 *   docs/research/ai-explore-poker-820d0558/chat-6ea4b827/*.json/.html    — extracted data
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

const NAV_TIMEOUT = 60000;

// The skill's per-element style extraction property list
const STYLE_PROPS = [
  'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing', 'color',
  'textTransform', 'textDecoration', 'backgroundColor', 'background',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'width', 'height', 'maxWidth', 'minWidth', 'maxHeight', 'minHeight',
  'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
  'gridTemplateColumns', 'gridTemplateRows',
  'borderRadius', 'border', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight',
  'boxShadow', 'overflow', 'overflowX', 'overflowY',
  'position', 'top', 'right', 'bottom', 'left', 'zIndex',
  'opacity', 'transform', 'transition', 'cursor',
  'objectFit', 'objectPosition', 'mixBlendMode', 'filter', 'backdropFilter',
  'whiteSpace', 'textOverflow', 'WebkitLineClamp',
];

const EXTRACT_JS = `(opts) => {
  const props = ${JSON.stringify(STYLE_PROPS)};
  function extractStyles(element) {
    const cs = getComputedStyle(element);
    const styles = {};
    props.forEach((p) => { const v = cs[p]; if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') styles[p] = v; });
    return styles;
  }
  function walk(element, depth) {
    if (depth > (opts?.maxDepth ?? 5)) return null;
    const children = [...element.children];
    const out = {
      tag: element.tagName.toLowerCase(),
      classes: element.className?.toString().split(' ').slice(0, 6).join(' '),
      text: element.childNodes.length === 1 && element.childNodes[0].nodeType === 3 ? element.textContent.trim().slice(0, 300) : null,
      styles: extractStyles(element),
      childCount: children.length,
    };
    if (element.tagName === 'IMG') {
      out.img = { src: element.src, alt: element.alt, naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight };
    }
    if (element.tagName === 'SVG') {
      out.svg = { width: element.getAttribute('width'), height: element.getAttribute('height'), viewBox: element.getAttribute('viewBox') };
    }
    if (children.length && depth < (opts?.maxDepth ?? 5)) {
      out.children = children.slice(0, 20).map((c) => walk(c, depth + 1)).filter(Boolean);
    }
    return out;
  }
  const sel = opts?.selector;
  const root = sel ? document.querySelector(sel) : document.body;
  if (!root) return JSON.stringify({ error: 'not found: ' + sel });
  return JSON.stringify(walk(root, 0), null, 1);
}`;

async function save(name, data) {
  const target = path.join(RESEARCH, name);
  fs.writeFileSync(target, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log(`  wrote ${path.relative(APP_ROOT, target)} (${fs.statSync(target).size} bytes)`);
}

async function main() {
  fs.mkdirSync(RESEARCH, { recursive: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  console.log('Launching Edge...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    const requests = [];
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['script', 'stylesheet', 'font', 'xhr', 'fetch', 'websocket'].includes(type)) {
        requests.push({ url: req.url(), type });
      }
    });
    page.on('websocket', (ws) => {
      requests.push({ url: ws.url(), type: 'websocket' });
    });
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push({ level: msg.type(), text: msg.text().slice(0, 500) }));

    console.log(`Navigating to ${URL} ...`);
    let navStatus = 'ok';
    try {
      await page.goto(URL, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
    } catch (e) {
      navStatus = 'timeout/' + e.message.slice(0, 120);
      console.log('Navigation warning:', e.message.slice(0, 200));
    }

    // The app renders a "Initializing Explore..." splash first, then hydrates the real
    // chat UI client-side. Poll until the splash is gone and interactive UI exists.
    console.log('Waiting for the chat app to initialize...');
    let appReady = false;
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      const state = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const loading = bodyText.includes('Initializing Explore');
        const buttons = document.querySelectorAll('button').length;
        const textareas = document.querySelectorAll('textarea').length;
        const inputs = document.querySelectorAll('input').length;
        const svgCount = document.querySelectorAll('svg').length;
        return { loading, buttons, textareas, inputs, svgCount, textPreview: bodyText.slice(0, 200) };
      });
      console.log(`  [${i * 2}s] loading=${state.loading} buttons=${state.buttons} textareas=${state.textareas} inputs=${state.inputs} svgs=${state.svgCount}`);
      if (!state.loading && state.buttons > 0) { appReady = true; break; }
    }
    if (!appReady) console.log('  WARNING: app did not fully initialize within 120s — capturing what exists.');
    await sleep(3000); // let animations/fonts settle

    const meta = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      lang: document.documentElement.lang,
      metaDescription: document.querySelector('meta[name="description"]')?.content ?? null,
      metaKeywords: document.querySelector('meta[name="keywords"]')?.content ?? null,
      viewportMeta: document.querySelector('meta[name="viewport"]')?.content ?? null,
      framework: (() => {
        if (window.__NEXT_DATA__) return 'next.js';
        if (window.__NUXT__) return 'nuxt';
        if (window.__APP__) return 'vue';
        if (document.querySelector('#root')) return 'react-cra';
        if (document.querySelector('[ng-version]')) return 'angular';
        if (window.React) return 'react';
        return 'unknown';
      })(),
      fonts: [...new Set([...document.querySelectorAll('*')].slice(0, 400).map((el) => getComputedStyle(el).fontFamily))],
      favicons: [...document.querySelectorAll('link[rel*="icon"]')].map((l) => ({ href: l.href, sizes: l.sizes?.toString() })),
      themeColor: document.querySelector('meta[name="theme-color"]')?.content ?? null,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      bodyFontSize: getComputedStyle(document.body).fontSize,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hasLenis: !!document.querySelector('.lenis'),
      hasLocomotive: !!document.querySelector('.locomotive-scroll'),
      shadowRoots: [...document.querySelectorAll('*')].filter((el) => el.shadowRoot).length,
      scripts: [...document.querySelectorAll('script[src]')].map((s) => s.src).slice(0, 30),
      stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href).slice(0, 30),
    }));
    await save('meta.json', meta);

    console.log('Capturing screenshots...');
    // Desktop full + viewport
    await page.screenshot({ path: path.join(SHOTS, 'desktop-1440-full.png'), fullPage: true });
    await page.screenshot({ path: path.join(SHOTS, 'desktop-1440-viewport.png') });

    // Tablet
    await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, 'tablet-768-viewport.png') });

    // Mobile
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, 'mobile-390-full.png'), fullPage: true });
    await page.screenshot({ path: path.join(SHOTS, 'mobile-390-viewport.png') });
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    console.log('Extracting DOM snapshot with computed styles...');
    const domSnapshot = await page.evaluate(EXTRACT_JS, { maxDepth: 6 });
    await save('dom-snapshot-desktop.json', domSnapshot);

    console.log('Extracting full text content...');
    const textContent = await page.evaluate(() => {
      const walk = (el, acc) => {
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
          const t = el.textContent.trim();
          if (t) {
            const cs = getComputedStyle(el);
            acc.push({ tag: el.tagName.toLowerCase(), cls: el.className?.toString().slice(0, 80), text: t, fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, ff: cs.fontFamily });
          }
        }
        [...el.children].forEach((c) => walk(c, acc));
      };
      const acc = [];
      walk(document.body, acc);
      return acc;
    });
    await save('text-content.json', textContent);

    console.log('Discovering assets...');
    const assets = await page.evaluate(() => ({
      images: [...document.querySelectorAll('img')].map((img) => ({
        src: img.src || img.currentSrc,
        alt: img.alt,
        width: img.naturalWidth,
        height: img.naturalHeight,
        parentClasses: img.parentElement?.className?.toString().slice(0, 100),
        position: getComputedStyle(img).position,
        zIndex: getComputedStyle(img).zIndex,
      })),
      videos: [...document.querySelectorAll('video')].map((v) => ({
        src: v.src || v.querySelector('source')?.src,
        poster: v.poster,
        autoplay: v.autoplay,
        loop: v.loop,
        muted: v.muted,
      })),
      backgroundImages: [...document.querySelectorAll('*')]
        .filter((el) => {
          const bg = getComputedStyle(el).backgroundImage;
          return bg && bg !== 'none';
        })
        .map((el) => ({
          url: getComputedStyle(el).backgroundImage,
          element: el.tagName + '.' + el.className?.toString().split(' ')[0],
        })),
      svgCount: document.querySelectorAll('svg').length,
      svgSample: [...document.querySelectorAll('svg')].slice(0, 30).map((s) => ({
        cls: s.className?.baseVal || s.className?.toString().slice(0, 60) || '',
        width: s.getAttribute('width') || getComputedStyle(s).width,
        height: s.getAttribute('height') || getComputedStyle(s).height,
        viewBox: s.getAttribute('viewBox') || '',
      })),
    }));
    await save('assets.json', assets);

    console.log('Extracting design tokens...');
    const tokens = await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((el) => {
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      const colors = new Set();
      const fontSizes = new Set();
      const radii = new Set();
      const shadows = new Set();
      els.slice(0, 1500).forEach((el) => {
        const cs = getComputedStyle(el);
        ['color', 'backgroundColor', 'borderColor', 'borderTopColor'].forEach((p) => {
          const v = cs[p];
          if (v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent') colors.add(v);
        });
        if (cs.fontSize && cs.fontSize !== '16px') fontSizes.add(cs.fontSize);
        if (cs.borderRadius && cs.borderRadius !== '0px') radii.add(cs.borderRadius);
        if (cs.boxShadow && cs.boxShadow !== 'none') shadows.add(cs.boxShadow);
      });
      return {
        colors: [...colors].sort(),
        fontSizes: [...fontSizes].sort((a, b) => parseFloat(a) - parseFloat(b)),
        borderRadiuses: [...radii].sort(),
        boxShadows: [...shadows].slice(0, 40),
      };
    });
    await save('design-tokens.json', tokens);

    await save('network-requests.json', requests);
    await save('console-logs.json', consoleLogs);

    const html = await page.content();
    await save('page.html', html);

    console.log('Network request summary:');
    const byType = {};
    requests.forEach((r) => { byType[r.type] = (byType[r.type] || 0) + 1; });
    console.log('  ', JSON.stringify(byType));
    console.log('  scripts:', requests.filter((r) => r.type === 'script').map((r) => r.url).slice(0, 12).join('\n    '));

    console.log('\nDONE. Screenshots + research saved.');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
