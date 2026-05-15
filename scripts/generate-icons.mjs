#!/usr/bin/env node
/**
 * Gera os PNGs do PWA a partir do SVG base.
 * Roda automaticamente antes do build (npm prebuild).
 */
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

const svg = readFileSync(resolve(publicDir, 'icon.svg'));

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-512-maskable.png', size: 512, padding: 0.1 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size, padding = 0 } of targets) {
  const out = resolve(publicDir, name);
  if (padding === 0) {
    await sharp(svg).resize(size, size).png().toFile(out);
  } else {
    // Maskable: render at smaller size + transparent border = "safe area" padding.
    const inner = Math.round(size * (1 - 2 * padding));
    const offset = Math.round((size - inner) / 2);
    const innerBuf = await sharp(svg).resize(inner, inner).png().toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 107, g: 142, b: 35, alpha: 1 },
      },
    })
      .composite([{ input: innerBuf, top: offset, left: offset }])
      .png()
      .toFile(out);
  }
  console.log(`✓ ${name} (${size}×${size})`);
}
