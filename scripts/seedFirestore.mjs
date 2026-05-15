#!/usr/bin/env node
/**
 * Sobe os dados de seed/ingredients.json para o Firestore.
 *
 * Como rodar:
 *   1. Garanta que .env.local tem as VITE_FIREBASE_* preenchidas
 *   2. npm run seed:firestore
 *
 * Idempotente: usa o `id` do ingrediente como ID do documento. Rodar duas
 * vezes não duplica dados — só atualiza.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env.local');
  if (!existsSync(envPath)) {
    console.error('❌ .env.local não encontrado. Copie de .env.local.example e preencha.');
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(config)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length > 0) {
  console.error('❌ Variáveis de ambiente faltando em .env.local:', missing.join(', '));
  process.exit(1);
}

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`📡 Conectando ao projeto ${config.projectId}…`);
await signInAnonymously(auth);
console.log(`✓ Autenticado como ${auth.currentUser?.uid}`);

const seedPath = resolve(root, 'seed/ingredients.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const ingredients = seed.ingredients;

console.log(`📦 Subindo ${ingredients.length} ingredientes para Firestore…`);

const BATCH_SIZE = 400;
let written = 0;

for (let i = 0; i < ingredients.length; i += BATCH_SIZE) {
  const slice = ingredients.slice(i, i + BATCH_SIZE);
  const batch = writeBatch(db);
  for (const ing of slice) {
    batch.set(doc(db, 'ingredients', ing.id), ing);
  }
  await batch.commit();
  written += slice.length;
  console.log(`  ${written}/${ingredients.length}`);
}

console.log('✅ Seed concluído.');
process.exit(0);
