const $ = (id) => document.getElementById(id);
const video = $('video');
let subtitles = [];
let current = 0;
let loopEnabled = false;
let recorder;
let recordedBlob;
let recordingStart;
let recordingTimer;
let objectUrl;
let currentRecord = null;
let dictationMode = false;
let revealMode = false;
let revealStage = 0;
let seekingVideo = false;
let abStart = null;
let abEnd = null;
let recordedForSentence = '';
let comparisonPlaying = false;
let comparisonStopper = null;
let subtitleSaveTimer;

const store = {
  get bookmarks() { return JSON.parse(localStorage.getItem('speakloop-bookmarks') || '[]'); },
  toggleBookmark(item) { const list = this.bookmarks; const index = list.findIndex((x) => bookmarkMatches(x, item)); index >= 0 ? list.splice(index, 1) : list.unshift(item); localStorage.setItem('speakloop-bookmarks', JSON.stringify(list)); void syncBookmarks(list); return index < 0; }
};

function provider() { return sessionStorage.getItem('speakloop-ai-provider') || 'openai'; }
async function syncBookmarks(items) { try { await fetch('/api/bookmarks', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ items }) }); } catch { /* 收藏会继续保留在当前浏览器，待本机服务恢复后可再次修改同步。 */ } }
async function loadBookmarks() { const local = store.bookmarks; try { const remote = await getJson(await fetch('/api/bookmarks', { cache:'no-store' })); const items = Array.isArray(remote.items) ? remote.items : []; if (items.length) localStorage.setItem('speakloop-bookmarks', JSON.stringify(items)); else if (local.length) await syncBookmarks(local); } catch { /* 本地缓存仍可用于离线收藏。 */ } if (localStorage.getItem('speakloop-page') === 'bookmarks') renderBookmarks(); updateCurrent(); }
function key() { return sessionStorage.getItem(`speakloop-${provider()}-key`) || ''; }
function hasKey() { return Boolean(key()); }
function providerLabel() { return provider() === 'zhipu' ? '智谱 AI' : provider() === 'deepseek' ? 'DeepSeek' : 'OpenAI'; }
function azureKey() { return sessionStorage.getItem('speakloop-azure-speech-key') || ''; }
function azureRegion() { return sessionStorage.getItem('speakloop-azure-speech-region') || ''; }
function pronunciationLocale() { return sessionStorage.getItem('speakloop-pronunciation-locale') || 'en-GB'; }
function hasPronunciationAssessment() { return Boolean(azureKey() && azureRegion()); }
function updateProviderUi() {
  const isZhipu = provider() === 'zhipu';
  const isDeepSeek = provider() === 'deepseek';
  $('providerSelect').value = provider();
  $('apiKeyLabel').firstChild.textContent = isZhipu ? '智谱 AI API Key' : isDeepSeek ? 'DeepSeek API Key' : 'OpenAI API Key';
  $('apiKeyInput').placeholder = isZhipu ? '输入智谱 API Key' : isDeepSeek ? '输入 DeepSeek API Key' : 'sk-...';
  $('providerHint').textContent = isZhipu
    ? '智谱转写会在浏览器中将音频转换为 WAV；单段上限 30 秒、25 MB。适合逐句录音与短片段。'
    : isDeepSeek ? 'DeepSeek 仅用于中文翻译；视频自动转写请切换至 OpenAI 或智谱 AI。'
    : '用于自动英文转写和中文翻译，不用于专业发音打分。';
  $('modePill').textContent = hasPronunciationAssessment() ? '高精度评测已启用' : hasKey() ? `${providerLabel()} 增强模式` : '离线基础模式';
}
const themePreference = () => localStorage.getItem('speakloop-theme') || 'system';
function applyTheme(choice = themePreference()) {
  const resolved = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  document.documentElement.dataset.theme = resolved;
  document.querySelectorAll('[data-theme-choice]').forEach((button) => button.classList.toggle('selected', button.dataset.themeChoice === choice));
}
function showPage(page = 'practice') {
  const target = ['library', 'bookmarks'].includes(page) ? page : 'practice';
  const practicePage = $('practicePage');
  const libraryPage = $('libraryPage');
  const bookmarksPage = $('bookmarksPage');
  const isLibrary = target === 'library';
  const isBookmarks = target === 'bookmarks';

  // Keep the native hidden state and an explicit display value in sync. This
  // prevents an old browser style/cache state from leaving the library blank.
  practicePage.hidden = target !== 'practice';
  libraryPage.hidden = !isLibrary;
  bookmarksPage.hidden = !isBookmarks;
  practicePage.style.display = target === 'practice' ? '' : 'none';
  libraryPage.style.display = isLibrary ? 'block' : 'none';
  bookmarksPage.style.display = isBookmarks ? 'block' : 'none';
  document.querySelectorAll('[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === target));
  localStorage.setItem('speakloop-page', target);

  if (isLibrary) {
    refreshLibrary().catch(() => {
      $('libraryHistoryList').innerHTML = '<p class="hint">暂时无法读取本地记录，请刷新后重试。</p>';
    });
    loadPersonalPicks();
  }
  if (isBookmarks) renderBookmarks();
}
function formatTime(seconds) { const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function normalize(text) { return text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean); }
function wordDiff(expected, actual) { const rows = expected.length + 1; const cols = actual.length + 1; const table = Array.from({length:rows}, () => Array(cols).fill(0)); for (let i = 1; i < rows; i += 1) for (let j = 1; j < cols; j += 1) table[i][j] = expected[i - 1] === actual[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]); const result = []; let i = expected.length; let j = actual.length; while (i || j) { if (i && j && expected[i - 1] === actual[j - 1]) { result.unshift({word:expected[i - 1], state:'correct'}); i -= 1; j -= 1; } else if (j && (!i || table[i][j - 1] >= table[i - 1][j])) { result.unshift({word:actual[j - 1], state:'extra'}); j -= 1; } else { result.unshift({word:expected[i - 1], state:'missing'}); i -= 1; } } return result; }
function contentWords(text) { const stop = new Set(['a','an','the','and','or','but','to','of','in','on','at','for','with','is','are','was','were','be','been','it','this','that','we','you','i','they','he','she','as','if','so','not','do','does','did','have','has','had']); return normalize(text).filter(word => !stop.has(word) && word.length > 2); }
function escapeHtml(value) { return value.replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]); }
function fitSubtitleTextarea(textarea) { textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight}px`; }
async function importRecommendedVideo(item, button) {
  const original = button.textContent; button.textContent = '导入中…'; button.disabled = true;
  try {
    const response = await fetch('/api/library-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: item.downloadUrl, title: item.title }) });
    const record = await getJson(response); await refreshLibrary(); openLibraryRecord(record); button.textContent = '已导入';
  } catch (error) { alert(error.message || '导入失败。'); button.textContent = original; button.disabled = false; }
}
function recommendationProfile() { try { return { autoImport:false, ...JSON.parse(localStorage.getItem('speakloop-recommendation-profile') || '{"accent":"英国英语 / 接近标准英音","topics":"IELTS 常见口语话题、表达与发音","duration":"5–20 分钟","count":"5"}') }; } catch { return { accent:'英国英语 / 接近标准英音', topics:'IELTS 常见口语话题、表达与发音', duration:'5–20 分钟', count:'5', autoImport:false }; } }
function recommendationTaskPrompt(profile = recommendationProfile()) { return `请每周执行一次，为我的 IELTS 英语口语练习寻找 ${profile.count} 条高质量视频推荐。偏好：${profile.accent}；主题：${profile.topics}；时长：${profile.duration}。优先公开来源、自然口语、无内嵌字幕或可关闭字幕的视频；核验每条 URL 可打开。${profile.autoImport ? '已启用自动导入：只提供已核验、可合法直接下载的 MP4/WebM URL；无法核验时不要提供 downloadUrl。' : '未启用自动导入：只需提供公开视频页面 URL。'}\n\n将结果写入当前 SpeakLoop 项目的 user-data/recommendations.json（没有目录请创建）。严格使用以下 JSON 格式，不要写 Markdown：\n{\n  "updatedAt": "YYYY-MM-DD",\n  "autoImport": ${Boolean(profile.autoImport)},\n  "note": "一句推荐说明",\n  "items": [\n    {\n      "title": "视频标题",\n      "accent": "口音",\n      "length": "时长",\n      "why": "适合练习的原因",\n      "url": "公开视频页面 URL",\n      "downloadUrl": "可选：直接 MP4/WebM URL，仅在确认可合法直接导入时提供"\n    }\n  ]\n}\n\n不要下载或保存视频文件；只更新 JSON。开启自动导入后，应用会在本机资源页读取 JSON 并导入已核验的直链视频。完成后简要报告本次更新。`; }
function renderPersonalPicks(data) { const items = Array.isArray(data?.items) ? data.items : []; $('personalPicksMeta').textContent = items.length ? `${data.updatedAt || '最近更新'} · ${data.note || '来自你的 Codex 定时任务'}${data.autoImport ? ' · 自动导入已开启' : ''}` : '在 Codex 设置自己的定时推荐任务后，清单会显示在这里。'; const list = $('personalPicksList'); list.innerHTML = items.length ? items.map((item, index) => `<article class="weekly-pick"><span>${String(index + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(String(item.title || '未命名推荐'))}</h3><p>${escapeHtml(String(item.accent || '英语口语'))} · ${escapeHtml(String(item.length || '时长待核验'))} · ${escapeHtml(String(item.why || '来自你的定制规则'))}</p>${item.importedAt ? '<em class="availability ready">已导入本机</em>' : item.importError ? `<em class="availability">导入失败：${escapeHtml(String(item.importError))}</em>` : ''}</div><div class="pick-actions"><a class="source-link" href="${escapeHtml(String(item.url || '#'))}" target="_blank" rel="noopener">打开视频 ↗</a>${item.downloadUrl && !item.recordId ? `<button class="primary compact personal-import" data-index="${index}">导入到库</button>` : ''}</div></article>`).join('') : '<p class="hint">还没有个人推荐。点击“推荐设置”生成 Codex 定时任务提示词。</p>'; list.querySelectorAll('.personal-import').forEach((button) => button.onclick = () => importRecommendedVideo(items[Number(button.dataset.index)], button)); }
async function loadPersonalPicks() { try { let data = await getJson(await fetch('/api/personal-recommendations', { cache:'no-store' })); if (data.autoImport) { data = await getJson(await fetch('/api/personal-recommendations/import-ready', { method:'POST' })); refreshLibrary().catch(() => {}); } renderPersonalPicks(data); } catch { renderPersonalPicks({ items: [] }); } }

function renderSubtitles() {
  const list = $('subtitleList'); list.innerHTML = '';
  if (!subtitles.length) { list.innerHTML = '<p class="hint" style="padding:18px 4px">导入视频后，配置自己的 API Key 并点击“AI 自动转写”；生成的中英文都可以直接修改。</p>'; updateCurrent(); return; }
  const tpl = $('subtitleTemplate');
  subtitles.forEach((line, index) => { const node = tpl.content.cloneNode(true); const article = node.querySelector('article'); const time = node.querySelector('.subtitle-time'); const en = node.querySelector('.english'); const zh = node.querySelector('.chinese'); const locked = !video.paused && index !== current; time.textContent = formatTime(line.start); time.disabled = locked; time.title = locked ? '请暂停视频后再切换练习句' : '选择这一句进行跟读'; time.onclick = () => selectPracticeSentence(index); en.value = line.en; zh.value = line.zh || ''; en.oninput = () => { line.en = en.value; fitSubtitleTextarea(en); updateCurrent(); scheduleSubtitleSave(); }; zh.oninput = () => { line.zh = zh.value; fitSubtitleTextarea(zh); updateCurrent(); scheduleSubtitleSave(); }; en.onblur = () => { void saveCurrentSubtitles().catch(() => {}); }; zh.onblur = () => { void saveCurrentSubtitles().catch(() => {}); }; if (index === current) article.classList.add('active'); if (locked) article.classList.add('locked'); list.append(node); fitSubtitleTextarea(en); fitSubtitleTextarea(zh); }); updateCurrent();
}
function selectSentence(index, seek = false) { if (!subtitles.length) return; current = Math.max(0, Math.min(index, subtitles.length - 1)); if (seek && video.src) video.currentTime = subtitles[current].start; renderSubtitles(); }
function selectPracticeSentence(index) { if (!video.paused && index !== current) return; current = Math.max(0, Math.min(index, subtitles.length - 1)); renderSubtitles(); }
function bookmarkMatches(saved, item) { return saved.recordId && item.recordId ? saved.recordId === item.recordId && Number(saved.start) === Number(item.start) : saved.en === item.en; }
function bookmarkFromLine(line) { return { en:line.en, zh:line.zh || '', start:line.start, end:line.end, recordId:currentRecord?.id || '', title:currentRecord?.title || '未命名视频', savedAt:new Date().toISOString() }; }
function updateCurrent() { const line = subtitles[current]; const valid = Boolean(line); $('targetEnglish').textContent = valid ? line.en : '先导入视频，再自动生成字幕。'; $('targetChinese').textContent = valid ? (line.zh || '尚未翻译，可点击“翻译中文”。') : '你可以先在 API 设置中接入自己的 Key。'; $('sentenceTime').textContent = valid ? `${formatTime(line.start)} – ${formatTime(line.end)}` : '00:00 – 00:00'; $('bookmarkButton').textContent = valid && store.bookmarks.some((x) => bookmarkMatches(x, bookmarkFromLine(line))) ? '★' : '☆'; updateComparisonPanel(); }
function activeLine() { return subtitles[current]; }
function updateTimeline(time = video.currentTime) { const duration = Number.isFinite(video.duration) ? video.duration : 0; $('seekBar').max = String(duration); if (!seekingVideo) $('seekBar').value = String(Math.min(time || 0, duration)); $('timelineLabel').textContent = `${formatTime(time || 0)} / ${formatTime(duration)}`; }
function seekTo(time, autoplay = false) { const perform = () => { const duration = Number.isFinite(video.duration) ? video.duration : 0; const target = Math.max(0, Math.min(Number(time) || 0, duration || Number(time) || 0)); const resume = () => { updateTimeline(target); if (autoplay) video.play().catch(() => {}); }; if (Math.abs(video.currentTime - target) < .05) return resume(); video.addEventListener('seeked', resume, { once:true }); video.currentTime = target; }; if (video.readyState < 1) video.addEventListener('loadedmetadata', perform, { once:true }); else perform(); }
function playSentence() { stopComparison(); const line = activeLine(); if (!line || !video.src) return alert('请先等待字幕处理完成，再播放或循环本句。'); seekTo(line.start, true); }
function wavFromAudioBuffer(audioBuffer, targetRate = audioBuffer.sampleRate) {
  const source = audioBuffer.getChannelData(0); const length = Math.max(1, Math.round(source.length * targetRate / audioBuffer.sampleRate)); const buffer = new ArrayBuffer(44 + length * 2); const view = new DataView(buffer); const write = (offset, value) => view.setUint32(offset, value, true);
  [82,73,70,70].forEach((v,i) => view.setUint8(i,v)); write(4, 36 + length * 2); [87,65,86,69,102,109,116,32].forEach((v,i) => view.setUint8(8+i,v)); write(16,16); view.setUint16(20,1,true); view.setUint16(22,1,true); write(24,targetRate); write(28,targetRate*2); view.setUint16(32,2,true); view.setUint16(34,16,true); [100,97,116,97].forEach((v,i) => view.setUint8(36+i,v)); write(40,length*2);
  for (let index = 0; index < length; index += 1) { const position = index * audioBuffer.sampleRate / targetRate; const before = Math.floor(position); const after = Math.min(source.length - 1, before + 1); const sample = source[before] + (source[after] - source[before]) * (position - before); view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true); }
  return new Blob([buffer], { type: 'audio/wav' });
}
async function prepareAssessmentFile(file) {
  const context = new AudioContext();
  try { const audio = await context.decodeAudioData(await file.arrayBuffer()); const wav = wavFromAudioBuffer(audio, 16000); return new File([wav], 'practice-16k.wav', { type:'audio/wav' }); }
  catch (error) { throw new Error(`录音转换失败：${error instanceof Error ? error.message : '请重试。'}`); }
  finally { await context.close(); }
}
async function assessWithAzure(target) {
  const prepared = await prepareAssessmentFile(recordedBlob);
  const response = await fetch('/api/pronunciation-assessment', { method:'POST', headers:{ 'x-azure-speech-key':azureKey(), 'x-azure-speech-region':azureRegion(), 'x-pronunciation-language':pronunciationLocale(), 'x-reference-text':target.en }, body:prepared });
  return getJson(response);
}
async function getJson(response) { const data = await response.json(); if (!response.ok) throw new Error(data.error || '请求失败。'); return data; }
function segmentsFromText(text, duration) { const sentences = String(text || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || []; const slice = Math.max(1, (Number.isFinite(duration) ? duration : sentences.length * 5) / Math.max(1, sentences.length)); return sentences.map((en, index) => ({ start:index * slice, end:(index + 1) * slice, en, zh:'' })); }

async function refreshLibrary() { const response = await fetch('/api/library', { cache:'no-store' }); const records = await getJson(response); const list = $('libraryHistoryList'); list.innerHTML = records.length ? records.map(record => `<button class="library-record" data-id="${record.id}"><b>${escapeHtml(record.title)}</b><span class="${record.status === 'ready' ? 'ready' : ''}">${record.status === 'ready' ? '字幕已就绪' : record.status === 'processing' ? `正在处理 ${record.progress || 0}%` : record.status === 'error' ? '处理失败' : '已导入，等待处理'}</span></button>`).join('') : '<p class="hint">导入的视频会自动出现在这里。</p>'; list.querySelectorAll('[data-id]').forEach(button => button.onclick = () => openLibraryRecord(records.find(record => record.id === button.dataset.id))); return records; }
function openLibraryRecord(record) { if (!record) return; currentRecord = record; video.src = record.url; video.load(); $('emptyVideo').hidden = true; subtitles = record.subtitles || []; current = 0; renderSubtitles(); showPage('practice'); if (record.status === 'processing') pollRecord(record.id); }
function renderBookmarks() { const items = store.bookmarks; $('bookmarksMeta').textContent = items.length ? `共 ${items.length} 句 · 点击“继续练习”可回到原视频对应位置。` : '把值得反复模仿的句子收集在这里。'; const list = $('bookmarksList'); list.innerHTML = items.length ? items.map((item, index) => `<article class="bookmark-card"><div><p class="bookmark-source">${escapeHtml(item.title || '早期收藏')}</p><h3>${escapeHtml(item.en || '未保存英文内容')}</h3><p class="bookmark-translation">${escapeHtml(item.zh || '暂无中文翻译')}</p><small>${formatTime(Number(item.start) || 0)} · ${item.savedAt ? new Date(item.savedAt).toLocaleDateString('zh-CN') : '已收藏'}</small></div><div class="bookmark-actions">${item.recordId ? `<button class="primary compact resume-bookmark" data-index="${index}">继续练习</button>` : ''}<button class="ghost compact remove-bookmark" data-index="${index}">移除</button></div></article>`).join('') : '<p class="hint">还没有收藏句子。练习时点击右上角的 ☆，它就会出现在这里。</p>'; list.querySelectorAll('.resume-bookmark').forEach((button) => button.onclick = () => resumeBookmark(items[Number(button.dataset.index)])); list.querySelectorAll('.remove-bookmark').forEach((button) => button.onclick = () => { store.toggleBookmark(items[Number(button.dataset.index)]); renderBookmarks(); updateCurrent(); }); }
async function resumeBookmark(item) { try { const records = await refreshLibrary(); const record = records.find((entry) => entry.id === item.recordId); if (!record) throw new Error('原视频已不在本机资源库中。'); openLibraryRecord(record); const index = subtitles.findIndex((line) => Number(line.start) === Number(item.start) && line.en === item.en); current = index >= 0 ? index : 0; renderSubtitles(); seekTo(subtitles[current]?.start || 0, false); } catch (error) { alert(error.message || '无法打开这条收藏。'); } }
async function archiveVideo(file) { const response = await fetch('/api/library/import', { method:'POST', headers:{'x-file-name':file.name,'x-file-type':file.type}, body:file }); return getJson(response); }
async function processCurrentVideo() { if (!currentRecord || !hasKey()) return; if (provider() === 'deepseek') return alert('DeepSeek 当前只用于中文翻译。请切换到 OpenAI 或智谱 AI 后再自动转写视频。'); const button = $('generateButton'); button.disabled = true; button.textContent = '正在准备…'; try { await getJson(await fetch(`/api/library/${encodeURIComponent(currentRecord.id)}/process`, { method:'POST', headers:{'x-ai-provider':provider(),'x-ai-key':key()} })); pollRecord(currentRecord.id); } catch (error) { alert(error.message); button.disabled = false; button.textContent = 'AI 自动转写'; } }
async function pollRecord(id) { const button = $('generateButton'); const timer = setInterval(async () => { try { const records = await refreshLibrary(); const record = records.find(item => item.id === id); if (!record) return clearInterval(timer); currentRecord = record; if (record.status === 'processing') { button.textContent = `处理中 ${record.progress || 0}%`; return; } clearInterval(timer); button.disabled = false; button.textContent = 'AI 自动转写'; if (record.status === 'ready') { subtitles = record.subtitles || []; current = 0; renderSubtitles(); } else if (record.status === 'error') alert(`字幕处理失败：${record.error || '请重试'}`); } catch { clearInterval(timer); button.disabled = false; button.textContent = 'AI 自动转写'; } }, 1500); }
$('videoInput').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = URL.createObjectURL(file); video.src = objectUrl; video.load(); $('emptyVideo').hidden = true; $('dropZone').classList.remove('empty'); try { currentRecord = await archiveVideo(file); await refreshLibrary(); if (hasKey() && provider() !== 'deepseek') processCurrentVideo(); } catch (error) { alert(`视频可临时播放，但存档失败：${error.message}`); } });
$('dropZone').addEventListener('dragover', (e) => e.preventDefault());
$('dropZone').addEventListener('drop', (e) => { e.preventDefault(); const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('video/')); if (file) { const transfer = new DataTransfer(); transfer.items.add(file); $('videoInput').files = transfer.files; $('videoInput').dispatchEvent(new Event('change')); } });
$('speedSelect').onchange = (e) => { video.playbackRate = Number(e.target.value); };
$('seekBar').oninput = (event) => { seekingVideo = true; const time = Number(event.target.value); $('timelineLabel').textContent = `${formatTime(time)} / ${formatTime(video.duration || 0)}`; };
$('seekBar').onchange = (event) => { seekingVideo = false; video.currentTime = Number(event.target.value); syncSubtitleToVideo(); updateTimeline(); };
$('setAButton').onclick = () => { if (!video.src) return alert('请先导入视频。'); abStart = video.currentTime; abEnd = null; $('setBButton').disabled = false; $('clearABButton').disabled = false; $('abLoopStatus').textContent = `A 点：${formatTime(abStart)}，请定位后设 B 点`; };
$('setBButton').onclick = () => { if (abStart == null) return; const candidate = video.currentTime; const length = candidate - abStart; if (length < 2 || length > 8) return alert('A–B 片段需在 2 到 8 秒之间。请重新定位 B 点。'); abEnd = candidate; loopEnabled = false; $('loopButton').classList.remove('active'); $('abLoopStatus').textContent = `循环 ${formatTime(abStart)} – ${formatTime(abEnd)}（${length.toFixed(1)} 秒）`; $('setAButton').textContent = '重设 A 点'; $('setBButton').disabled = true; seekTo(abStart, true); };
$('clearABButton').onclick = () => { abStart = null; abEnd = null; $('setAButton').textContent = '设 A 点'; $('setBButton').disabled = true; $('clearABButton').disabled = true; $('abLoopStatus').textContent = '选择 2–8 秒片段'; };
$('playSentenceButton').onclick = playSentence;
$('previousButton').onclick = () => selectSentence(current - 1, true);
$('nextButton').onclick = () => selectSentence(current + 1, true);
$('loopButton').onclick = () => { loopEnabled = !loopEnabled; $('loopButton').classList.toggle('active', loopEnabled); };
$('subtitleToggle').onclick = () => { const hidden = $('subtitleList').hidden = !$('subtitleList').hidden; $('subtitleToggle').textContent = hidden ? '显示字幕' : '隐藏字幕'; $('subtitleToggle').classList.toggle('active', !hidden); };
$('dictationModeButton').onclick = () => { if (!subtitles.length) return alert('请先生成英文字幕，再开始听写。'); dictationMode = !dictationMode; if (dictationMode && revealMode) { revealMode = false; $('revealPanel').hidden = true; $('revealModeButton').classList.remove('active'); $('revealModeButton').textContent = '逐层揭晓'; } $('dictationModeButton').classList.toggle('active', dictationMode); $('dictationModeButton').textContent = dictationMode ? '退出听写' : '听写模式'; $('dictationPanel').hidden = !dictationMode; $('targetEnglish').hidden = dictationMode; $('targetChinese').hidden = dictationMode; $('subtitleList').hidden = dictationMode; $('subtitleToggle').textContent = dictationMode ? '显示字幕' : '显示字幕'; $('subtitleToggle').classList.toggle('active', !dictationMode); if (dictationMode) { $('dictationInput').value = ''; $('dictationResult').innerHTML = ''; $('dictationInput').focus(); } else { $('subtitleList').hidden = false; } };
$('revealModeButton').onclick = () => { if (!subtitles.length) return alert('请先生成英文字幕，再开始逐层揭晓。'); revealMode = !revealMode; if (revealMode && dictationMode) { dictationMode = false; $('dictationPanel').hidden = true; $('dictationModeButton').classList.remove('active'); $('dictationModeButton').textContent = '听写模式'; } $('revealModeButton').classList.toggle('active', revealMode); $('revealModeButton').textContent = revealMode ? '退出揭晓' : '逐层揭晓'; $('revealPanel').hidden = !revealMode; $('targetEnglish').hidden = revealMode; $('targetChinese').hidden = revealMode; $('subtitleList').hidden = revealMode; if (revealMode) { revealStage = 0; $('revealHint').textContent = '先只听，不看任何文字提示。'; $('revealContent').textContent = '准备好后，点击下方按钮获取第一层提示。'; $('nextRevealButton').textContent = '揭晓首词'; } else { $('subtitleList').hidden = false; } };
$('replayDictationButton').onclick = playSentence;
$('replayRevealButton').onclick = playSentence;
$('nextRevealButton').onclick = () => { const line = activeLine(); if (!line) return; revealStage += 1; const words = normalize(line.en); const stages = [null, { title:'首词提示', text: words[0] || '—', button:'揭晓关键词' }, { title:'关键词提示', text: contentWords(line.en).join(' · ') || words.slice(0, 3).join(' · '), button:'揭晓完整英文' }, { title:'完整英文', text: line.en, button:'揭晓中文' }, { title:'中文含义', text: line.zh || '这句还没有中文翻译，可退出后点击“翻译中文”。', button:'已全部揭晓' }]; const stage = stages[Math.min(revealStage, 4)]; $('revealHint').textContent = stage.title; $('revealContent').textContent = stage.text; $('nextRevealButton').textContent = stage.button; $('nextRevealButton').disabled = revealStage >= 4; };
$('revealDictationButton').onclick = () => { const line = activeLine(); if (!line) return; const expected = normalize(line.en); const actual = normalize($('dictationInput').value); if (!actual.length) return alert('先输入你听到的英文，再揭晓对照。'); const diff = wordDiff(expected, actual); const correct = diff.filter(item => item.state === 'correct').length; $('dictationResult').innerHTML = `<p><b>逐词对照 · ${correct}/${expected.length} 词正确</b></p><div>${diff.map(item => `<span class="${item.state}">${escapeHtml(item.word)}</span>`).join(' ')}</div><p class="hint">绿色＝听对，红色＝漏写，灰色＝多写。原句：${escapeHtml(line.en)}</p>`; };
function syncSubtitleToVideo() { if (comparisonPlaying) return; const index = subtitles.findIndex((s) => video.currentTime >= s.start && video.currentTime < s.end); if (index !== -1 && index !== current) { current = index; renderSubtitles(); } }
video.addEventListener('loadedmetadata', () => updateTimeline(0));
video.addEventListener('play', syncSubtitleToVideo);
video.addEventListener('pause', renderSubtitles);
video.addEventListener('seeked', () => { seekingVideo = false; syncSubtitleToVideo(); updateTimeline(); });
video.addEventListener('timeupdate', () => { updateTimeline(); syncSubtitleToVideo(); if (abStart != null && abEnd != null && video.currentTime >= abEnd) return seekTo(abStart, true); const line = activeLine(); if (loopEnabled && line && video.currentTime >= line.end) { seekTo(line.start, true); } });

$('settingsButton').onclick = () => { const menu = $('appearanceMenu'); const visible = menu.hidden; menu.hidden = !visible; $('settingsButton').setAttribute('aria-expanded', String(visible)); };
document.querySelector('[data-page="practice"]').onclick = () => showPage('practice');
document.querySelector('[data-page="library"]').onclick = () => showPage('library');
document.querySelector('[data-page="bookmarks"]').onclick = () => showPage('bookmarks');
$('apiSettingsButton').onclick = () => { $('appearanceMenu').hidden = true; $('settingsButton').setAttribute('aria-expanded', 'false'); updateProviderUi(); $('apiKeyInput').value = key(); $('azureSpeechKeyInput').value = azureKey(); $('azureSpeechRegionInput').value = azureRegion(); $('pronunciationLocaleSelect').value = pronunciationLocale(); $('settingsDialog').showModal(); };
function syncRecommendationDialog() { const profile = recommendationProfile(); $('recommendationAccent').value = profile.accent; $('recommendationTopics').value = profile.topics; $('recommendationDuration').value = profile.duration; $('recommendationCount').value = profile.count; $('recommendationAutoImport').checked = Boolean(profile.autoImport); $('recommendationPrompt').value = recommendationTaskPrompt(profile); }
function persistRecommendationProfile() { const profile = { accent:$('recommendationAccent').value, topics:$('recommendationTopics').value.trim() || 'IELTS 常见口语话题、表达与发音', duration:$('recommendationDuration').value, count:$('recommendationCount').value, autoImport:$('recommendationAutoImport').checked }; localStorage.setItem('speakloop-recommendation-profile', JSON.stringify(profile)); $('recommendationPrompt').value = recommendationTaskPrompt(profile); }
$('recommendationSettingsButton').onclick = () => { syncRecommendationDialog(); $('recommendationDialog').showModal(); };
['recommendationAccent', 'recommendationTopics', 'recommendationDuration', 'recommendationCount', 'recommendationAutoImport'].forEach((id) => { $(id).oninput = persistRecommendationProfile; $(id).onchange = persistRecommendationProfile; });
$('copyRecommendationPrompt').onclick = async () => { persistRecommendationProfile(); const button = $('copyRecommendationPrompt'); try { await navigator.clipboard.writeText($('recommendationPrompt').value); button.textContent = '已复制'; } catch { $('recommendationPrompt').focus(); $('recommendationPrompt').select(); document.execCommand('copy'); button.textContent = '已复制'; } window.setTimeout(() => { button.textContent = '复制提示词'; }, 1300); };
document.querySelectorAll('[data-theme-choice]').forEach((button) => button.onclick = () => { localStorage.setItem('speakloop-theme', button.dataset.themeChoice); applyTheme(button.dataset.themeChoice); $('appearanceMenu').hidden = true; $('settingsButton').setAttribute('aria-expanded', 'false'); });
$('providerSelect').onchange = (event) => { sessionStorage.setItem('speakloop-ai-provider', event.target.value); updateProviderUi(); $('apiKeyInput').value = key(); };
$('saveKeyButton').onclick = () => { const value = $('apiKeyInput').value.trim(); const currentProvider = provider(); if (value) sessionStorage.setItem(`speakloop-${currentProvider}-key`, value); else sessionStorage.removeItem(`speakloop-${currentProvider}-key`); const speechKey = $('azureSpeechKeyInput').value.trim(); const speechRegion = $('azureSpeechRegionInput').value.trim(); if (speechKey) sessionStorage.setItem('speakloop-azure-speech-key', speechKey); else sessionStorage.removeItem('speakloop-azure-speech-key'); if (speechRegion) sessionStorage.setItem('speakloop-azure-speech-region', speechRegion); else sessionStorage.removeItem('speakloop-azure-speech-region'); sessionStorage.setItem('speakloop-pronunciation-locale', $('pronunciationLocaleSelect').value); updateProviderUi(); };
$('generateButton').onclick = () => { if (!currentRecord) return alert('请先导入视频。'); if (!hasKey()) return $('apiSettingsButton').click(); processCurrentVideo(); };
async function translateLines(lines) { const response = await fetch('/api/translate', { method:'POST', headers:{'Content-Type':'application/json','x-ai-provider':provider(),'x-ai-key':key()}, body:JSON.stringify({lines}) }); return (await getJson(response)).translations; }
async function saveCurrentSubtitles() {
  if (!currentRecord?.id) return;
  return saveSubtitlesForRecord(currentRecord.id, subtitles);
}
async function saveSubtitlesForRecord(recordId, lines) {
  const response = await fetch(`/api/library/${encodeURIComponent(recordId)}/subtitles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtitles: lines })
  });
  const saved = await getJson(response);
  if (currentRecord?.id === recordId) currentRecord = { ...currentRecord, subtitles: saved.subtitles, updatedAt: saved.updatedAt };
  return saved;
}
function scheduleSubtitleSave() { if (!currentRecord?.id) return; const recordId = currentRecord.id; const snapshot = subtitles.map((line) => ({ ...line })); clearTimeout(subtitleSaveTimer); subtitleSaveTimer = window.setTimeout(() => { saveSubtitlesForRecord(recordId, snapshot).catch(() => {}); }, 700); }
$('translateButton').onclick = async () => { if (!subtitles.length) return alert('请先生成英文字幕。'); if (!hasKey()) return $('apiSettingsButton').click(); const button = $('translateButton'); const pending = subtitles.map((line, index) => ({ line, index })).filter(({ line }) => !line.zh?.trim()); const batchSize = 24; if (!pending.length) return alert('当前字幕已全部翻译。'); button.disabled = true; try { for (let start = 0; start < pending.length; start += batchSize) { const batch = pending.slice(start, start + batchSize); button.textContent = `翻译 ${start + batch.length}/${pending.length}`; let translations; try { translations = await translateLines(batch.map(({ line }) => line.en)); } catch (batchError) { button.textContent = `第 ${start + 1}–${start + batch.length} 句分开重试…`; translations = []; for (const { line } of batch) { translations.push(...await translateLines([line.en])); } } translations.forEach((translation, index) => { batch[index].line.zh = translation; }); await saveCurrentSubtitles(); renderSubtitles(); } } catch (e) { alert(e.message); } finally { button.textContent = '翻译中文'; button.disabled = false; } };
$('bookmarkButton').onclick = () => { const line = activeLine(); if (!line) return; const isSaved = store.toggleBookmark(bookmarkFromLine(line)); $('bookmarkButton').textContent = isSaved ? '★' : '☆'; };

function updateComparisonPanel() {
  const matchesCurrentSentence = Boolean(recordedBlob && recordedForSentence && recordedForSentence === activeLine()?.en);
  if (!matchesCurrentSentence) {
    if (comparisonPlaying) stopComparison();
    $('comparisonPanel').hidden = true;
    return;
  }
  $('comparisonPanel').hidden = false;
  if (!comparisonPlaying) $('comparisonStatus').textContent = '先听原声，再自动播放你的录音。重点对照停顿、重音和节奏。';
}
function stopComparison(message = '已停止 A/B 对比。') {
  comparisonPlaying = false;
  if (comparisonStopper) video.removeEventListener('timeupdate', comparisonStopper);
  comparisonStopper = null;
  $('recordingPlayback').pause();
  $('abCompareButton').textContent = '原声 → 我的录音';
  $('abCompareButton').classList.remove('active');
  if (!$('comparisonPanel').hidden) $('comparisonStatus').textContent = message;
}
function playReferenceThenRecording() {
  if (comparisonPlaying) return stopComparison();
  const line = activeLine();
  if (!line || !recordedBlob || recordedForSentence !== line.en) return alert('请先录制当前这一句，再进行 A/B 对比。');
  comparisonPlaying = true;
  $('recordingPlayback').pause();
  $('recordingPlayback').currentTime = 0;
  $('comparisonStatus').textContent = '正在播放原声…';
  $('abCompareButton').textContent = '停止对比';
  $('abCompareButton').classList.add('active');
  const playOwnRecording = () => {
    if (!comparisonPlaying) return;
    if (comparisonStopper) video.removeEventListener('timeupdate', comparisonStopper);
    comparisonStopper = null;
    video.pause();
    $('comparisonStatus').textContent = '正在播放我的录音…';
    $('recordingPlayback').currentTime = 0;
    $('recordingPlayback').play().catch(() => stopComparison('无法自动播放录音，请点击“只听我的录音”。'));
  };
  comparisonStopper = () => {
    if (video.currentTime >= line.end) playOwnRecording();
  };
  video.addEventListener('timeupdate', comparisonStopper);
  seekTo(line.start, true);
}
$('abCompareButton').onclick = playReferenceThenRecording;
$('listenOwnButton').onclick = () => {
  if (!recordedBlob || recordedForSentence !== activeLine()?.en) return alert('请先录制当前这一句。');
  stopComparison('正在播放我的录音…');
  $('recordingPlayback').currentTime = 0;
  $('recordingPlayback').play().catch(() => {});
};
$('recordingPlayback').addEventListener('ended', () => { if (comparisonPlaying) stopComparison('A/B 对比完成，可再听一次。'); });

function setRecording(recording) { const card = document.querySelector('.recording-card'); card.classList.toggle('recording', recording); $('recordStatus').textContent = recording ? '正在录音' : '准备跟读'; $('recordButton').textContent = recording ? '■' : '●'; }
async function toggleRecording() { if (recorder?.state === 'recording') { recorder.stop(); return; } try { stopComparison(); const stream = await navigator.mediaDevices.getUserMedia({ audio:true }); const chunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = (e) => chunks.push(e.data); recorder.onstop = async () => { clearInterval(recordingTimer); stream.getTracks().forEach((track) => track.stop()); recordedBlob = new Blob(chunks, {type:recorder.mimeType || 'audio/webm'}); recordedForSentence = activeLine()?.en || ''; $('recordingPlayback').src = URL.createObjectURL(recordedBlob); $('recordingPlayback').hidden = false; setRecording(false); updateComparisonPanel(); await assessRecording(); }; recordingStart = Date.now(); recordingTimer = setInterval(() => $('recordTimer').textContent = formatTime((Date.now() - recordingStart) / 1000), 250); setRecording(true); recorder.start(); } catch(e) { alert('无法使用麦克风：' + e.message); } }
$('recordButton').onclick = toggleRecording;
async function assessRecording() { const target = activeLine(); if (!target) return; if (!hasPronunciationAssessment()) { $('recordStatus').textContent = '准备跟读'; $('feedback').classList.add('empty'); $('feedback').innerHTML = '<h3>录音已就绪</h3><p>你现在可以直接回听自己的录音。若要获得语调、目标口音契合度和单词红黄绿反馈，请在右上角“设置 → API 设置”中配置 Azure Speech Key 与区域。</p><p class="hint">OpenAI 与智谱 AI 仅用于视频字幕转写和中文翻译，不会消耗它们的额度来做录音评分。</p>'; return; } let spoken = ''; let detailed = null; $('recordStatus').textContent = '正在进行单词级评测…'; try { detailed = await assessWithAzure(target); spoken = detailed?.NBest?.[0]?.Display || detailed?.DisplayText || ''; } catch (e) { alert(`录音已就绪，但高精度评测失败：${e.message}`); } const nbest = detailed?.NBest?.[0]; const assessment = nbest?.PronunciationAssessment; if (!assessment) { $('recordStatus').textContent = '准备跟读'; return; } const score = assessment.PronScore; const words = nbest?.Words || []; const wordHtml = words.length ? `<p><b>单词反馈</b> <small>绿色＝正确，黄色＝需加强，红色＝读音问题，紫色＝漏读／多读</small></p><div class="word-feedback">${words.map((word) => { const pa = word.PronunciationAssessment || {}; const error = pa.ErrorType || ''; const accuracy = Number(pa.AccuracyScore ?? 0); const state = error && error !== 'None' ? (error === 'Omission' || error === 'Insertion' ? 'missing' : 'poor') : accuracy >= 80 ? 'good' : accuracy >= 60 ? 'fair' : 'poor'; const label = error && error !== 'None' ? `${word.Word} · ${error}` : `${word.Word} · ${Math.round(accuracy)}`; return `<span class="${state}" title="${escapeHtml(error || `准确度 ${Math.round(accuracy)}`)}">${escapeHtml(label)}</span>`; }).join('')}</div>` : ''; const accent = pronunciationLocale() === 'en-GB' ? '英式英语' : '美式英语'; const prosody = assessment.ProsodyScore; const tip = prosody != null && Number(prosody) < 70 ? '语调和重音还可以更有起伏：强调信息词，并让句末语气自然收束。' : '先处理黄色和红色单词，再保持现在的语流与停顿。'; $('recordStatus').textContent = '准备跟读'; $('feedback').classList.remove('empty'); $('feedback').innerHTML = `<h3>高精度跟读反馈</h3><div class="score-grid"><div>综合表现<b>${Math.round(Number(score))}</b></div><div>${accent}契合<b>${Math.round(Number(assessment.AccuracyScore ?? score))}%</b></div>${prosody != null ? `<div>语调与韵律<b>${Math.round(Number(prosody))}</b></div>` : `<div>语调与韵律<b>美式模式可测</b></div>`}</div>${spoken ? `<p><b>识别：</b>${escapeHtml(spoken)}</p>` : ''}${wordHtml}<p><b>建议：</b>${tip}</p>`; }
function dismissStartup() {
  const screen = $('startupScreen');
  if (!screen || screen.classList.contains('is-hidden')) return;
  screen.classList.add('is-hidden');
  window.setTimeout(() => screen.remove(), 650);
}
window.addEventListener('load', () => window.setTimeout(dismissStartup, matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 1400), { once:true });
$('startupScreen').addEventListener('pointerdown', dismissStartup, { once:true });
applyTheme(); updateProviderUi(); showPage(localStorage.getItem('speakloop-page') || 'practice');
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themePreference() === 'system') applyTheme('system'); });
renderSubtitles(); loadPersonalPicks(); loadBookmarks(); refreshLibrary();

