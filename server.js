'use strict';

const os = require('os');
const path = require('path');
const fsp = require('fs/promises');
const express = require('express');
const { JobStore } = require('./lib/store');

const app = express();
const port = process.env.PORT || 3000;
const store = new JobStore();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 起点（ルート）一覧: Windowsはドライブ＋ホーム＋OneDrive系、その他は / とホーム
app.get('/api/roots', async (req, res) => {
  const home = os.homedir();
  const roots = [];

  if (process.platform === 'win32') {
    // A:〜Z: のうち実在するドライブを探す
    for (let c = 67; c <= 90; c++) {
      // C から開始
      const drive = `${String.fromCharCode(c)}:\\`;
      try {
        await fsp.access(drive);
        roots.push({ name: `💽 ${drive}`, path: drive });
      } catch {
        /* 存在しないドライブは無視 */
      }
    }
    // OneDrive / SharePoint 同期フォルダ（環境変数 or ホーム直下を検出）
    for (const key of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
      const p = process.env[key];
      if (p) {
        try {
          await fsp.access(p);
          if (!roots.some((r) => r.path === p)) {
            roots.push({ name: `☁ ${path.basename(p)}`, path: p });
          }
        } catch { /* なければ無視 */ }
      }
    }
  } else {
    roots.push({ name: '💽 / （ルート）', path: '/' });
  }

  roots.push({ name: `🏠 ホーム (${home})`, path: home });
  res.json({ home, platform: process.platform, roots });
});

// フォルダ参照: 指定パス（省略時はホーム）配下のサブフォルダ一覧を返す
app.get('/api/browse', async (req, res) => {
  const target = req.query.path ? path.resolve(req.query.path) : os.homedir();
  try {
    const dirents = await fsp.readdir(target, { withFileTypes: true });
    const entries = dirents
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: path.join(target, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    const parent = path.dirname(target);
    res.json({
      path: target,
      parent: parent === target ? null : parent, // ルートでは parent を null
      home: os.homedir(),
      entries,
    });
  } catch (err) {
    res.status(400).json({ error: `フォルダを開けません: ${err.message}` });
  }
});

// 新規フォルダ作成（コピー先をその場で作りたいとき用）
app.post('/api/mkdir', async (req, res) => {
  const { parent, name } = req.body || {};
  if (!parent || !name) {
    return res.status(400).json({ error: '親フォルダ(parent)と名前(name)は必須です' });
  }
  if (name.includes('/') || name.includes('\\') || name === '..' || name === '.') {
    return res.status(400).json({ error: 'フォルダ名に使えない文字が含まれています' });
  }
  const target = path.join(path.resolve(parent), name);
  try {
    await fsp.mkdir(target, { recursive: true });
    res.status(201).json({ path: target });
  } catch (err) {
    res.status(400).json({ error: `作成できません: ${err.message}` });
  }
});

// ジョブ一覧
app.get('/api/jobs', (req, res) => {
  res.json(store.list().map((j) => j.toJSON()));
});

// ジョブ作成
app.post('/api/jobs', async (req, res) => {
  try {
    const job = await store.create(req.body || {});
    res.status(201).json(job.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ジョブ削除
app.delete('/api/jobs/:id', async (req, res) => {
  const ok = await store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'ジョブが見つかりません' });
  res.status(204).end();
});

// 監視開始
app.post('/api/jobs/:id/start', async (req, res) => {
  const job = store.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'ジョブが見つかりません' });
  try {
    await job.start();
    res.json(job.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message, job: job.toJSON() });
  }
});

// 監視停止
app.post('/api/jobs/:id/stop', async (req, res) => {
  const job = store.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'ジョブが見つかりません' });
  await job.stop();
  res.json(job.toJSON());
});

// ログ取得
app.get('/api/jobs/:id/logs', (req, res) => {
  const job = store.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'ジョブが見つかりません' });
  res.json(job.logs);
});

async function main() {
  await store.load();
  app.listen(port, () => {
    console.log(`ミラーコピーアプリを起動しました: http://localhost:${port}`);
  });
}

// 終了時に監視を後始末する
async function shutdown() {
  for (const job of store.list()) {
    await job.stop();
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main();
