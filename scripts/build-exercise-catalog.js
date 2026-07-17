#!/usr/bin/env node
/**
 * Dev-time trimmer for the exercises-dataset (hasaneyldrm/exercises-dataset, MIT).
 *
 * The upstream exercises.json is ~17MB because it carries instructions in 10
 * languages plus media refs Orial doesn't use yet. This script fetches it once,
 * keeps only EN/ES text + the fields the exercise picker needs, and writes a
 * bundleable asset. Not run at app build/runtime — run by hand when the
 * catalog needs refreshing, and its output (src/data/exerciseCatalog.json) is
 * committed to the repo.
 *
 * Usage: node scripts/build-exercise-catalog.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const OUTPUT_PATH = path.join(__dirname, '../src/data/exerciseCatalog.json');
const KEPT_LANGUAGES = ['en', 'es'];

function pickLanguages(record) {
  const trimmed = {};
  for (const lang of KEPT_LANGUAGES) {
    if (record && record[lang] !== undefined) trimmed[lang] = record[lang];
  }
  return trimmed;
}

function trimExercise(exercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    body_part: exercise.body_part,
    equipment: exercise.equipment,
    muscle_group: exercise.muscle_group,
    secondary_muscles: exercise.secondary_muscles,
    target: exercise.target,
    // Kept as plain strings for a future media phase — not fetched/rendered today.
    image: exercise.image,
    gif_url: exercise.gif_url,
    instructions: pickLanguages(exercise.instructions),
    instruction_steps: pickLanguages(exercise.instruction_steps),
  };
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.status} ${response.statusText}`);
  }
  const exercises = await response.json();
  if (!Array.isArray(exercises)) {
    throw new Error('Unexpected dataset shape: expected a top-level array');
  }

  const trimmed = exercises.map(trimExercise);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(trimmed));

  const sizeMb = fs.statSync(OUTPUT_PATH).size / (1024 * 1024);
  console.log(`Wrote ${trimmed.length} exercises to ${OUTPUT_PATH} (${sizeMb.toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
