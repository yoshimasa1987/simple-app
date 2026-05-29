'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { MirrorJob } = require('./mirror');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'jobs.json');

/**
 * ミラージョブの一覧を管理し、設定をディスクへ永続化するストア。
 */
class JobStore {
  constructor() {
    this.jobs = new Map();
  }

  /** 永続化された設定を読み込む（サーバー起動時に呼ぶ） */
  async load() {
    try {
      const raw = await fsp.readFile(CONFIG_FILE, 'utf8');
      const configs = JSON.parse(raw);
      for (const cfg of configs) {
        this.jobs.set(cfg.id, new MirrorJob(cfg));
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('設定の読み込みに失敗しました:', err.message);
      }
    }
  }

  async persist() {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const configs = [...this.jobs.values()].map((j) => j.toConfig());
    await fsp.writeFile(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf8');
  }

  list() {
    return [...this.jobs.values()];
  }

  get(id) {
    return this.jobs.get(id);
  }

  async create({ name, source, dest, deleteOrphans }) {
    if (!source || !dest) {
      throw new Error('送信元(source)とコピー先(dest)は必須です');
    }
    const id = crypto.randomUUID();
    const job = new MirrorJob({ id, name, source, dest, deleteOrphans });
    this.jobs.set(id, job);
    await this.persist();
    return job;
  }

  async remove(id) {
    const job = this.jobs.get(id);
    if (!job) return false;
    await job.stop();
    this.jobs.delete(id);
    await this.persist();
    return true;
  }
}

module.exports = { JobStore };
