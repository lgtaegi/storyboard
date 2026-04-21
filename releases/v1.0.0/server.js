/*
Created: 2026-04-21 America/Denver
Created by lgtaegi
Updated:
- added fixed art style slot saving for 2D Animation, Live-Action, and Custom Style
- added save name prefix settings API with persistent storage
- supports current storyboard save, auto-save, art style, and app settings folders
*/
const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5055);
const defaultModel = process.env.OLLAMA_MODEL || 'llama3.2:latest';
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const baseDir = __dirname;
const dataDir = path.join(baseDir, 'data');
const autoSaveDir = path.join(baseDir, 'auto-generated');
const artStyleDir = path.join(baseDir, 'art-styles');
const appSettingsDir = path.join(baseDir, 'app-settings');
const saveNamePrefixPath = path.join(appSettingsDir, 'save-name-prefix.json');
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

function projectPathFor(id) {
  const safeId = path.basename(String(id || '')).replace(/\.json$/i, '');
  return path.join(dataDir, `${safeId}.json`);
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

function buildPrompt(data) {
  const duration = clampNumber(data.duration, 15, 3, 180);
  const sceneCount = clampNumber(data.sceneCount, 5, 1, Math.min(30, duration));
  const interval = Math.max(1, Math.round(duration / sceneCount));
  const character = cleanText(data.character, 'Among Us game character Yellow', 300);
  const objectKeyword = cleanText(data.objectKeyword, '', 120);
  const setDescription = cleanText(data.setDescription, '', 1000);
  const characterDesign = cleanText(data.characterDesign, defaultCharacterDesign, 3000);
  const idea = cleanText(data.idea, 'finds a baseball bat on the street', 600);
  const genre = cleanText(data.genre, 'Science fiction', 80);
  const mood = cleanText(data.mood, 'Wonder', 80);
  const style = cleanText(data.style, '', 1000);
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

  if (resolveLanguage(data) === 'ko') {
    return `새로운 AI 영상용 스토리보드를 만드세요.

출력은 스토리보드 텍스트만 하세요. 마크다운 코드블록이나 설명은 쓰지 마세요.

필수 규칙:
- 첫 줄은 반드시 "Title:"로 시작하세요.
- 전체 길이: ${duration}초.
- 장르: ${genre}.
- 분위기: ${mood}.
${artDirectionRuleKo}
- 주인공 캐릭터: ${character}.
- 오브젝트 키워드: ${objectKeyword || '없음. 이야기 아이디어 안의 물건을 사용하거나, 상품 노출에 적합한 물건 하나를 선택하세요.'}
- Set: ${setDescription || '없음. 이야기 아이디어나 생성 과정에서 적절한 장소를 만드세요.'}
- 아트 스타일: ${characterDesign}.
- 출력하기 전에 내부적으로 입력된 Art Style, Set, 오브젝트 키워드, 장르, 분위기가 서로 충돌하는지 점검하세요. 이 점검 내용은 출력하지 마세요.
- 충돌이 있으면 사용자가 직접 입력한 Set과 Art Style을 우선 보존하고, 나머지 이야기 설정은 그 안에서 가능한 한 일관되게 적용하세요.
- Set 내용이 입력되어 있으면 아트 스타일 안의 배경/장소/씬 언급보다 Set을 우선하세요.
- 단, 이야기 구조상 추격, 반전, 이동이 필요하면 Set을 중심 장소로 유지하면서 추가 장소를 자연스럽게 사용할 수 있습니다.
- Art Style에 금지 조건이 있으면 반드시 지키세요. 예: 얼굴이 보이면 안 된다는 조건이 있으면 표정은 얼굴이 아니라 자세, 고개 방향, 손동작, 바이저 반사, 몸짓으로 표현하세요.
- 각 장면은 입력된 Set, Art Style, 캐릭터 정체성, 핵심 오브젝트가 실제 화면 설명 안에 살아 있도록 쓰세요.
- 이야기 아이디어는 사건/상황입니다. 주인공 캐릭터는 위의 캐릭터를 사용하세요.
- 이야기 아이디어에는 반드시 하나의 명확한 물건이 있어야 하며, 이 물건이 사건을 이끌어가는 핵심 요소여야 합니다.
- 오브젝트 키워드가 있으면 반드시 그 물건을 핵심 물건으로 사용하세요.
- 그 물건은 여러 장면에 반복적으로 보이는 주요 소품이어야 하고, 나중에 온라인 상점 상품 링크와 연결할 수 있을 만큼 분명해야 합니다.
- 인기 있는 유튜브 쇼츠처럼 빠른 전개, 즉시 보이는 갈등, 작은 긴장감, 과장된 리액션, 마지막 반전 코미디를 넣으세요.
- 장면 설명은 사람들의 시선을 끌 수 있게 감각적이고 강렬하되, 폭력적이거나 혐오적인 표현은 피하세요.
- 장면을 쓰기 전에 반드시 아래 상단 프롬프트 블록 3개만 넣으세요:
  0. "Key object / product hook:" 라벨 아래에 이야기의 핵심 물건과 상품 연결 가능성을 1문장으로 쓰세요.
  0-1. "Set prompt:" 라벨 아래에 주요 장소를 1문장으로 쓰세요. Set이 입력되었으면 그 내용을 우선 사용하세요.
  1. "Art style prompt:" 라벨 아래에 입력된 아트 스타일을 스토리에 적용하는 방법을 1문장으로 설명하세요.
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

이야기 아이디어:
${idea}

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
- Genre: ${genre}.
- Mood: ${mood}.
${artDirectionRuleEn}
- Main character: ${character}.
- Object keyword: ${objectKeyword || 'none. Use the object in the story idea, or choose one product-friendly object if the idea is missing one.'}
- Set: ${setDescription || 'none. Use the location created in the story idea, or create a clear product-friendly main set.'}
- Art style: ${characterDesign}.
- Before writing the output, silently check whether the user art style, Set, object keyword, genre, and mood conflict with each other. Do not output this checklist.
- If there is a conflict, preserve the user-entered Set and Art Style first, then apply the remaining story settings as consistently as possible inside those constraints.
- If Set is provided, prioritize that set over any background, location, or scene references inside Art Style.
- The story may still use additional locations when the structure needs movement, escalation, chase, or a twist, but the provided Set must remain the main location anchor.
- Strictly follow negative constraints inside Art Style. For example, if visible faces are forbidden, express emotion through posture, head angle, hand motion, visor reflections, and body language instead of facial expressions.
- Every scene must visibly preserve the key input settings: Set, Art Style, character identity, and the core object.
- Treat the story idea as the event or situation. Use the main character above as the protagonist.
- The story idea must include exactly one clear physical object, and that object must drive the story events.
- If Object keyword is provided, that exact object must be the core object.
- The object must appear repeatedly as the main prop and be specific enough to later connect to an online store or affiliate product link.
- Use the pacing of popular YouTube Shorts: instant hook, fast escalation, playful tension, exaggerated reactions, and a final comic twist.
- Make the descriptions attention-grabbing and sensory, while avoiding hateful, graphic, or unsafe content.
- Before the scenes, include only these three top prompt blocks:
  0. "Key object / product hook:" Write one sentence naming the core object and why it can connect to a future product link.
  0-1. "Set prompt:" Write one sentence naming the main set. If Set is provided, use that set.
  1. "Art style prompt:" Explain in one sentence how the entered Art Style should apply to this story.
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

Story idea:
${idea}

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

function buildIdeaPrompt(data) {
  const character = cleanText(data.character, 'Among Us game character Yellow', 300);
  const objectKeyword = cleanText(data.objectKeyword, '', 120);
  const setDescription = cleanText(data.setDescription, '', 500);
  const genre = cleanText(data.genre, 'Science fiction', 80);
  const mood = cleanText(data.mood, 'Wonder', 80);
  const currentIdea = cleanText(data.idea, 'finds a baseball bat on the street', 300);
  const randomSeed = `${Date.now()}-${Math.random()}`;

  return `Generate one very simple story idea for an AI video storyboard.

Return only one short sentence with 6 to 12 words. Do not add a title, numbering, markdown, quotes, or explanation.

Use these settings:
- Main character: ${character}
- Object keyword: ${objectKeyword || 'none'}
- Set: ${setDescription || 'none'}
- Genre: ${genre}
- Mood: ${mood}
- Use the main character above as the protagonist, but keep the wording short.
- The idea must include exactly one clear physical object.
- If Object keyword is not "none", you MUST use that exact object phrase and no other object.
- If Object keyword is "none", choose one random product-friendly object that can be clearly shown on screen.
- That object must drive the event and be product-link friendly.
- If Set is not "none", make the event happen mainly in that set.
- If Set is "none", choose a simple place that fits the object.
- Use this simple format: [character] finds/uses/loses [one object] at/in [simple place or provided set].
- Keep it punchy like a YouTube Short hook, with room for a comic twist.
- Make it different from but compatible with this current event idea: ${currentIdea}
- Random seed for variation: ${randomSeed}`;
}

function articleForObject(objectKeyword) {
  if (/^(a|an|the)\s/i.test(objectKeyword)) return '';
  return /^[aeiou]/i.test(objectKeyword) ? 'an ' : 'a ';
}

function fallbackIdeaFor(data, objectKeyword) {
  const character = cleanText(data.character, 'Yellow', 80);
  const setDescription = cleanText(data.setDescription, '', 180);
  const actions = ['finds', 'drops', 'uses', 'loses', 'chases', 'hides'];
  const places = [
    'inside a vending machine',
    'under a streetlight',
    'in the crew lounge',
    'beside a locked door',
    'near a noisy elevator',
    'inside a snack shop',
    'on a slippery sidewalk',
    'behind a tiny spaceship'
  ];
  const index = Math.floor(Math.random() * actions.length);
  const place = setDescription || places[Math.floor(Math.random() * places.length)];
  return `${character} ${actions[index]} ${articleForObject(objectKeyword)}${objectKeyword} ${place}.`;
}

async function createIdea(data) {
  const model = modelFor(data);
  const objectKeyword = cleanText(data.objectKeyword, '', 120);
  if (objectKeyword) {
    return { model, idea: fallbackIdeaFor(data, objectKeyword) };
  }

  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildIdeaPrompt(data),
      stream: false,
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
  let idea = cleanIdeaResponse(payload.response);
  const currentIdea = cleanText(data.idea, '', 300).toLowerCase();
  if (
    objectKeyword &&
    (!idea.toLowerCase().includes(objectKeyword.toLowerCase()) || idea.toLowerCase() === currentIdea)
  ) {
    idea = fallbackIdeaFor(data, objectKeyword);
  }
  if (!idea) {
    throw new Error('Ollama returned an empty idea.');
  }

  return { model, idea };
}

async function createStory(data) {
  const model = modelFor(data);
  const duration = clampNumber(data.duration, 15, 3, 180);
  const sceneCount = clampNumber(data.sceneCount, 5, 1, Math.min(30, duration));
  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildPrompt(data),
      stream: false,
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
}

function buildYoutubePrompt(data) {
  const title = cleanText(data.title, titleFromIdea(data.idea), 160);
  const character = cleanText(data.character, 'Among Us game character Yellow', 300);
  const objectKeyword = cleanText(data.objectKeyword, '', 120);
  const setDescription = cleanText(data.setDescription, '', 500);
  const idea = cleanText(data.idea, 'finds a baseball bat on the street', 500);
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
  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildYoutubePrompt(data),
      stream: false,
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
  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildTranslatePrompt(data),
      stream: false,
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
  ensureCharacterDesignDir().catch(error => {
    console.error(`Could not create art-styles folder: ${error.message}`);
  });
  ensureAppSettingsDir().catch(error => {
    console.error(`Could not create app-settings folder: ${error.message}`);
  });
  console.log(`AI Story Builder: http://${host}:${port}`);
  console.log(`Default Ollama model: ${defaultModel}`);
});
