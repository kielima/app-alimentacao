#!/usr/bin/env node
/**
 * Gera os PNGs do PWA a partir do PNG base (icon-source.png).
 * Roda automaticamente antes do build (npm prebuild).
 */
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

const sourcePath = resolve(publicDir, 'icon-source.png');
const sourceBuf = readFileSync(sourcePath);

// Off-white com leve tom esverdeado.
const BG = { r: 241, g: 244, b: 230, alpha: 1 };
const BG_HEX = '#F1F4E6';

// Pequeno ajuste óptico do logo (frações do canvas).
const SHIFT_X = 0.01; // direita
const SHIFT_Y = -0.02; // cima

async function renderIcon(size, { padding = 0.12, rounded = true } = {}) {
  const inner = Math.round(size * (1 - 2 * padding));
  const baseOffset = Math.round((size - inner) / 2);
  const top = baseOffset + Math.round(size * SHIFT_Y);
  const left = baseOffset + Math.round(size * SHIFT_X);
  const innerBuf = await sharp(sourceBuf)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const composites = [{ input: innerBuf, top, left }];

  if (rounded) {
    const r = Math.round(size * 0.1875);
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
    );
    composites.push({ input: mask, blend: 'dest-in' });
  }

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

const targets = [
  { name: 'icon-192.png', size: 192, padding: 0.05, rounded: true },
  { name: 'icon-512.png', size: 512, padding: 0.05, rounded: true },
  { name: 'icon-512-maskable.png', size: 512, padding: 0.12, rounded: false },
  { name: 'apple-touch-icon.png', size: 180, padding: 0.05, rounded: true },
];

for (const { name, size, padding, rounded } of targets) {
  const out = resolve(publicDir, name);
  const buf = await renderIcon(size, { padding, rounded });
  writeFileSync(out, buf);
  console.log(`✓ ${name} (${size}×${size})`);
}

// SVGs (favicon + icon.svg) embutem o PNG em base64 para serem auto-contidos.
const b64 = sourceBuf.toString('base64');

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${BG_HEX}"/>
  <image href="data:image/png;base64,${b64}" x="31" y="16" width="460" height="460"/>
</svg>
`;
writeFileSync(resolve(publicDir, 'icon.svg'), iconSvg);
console.log('✓ icon.svg');

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${BG_HEX}"/>
  <image href="data:image/png;base64,${b64}" x="3.6" y="1.7" width="58" height="58"/>
</svg>
`;
writeFileSync(resolve(publicDir, 'favicon.svg'), faviconSvg);
console.log('✓ favicon.svg');
