'use strict';

const path = require('path');
const express = require('express');
const { JobStore } = require('./lib/store');

const app = express();
const port = process.env.PORT || 3000;
const store = new JobStore();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
