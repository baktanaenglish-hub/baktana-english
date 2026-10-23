// Renders the PNG icons from the SVG logo in public/icons/icon-maskable.svg, using Playwright's Chromium.
// Writes the iPhone home-screen icon to public/icons/ and the Capacitor source images to assets/;
// then regenerate the Android resources (see docs/android.md).
//
//   node tools/render-icons.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = '#1f7cf2';
const maskable = readFileSync(join(root, 'public/icons/icon-maskable.svg'), 'utf8');
// The logo mark without its square background, for the Android foreground layer and the splash screens.
const mark = maskable.replace(/<rect width="512" height="512" fill="[^"]+"\/>/, '');

const page = (size, background, svg, scale = 1, radius = 0) => `<!doctype html>
<style>html,body{margin:0;width:${size}px;height:${size}px;background:${background};position:relative;overflow:hidden}
div{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${size * scale}px;height:${size * scale}px;border-radius:${radius * scale}%;overflow:hidden}
svg{display:block;width:100%;height:100%}</style><div>${svg}</div>`;

const outputs = [
  { file: 'public/icons/apple-touch-icon.png', size: 180, html: page(180, BRAND, maskable) },
  { file: 'assets/icon-only.png', size: 1024, html: page(1024, BRAND, maskable) },
  { file: 'assets/icon-background.png', size: 1024, html: page(1024, BRAND, '') },
  // ic_launcher.xml insets the foreground by 16.7%, so this PNG is the whole visible icon; the bubble
  // fills ~75% of it and still fits a round mask.
  { file: 'assets/icon-foreground.png', size: 1024, html: page(1024, 'transparent', mark, 1.15), transparent: true },
  { file: 'assets/splash.png', size: 2732, html: page(2732, '#ffffff', maskable, 0.18, 22) },
  { file: 'assets/splash-dark.png', size: 2732, html: page(2732, '#131f24', maskable, 0.18, 22) },
];

const browser = await chromium.launch();
for (const { file, size, html, transparent } of outputs) {
  const tab = await browser.newPage({ viewport: { width: size, height: size } });
  await tab.setContent(html);
  await tab.screenshot({ path: join(root, file), omitBackground: Boolean(transparent) });
  await tab.close();
  console.log(`wrote ${file}`);
}
await browser.close();
