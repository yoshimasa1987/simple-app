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

/* ===== フォルダ選択ダイアログ ===== */
const picker = document.getElementById('picker');
const pickerList = document.getElementById('picker-list');
const pickerPath = document.getElementById('picker-path');
let pickerCurrent = null; // 現在表示しているフォルダ
let pickerTarget = null;  // 値を入れる対象のinput name ('source' | 'dest')

async function openPicker(targetName) {
  pickerTarget = targetName;
  document.getElementById('picker-title').textContent =
    targetName === 'source' ? '送信元フォルダを選択' : 'コピー先フォルダを選択';
  // すでに入力済みならそこから、なければホームから開始
  const cur = form.elements[targetName].value;
  picker.classList.remove('hidden');
  await loadPicker(cur || null);
}

function closePicker() {
  picker.classList.add('hidden');
}

async function loadPicker(targetPath) {
  pickerList.innerHTML = '<li class="empty">読み込み中…</li>';
  try {
    const q = targetPath ? `?path=${encodeURIComponent(targetPath)}` : '';
    const data = await api(`/api/browse${q}`);
    pickerCurrent = data.path;
    pickerPath.textContent = data.path;
    pickerList.innerHTML = '';
    if (data.entries.length === 0) {
      pickerList.innerHTML = '<li class="empty">このフォルダにサブフォルダはありません</li>';
      return;
    }
    data.entries.forEach((e) => {
      const li = document.createElement('li');
      li.innerHTML = `📁 ${escapeHtml(e.name)}`;
      li.addEventListener('click', () => loadPicker(e.path));
      pickerList.appendChild(li);
    });
  } catch (err) {
    pickerList.innerHTML = `<li class="empty">${escapeHtml(err.message)}</li>`;
  }
}

document.querySelectorAll('button[data-browse]').forEach((btn) => {
  btn.addEventListener('click', () => openPicker(btn.dataset.browse));
});

document.getElementById('picker-close').addEventListener('click', closePicker);
document.getElementById('picker-cancel').addEventListener('click', closePicker);
picker.addEventListener('click', (e) => {
  if (e.target === picker) closePicker(); // 背景クリックで閉じる
});

document.getElementById('picker-up').addEventListener('click', async () => {
  const q = `?path=${encodeURIComponent(pickerCurrent)}`;
  const data = await api(`/api/browse${q}`);
  if (data.parent) loadPicker(data.parent);
});

document.getElementById('picker-home').addEventListener('click', () => loadPicker(null));

document.getElementById('picker-select').addEventListener('click', () => {
  if (pickerCurrent && pickerTarget) {
    form.elements[pickerTarget].value = pickerCurrent;
  }
  closePicker();
});

document.getElementById('picker-newfolder').addEventListener('click', async () => {
  const name = prompt(`「${pickerCurrent}」の中に作る新しいフォルダ名を入力してください`);
  if (!name) return;
  try {
    const created = await api('/api/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent: pickerCurrent, name }),
    });
    await loadPicker(created.path); // 作ったフォルダの中に移動
  } catch (err) {
    alert(err.message);
  }
});

// 自動更新（監視中のステータス・ログを反映）
refresh();
setInterval(refresh, 2000);
