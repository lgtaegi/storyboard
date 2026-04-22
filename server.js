/*
Created: 2026-04-21 America/Denver
Created by lgtaegi
Updated:
- added fixed art style slot saving for 2D Animation, Live-Action, and Custom Style
- added save name prefix settings API with persistent storage
- supports current storyboard save, auto-save, art style, and app settings folders
- added Ollama model catalog API with installed-status reporting
- added Ollama model install or latest-update API endpoint
- added Ollama model delete API endpoint
- shortened Ollama keep-alive time so models release memory faster after generation
- widened story idea generation so object-driven ideas can branch into more surprising event hooks
- allowed object ideas to ignore real-world logic so props can be used in absurd or impossible ways
- added reference-script guidance with adjustable influence and an option to keep user settings as absolute priority
- removed the hard-coded baseball-bat fallback from empty story-idea fields
- widened empty-set fallback locations so no single place pattern keeps repeating too strongly
- removed the hard-coded yellow-crewmate fallback from empty character fields
- stopped forcing the default yellow-crewmate art style into prompts when the art-style field is intentionally blank
*/
const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5055);
const defaultModel = process.env.OLLAMA_MODEL || 'llama3.2:latest';
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const ollamaUrl = process.env.OLLAMA_URL || `${ollamaBaseUrl}/api/generate`;
const ollamaKeepAlive = process.env.OLLAMA_KEEP_ALIVE || '30s';
const baseDir = __dirname;
const dataDir = path.join(baseDir, 'data');
const autoSaveDir = path.join(baseDir, 'auto-generated');
const uploadStoryDir = path.join(baseDir, 'upload-stories');
const artStyleDir = path.join(baseDir, 'art-styles');
const appSettingsDir = path.join(baseDir, 'app-settings');
const saveNamePrefixPath = path.join(appSettingsDir, 'save-name-prefix.json');
const knownModels = [
  'llama3.2:latest',
  'llama3:latest',
  'qwen2.5:latest',
  'mistral:latest',
  'gemma3:latest',
];
const defaultCharacterDesign = `2D animation art style for a yellow crewmate-inspired character.

Visual direction:
- flat cel-shaded cartoon
- clean vector-like finish
- simple readable shapes
- smooth uniform outlines
- bright but controlled colors
- mobile game character design feel
- clear silhouette and expressive body language

Avoid:
- realistic rendering
- 3D shading
- heavy texture
- noisy details`;

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanText(value, fallback, maxLength = 500) {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, maxLength);
}

function slugify(value) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  return slug || 'story';
}

function idForProject(name) {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugify(name)}`;
}

function fixedArtStyleId(value) {
  const id = slugify(value);
  const fixedIds = new Set(['2d-animation', 'live-action', 'custom-style']);
  return fixedIds.has(id) ? id : '';
}

function isSafeModelName(value) {
  return /^[a-z0-9][a-z0-9._-]*(?::[a-z0-9._-]+)?$/i.test(String(value || '').trim());
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};

  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const detail = payload.error || payload.message || text.trim() || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}

async function listInstalledModels() {
  const payload = await fetchJson(`${ollamaBaseUrl}/api/tags`);
  return Array.isArray(payload.models) ? payload.models : [];
}

function modelCatalogFromInstalled(installedModels) {
  const installedByName = new Map(
    installedModels
      .filter((entry) => entry && entry.name)
      .map((entry) => [entry.name, entry]),
  );
  const allNames = [...new Set([...knownModels, defaultModel, ...installedByName.keys()])];

  return allNames.map((name) => {
    const installed = installedByName.get(name);
    return {
      name,
      installed: Boolean(installed),
      modifiedAt: installed?.modified_at || '',
      size: installed?.size || 0,
      digest: installed?.digest || '',
      details: installed?.details || {},
    };
  });
}

async function getModelCatalog() {
  try {
    const installedModels = await listInstalledModels();
    return {
      defaultModel,
      ollamaReachable: true,
      models: modelCatalogFromInstalled(installedModels),
    };
  } catch (error) {
    return {
      defaultModel,
      ollamaReachable: false,
      error: error.message,
      models: modelCatalogFromInstalled([]),
    };
  }
}

async function installOrUpdateModel(modelName) {
  const safeModel = cleanText(modelName, '', 80);
  if (!isSafeModelName(safeModel)) {
    throw new Error('Invalid model name.');
  }

  const payload = await fetchJson(`${ollamaBaseUrl}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: safeModel,
      stream: false,
    }),
  });

  const status = cleanText(payload.status || payload.message || '', 'Model request finished.', 200);
  return {
    model: safeModel,
    status,
    message: `${safeModel}: ${status}`,
  };
}

async function removeModel(modelName) {
  const safeModel = cleanText(modelName, '', 80);
  if (!isSafeModelName(safeModel)) {
    throw new Error('Invalid model name.');
  }

  await fetchJson(`${ollamaBaseUrl}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: safeModel,
    }),
  });

  return {
    model: safeModel,
    message: `${safeModel} was removed successfully.`,
  };
}

function projectPathFor(id) {
  const safeId = path.basename(String(id || '')).replace(/\.json$/i, '');
  return path.join(dataDir, `${safeId}.json`);
}

function uploadProjectPathFor(id) {
  const safeId = path.basename(String(id || '')).replace(/\.json$/i, '');
  return path.join(uploadStoryDir, `${safeId}.json`);
}

function characterDesignPathFor(id) {
  const safeId = path.basename(String(id || '')).replace(/\.json$/i, '');
  return path.join(artStyleDir, `${safeId}.json`);
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function ensureAutoSaveDir() {
  await fs.mkdir(autoSaveDir, { recursive: true });
}

async function ensureUploadStoryDir() {
  await fs.mkdir(uploadStoryDir, { recursive: true });
}

async function ensureCharacterDesignDir() {
  await fs.mkdir(artStyleDir, { recursive: true });
}

async function ensureAppSettingsDir() {
  await fs.mkdir(appSettingsDir, { recursive: true });
}

function modelFor(data) {
  return cleanText(data.model, defaultModel, 80);
}

function normalizeStoryboard(text, data) {
  const storyboard = String(text || '').trim();
  if (/^Title:/im.test(storyboard)) return storyboard;

  const lines = storyboard.split(/\n/);
  const firstContentIndex = lines.findIndex(line => line.trim());
  if (firstContentIndex === -1) return storyboard;

  const rawTitle = lines[firstContentIndex]
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/^#+\s*/, '')
    .replace(/^"|"$/g, '')
    .trim();

  lines[firstContentIndex] = `Title: ${rawTitle || titleFromIdea(data.idea)}`;
  return lines.join('\n').trim();
}

function parseStoryboardSections(text) {
  const storyboard = String(text || '').trim();
  const title = (storyboard.match(/^Title:\s*(.+)$/im) || [])[1]?.trim() || '';
  const totalDuration = (storyboard.match(/^Total duration:\s*(.+)$/im) || [])[1]?.trim() || '';
  const genre = (storyboard.match(/^Genre:\s*(.+)$/im) || [])[1]?.trim() || '';
  const mood = (storyboard.match(/^Mood:\s*(.+)$/im) || [])[1]?.trim() || '';
  const keyObject = (storyboard.match(/Key object\s*\/\s*product hook:\s*([\s\S]*?)(?=\n\s*Set prompt:|\n\s*Art style prompt:|\n\s*Scene\s+\d+\s*-\s*\d+s:|$)/i) || [])[1]?.trim() || '';
  const setPrompt = (storyboard.match(/Set prompt:\s*([\s\S]*?)(?=\n\s*Art style prompt:|\n\s*Scene\s+\d+\s*-\s*\d+s:|$)/i) || [])[1]?.trim() || '';
  const artStylePrompt = (storyboard.match(/Art style prompt:\s*([\s\S]*?)(?=\n\s*Scene\s+\d+\s*-\s*\d+s:|$)/i) || [])[1]?.trim() || '';
  const scenes = [...storyboard.matchAll(/Scene\s+(\d+)\s*-\s*(\d+)s:\s*([\s\S]*?)(?=\n\s*Scene\s+\d+\s*-\s*\d+s:|$)/gi)]
    .map((match) => ({
      number: Number(match[1]),
      time: Number(match[2]),
      text: match[3].trim(),
    }));

  return { title, totalDuration, genre, mood, keyObject, setPrompt, artStylePrompt, scenes };
}

function rebuildStoryboardFromSections(parts) {
  return [
    `Title: ${parts.title}`,
    '',
    `Total duration: ${parts.totalDuration}`,
    '',
    `Genre: ${parts.genre}`,
    '',
    `Mood: ${parts.mood}`,
    '',
    'Key object / product hook:',
    parts.keyObject,
    '',
    'Set prompt:',
    parts.setPrompt,
    '',
    'Art style prompt:',
    parts.artStylePrompt,
    '',
    ...parts.scenes.flatMap((scene) => [`Scene ${scene.number} - ${scene.time}s:`, scene.text, '']),
  ].join('\n').trim();
}

function cleanTranslatedLine(value) {
  return String(value || '')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/^Title:\s*/i, '')
    .replace(/^Scene\s+\d+\s*-\s*\d+s:\s*/i, '')
    .replace(/^[-*]\s*/g, '')
    .trim();
}

function buildChunkTranslatePrompt(text, target, kind) {
  if (target === 'ko') {
    return `다음 ${kind} 텍스트만 자연스럽고 순수한 한국어로 번역하세요.

규칙:
- 결과만 출력하세요.
- 영어, 중국어, 일본어, 베트남어, 로마자 표기를 섞지 마세요.
- 설명, 따옴표, 번호, 라벨을 추가하지 마세요.
- 원문의 시각적 의미를 유지하세요.

텍스트:
${text}`;
  }

  return `Translate only this ${kind} text into natural English.

Rules:
- Output only the translated text.
- Do not add labels, quotes, bullet points, numbering, or explanations.
- Preserve the visual meaning.

Text:
${text}`;
}

async function translateChunk(model, text, target, kind) {
  const clean = cleanText(text, '', 4000);
  if (!clean) return '';

  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildChunkTranslatePrompt(clean, target, kind),
      stream: false,
      keep_alive: ollamaKeepAlive,
      options: {
        temperature: 0.15,
        top_p: 0.7,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  return cleanTranslatedLine(payload.response || clean);
}

function titleFromIdea(idea) {
  const words = cleanText(idea, 'Untitled AI Story', 120)
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => !['a', 'an', 'the', 'that', 'with', 'and', 'or', 'in', 'of', 'to'].includes(word.toLowerCase()));

  return words.slice(0, 5).join(' ') || 'Untitled AI Story';
}

function resolveLanguage(data) {
  if (data.language === 'ko') return 'ko';
  if (data.language === 'en') return 'en';
  return /[\u3131-\u318e\uac00-\ud7a3]/.test(String(data.idea || '')) ? 'ko' : 'en';
}

function languageInstruction(data) {
  if (resolveLanguage(data) === 'ko') {
    return 'Output language: Korean. Keep the labels "Title:" and "Scene N - Ns:" exactly in English, but write all title content and scene descriptions in natural Korean only. Do not mix in English, Hindi, code words, or romanized words.';
  }
  return 'Output language: English. Keep every title and scene description in natural English.';
}

function referenceStrengthLabel(value) {
  if (value <= 0) return 'ignore the reference';
  if (value <= 30) return 'use the reference only as light inspiration';
  if (value <= 60) return 'borrow the reference structure and style in a balanced way';
  if (value <= 85) return 'follow the reference strongly for shot logic, pacing, and camera language';
  if (value < 100) return 'follow the reference very strongly while still allowing some reinterpretation';
  return 'replay the reference as directly as possible';
}

function extractReferenceSceneCount(referenceScript) {
  const clean = cleanText(referenceScript, '', 8000);
  if (!clean) return 0;

  const explicitCount = clean.match(/(?:Format|Shots?|Scenes?)\s*:\s*(\d+)\s*(?:shots?|scenes?)/i);
  if (explicitCount) {
    return clampNumber(Number(explicitCount[1]), 0, 0, 30);
  }

  const shotMatches = clean.match(/(?:^|\n)\s*(?:=+\s*)?(?:SHOT|Shot|Scene)\s+\d+/g);
  if (shotMatches?.length) {
    return clampNumber(shotMatches.length, 0, 0, 30);
  }

  return 0;
}

function buildReferenceRule(data) {
  const referenceScript = cleanText(data.referenceScript, '', 8000);
  const referenceStrength = clampNumber(data.referenceStrength, 0, 0, 100);
  const preserveCoreSettings = data.preserveCoreSettings !== false;
  const referenceSceneCount = extractReferenceSceneCount(referenceScript);

  if (!referenceScript || referenceStrength <= 0) {
    return { ko: '', en: '', referenceSceneCount: 0 };
  }

  const nearLiteral = referenceStrength === 100;

  const priorityRuleKo = preserveCoreSettings
    ? (nearLiteral
      ? '- 레퍼런스 장면 내용을 매우 강하게 따르되, 사용자가 입력한 캐릭터, Set, Art Style, 핵심 오브젝트를 절대 바꾸지 마세요. 즉, 레퍼런스의 각 샷 내용을 현재 설정으로 치환해서 거의 그대로 옮기세요.'
      : '- 레퍼런스 강도가 높아도 사용자가 입력한 캐릭터, Set, Art Style, 핵심 오브젝트를 절대 바꾸지 마세요. 레퍼런스는 샷 구조, 카메라 언어, 장면 역할, 전개 리듬만 강하게 참고하세요.')
    : '- 레퍼런스가 현재 설정을 더 강하게 재구성해도 됩니다. 다만 핵심 오브젝트는 유지하세요.';
  const priorityRuleEn = preserveCoreSettings
    ? (nearLiteral
      ? '- Follow the reference scenes extremely closely, but never replace the user-entered character, Set, Art Style, or core object. Treat each reference shot as a template and swap in the current settings almost literally.'
      : '- Even at high reference strength, never replace the user-entered character, Set, Art Style, or core object. Use the reference mainly for shot structure, camera language, scene function, and pacing.')
    : '- The reference is allowed to reshape the storyboard more aggressively, but the core object must still remain in the story.';

  const literalRuleKo = nearLiteral
    ? `- 레퍼런스 강도가 100이므로, 각 장면의 핵심 행동, 샷 역할, 카메라 방식, 장면 목적, 전개 순서를 거의 그대로 유지하세요.${referenceSceneCount ? ` 레퍼런스의 장면 수 ${referenceSceneCount}개도 그대로 따르세요.` : ''}\n- 레퍼런스 속 오브젝트가 하던 행동과 용도도 최대한 그대로 유지하세요. 현재 오브젝트가 상식적으로 맞지 않아도 그 부조리함을 코믹 포인트로 살리고, 더 정상적인 행동으로 바꾸지 마세요.`
    : '- 아래 레퍼런스 스크립트를 분석해 샷 수, 샷 역할, 카메라 움직임, 연출 리듬, 글로벌 제약, 전개 순서를 참고하세요.';
  const literalRuleEn = nearLiteral
    ? `- Because reference strength is 100, preserve each scene's core action, shot purpose, camera logic, and sequence order as literally as possible.${referenceSceneCount ? ` Also keep the reference scene count of ${referenceSceneCount}.` : ''}\n- Preserve the reference object's behavior and use as literally as possible too. If the current object makes the action irrational or absurd, keep that absurdity as the joke instead of normalizing it.`
    : '- Analyze the reference script below for shot count, shot function, camera movement, pacing rhythm, global constraints, and sequence flow.';

  return {
    ko: `- 레퍼런스 강도: ${referenceStrength}% (${referenceStrengthLabel(referenceStrength)}).\n${priorityRuleKo}\n${literalRuleKo}\n- 레퍼런스를 현재 이야기 설정으로 치환해 재구성하세요. 레퍼런스의 인물, 제품, 장소, 스타일 이름은 현재 설정으로 바꾸세요.\n- 레퍼런스 스크립트:\n${referenceScript}`,
    en: `- Reference strength: ${referenceStrength}% (${referenceStrengthLabel(referenceStrength)}).\n${priorityRuleEn}\n${literalRuleEn}\n- Rebuild the reference by swapping its people, products, places, and style names into the current story settings.\n- Reference script:\n${referenceScript}`,
    referenceSceneCount,
  };
}

function shouldStrictReferenceReplay(data) {
  const referenceScript = cleanText(data.referenceScript, '', 12000);
  const referenceStrength = clampNumber(data.referenceStrength, 0, 0, 100);
  const rawCharacter = cleanText(data.character, '', 300);
  const rawObjectKeyword = cleanText(data.objectKeyword, '', 120);
  const rawSetDescription = cleanText(data.setDescription, '', 1000);
  const noUserStoryStructureSettings = !rawCharacter && !rawObjectKeyword && !rawSetDescription;
  return Boolean(referenceScript) && referenceStrength === 100 && noUserStoryStructureSettings;
}

function referenceLabelValue(block, label) {
  const match = block.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\s*(?:Subject|Action|Environment|Camera|Style|Constraints):|$)`, 'i'));
  return match ? cleanText(match[1], '', 2000) : '';
}

function compactSceneSentence(parts) {
  return parts
    .map(part => cleanText(part, '', 2000))
    .filter(Boolean)
    .join(', ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.。]+$/g, '') + '.';
}

function buildStoryboardFromReference(data) {
  const referenceScript = cleanText(data.referenceScript, '', 12000);
  if (!referenceScript) return '';

  const durationMatch = referenceScript.match(/Total duration:\s*(\d+)\s*seconds?/i);
  const totalDuration = durationMatch ? Number(durationMatch[1]) : clampNumber(data.duration, 15, 3, 180);
  const styleReference = cleanText((referenceScript.match(/Style reference:\s*(.+)$/im) || [])[1], '', 500);
  const globalNegative = cleanText((referenceScript.match(/===\s*🚫?\s*Global Negative Prompt\s*===\s*([\s\S]*)$/i) || [])[1], '', 1500);

  const shotRegex = /===\s*(?:SHOT|Shot|Scene)\s*(\d+)\s*\|\s*(\d+)(?:[–-](\d+))?s?(?:\s*\|\s*([^=\n]+?))?\s*===\s*([\s\S]*?)(?=(?:\n===\s*(?:SHOT|Shot|Scene)\s*\d+\s*\|)|(?:\n===\s*🚫?\s*Global Negative Prompt\s*===)|$)/g;
  const shots = [];
  let match;
  while ((match = shotRegex.exec(referenceScript)) !== null) {
    const number = Number(match[1]);
    const startTime = Number(match[2] || 0);
    const purpose = cleanText(match[4], '', 120);
    const block = cleanText(match[5], '', 6000);
    const subject = referenceLabelValue(block, 'Subject');
    const action = referenceLabelValue(block, 'Action');
    const environment = referenceLabelValue(block, 'Environment');
    const camera = referenceLabelValue(block, 'Camera');
    const style = referenceLabelValue(block, 'Style');
    const constraints = referenceLabelValue(block, 'Constraints');
    shots.push({
      number,
      startTime,
      purpose,
      prompt: compactSceneSentence([
        purpose ? `${purpose} shot` : '',
        subject,
        action,
        environment,
        camera,
        style,
        constraints ? `Constraints: ${constraints}` : '',
      ]),
    });
  }

  if (!shots.length) {
    return '';
  }

  const firstEnvironment = referenceLabelValue(cleanText(shots[0].prompt, '', 4000), 'Environment');
  const setPrompt = firstEnvironment || cleanText((referenceScript.match(/Environment:\s*(.+)$/im) || [])[1], 'Use the primary reference location.', 500);
  const keyObjectPrompt = cleanText((referenceScript.match(/Action:\s*(.+)$/im) || [])[1], 'Use the reference core prop and event exactly as shown.', 500);
  const userArtStyle = cleanText(data.characterDesign, '', 3000);
  const artStylePrompt = userArtStyle || [
    styleReference ? `Follow this reference style: ${styleReference}.` : '',
    globalNegative ? `Global negative prompt: ${globalNegative}` : '',
  ].filter(Boolean).join(' ');

  const title = cleanText((referenceScript.match(/Title:\s*(.+)$/im) || [])[1], 'Reference Replay', 160);
  const genre = cleanText(data.genre, 'Reference-derived', 80);
  const mood = cleanText(data.mood, 'Reference-derived', 80);

  return [
    `Title: ${title}`,
    `Total duration: ${totalDuration} seconds`,
    `Genre: ${genre}`,
    `Mood: ${mood}`,
    `Key object / product hook: ${keyObjectPrompt}`,
    `Set prompt: ${setPrompt}`,
    `Art style prompt: ${artStylePrompt || 'Follow the visual style and camera language of the reference exactly.'}`,
    ...shots.map(shot => `Scene ${shot.number} - ${shot.startTime}s: ${shot.prompt}`),
  ].join('\n\n');
}

function buildPrompt(data) {
  const duration = clampNumber(data.duration, 15, 3, 180);
  const requestedSceneCount = clampNumber(data.sceneCount, 5, 1, Math.min(30, duration));
  const rawCharacter = cleanText(data.character, '', 300);
  const rawObjectKeyword = cleanText(data.objectKeyword, '', 120);
  const rawSetDescription = cleanText(data.setDescription, '', 1000);
  const rawCharacterDesign = cleanText(data.characterDesign, '', 3000);
  const character = cleanText(data.character, 'Create a fitting main character for this story.', 300);
  const objectKeyword = cleanText(data.objectKeyword, '', 120);
  const setDescription = cleanText(data.setDescription, '', 1000);
  const characterDesign = cleanText(data.characterDesign, '', 3000);
  const idea = cleanText(data.idea, 'Create a fresh object-driven event that fits the current settings.', 600);
  const genre = cleanText(data.genre, 'Science fiction', 80);
  const mood = cleanText(data.mood, 'Wonder', 80);
  const style = cleanText(data.style, '', 1000);
  const referenceRule = buildReferenceRule(data);
  const referenceStrength = clampNumber(data.referenceStrength, 0, 0, 100);
  const hasReferenceScript = Boolean(cleanText(data.referenceScript, '', 12000));
  const preserveCoreSettings = data.preserveCoreSettings === true;
  const noUserStorySettings = !rawCharacter && !rawObjectKeyword && !rawSetDescription && !rawCharacterDesign;
  const strictReferenceReplay = shouldStrictReferenceReplay(data);
  const sceneCount = referenceStrength === 100 && referenceRule.referenceSceneCount
    ? clampNumber(referenceRule.referenceSceneCount, requestedSceneCount, 1, Math.min(30, duration))
    : requestedSceneCount;
  const interval = Math.max(1, Math.round(duration / sceneCount));
  const artDirectionRuleKo = style
    ? `- 사용자가 입력한 아트 디렉팅: ${style}\n- 위 사용자가 입력한 아트 디렉팅만 사용하고, 별도의 추가 아트 스타일 블록을 새로 만들지 마세요.`
    : '- 별도의 아트 디렉팅이 입력되지 않았습니다. 추가 아트 스타일 블록을 만들지 마세요.';
  const artDirectionRuleEn = style
    ? `- User art direction: ${style}\n- Use only the user-provided art direction above. Do not invent separate extra art-style blocks.`
    : '- No separate art direction was entered. Do not create extra art-style blocks.';
  const includeScenePromptDetails = data.includeScenePromptDetails === true;
  const scenePromptDetailRuleKo = includeScenePromptDetails
    ? '각 장면 설명 끝에 카메라, 스타일, 분위기, 화면 구성 같은 상세 프롬프트 요소를 자연스럽게 덧붙이세요.'
    : '각 장면 끝에 "visual scene prompt..." 같은 반복적인 상세 프롬프트 가이드 문구를 붙이지 마세요. 장면에서 실제 보이는 내용만 쓰세요.';
  const scenePromptDetailRuleEn = includeScenePromptDetails
    ? 'At the end of each scene, naturally append detailed prompt elements such as camera, style, mood, visible composition, lighting, and background.'
    : 'Do not append repeated boilerplate prompt guide phrases such as "visual scene prompt..." after each scene. Write only the visible scene description.';
  const sceneGuide = Array.from({ length: sceneCount }, (_, index) => {
    const time = index === 0 ? 0 : Math.min(duration - 1, index * interval);
    return `Scene ${index + 1} - ${time}s:`;
  }).join('\n');
  const strictReferenceModeKo = strictReferenceReplay
    ? `- 현재 생성은 "레퍼런스 거의 그대로 재현" 모드입니다.
- 사용자가 캐릭터, 오브젝트, Set을 따로 입력하지 않았고 레퍼런스 강도가 100이므로, 새로운 이야기를 발명하지 말고 레퍼런스의 내용을 거의 그대로 재현하세요.
- 각 장면의 핵심 행동, 소품 사용 방식, 샷 목적, 카메라 흐름, 장소 기능, 전개 순서를 최대한 그대로 유지하세요.
- 레퍼런스 안에 이미 있는 인물, 오브젝트, 장소, 스타일 정보를 그대로 사용해도 됩니다.
- 더 그럴듯하거나 더 일반적인 방향으로 바꾸지 마세요.
- 새로운 반전, 새 오브젝트, 새 갈등, 새 코미디 구조를 추가하지 마세요.
- 레퍼런스를 요약하지 말고, 스토리보드 카드용 씬 프롬프트로 거의 그대로 옮기세요.`
    : '';
  const strictReferenceModeEn = strictReferenceReplay
    ? `- The current generation mode is "near-literal reference replay."
- Because the user did not enter a character, object, or Set and the reference strength is 100, do not invent a new story. Recreate the reference as closely as possible.
- Preserve each scene's core action, prop usage, shot purpose, camera flow, location function, and sequence order as literally as possible.
- You may keep the people, objects, places, and style identity already present inside the reference.
- Do not improve, normalize, modernize, simplify, or add a new comic twist beyond what the reference already does.
- Do not summarize the reference. Translate it into storyboard-card-ready scene prompts as directly as possible.`
    : '';
  const objectRulesKo = strictReferenceReplay
    ? `- 레퍼런스 속 핵심 오브젝트와 그 오브젝트의 사용 방식을 그대로 유지하세요.
- 오브젝트를 하나로 다시 단순화하거나 다른 상품성 물건으로 교체하지 마세요.`
    : `- 이야기 아이디어에는 반드시 하나의 명확한 물건이 있어야 하며, 이 물건이 사건을 이끌어가는 핵심 요소여야 합니다.
- 오브젝트 키워드가 있으면 반드시 그 물건을 핵심 물건으로 사용하세요.
- 그 물건은 여러 장면에 반복적으로 보이는 주요 소품이어야 하고, 나중에 온라인 상점 상품 링크와 연결할 수 있을 만큼 분명해야 합니다.`;
  const objectRulesEn = strictReferenceReplay
    ? `- Keep the reference's core object and the way that object is used.
- Do not replace it with a simpler or more product-friendly object.`
    : `- The story idea must include exactly one clear physical object, and that object must drive the story events.
- If Object keyword is provided, that exact object must be the core object.
- The object must appear repeatedly as the main prop and be specific enough to later connect to an online store or affiliate product link.`;
  const pacingRulesKo = strictReferenceReplay
    ? '- 레퍼런스가 가진 원래의 진행 리듬과 장면 기능을 유지하세요. 유튜브 쇼츠용 새 공식으로 다시 재작성하지 마세요.'
    : '- 인기 있는 유튜브 쇼츠처럼 빠른 전개, 즉시 보이는 갈등, 작은 긴장감, 과장된 리액션, 마지막 반전 코미디를 넣으세요.';
  const pacingRulesEn = strictReferenceReplay
    ? '- Preserve the original pacing and scene function of the reference. Do not rewrite it into a new generic YouTube Shorts formula.'
    : '- Use the pacing of popular YouTube Shorts: instant hook, fast escalation, playful tension, exaggerated reactions, and a final comic twist.';
  const characterLineKo = strictReferenceReplay
    ? '- 주인공 캐릭터: 레퍼런스 안의 주인공을 그대로 사용하세요.'
    : `- 주인공 캐릭터: ${character}.`;
  const objectLineKo = strictReferenceReplay
    ? '- 오브젝트 키워드: 레퍼런스 안의 핵심 오브젝트를 그대로 사용하세요.'
    : `- 오브젝트 키워드: ${objectKeyword || '없음. 이야기 아이디어 안의 물건을 사용하거나, 상품 노출에 적합한 물건 하나를 선택하세요.'}`;
  const setLineKo = strictReferenceReplay
    ? '- Set: 레퍼런스 안의 주요 장소를 그대로 사용하세요.'
    : `- Set: ${setDescription || '없음. 이야기 아이디어나 생성 과정에서 적절한 장소를 만드세요.'}`;
  const artStyleLineKo = strictReferenceReplay
    ? '- 아트 스타일: 레퍼런스 안의 시각 스타일과 촬영 톤을 그대로 사용하세요.'
    : `- 아트 스타일: ${characterDesign || '없음. 현재 이야기 설정과 레퍼런스가 있으면 그에 맞는 일관된 시각 스타일을 만드세요.'}.`;
  const genreLineKo = strictReferenceReplay
    ? '- 장르: 레퍼런스에서 읽히는 장르를 그대로 따르세요.'
    : `- 장르: ${genre}.`;
  const moodLineKo = strictReferenceReplay
    ? '- 분위기: 레퍼런스에서 읽히는 분위기를 그대로 따르세요.'
    : `- 분위기: ${mood}.`;
  const ideaLineKo = strictReferenceReplay
    ? '이야기 아이디어:\n레퍼런스의 핵심 사건을 그대로 사용하세요.'
    : `이야기 아이디어:\n${idea}`;
  const characterLineEn = strictReferenceReplay
    ? '- Main character: use the reference protagonist as-is.'
    : `- Main character: ${character}.`;
  const objectLineEn = strictReferenceReplay
    ? '- Object keyword: use the reference core object as-is.'
    : `- Object keyword: ${objectKeyword || 'none. Use the object in the story idea, or choose one product-friendly object if the idea is missing one.'}`;
  const setLineEn = strictReferenceReplay
    ? '- Set: use the reference primary location as-is.'
    : `- Set: ${setDescription || 'none. Use the location created in the story idea, or create a clear product-friendly main set.'}`;
  const artStyleLineEn = strictReferenceReplay
    ? '- Art style: use the reference visual style and shooting tone as-is.'
    : `- Art style: ${characterDesign || 'none. Create a consistent visual style that fits the current story settings and any active reference.'}`;
  const genreLineEn = strictReferenceReplay
    ? '- Genre: follow the genre implied by the reference.'
    : `- Genre: ${genre}.`;
  const moodLineEn = strictReferenceReplay
    ? '- Mood: follow the mood implied by the reference.'
    : `- Mood: ${mood}.`;
  const ideaLineEn = strictReferenceReplay
    ? 'Story idea:\nUse the reference event itself.'
    : `Story idea:\n${idea}`;

  if (resolveLanguage(data) === 'ko') {
    return `새로운 AI 영상용 스토리보드를 만드세요.

출력은 스토리보드 텍스트만 하세요. 마크다운 코드블록이나 설명은 쓰지 마세요.

필수 규칙:
- 첫 줄은 반드시 "Title:"로 시작하세요.
- 전체 길이: ${duration}초.
${genreLineKo}
${moodLineKo}
${artDirectionRuleKo}
${referenceRule.ko || '- 레퍼런스 스크립트는 사용하지 않습니다.'}
${strictReferenceModeKo}
${characterLineKo}
${objectLineKo}
${setLineKo}
${artStyleLineKo}
- 출력하기 전에 내부적으로 입력된 Art Style, Set, 오브젝트 키워드, 장르, 분위기가 서로 충돌하는지 점검하세요. 이 점검 내용은 출력하지 마세요.
- 충돌이 있으면 사용자가 직접 입력한 Set과 Art Style을 우선 보존하고, 나머지 이야기 설정은 그 안에서 가능한 한 일관되게 적용하세요.
- Set 내용이 입력되어 있으면 아트 스타일 안의 배경/장소/씬 언급보다 Set을 우선하세요.
- 단, 이야기 구조상 추격, 반전, 이동이 필요하면 Set을 중심 장소로 유지하면서 추가 장소를 자연스럽게 사용할 수 있습니다.
- Art Style에 금지 조건이 있으면 반드시 지키세요. 예: 얼굴이 보이면 안 된다는 조건이 있으면 표정은 얼굴이 아니라 자세, 고개 방향, 손동작, 바이저 반사, 몸짓으로 표현하세요.
- 각 장면은 입력된 Set, Art Style, 캐릭터 정체성, 핵심 오브젝트가 실제 화면 설명 안에 살아 있도록 쓰세요.
- 이야기 아이디어는 사건/상황입니다. 주인공 캐릭터는 위의 캐릭터를 사용하세요.
${objectRulesKo}
${pacingRulesKo}
- 장면 설명은 사람들의 시선을 끌 수 있게 감각적이고 강렬하되, 폭력적이거나 혐오적인 표현은 피하세요.
- 장면을 쓰기 전에 반드시 아래 상단 프롬프트 블록 3개만 넣으세요:
  0. "Key object / product hook:" 라벨 아래에 이야기의 핵심 물건과 상품 연결 가능성을 1문장으로 쓰세요.
  0-1. "Set prompt:" 라벨 아래에 주요 장소를 1문장으로 쓰세요. Set이 입력되었으면 그 내용을 우선 사용하세요.
  1. "Art style prompt:" 라벨 아래에 입력된 아트 스타일이 있으면 그것을 적용하는 방법을, 입력이 없으면 현재 이야기와 레퍼런스에 맞는 일관된 시각 스타일을 1문장으로 설명하세요.
- 정확히 ${sceneCount}개의 장면만 쓰세요.
- 각 장면은 아래 형식 그대로 "Scene 번호 - 초s:"로 시작해야 합니다.
- 각 장면은 스토리 설명이 아니라 이미지/영상 생성을 위한 "씬 프롬프트"로 쓰세요.
- 각 장면 프롬프트는 캐릭터 행동, 위치, 소품, 카메라 구도, 표정/포즈, 조명, 배경 디테일을 묘사하세요.
- ${scenePromptDetailRuleKo}
- 대사나 추상적인 줄거리 설명보다 화면에 보이는 요소 중심으로 쓰세요.
- 각 장면은 선명한 한국어 1개의 짧은 프롬프트 문장으로 쓰세요.
- 모든 ${sceneCount}개 장면을 반드시 끝까지 출력하세요.
- 장면 설명에는 영어 단어, 외국어 단어, 로마자 표기를 섞지 마세요.
- 소라 스토리보드 카드에 넣기 좋게 시각적으로 분명하게 쓰세요.
- 시작, 변화, 고조, 마지막 이미지가 느껴지게 완결된 이야기로 만드세요.

${ideaLineKo}

출력 순서:
Title:
Total duration:
Genre:
Mood:
Key object / product hook:
Set prompt:
Art style prompt:
Scene 1...

반드시 따를 장면 형식:
${sceneGuide}`;
  }

  return `Create a fresh AI video story storyboard.

Return only the storyboard text. Do not add markdown fences or explanations.

Requirements:
- Title line first.
- Total duration: ${duration} seconds.
${genreLineEn}
${moodLineEn}
${artDirectionRuleEn}
${referenceRule.en || '- Do not use any reference script for this generation.'}
${strictReferenceModeEn}
${characterLineEn}
${objectLineEn}
${setLineEn}
${artStyleLineEn}
- Before writing the output, silently check whether the user art style, Set, object keyword, genre, and mood conflict with each other. Do not output this checklist.
- If there is a conflict, preserve the user-entered Set and Art Style first, then apply the remaining story settings as consistently as possible inside those constraints.
- If Set is provided, prioritize that set over any background, location, or scene references inside Art Style.
- The story may still use additional locations when the structure needs movement, escalation, chase, or a twist, but the provided Set must remain the main location anchor.
- Strictly follow negative constraints inside Art Style. For example, if visible faces are forbidden, express emotion through posture, head angle, hand motion, visor reflections, and body language instead of facial expressions.
- Every scene must visibly preserve the key input settings: Set, Art Style, character identity, and the core object.
- Treat the story idea as the event or situation. Use the main character above as the protagonist.
${objectRulesEn}
${pacingRulesEn}
- Make the descriptions attention-grabbing and sensory, while avoiding hateful, graphic, or unsafe content.
- Before the scenes, include only these three top prompt blocks:
  0. "Key object / product hook:" Write one sentence naming the core object and why it can connect to a future product link.
  0-1. "Set prompt:" Write one sentence naming the main set. If Set is provided, use that set.
  1. "Art style prompt:" If an Art Style was entered, explain how it should apply. If no Art Style was entered, describe one consistent visual style that fits the current story settings and any active reference.
- Use exactly ${sceneCount} scenes.
- Every scene must begin with the exact scene number and timestamp format shown below.
- Write each scene as a visual scene prompt for image/video generation, not as general plot summary.
- Each scene prompt must describe character action, location, key prop, camera framing, pose/expression, lighting, and background details.
- ${scenePromptDetailRuleEn}
- Focus on what is visible on screen; avoid dialogue and abstract explanation.
- Each scene should be exactly 1 short vivid prompt sentence.
- Do not stop before all ${sceneCount} scenes are written.
- Keep the story visually clear for Sora storyboard cards.
- Make the plot feel complete, with a beginning, change, escalation, and final image.
- ${languageInstruction(data)}

${ideaLineEn}

Output order:
Title:
Total duration:
Genre:
Mood:
Key object / product hook:
Set prompt:
Art style prompt:
Scene 1...

Scene format to follow:
${sceneGuide}`;
}

function cleanIdeaResponse(value) {
  return String(value || '')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/^Story idea:\s*/i, '')
    .replace(/^Idea:\s*/i, '')
    .split(/\n/)
    .map(line => line.replace(/^[-*\d.]+\s*/, '').trim())
    .filter(Boolean)[0] || '';
}

function objectWords(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !['a', 'an', 'the', 'that', 'with', 'and', 'or', 'in', 'of', 'to', 'is', 'this'].includes(word));
}

function canonicalObjectKey(value) {
  const words = objectWords(value);
  if (!words.length) return '';
  return words.length >= 2 ? words.slice(-2).join(' ') : words[0];
}

function objectNameFromIdeaText(idea) {
  const source = String(idea || '').trim();
  const patterns = [
    /\b(?:finds|uses|loses|drops|chases|hides|discovers|grabs|opens)\s+(?:(?:a|an|the)\s+)?([^.,;]+?)(?:\s+(?:at|in|inside|on|under|near|beside|behind)\b|[.!?]|$)/i,
    /\b(?:tries|attempts)\s+to\s+(?:squeeze|wear|hide|grab|open|swallow|lick|hug|trade|drop)\s+(?:(?:a|an|the)\s+)?([^.,;]+?)(?:\s+(?:into|inside|in|on|under|near|behind|beside|at)\b|[.!?]|$)/i,
    /\b(?:mistakes|treats)\s+(?:(?:a|an|the)\s+)?([^.,;]+?)(?:\s+(?:for|like)\b|[.!?]|$)/i,
    /\b(?:shows|tests|activates|presses|bites|licks|wears|hugs|swaps|trades)\s+(?:(?:a|an|the)\s+)?([^.,;]+?)(?:\s+(?:at|in|inside|on|under|near|beside|behind|before|and)\b|[.!?]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function keyObjectFromStoryboardText(text) {
  const storyboard = String(text || '');
  const hookMatch = storyboard.match(/Key object\s*\/\s*product hook:\s*([\s\S]*?)(?=\n\s*Set prompt:|\n\s*Art style prompt:|\n\s*Scene\s+\d+\s*-\s*\d+s:|$)/i);
  const hookText = hookMatch ? hookMatch[1].trim() : '';
  const genericHook = /one visible object must drive the story events/i.test(hookText);
  if (!hookText || genericHook) return '';
  const candidates = [
    hookText.match(/\b(?:core object|key object|main object|object)\s*[:\-]?\s*([^.,;\n]+)/i)?.[1],
    hookText.match(/\b(?:a|an|the)\s+([^.,;\n]+?)(?:\s+(?:drives|appears|returns|repeats|anchors|stays)\b|[.!?]|$)/i)?.[1],
    hookText.match(/^([^.,;\n]{2,80})/i)?.[1],
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return candidates[0] || '';
}

function objectNameFromStoryboardScenesText(text) {
  const storyboard = String(text || '');
  const sceneText = [...storyboard.matchAll(/Scene\s+\d+\s*-\s*\d+s:\s*([\s\S]*?)(?=\n\s*Scene\s+\d+\s*-\s*\d+s:|$)/gi)]
    .map((match) => match[1].trim())
    .join(' ');
  if (!sceneText) return '';

  const patterns = [
    /\b(?:holds up|hold up|holding up|holds|hold|holding|carry|carries|carrying|raises|raised|lifts|lifted|shows|showing|presents|presenting)\s+(?:(?:a|an|the)\s+)?([^.,;]+?)(?:\s+(?:in|with|toward|towards|above|below|while|as|before|against|surrounded|set)\b|[.!?]|$)/i,
    /\b(?:zooms?\s+in\s+on|camera\s+zooms?\s+in\s+on|focuses?\s+on)\s+(?:(?:a|an|the)\s+)?([^.,;]+?)(?:\s+(?:in|with|against|as|while|set)\b|[.!?]|$)/i,
    /\b(?:the)\s+([^.,;]+?)(?:\s+(?:floats away|glows|shakes|spins|drops|falls|breaks|bursts)\b|[.!?]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = sceneText.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractStoryObject(text) {
  return keyObjectFromStoryboardText(text) || objectNameFromStoryboardScenesText(text) || '';
}

function extractExpectedObject(data) {
  return cleanText(data.objectKeyword, '', 120)
    || objectNameFromIdeaText(cleanText(data.idea, '', 300))
    || '';
}

function objectMatches(expectedObject, actualObject, fullText = '') {
  const expectedWords = objectWords(expectedObject);
  if (!expectedWords.length) return true;

  const actualWords = objectWords(actualObject);
  const expectedKey = canonicalObjectKey(expectedObject);
  const actualKey = canonicalObjectKey(actualObject);
  const text = String(fullText || '').toLowerCase();

  if (expectedKey && actualKey && expectedKey === actualKey) return true;
  if (expectedWords.at(-1) && actualWords.at(-1) && expectedWords.at(-1) === actualWords.at(-1)) return true;
  if (actualWords.length && actualWords.every((word) => expectedWords.includes(word))) return true;
  if (expectedWords.length && expectedWords.every((word) => actualWords.includes(word))) return true;
  if (expectedKey && text.includes(expectedKey)) return true;
  if (expectedWords.at(-1) && text.includes(expectedWords.at(-1))) return true;
  return false;
}

async function withObjectRetries(runAttempt, expectedObject, extractActual, options = {}) {
  const maxAttempts = 4;
  let lastResult = null;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await runAttempt(attempt);
      lastResult = result;
      if (!expectedObject) return result;

      const actualObject = cleanText(extractActual(result), '', 200);
      if (objectMatches(expectedObject, actualObject, options.fullText ? options.fullText(result) : '')) {
        return result;
      }

      lastError = new Error(`Object mismatch on attempt ${attempt}: expected "${expectedObject}" but got "${actualObject || 'nothing'}".`);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResult) return lastResult;
  throw lastError || new Error('Object consistency retry failed.');
}

function buildIdeaPrompt(data, forcedObject = '') {
  const character = cleanText(data.character, 'Create a fitting main character for this story.', 300);
  const objectKeyword = cleanText(data.objectKeyword, forcedObject, 120);
  const setDescription = cleanText(data.setDescription, '', 500);
  const mood = cleanText(data.mood, 'Wonder', 80);
  const currentIdea = cleanText(data.idea, '', 300);
  const randomSeed = `${Date.now()}-${Math.random()}`;

  return `Generate one very simple but visually surprising story idea for an AI video storyboard.

Return only one short sentence with 7 to 16 words. Do not add a title, numbering, markdown, quotes, or explanation.

Use these settings:
- Main character: ${character}
- Object keyword: ${objectKeyword || 'none'}
- Set: ${setDescription || 'none'}
- Mood: ${mood}
- Use the main character above as the protagonist, but keep the wording short.
- The idea must include exactly one clear physical object.
- You MUST use the exact object keyword phrase above and no other object.
- That object must drive the event.
- If Set is not "none", make the event happen mainly in that set.
- If Set is "none", choose a simple place that fits the object.
- The object choice is already fully random when no object keyword is provided.
- Do not let mood, set, art style, genre, or story logic influence which object gets chosen.
- First accept the random object as-is, then build the event around it.
- Let the MOOD drive the event tone, reaction, pacing, and outcome more than genre.
- If the mood is Joy, make the event playful, silly, bright, mischievous, or unexpectedly satisfying.
- If the mood is Suspense or Tension, make the same random object create pressure, doubt, awkward danger, or nervous anticipation.
- If the mood is Horror, make the random object feel eerie, cursed, uncanny, invasive, or wrong in a visually memorable way.
- If the mood is Wonder or Hope, make the object feel surprising, magical, or strangely meaningful.
- If the mood is Melancholy, make the object trigger a funny-but-slightly-sad or wistful turn.
- Make the event feel like a fast YouTube Shorts hook with a surprise, reversal, accident, reveal, trap, swap, test, malfunction, chase, or visual misunderstanding.
- Keep it simple, but avoid repetitive ideas like only finds / uses / loses.
- Let the object trigger an unexpected event direction.
- Real-world logic does not matter much here. The character may misuse the object in absurd, impossible, or childish ways if the image is funny and clear on screen.
- The object does not need to be used correctly. For example, a baseball can be swallowed, worn, worshipped, mistaken for food, or treated like a button.
- Good patterns include:
  [character] touches [object] and something strange starts.
  [character] hides [object] but it causes a public mess.
  [character] trades [object] and instantly regrets it.
  [character] opens [object] and the set changes.
  [character] shows [object] and everyone reacts the wrong way.
  [character] bites [object] and the wrong thing happens.
  [character] wears [object] the wrong way and causes a scene.
  [character] mistakes [object] for something else and chaos starts.
- Use one clean hook sentence, not a rigid template.
- Make it different from but compatible with this current event idea: ${currentIdea}
- Random seed for variation: ${randomSeed}`;
}

function moodTemplatePool(mood) {
  const normalized = cleanText(mood, '', 80).toLowerCase();
  if (normalized.includes('joy')) {
    return [
      'and turns the moment into a goofy victory.',
      'and makes everyone laugh for the wrong reason.',
      'and starts a playful chain reaction.',
      'and accidentally becomes the center of a silly celebration.',
      'and creates a bright, ridiculous payoff.'
    ];
  }
  if (normalized.includes('suspense') || normalized.includes('tension')) {
    return [
      'and makes the whole space feel wrong.',
      'and creates a tiny but real panic.',
      'and turns the moment tense in a funny way.',
      'and makes everyone freeze for one second too long.',
      'and triggers a nervous chain reaction.'
    ];
  }
  if (normalized.includes('horror')) {
    return [
      'and makes the room feel suddenly haunted.',
      'and turns into a creepy visual mistake.',
      'and creates a small but unmistakable sense of dread.',
      'and starts an uncanny reaction no one can explain.',
      'and leaves behind a weirdly cursed image.'
    ];
  }
  if (normalized.includes('wonder') || normalized.includes('hope')) {
    return [
      'and reveals something strangely beautiful.',
      'and changes the mood in an unexpectedly magical way.',
      'and makes the whole place feel special for a second.',
      'and turns into a small hopeful surprise.',
      'and opens a weird but delightful possibility.'
    ];
  }
  if (normalized.includes('melancholy')) {
    return [
      'and leaves behind a weirdly bittersweet image.',
      'and turns the joke slightly wistful.',
      'and creates a funny moment with a soft sad aftertaste.',
      'and makes the scene oddly lonely.',
      'and ends with a silly but tender letdown.'
    ];
  }
  return [
    'and changes the whole moment.',
    'and triggers the wrong reaction.',
    'and sends the event in a strange direction.',
    'and creates an instant visual payoff.',
    'and turns into an unexpected problem.'
  ];
}

function randomFallbackObject() {
  const prefixes = [
    'mini',
    'glow-in-the-dark',
    'folding',
    'plastic',
    'inflatable',
    'magnetic',
    'sparkly',
    'vintage',
    'portable',
    'rainbow',
    'tiny',
    'oversized',
    'fake',
    'striped',
    'transparent',
    'noisy',
    'wobbly',
    'scented',
    'mechanical',
    'soft'
  ];
  const nouns = [
    'traffic cone',
    'teacup',
    'doorbell',
    'snow globe',
    'pool noodle',
    'karaoke microphone',
    'soap dish',
    'golf glove',
    'measuring tape',
    'lantern',
    'pillow',
    'flip phone',
    'thermos',
    'whistle',
    'roller skate',
    'watering can',
    'birthday candle',
    'camera tripod',
    'beach bucket',
    'oven mitt',
    'spatula',
    'trophy',
    'helmet',
    'lunchbox',
    'yo-yo',
    'bookmark',
    'bubble wand',
    'sticker pack',
    'slipper',
    'neck pillow',
    'coupon book',
    'toy dinosaur',
    'hand mirror',
    'umbrella',
    'fishing bobber',
    'beanbag',
    'fanny pack',
    'binoculars',
    'cowbell',
    'shower cap',
    'hula hoop',
    'desk calendar',
    'ice tray',
    'tennis visor',
    'soap bubble gun',
    'pencil case',
    'camping mug',
    'rubber boot',
    'paper lantern',
    'cereal bowl',
    'tote bag',
    'remote control',
    'dog leash',
    'shoehorn',
    'cookie tin',
    'flash card',
    'watering hose nozzle',
    'seat cushion',
    'bike bell'
  ];
  const usePrefix = Math.random() < 0.7;
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  if (!usePrefix) return noun;
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix} ${noun}`;
}

async function createIdea(data) {
  const model = modelFor(data);
  const objectKeyword = cleanText(data.objectKeyword, '', 120);
  const selectedObject = objectKeyword || randomFallbackObject();
  const currentIdea = cleanText(data.idea, '', 300).toLowerCase();

  return withObjectRetries(
    async () => {
      const response = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: buildIdeaPrompt(data, selectedObject),
          stream: false,
          keep_alive: ollamaKeepAlive,
          options: {
            temperature: objectKeyword ? 0.75 : 1,
            top_p: objectKeyword ? 0.9 : 0.95,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      const idea = cleanIdeaResponse(payload.response);
      if (!idea) {
        throw new Error('The model returned an empty idea.');
      }
      if (idea.toLowerCase() === currentIdea) {
        throw new Error('The model repeated the current idea instead of making a new one.');
      }
      return { model, idea };
    },
    selectedObject,
    (result) => objectNameFromIdeaText(result.idea),
    { fullText: (result) => result.idea },
  );
}

async function createStory(data) {
  const model = modelFor(data);
  const duration = clampNumber(data.duration, 15, 3, 180);
  const sceneCount = clampNumber(data.sceneCount, 5, 1, Math.min(30, duration));

  if (shouldStrictReferenceReplay(data)) {
    const storyboard = buildStoryboardFromReference(data);
    if (storyboard) {
      const titleMatch = storyboard.match(/^Title:\s*(.+)$/im);
      return {
        model: `${model} (reference replay)`,
        title: titleMatch ? titleMatch[1].trim() : 'Reference Replay',
        storyboard,
      };
    }
  }
  const expectedObject = extractExpectedObject(data);

  return withObjectRetries(
    async () => {
      const response = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: buildPrompt(data),
          stream: false,
          keep_alive: ollamaKeepAlive,
          options: {
            temperature: 0.85,
            top_p: 0.9,
            num_predict: Math.min(8000, 1400 + sceneCount * 160),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      const storyboard = normalizeStoryboard(payload.response, data);
      if (!storyboard) {
        throw new Error('Ollama returned an empty story.');
      }

      const titleMatch = storyboard.match(/^Title:\s*(.+)$/im);
      return {
        model,
        title: titleMatch ? titleMatch[1].trim() : titleFromIdea(data.idea),
        storyboard,
      };
    },
    expectedObject,
    (result) => extractStoryObject(result.storyboard),
    { fullText: (result) => result.storyboard },
  );
}

function buildYoutubePrompt(data) {
  const title = cleanText(data.title, titleFromIdea(data.idea), 160);
  const character = cleanText(data.character, '', 300);
  const objectKeyword = cleanText(data.objectKeyword, '', 120);
  const setDescription = cleanText(data.setDescription, '', 500);
  const idea = cleanText(data.idea, '', 500);
  const storyboard = cleanText(data.storyboard, '', 100_000);

  return `Create YouTube Shorts upload content for this AI animated short.

Return only this exact structure:
YouTube upload content:
Title:
Description:
[5 main tags on one line, each starting with #, no label]
[30 hook-focused tags on one line, separated by commas, no # symbols, no label]

Rules:
- Make it optimized for YouTube Shorts.
- Make the Title more provocative, curiosity-driven, and click-worthy than the story title.
- Title should feel like a viral Shorts hook: surprising, urgent, funny, and impossible to ignore.
- Use a fast, attention-grabbing, sensory hook.
- Emphasize quick escalation, playful tension, and a final comic twist.
- Keep it exciting but safe and non-graphic.
- Description should be 2 to 4 short sentences.
- Put one blank line after the description, then write exactly 5 main tags separated by spaces. Each main tag must start with #.
- Under that, write exactly 30 hook-focused tags separated by commas. Do not use # on this 30-tag line.
- Do not write labels such as "Top 5 tags:", "Tags:", "Hashtags:", or "Hash tags:".
- Mention or imply the key object/product naturally.
- Use the set/location naturally when it helps the hook.

Story title: ${title}
Main character: ${character}
Object keyword: ${objectKeyword || 'object from the story'}
Set: ${setDescription || 'main location from the story'}
Story idea: ${idea}

Storyboard:
${storyboard}`;
}

function normalizeYoutubeContent(text, data = {}) {
  let cleaned = String(text || '').trim()
    .replace(/^Top 5 tags:\s*/gim, '')
    .replace(/^Tags:\s*/gim, '')
    .replace(/^Hash\s*tags:\s*/gim, '')
    .replace(/^Hashtags:\s*/gim, '');
  const contentStart = cleaned.search(/(?:YouTube upload content:|Title:)/i);
  if (contentStart > 0) {
    cleaned = cleaned.slice(contentStart).trim();
  }
  const lines = cleaned.split(/\n+/);
  const extractedHashtags = cleaned.match(/#[\p{L}\p{N}_-]+/gu) || [];
  const extractedCommaTags = lines
    .filter(line => isCommaTagLine(line))
    .flatMap(line => line.split(',').map(part => part.trim()));
  const body = lines
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^(Top 5 tags|Tags|Hashtags|Hash tags):/i.test(trimmed)) return false;
      if (isHashtagLine(trimmed)) return false;
      if (isCommaTagLine(trimmed)) return false;
      if (isLooseKeywordTagLine(trimmed)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const objectKeyword = cleanText(data.objectKeyword, '', 80);
  const character = cleanText(data.character, '', 120);
  const setDescription = cleanText(data.setDescription, '', 120);
  const characterTag = /yellow/i.test(character) ? 'yellow crewmate' : shortTagPhrase(character, 3);
  const setTag = shortTagPhrase(setDescription, 4);
  const mainTagWords = uniqueItems([
    ...extractedHashtags.map(tag => tag.replace(/^#/, '')),
    objectKeyword,
    characterTag,
    setTag,
    'YouTube Shorts',
    'AI Animation',
    'Funny Twist',
    'Viral Short'
  ].map(hashtagWord)).slice(0, 5);

  const hookTags = uniqueItems([
    ...extractedCommaTags,
    objectKeyword,
    characterTag,
    setTag,
    'must watch',
    'viral short',
    'funny twist',
    'unexpected ending',
    'comedy short',
    'AI animation',
    'animated story',
    'YouTube Shorts',
    'quick laugh',
    'crazy moment',
    'surprise reaction',
    'visual hook',
    'fast paced',
    'cartoon comedy',
    'game character',
    'Among Us style',
    'yellow crewmate',
    'product hook',
    'object story',
    'storyboard idea',
    'Sora prompt',
    'short video',
    'meme energy',
    'cute chaos',
    'attention grabber',
    'final twist',
    'family friendly',
    'creator idea',
    'shareable clip',
    'trend ready'
  ].map(tagPhrase)).slice(0, 30);

  return `${body}\n\n${mainTagWords.map(tag => `#${tag}`).join(' ')}\n\n${hookTags.join(', ')}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isHashtagLine(line) {
  return /^(?:#[\p{L}\p{N}_-]+[\s,]*)+$/u.test(String(line || '').trim());
}

function isCommaTagLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  if (/^(YouTube upload content|Title|Description):/i.test(trimmed)) return false;
  return trimmed.split(',').map(part => part.trim()).filter(Boolean).length >= 5;
}

function isLooseKeywordTagLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || /[:.,!?]/.test(trimmed) || trimmed.startsWith('#')) return false;
  return trimmed.split(/\s+/).filter(Boolean).length >= 6;
}

function hashtagWord(value) {
  const words = String(value || '')
    .replace(/^#/, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  return words.join('');
}

function tagPhrase(value) {
  return String(value || '')
    .replace(/#/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function shortTagPhrase(value, wordLimit = 4) {
  return tagPhrase(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, wordLimit)
    .join(' ');
}

function uniqueItems(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const cleaned = String(item || '').trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
  }
  return unique;
}

async function createYoutubeContent(data) {
  const model = modelFor(data);
  const expectedObject = extractExpectedObject(data) || extractStoryObject(data.storyboard);

  return withObjectRetries(
    async () => {
      const response = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: buildYoutubePrompt(data),
          stream: false,
          keep_alive: ollamaKeepAlive,
          options: {
            temperature: 0.85,
            top_p: 0.9,
            num_predict: 1800,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      const youtubeContent = normalizeYoutubeContent(String(payload.response || '').trim(), data);
      if (!youtubeContent) {
        throw new Error('Ollama returned empty YouTube content.');
      }

      return { model, youtubeContent };
    },
    expectedObject,
    (result) => result.youtubeContent,
    { fullText: (result) => result.youtubeContent },
  );
}

function buildTranslatePrompt(data) {
  const target = resolveLanguage(data) === 'ko' ? 'Korean' : 'English';
  if (target === 'Korean') {
    return `아래 스토리보드를 자연스러운 한국어로 변환하세요.

출력은 변환된 스토리보드 텍스트만 하세요. 설명이나 마크다운 코드블록은 쓰지 마세요.

필수 규칙:
- "Title:" 라벨은 그대로 유지하세요.
- "Scene 1 - 0s:" 같은 장면 번호와 시간 라벨은 그대로 유지하세요.
- 제목 내용과 장면 설명은 모두 자연스러운 한국어로 번역하세요.
- 영어 단어, 외국어 단어, 로마자 표기를 섞지 마세요.
- 장면 개수와 순서를 유지하세요.
- 원래 이야기의 시각적 의미와 구조를 유지하세요.

스토리보드:
${cleanText(data.storyboard, '', 6000)}`;
  }

  const languageRules = target === 'Korean'
    ? 'Translate all title content and scene descriptions into natural Korean only. Keep labels like "Title:" and "Scene 1 - 0s:" exactly in English. Do not mix in English, Hindi, code words, or romanized words.'
    : 'Translate all title content and scene descriptions into natural English. Keep labels like "Title:" and "Scene 1 - 0s:" exactly in English.';

  return `Convert this storyboard to ${target}.

Return only the converted storyboard text. Do not add markdown fences or explanations.

Rules:
- ${languageRules}
- Preserve every scene number.
- Preserve every timestamp.
- Preserve the same number of scenes.
- Keep the visual meaning and story structure.

Storyboard:
${cleanText(data.storyboard, '', 6000)}`;
}

async function translateStory(data) {
  const model = modelFor(data);
  const target = resolveLanguage(data);
  const parts = parseStoryboardSections(data.storyboard);

  if (!parts.scenes.length) {
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: buildTranslatePrompt(data),
        stream: false,
        keep_alive: ollamaKeepAlive,
        options: {
          temperature: 0.35,
          top_p: 0.8,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const storyboard = normalizeStoryboard(payload.response, data);
    if (!storyboard) {
      throw new Error('Ollama returned an empty conversion.');
    }

    const titleMatch = storyboard.match(/^Title:\s*(.+)$/im);
    return {
      model,
      title: titleMatch ? titleMatch[1].trim() : titleFromIdea(data.idea),
      storyboard,
    };
  }

  const translated = {
    title: await translateChunk(model, parts.title, target, 'title'),
    totalDuration: parts.totalDuration,
    genre: await translateChunk(model, parts.genre, target, 'genre'),
    mood: await translateChunk(model, parts.mood, target, 'mood'),
    keyObject: await translateChunk(model, parts.keyObject, target, 'storyboard note'),
    setPrompt: await translateChunk(model, parts.setPrompt, target, 'set prompt'),
    artStylePrompt: await translateChunk(model, parts.artStylePrompt, target, 'art style prompt'),
    scenes: [],
  };

  for (const scene of parts.scenes) {
    translated.scenes.push({
      number: scene.number,
      time: scene.time,
      text: await translateChunk(model, scene.text, target, `scene ${scene.number} description`),
    });
  }

  const storyboard = rebuildStoryboardFromSections(translated);
  if (!storyboard) {
    throw new Error('Ollama returned an empty conversion.');
  }

  const titleMatch = storyboard.match(/^Title:\s*(.+)$/im);
  return {
    model,
    title: titleMatch ? titleMatch[1].trim() : titleFromIdea(data.idea),
    storyboard,
  };
}

async function listProjects() {
  await ensureDataDir();
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    try {
      const filePath = path.join(dataDir, entry.name);
      const raw = await fs.readFile(filePath, 'utf8');
      const project = JSON.parse(raw);
      const updatedAt = project.updatedAt || project.createdAt || '';
      projects.push({
        id: project.id || entry.name.replace(/\.json$/i, ''),
        name: project.name || project.title || 'Untitled story',
        title: project.title || '',
        fileName: entry.name,
        updatedAt,
        updatedAtLabel: updatedAt ? new Date(updatedAt).toLocaleString() : 'unknown time',
      });
    } catch {
      // Ignore malformed save files so one bad file does not break the menu.
    }
  }

  projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return projects;
}

async function listUploadProjects() {
  await ensureUploadStoryDir();
  const entries = await fs.readdir(uploadStoryDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    try {
      const filePath = path.join(uploadStoryDir, entry.name);
      const raw = await fs.readFile(filePath, 'utf8');
      const project = JSON.parse(raw);
      const updatedAt = project.updatedAt || project.createdAt || '';
      projects.push({
        id: project.id || entry.name.replace(/\.json$/i, ''),
        name: project.name || project.title || 'Untitled upload story',
        title: project.title || '',
        fileName: entry.name,
        updatedAt,
        updatedAtLabel: updatedAt ? new Date(updatedAt).toLocaleString() : 'unknown time',
      });
    } catch {
      // Ignore malformed upload files so one bad file does not break the menu.
    }
  }

  projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return projects;
}

async function saveProject(data) {
  await ensureDataDir();
  const name = cleanText(data.name, data.title || 'Untitled story', 120);
  const now = new Date().toISOString();
  const id = idForProject(name);
  const project = {
    id,
    name,
    title: cleanText(data.title, name, 160),
    settings: data.settings || {},
    storyboard: cleanText(data.storyboard, '', 100_000),
    youtubeContent: cleanText(data.youtubeContent, '', 100_000),
    createdAt: now,
    updatedAt: now,
  };

  const fileName = `${id}.json`;
  await fs.writeFile(path.join(dataDir, fileName), JSON.stringify(project, null, 2));
  return { ...project, fileName };
}

async function saveUploadProject(data) {
  await ensureUploadStoryDir();
  const name = cleanText(data.name, data.title || 'Upload story', 120);
  const now = new Date().toISOString();
  const id = idForProject(name);
  const project = {
    id,
    name,
    title: cleanText(data.title, name, 160),
    settings: data.settings || {},
    storyboard: cleanText(data.storyboard, '', 100_000),
    youtubeContent: cleanText(data.youtubeContent, '', 100_000),
    uploadReady: true,
    createdAt: now,
    updatedAt: now,
  };

  const fileName = `${id}.json`;
  await fs.writeFile(path.join(uploadStoryDir, fileName), JSON.stringify(project, null, 2));
  return { ...project, fileName };
}

async function saveAutoGenerated(data) {
  await ensureAutoSaveDir();
  const name = cleanText(data.name, data.title || 'Auto generated story', 120);
  const now = new Date().toISOString();
  const id = idForProject(name);
  const project = {
    id,
    reason: cleanText(data.reason, 'auto', 80),
    name,
    title: cleanText(data.title, name, 160),
    settings: data.settings || {},
    storyboard: cleanText(data.storyboard, '', 100_000),
    youtubeContent: cleanText(data.youtubeContent, '', 100_000),
    createdAt: now,
    updatedAt: now,
  };

  const fileName = `${id}.json`;
  await fs.writeFile(path.join(autoSaveDir, fileName), JSON.stringify(project, null, 2));
  return { ...project, fileName };
}

async function loadProject(id) {
  await ensureDataDir();
  const filePath = projectPathFor(id);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function loadUploadProject(id) {
  await ensureUploadStoryDir();
  const filePath = uploadProjectPathFor(id);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function updateProject(id, data) {
  await ensureDataDir();
  const filePath = projectPathFor(id);
  const raw = await fs.readFile(filePath, 'utf8');
  const existing = JSON.parse(raw);
  const now = new Date().toISOString();
  const name = cleanText(data.name, existing.name || existing.title || 'Untitled story', 120);
  const project = {
    ...existing,
    id: existing.id || path.basename(filePath, '.json'),
    name,
    title: cleanText(data.title, existing.title || name, 160),
    settings: data.settings || existing.settings || {},
    storyboard: cleanText(data.storyboard, existing.storyboard || '', 100_000),
    youtubeContent: cleanText(data.youtubeContent, existing.youtubeContent || '', 100_000),
    updatedAt: now,
  };

  await fs.writeFile(filePath, JSON.stringify(project, null, 2));
  return { ...project, fileName: path.basename(filePath) };
}

async function updateUploadProject(id, data) {
  await ensureUploadStoryDir();
  const filePath = uploadProjectPathFor(id);
  const raw = await fs.readFile(filePath, 'utf8');
  const existing = JSON.parse(raw);
  const now = new Date().toISOString();
  const name = cleanText(data.name, existing.name || existing.title || 'Upload story', 120);
  const project = {
    ...existing,
    id: existing.id || path.basename(filePath, '.json'),
    name,
    title: cleanText(data.title, existing.title || name, 160),
    settings: data.settings || existing.settings || {},
    storyboard: cleanText(data.storyboard, existing.storyboard || '', 100_000),
    youtubeContent: cleanText(data.youtubeContent, existing.youtubeContent || '', 100_000),
    uploadReady: true,
    updatedAt: now,
  };

  await fs.writeFile(filePath, JSON.stringify(project, null, 2));
  return { ...project, fileName: path.basename(filePath) };
}

async function loadSaveNamePrefix() {
  await ensureAppSettingsDir();
  try {
    const raw = await fs.readFile(saveNamePrefixPath, 'utf8');
    const settings = JSON.parse(raw);
    return {
      enabled: Boolean(settings.enabled),
      prefix: cleanText(settings.prefix, '', 80),
      updatedAt: settings.updatedAt || '',
    };
  } catch {
    return { enabled: false, prefix: '', updatedAt: '' };
  }
}

async function saveSaveNamePrefix(data) {
  await ensureAppSettingsDir();
  const settings = {
    enabled: Boolean(data.enabled),
    prefix: cleanText(data.prefix, '', 80),
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(saveNamePrefixPath, JSON.stringify(settings, null, 2));
  return settings;
}

async function listCharacterDesigns() {
  await ensureCharacterDesignDir();
  const entries = await fs.readdir(artStyleDir, { withFileTypes: true });
  const designs = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    try {
      const filePath = path.join(artStyleDir, entry.name);
      const raw = await fs.readFile(filePath, 'utf8');
      const design = JSON.parse(raw);
      const updatedAt = design.updatedAt || design.createdAt || '';
      designs.push({
        id: design.id || entry.name.replace(/\.json$/i, ''),
        name: design.name || 'Untitled art style',
        fileName: entry.name,
        updatedAt,
        updatedAtLabel: updatedAt ? new Date(updatedAt).toLocaleString() : 'unknown time',
      });
    } catch {
      // Ignore malformed art style files.
    }
  }

  designs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return designs;
}

async function saveCharacterDesign(data) {
  await ensureCharacterDesignDir();
  const design = cleanText(data.design, '', 20_000);
  if (!design) {
    throw new Error('Art style is empty.');
  }

  const name = cleanText(data.name, 'Art style', 120);
  const now = new Date().toISOString();
  const id = fixedArtStyleId(data.fixedId) || idForProject(name);
  const fileName = `${id}.json`;
  let createdAt = now;

  if (fixedArtStyleId(data.fixedId)) {
    try {
      const previous = JSON.parse(await fs.readFile(path.join(artStyleDir, fileName), 'utf8'));
      createdAt = previous.createdAt || now;
    } catch {
      createdAt = now;
    }
  }

  const characterDesign = {
    id,
    name,
    design,
    createdAt,
    updatedAt: now,
    fixedId: fixedArtStyleId(data.fixedId) || undefined,
  };

  await fs.writeFile(path.join(artStyleDir, fileName), JSON.stringify(characterDesign, null, 2));
  return { ...characterDesign, fileName };
}

async function loadCharacterDesign(id) {
  await ensureCharacterDesignDir();
  const filePath = characterDesignPathFor(id);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(baseDir, pathname));

  if (!filePath.startsWith(baseDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html'
      ? 'text/html; charset=utf-8'
      : ext === '.js'
        ? 'text/javascript; charset=utf-8'
        : 'application/octet-stream';
    sendText(res, 200, content, type);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && req.url === '/api/story') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const story = await createStory(data);
      sendJson(res, 200, story);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/idea') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const idea = await createIdea(data);
      sendJson(res, 200, idea);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/translate') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const story = await translateStory(data);
      sendJson(res, 200, story);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/youtube') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const youtube = await createYoutubeContent(data);
      sendJson(res, 200, youtube);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auto-saves') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const project = await saveAutoGenerated(data);
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/models') {
    try {
      const catalog = await getModelCatalog();
      sendJson(res, 200, catalog);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/models/install') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const result = await installOrUpdateModel(data.model);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'DELETE' && req.url === '/api/models/delete') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const result = await removeModel(data.model);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/save-name-prefix') {
    try {
      const settings = await loadSaveNamePrefix();
      sendJson(res, 200, { settings });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/save-name-prefix') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const settings = await saveSaveNamePrefix(data);
      sendJson(res, 200, { settings });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/projects') {
    try {
      const projects = await listProjects();
      sendJson(res, 200, { projects });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/upload-projects') {
    try {
      const projects = await listUploadProjects();
      sendJson(res, 200, { projects });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/projects') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const project = await saveProject(data);
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/upload-projects') {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const project = await saveUploadProject(data);
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/projects/')) {
    try {
      const id = decodeURIComponent(url.pathname.replace('/api/projects/', ''));
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const project = await updateProject(id, data);
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/upload-projects/')) {
    try {
      const id = decodeURIComponent(url.pathname.replace('/api/upload-projects/', ''));
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const project = await updateUploadProject(id, data);
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/projects/')) {
    try {
      const id = decodeURIComponent(url.pathname.replace('/api/projects/', ''));
      const project = await loadProject(id);
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 404, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/upload-projects/')) {
    try {
      const id = decodeURIComponent(url.pathname.replace('/api/upload-projects/', ''));
      const project = await loadUploadProject(id);
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 404, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && (req.url === '/api/art-styles' || req.url === '/api/character-designs')) {
    try {
      const designs = await listCharacterDesigns();
      sendJson(res, 200, { designs });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && (req.url === '/api/art-styles' || req.url === '/api/character-designs')) {
    try {
      const body = await getRequestBody(req);
      const data = JSON.parse(body || '{}');
      const design = await saveCharacterDesign(data);
      sendJson(res, 200, { design });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && (url.pathname.startsWith('/api/art-styles/') || url.pathname.startsWith('/api/character-designs/'))) {
    try {
      const id = decodeURIComponent(url.pathname.replace(/^\/api\/(?:art-styles|character-designs)\//, ''));
      const design = await loadCharacterDesign(id);
      sendJson(res, 200, { design });
    } catch (error) {
      sendJson(res, 404, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET') {
    await serveStatic(req, res);
    return;
  }

  sendText(res, 405, 'Method not allowed');
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.log(`AI Story Builder is already running at http://${host}:${port}`);
    console.log('Open that address in your browser. No second server was started.');
    process.exit(0);
  }

  throw error;
});

server.listen(port, host, () => {
  ensureDataDir().catch(error => {
    console.error(`Could not create data folder: ${error.message}`);
  });
  ensureAutoSaveDir().catch(error => {
    console.error(`Could not create auto-generated folder: ${error.message}`);
  });
  ensureUploadStoryDir().catch(error => {
    console.error(`Could not create upload-stories folder: ${error.message}`);
  });
  ensureCharacterDesignDir().catch(error => {
    console.error(`Could not create art-styles folder: ${error.message}`);
  });
  ensureAppSettingsDir().catch(error => {
    console.error(`Could not create app-settings folder: ${error.message}`);
  });
  console.log(`AI Story Builder: http://${host}:${port}`);
  console.log(`Default Ollama model: ${defaultModel}`);
});
