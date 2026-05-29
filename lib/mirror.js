'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const chokidar = require('chokidar');

/**
 * 1つの「送信元 -> コピー先」のミラー転送ジョブを表すクラス。
 *
 * chokidar で送信元を監視し、ファイル/フォルダの追加・変更・削除を
 * コピー先へそのまま反映する（ミラー）。delete オプションが有効な場合は
 * 送信元から消えたものをコピー先からも削除する。
 */
class MirrorJob {
  /**
   * @param {object} opts
   * @param {string} opts.id          ジョブの一意なID
   * @param {string} opts.name        表示名
   * @param {string} opts.source      送信元の絶対パス
   * @param {string} opts.dest        コピー先の絶対パス
   * @param {boolean} [opts.deleteOrphans=true] 送信元から消えたファイルをコピー先からも消すか
   */
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name || opts.source;
    this.source = path.resolve(opts.source);
    this.dest = path.resolve(opts.dest);
    this.deleteOrphans = opts.deleteOrphans !== false;

    this.status = 'stopped'; // stopped | running | error
    this.error = null;
    this.stats = { copied: 0, deleted: 0, errors: 0 };
    this.logs = []; // 直近のイベントログ（最大200件）
    this.watcher = null;
  }

  log(level, message) {
    const entry = { time: new Date().toISOString(), level, message };
    this.logs.push(entry);
    if (this.logs.length > 200) this.logs.shift();
  }

  /** 送信元の相対パスからコピー先の絶対パスを求める */
  destPathFor(srcPath) {
    const rel = path.relative(this.source, srcPath);
    return path.join(this.dest, rel);
  }

  async start() {
    if (this.status === 'running') return;

    // 送信元の存在チェック
    try {
      const st = await fsp.stat(this.source);
      if (!st.isDirectory()) {
        throw new Error('送信元はディレクトリである必要があります');
      }
    } catch (err) {
      this.status = 'error';
      this.error = `送信元にアクセスできません: ${err.message}`;
      this.log('error', this.error);
      throw new Error(this.error);
    }

    // コピー先のルートを用意
    await fsp.mkdir(this.dest, { recursive: true });

    this.status = 'running';
    this.error = null;
    this.log('info', `監視を開始しました: ${this.source} -> ${this.dest}`);

    this.watcher = chokidar.watch(this.source, {
      ignoreInitial: false, // 起動時に既存ファイルもミラーする（初回フルコピー）
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (p) => this.handleCopy(p))
      .on('change', (p) => this.handleCopy(p))
      .on('addDir', (p) => this.handleAddDir(p))
      .on('unlink', (p) => this.handleUnlink(p, false))
      .on('unlinkDir', (p) => this.handleUnlink(p, true))
      .on('error', (err) => {
        this.stats.errors++;
        this.log('error', `監視エラー: ${err.message}`);
      });
  }

  async handleCopy(srcPath) {
    const target = this.destPathFor(srcPath);
    try {
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.copyFile(srcPath, target);
      this.stats.copied++;
      this.log('info', `コピー: ${path.relative(this.source, srcPath)}`);
    } catch (err) {
      this.stats.errors++;
      this.log('error', `コピー失敗 ${path.relative(this.source, srcPath)}: ${err.message}`);
    }
  }

  async handleAddDir(srcPath) {
    const target = this.destPathFor(srcPath);
    try {
      await fsp.mkdir(target, { recursive: true });
    } catch (err) {
      this.stats.errors++;
      this.log('error', `フォルダ作成失敗: ${err.message}`);
    }
  }

  async handleUnlink(srcPath, isDir) {
    if (!this.deleteOrphans) return;
    const target = this.destPathFor(srcPath);
    try {
      await fsp.rm(target, { recursive: isDir, force: true });
      this.stats.deleted++;
      this.log('info', `削除: ${path.relative(this.source, srcPath)}`);
    } catch (err) {
      this.stats.errors++;
      this.log('error', `削除失敗 ${path.relative(this.source, srcPath)}: ${err.message}`);
    }
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.status = 'stopped';
    this.log('info', '監視を停止しました');
  }

  /** API / 保存用のシリアライズ可能なオブジェクト */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      dest: this.dest,
      deleteOrphans: this.deleteOrphans,
      status: this.status,
      error: this.error,
      stats: this.stats,
    };
  }

  /** 設定の永続化に使う最小限のフィールド */
  toConfig() {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      dest: this.dest,
      deleteOrphans: this.deleteOrphans,
    };
  }
}

module.exports = { MirrorJob };
