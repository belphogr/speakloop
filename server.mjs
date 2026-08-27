import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';

const projectDir = process.env.SPEAKLOOP_PROJECT_DIR || process.cwd();
const dataDir = process.env.SPEAKLOOP_DATA_DIR || projectDir;
const publicDir = resolve(process.env.SPEAKLOOP_PUBLIC_DIR || join(projectDir, 'public'));
const libraryDir = resolve(join(dataDir, 'video-library'));
const libraryIndex = join(libraryDir, 'library.json');
const userDataDir = resolve(join(dataDir, 'user-data'));
const personalRecommendationsFile = join(userDataDir, 'recommendations.json');
const bookmarksFile = join(userDataDir, 'bookmarks.json');
const ffmpegDir = resolve(process.env.SPEAKLOOP_FFMPEG_DIR || join(projectDir, 'tools', 'ffmpeg', 'bin'));
const ffmpeg = join(ffmpegDir, 'ffmpeg.exe');
const ffprobe = join(ffmpegDir, 'ffprobe.exe');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.ogv': 'video/ogg' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : JSON.stringify(body));
}

async function sendMedia(req, res, file) {
  const size = (await stat(file)).size;
  const type = mime[extname(file).toLowerCase()] || 'video/mp4';
  const range = req.headers.range;
  if (!range) { res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }); createReadStream(file).pipe(res); return; }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2] || 0));
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
  res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }); createReadStream(file, { start, end }).pipe(res);
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const delay = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));
async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { return await fetch(url, options); }
    catch (error) { lastError = error; if (attempt === 0) await delay(600); }
  }
  throw new Error('无法连接翻译服务，请检查网络后重试。');
}

async function library() { try { return JSON.parse(await readFile(libraryIndex, 'utf8')); } catch { return []; } }
async function personalRecommendations() { try { return JSON.parse(await readFile(personalRecommendationsFile, 'utf8')); } catch { return null; } }
async function bookmarks() { try { const saved = JSON.parse(await readFile(bookmarksFile, 'utf8')); return Array.isArray(saved) ? saved : []; } catch { return []; } }
async function saveBookmarks(items) { await mkdir(userDataDir, { recursive: true }); await writeFile(bookmarksFile, JSON.stringify(items, null, 2)); }
async function saveLibrary(records) { await mkdir(libraryDir, { recursive: true }); await writeFile(libraryIndex, JSON.stringify(records, null, 2)); }
function mediaUrl(record) { return `/library/${encodeURIComponent(record.fileName)}`; }
function run(binary, args) { return new Promise((resolve, reject) => { const child = spawn(binary, args, { windowsHide: true }); const chunks = []; let stderr = ''; child.stdout.on('data', c => chunks.push(c)); child.stderr.on('data', c => stderr += c); child.on('error', reject); child.on('close', code => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(stderr || `${binary} failed`))); }); }
async function durationOf(file) { return Number((await run(ffprobe, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file])).toString().trim()); }
async function wavChunk(file, start, seconds) { return run(ffmpeg, ['-ss',String(start),'-t',String(seconds),'-i',file,'-vn','-ac','1','-ar','16000','-f','wav','pipe:1']); }
function splitText(text, start, end) { const phrases = String(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x => x.trim()).filter(Boolean) || []; const total = phrases.reduce((n, x) => n + x.length, 0) || 1; let cursor = start; return phrases.map((en, i) => { const span = (end - start) * en.length / total; const item = { start: cursor, end: i === phrases.length - 1 ? end : cursor + span, en, zh: '' }; cursor += span; return item; }); }

function credentialsFrom(req) {
  const requested = req.headers['x-ai-provider'];
  const provider = requested === 'zhipu' || requested === 'deepseek' ? requested : 'openai';
  const key = req.headers['x-ai-key'];
  if (!key || typeof key !== 'string') throw new Error(`请在设置中填入有效的${provider === 'zhipu' ? '智谱' : provider === 'deepseek' ? ' DeepSeek' : ' OpenAI'} API Key。`);
  if (provider === 'openai' && !key.startsWith('sk-')) throw new Error('OpenAI API Key 通常以 sk- 开头，请确认服务商选择是否正确。');
  return { provider, key };
}

async function transcribe(req, res) {
  const { provider, key } = credentialsFrom(req);
  if (provider === 'deepseek') throw new Error('DeepSeek 当前不提供本应用所需的音频转写接口。请切换到 OpenAI 或智谱 AI。');
  const audio = await body(req);
  if (!audio.length) throw new Error('没有收到音频或视频文件。');
  if (audio.length > 24 * 1024 * 1024) throw new Error('文件超过 24 MB，请先截取片段或压缩后再转写。');
  const type = String(req.headers['x-file-type'] || 'video/mp4');
  const name = String(req.headers['x-file-name'] || 'recording.webm').replace(/[^\w.\-]/g, '_');
  if (provider === 'zhipu' && !/\.(wav|mp3)$/i.test(name)) throw new Error('智谱转写仅接受 WAV 或 MP3。应用会在浏览器中自动把不超过 30 秒的录音或视频音轨转换为 WAV；请稍候重试。');
  const form = new FormData();
  form.append('file', new Blob([audio], { type }), name);
  if (provider === 'zhipu') {
    form.append('model', 'glm-asr-2512');
    form.append('stream', 'false');
  } else {
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    form.append('language', 'en');
  }
  const endpoint = provider === 'zhipu' ? 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions';
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || '转写服务暂时不可用。');
  send(res, 200, data);
}

function azureCredentialsFrom(req) {
  const key = String(req.headers['x-azure-speech-key'] || '').trim();
  const region = String(req.headers['x-azure-speech-region'] || '').trim().toLowerCase();
  if (!key) throw new Error('请在 API 设置中填入 Azure Speech Key，才能使用单词级发音评测。');
  if (!/^[a-z0-9-]+$/.test(region)) throw new Error('请填入有效的 Azure Speech 区域，例如 eastasia。');
  return { key, region };
}

async function assessPronunciation(req, res) {
  const { key, region } = azureCredentialsFrom(req);
  const referenceText = String(req.headers['x-reference-text'] || '').trim();
  const language = req.headers['x-pronunciation-language'] === 'en-GB' ? 'en-GB' : 'en-US';
  const audio = await body(req);
  if (!referenceText) throw new Error('请先选择一条英文字幕作为跟读目标。');
  if (!audio.length) throw new Error('没有收到录音。');
  if (audio.length > 10 * 1024 * 1024) throw new Error('录音过大，请控制在单句练习范围内。');
  const assessment = Buffer.from(JSON.stringify({ ReferenceText: referenceText, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: true, EnableProsodyAssessment: language === 'en-US' ? 'True' : 'False' })).toString('base64');
  const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`;
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Pronunciation-Assessment': assessment, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', 'Accept': 'application/json' }, body: audio });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || data?.Message || 'Azure 发音评测服务暂时不可用。');
  send(res, 200, data);
}

async function transcribeChunk(provider, key, audio, name) {
  if (provider === 'deepseek') throw new Error('DeepSeek 当前不提供本应用所需的音频转写接口。');
  const form = new FormData(); form.append('file', new Blob([audio], { type: 'audio/wav' }), name);
  if (provider === 'zhipu') { form.append('model', 'glm-asr-2512'); form.append('stream', 'false'); }
  else { form.append('model', 'whisper-1'); form.append('response_format', 'verbose_json'); form.append('timestamp_granularities[]', 'segment'); form.append('language', 'en'); }
  const endpoint = provider === 'zhipu' ? 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions';
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form }); const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || '转写服务暂时不可用。'); return data;
}
async function processVideo(id, provider, key) {
  let records = await library(); const record = records.find(x => x.id === id); if (!record) throw new Error('找不到该视频记录。');
  try {
    const file = join(libraryDir, record.fileName); const duration = await durationOf(file); const chunkSeconds = provider === 'zhipu' ? 28 : 55; const subtitles = [];
    for (let start = 0; start < duration; start += chunkSeconds) {
      const length = Math.min(chunkSeconds, duration - start); const data = await transcribeChunk(provider, key, await wavChunk(file, start, length), `segment-${Math.round(start)}.wav`);
      if (provider === 'zhipu') subtitles.push(...splitText(data.text, start, start + length));
      else subtitles.push(...(data.segments || []).map(s => ({ start:start+s.start, end:start+s.end, en:s.text.trim(), zh:'' })));
      records = await library(); const entry = records.find(x => x.id === id); if (!entry) return; entry.status = 'processing'; entry.progress = Math.round(Math.min(99, (start + length) / duration * 100)); entry.duration = duration; await saveLibrary(records);
    }
    records = await library(); const entry = records.find(x => x.id === id); if (!entry) return; Object.assign(entry, { status:'ready', progress:100, duration, subtitles, processedAt:new Date().toISOString(), provider }); await saveLibrary(records);
  } catch (error) { records = await library(); const entry = records.find(x => x.id === id); if (entry) { entry.status = 'error'; entry.error = error instanceof Error ? error.message : '处理失败'; await saveLibrary(records); } }
}

async function translate(req, res) {
  const { provider, key } = credentialsFrom(req);
  const { lines } = JSON.parse((await body(req)).toString('utf8'));
  if (!Array.isArray(lines) || !lines.length) throw new Error('没有可翻译的字幕。');
  const endpoint = provider === 'zhipu' ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions' : provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/responses';
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const prompt = `Translate each English learning subtitle into concise, natural Simplified Chinese. Return ONLY a valid JSON array with exactly ${lines.length} strings in the same order. No markdown and no explanation. English subtitles:\n${JSON.stringify(lines)}`;
      const payload = provider === 'zhipu'
        ? { model: 'glm-5.2', messages: [{ role: 'user', content: prompt }], stream: false, max_tokens: 8192, do_sample: false, reasoning_effort: 'none' }
        : provider === 'deepseek'
          ? { model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], stream: false, max_tokens: 8192, temperature: 0 }
        : { model: 'gpt-4.1-mini', input: prompt };
      const response = await fetchWithRetry(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const responseText = await response.text();
      if (!responseText.trim()) throw new Error('翻译服务返回了空响应。');
      const data = JSON.parse(responseText);
      if (!response.ok) throw new Error(data?.error?.message || '翻译服务暂时不可用。');
      const raw = provider === 'zhipu' || provider === 'deepseek' ? data?.choices?.[0]?.message?.content || '' : data.output_text || '';
      const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').match(/\[[\s\S]*\]/)?.[0] || raw;
      const translations = JSON.parse(json);
      if (!Array.isArray(translations) || translations.length !== lines.length || !translations.every(item => typeof item === 'string')) throw new Error('翻译结果格式异常。');
      return send(res, 200, { translations });
    } catch (error) { lastError = error; if (attempt < 2) await delay(500); }
  }
  throw new Error(['翻译结果格式异常。', '翻译服务返回了空响应。', 'Unexpected end of JSON input'].includes(lastError?.message) ? '翻译服务连续返回不完整内容，请稍后重试。' : lastError?.message || '翻译服务暂时不可用。');
}

async function saveSubtitles(id, req, res) {
  const payload = JSON.parse((await body(req)).toString('utf8'));
  if (!Array.isArray(payload.subtitles)) throw new Error('字幕存档格式不正确。');
  const subtitles = payload.subtitles.map((line) => ({
    start: Number(line?.start),
    end: Number(line?.end),
    en: String(line?.en || '').trim(),
    zh: String(line?.zh || '').trim()
  }));
  if (subtitles.some((line) => !Number.isFinite(line.start) || !Number.isFinite(line.end) || line.end < line.start || !line.en)) {
    throw new Error('字幕存档包含无效内容。');
  }
  const records = await library();
  const record = records.find((item) => item.id === id);
  if (!record) throw new Error('找不到该视频记录。');
  record.subtitles = subtitles;
  record.updatedAt = new Date().toISOString();
  await saveLibrary(records);
  send(res, 200, { subtitles: record.subtitles, updatedAt: record.updatedAt });
}

function mediaExtension(url, contentType) {
  const fromUrl = extname(new URL(url).pathname).toLowerCase();
  if (['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(fromUrl)) return fromUrl;
  if (contentType.includes('webm')) return '.webm';
  if (contentType.includes('ogg')) return '.ogv';
  if (contentType.includes('quicktime')) return '.mov';
  return '.mp4';
}

async function downloadToLibrary(url, title = 'recommended-video') {
  const source = new URL(url);
  if (source.protocol !== 'https:') throw new Error('只能导入 HTTPS 的公开媒体链接。');
  const known = (await library()).find((record) => record.sourceUrl === url);
  if (known) return { ...known, url: mediaUrl(known) };
  const response = await fetch(source, { redirect: 'follow' });
  if (!response.ok) throw new Error('媒体链接暂时无法下载。');
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  const allowedExtension = /\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(response.url);
  if (!type.startsWith('video/') && !allowedExtension) throw new Error('该链接不是可直接导入的视频文件。');
  const limit = 300 * 1024 * 1024;
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > limit) throw new Error('文件超过 300 MB，请选择更短的视频。');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > limit) throw new Error('文件超过 300 MB，请选择更短的视频。');
  const cleanTitle = String(title).replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'weekly-video';
  const fileName = `${new Date().toISOString().slice(0, 10)}-${cleanTitle}-${Date.now()}${mediaExtension(response.url, type)}`;
  await mkdir(libraryDir, { recursive: true });
  await writeFile(join(libraryDir, fileName), buffer);
  const record = { id:randomUUID(), title:String(title).slice(0, 160) || '推荐视频', fileName, sourceUrl:url, importedAt:new Date().toISOString(), status:'imported', progress:0, subtitles:[] };
  const records = await library(); records.unshift(record); await saveLibrary(records);
  return { ...record, url:mediaUrl(record) };
}

async function importToLibrary(req, res) {
  const { url, title = 'recommended-video' } = JSON.parse((await body(req)).toString('utf8'));
  send(res, 200, await downloadToLibrary(url, title));
}

async function importReadyPersonalRecommendations() {
  const data = await personalRecommendations();
  if (!data?.autoImport || !Array.isArray(data.items)) return data || { items: [] };
  let changed = false;
  for (const item of data.items) {
    if (!item?.downloadUrl || item.recordId || item.importError) continue;
    try {
      const record = await downloadToLibrary(item.downloadUrl, item.title);
      item.recordId = record.id; item.importedAt = new Date().toISOString(); delete item.importError; changed = true;
    } catch (error) {
      item.importError = error instanceof Error ? error.message : '自动导入失败'; changed = true;
    }
  }
  if (changed) { await mkdir(userDataDir, { recursive:true }); await writeFile(personalRecommendationsFile, JSON.stringify(data, null, 2)); }
  return data;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true, ffmpeg, ffprobe, dataDir });
    if (req.method === 'GET' && req.url === '/api/library') return send(res, 200, (await library()).map(record => ({ ...record, url: mediaUrl(record) })));
    if (req.method === 'GET' && req.url === '/api/personal-recommendations') return send(res, 200, (await personalRecommendations()) || { items: [] });
    if (req.method === 'POST' && req.url === '/api/personal-recommendations/import-ready') return send(res, 200, await importReadyPersonalRecommendations());
    if (req.method === 'GET' && req.url === '/api/bookmarks') return send(res, 200, { items: await bookmarks() });
    if (req.method === 'POST' && req.url === '/api/bookmarks') { const payload = JSON.parse((await body(req)).toString('utf8')); if (!Array.isArray(payload.items)) throw new Error('收藏数据格式错误。'); await saveBookmarks(payload.items.slice(0, 500)); return send(res, 200, { items: await bookmarks() }); }
    if (req.method === 'POST' && req.url === '/api/library/import') {
      const content = await body(req); if (!content.length) throw new Error('没有收到视频文件。'); if (content.length > 600 * 1024 * 1024) throw new Error('视频超过 600 MB，请先压缩或截取。');
      const original = String(req.headers['x-file-name'] || 'video.mp4').replace(/[^\w.\-]/g, '_'); const extension = extname(original) || '.mp4'; const fileName = `${Date.now()}-${randomUUID()}${extension}`;
      await mkdir(libraryDir, { recursive:true }); await writeFile(join(libraryDir, fileName), content); const record = { id:randomUUID(), title:original.replace(/\.[^.]+$/, ''), fileName, importedAt:new Date().toISOString(), status:'imported', progress:0, subtitles:[] };
      const records = await library(); records.unshift(record); await saveLibrary(records); return send(res, 200, { ...record, url:mediaUrl(record) });
    }
    const processMatch = req.url?.match(/^\/api\/library\/([^/]+)\/process$/);
    if (req.method === 'POST' && processMatch) { const { provider, key } = credentialsFrom(req); const id = decodeURIComponent(processMatch[1]); const records = await library(); const record = records.find(x => x.id === id); if (!record) throw new Error('找不到该视频记录。'); if (record.status === 'processing') return send(res, 200, { status:'processing' }); record.status = 'processing'; record.progress = 0; record.error = null; await saveLibrary(records); void processVideo(id, provider, key); return send(res, 202, { status:'processing' }); }
    const subtitlesMatch = req.url?.match(/^\/api\/library\/([^/]+)\/subtitles$/);
    if (req.method === 'POST' && subtitlesMatch) return await saveSubtitles(decodeURIComponent(subtitlesMatch[1]), req, res);
    if (req.method === 'POST' && req.url === '/api/transcribe') return await transcribe(req, res);
    if (req.method === 'POST' && req.url === '/api/pronunciation-assessment') return await assessPronunciation(req, res);
    if (req.method === 'POST' && req.url === '/api/translate') return await translate(req, res);
    if (req.method === 'POST' && req.url === '/api/library-import') return await importToLibrary(req, res);
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    if (req.url.startsWith('/library/')) {
      const requested = decodeURIComponent(req.url.split('?')[0]).replace(/^\/library\//, '');
      const file = normalize(join(libraryDir, requested));
      if (!file.startsWith(libraryDir)) return send(res, 403, 'Forbidden', 'text/plain');
      return await sendMedia(req, res, file);
    }
    const requested = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
    const file = normalize(join(publicDir, requested));
    if (!file.startsWith(publicDir)) return send(res, 403, 'Forbidden', 'text/plain');
    const content = await readFile(file);
    send(res, 200, content.toString(), mime[extname(file)] || 'application/octet-stream');
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : '请求失败。' });
  }
});

export function startSpeakLoopServer(port = Number(process.env.PORT || 4173), host = '127.0.0.1') {
  return new Promise((resolveStart, rejectStart) => {
    const onError = (error) => { server.off('listening', onListening); rejectStart(error); };
    const onListening = () => {
      server.off('error', onError);
      const address = server.address();
      const activePort = typeof address === 'object' && address ? address.port : port;
      console.log(`SpeakLoop 已启动：http://localhost:${activePort}`);
      resolveStart({ server, port: activePort, host });
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

const launchedFromTerminal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (launchedFromTerminal) startSpeakLoopServer().catch((error) => { console.error(error); process.exitCode = 1; });

