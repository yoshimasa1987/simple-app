'use strict';

const jobsEl = document.getElementById('jobs');
const form = document.getElementById('job-form');
const formError = document.getElementById('form-error');

async function api(path, options) {
  const res = await fetch(path, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
}

function badge(status) {
  const label = { running: '監視中', stopped: '停止中', error: 'エラー' }[status] || status;
  return `<span class="badge ${status}">${label}</span>`;
}

function renderJob(job, logs) {
  const logLines = (logs || [])
    .slice()
    .reverse()
    .map((l) => {
      const t = new Date(l.time).toLocaleTimeString('ja-JP');
      const cls = l.level === 'error' ? 'log-error' : '';
      return `<div class="${cls}">[${t}] ${escapeHtml(l.message)}</div>`;
    })
    .join('');

  const div = document.createElement('div');
  div.className = 'job';
  div.innerHTML = `
    <div class="job-head">
      <span class="job-title">${escapeHtml(job.name)}</span>
      ${badge(job.status)}
    </div>
    <div class="paths">
      <code>${escapeHtml(job.source)}</code> → <code>${escapeHtml(job.dest)}</code>
    </div>
    <div class="stats">
      コピー: ${job.stats.copied} 件 / 削除: ${job.stats.deleted} 件 / エラー: ${job.stats.errors} 件
      ${job.deleteOrphans ? '・完全ミラー' : '・追加/更新のみ'}
    </div>
    ${job.error ? `<div class="error">${escapeHtml(job.error)}</div>` : ''}
    <div class="actions">
      ${
        job.status === 'running'
          ? `<button class="secondary" data-act="stop" data-id="${job.id}">停止</button>`
          : `<button data-act="start" data-id="${job.id}">監視開始</button>`
      }
      <button class="danger" data-act="delete" data-id="${job.id}">削除</button>
    </div>
    <div class="logs">${logLines || '<span class="empty">ログはまだありません</span>'}</div>
  `;
  return div;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function refresh() {
  try {
    const jobs = await api('/api/jobs');
    if (jobs.length === 0) {
      jobsEl.innerHTML = '<p class="empty">まだミラー転送が登録されていません。上のフォームから追加してください。</p>';
      return;
    }
    // 各ジョブのログも取得
    const logsByJob = {};
    await Promise.all(
      jobs.map(async (j) => {
        try {
          logsByJob[j.id] = await api(`/api/jobs/${j.id}/logs`);
        } catch {
          logsByJob[j.id] = [];
        }
      })
    );
    jobsEl.innerHTML = '';
    jobs.forEach((j) => jobsEl.appendChild(renderJob(j, logsByJob[j.id])));
  } catch (err) {
    jobsEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  const fd = new FormData(form);
  const payload = {
    name: fd.get('name') || undefined,
    source: fd.get('source'),
    dest: fd.get('dest'),
    deleteOrphans: fd.get('deleteOrphans') === 'on',
  };
  try {
    await api('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    form.reset();
    refresh();
  } catch (err) {
    formError.textContent = err.message;
  }
});

jobsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const { act, id } = btn.dataset;
  try {
    if (act === 'start') await api(`/api/jobs/${id}/start`, { method: 'POST' });
    if (act === 'stop') await api(`/api/jobs/${id}/stop`, { method: 'POST' });
    if (act === 'delete') {
      if (!confirm('このミラー転送を削除しますか？（コピー先のファイルは削除されません）')) return;
      await api(`/api/jobs/${id}`, { method: 'DELETE' });
    }
    refresh();
  } catch (err) {
    alert(err.message);
  }
});

// 自動更新（監視中のステータス・ログを反映）
refresh();
setInterval(refresh, 2000);
