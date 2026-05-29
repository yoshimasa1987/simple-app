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

/* ===== フォルダ選択ダイアログ（ツリー表示） ===== */
const picker = document.getElementById('picker');
const pickerTree = document.getElementById('picker-tree');
const pickerPath = document.getElementById('picker-path');
const pickerSelectBtn = document.getElementById('picker-select');
let pickerSelected = null; // 選択中のフォルダ絶対パス
let pickerTarget = null;   // 値を入れる対象のinput name ('source' | 'dest')
let selectedRowEl = null;  // ハイライト中の行

async function openPicker(targetName) {
  pickerTarget = targetName;
  document.getElementById('picker-title').textContent =
    targetName === 'source' ? '送信元フォルダを選択' : 'コピー先フォルダを選択';
  pickerSelected = null;
  selectedRowEl = null;
  pickerPath.textContent = '（未選択）';
  pickerSelectBtn.disabled = true;
  picker.classList.remove('hidden');

  // ドライブ／ホーム／OneDrive などの起点を並べてツリーを初期化
  pickerTree.innerHTML = '<li class="empty">読み込み中…</li>';
  try {
    const { roots } = await api('/api/roots');
    pickerTree.innerHTML = '';
    roots.forEach((r, i) => {
      // ホーム（最後の要素）だけ最初から開いておく
      const isHome = i === roots.length - 1;
      pickerTree.appendChild(makeNode({ name: r.name, path: r.path }, true, isHome));
    });
  } catch (err) {
    pickerTree.innerHTML = `<li class="empty">${escapeHtml(err.message)}</li>`;
  }
}

function closePicker() {
  picker.classList.add('hidden');
}

// ツリーの1ノード（フォルダ）を生成する
function makeNode(entry, isRoot = false, autoExpand = false) {
  const li = document.createElement('li');
  li.className = 'tree-node';

  const row = document.createElement('div');
  row.className = 'tree-row';

  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle';
  toggle.textContent = '▶';

  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = isRoot ? entry.name : `📁 ${entry.name}`;

  row.appendChild(toggle);
  row.appendChild(label);
  li.appendChild(row);

  const childUl = document.createElement('ul');
  childUl.className = 'tree-children';
  childUl.style.display = 'none';
  li.appendChild(childUl);

  let loaded = false;
  let expanded = false;

  async function expand() {
    if (!loaded) {
      childUl.innerHTML = '<li class="empty">読み込み中…</li>';
      try {
        const data = await api(`/api/browse?path=${encodeURIComponent(entry.path)}`);
        childUl.innerHTML = '';
        if (data.entries.length === 0) {
          childUl.innerHTML = '<li class="empty">サブフォルダなし</li>';
        } else {
          data.entries.forEach((e) => childUl.appendChild(makeNode(e)));
        }
        loaded = true;
      } catch (err) {
        childUl.innerHTML = `<li class="empty">${escapeHtml(err.message)}</li>`;
      }
    }
    childUl.style.display = '';
    toggle.textContent = '▼';
    expanded = true;
  }

  function collapse() {
    childUl.style.display = 'none';
    toggle.textContent = '▶';
    expanded = false;
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    expanded ? collapse() : expand();
  });

  // 名前クリックで選択（＋未展開なら開く）
  label.addEventListener('click', () => {
    if (selectedRowEl) selectedRowEl.classList.remove('selected');
    row.classList.add('selected');
    selectedRowEl = row;
    pickerSelected = entry.path;
    pickerPath.textContent = entry.path;
    pickerSelectBtn.disabled = false;
    if (!expanded) expand();
  });

  // 指定された起点だけ最初から開いておく
  if (autoExpand) expand();

  return li;
}

document.querySelectorAll('button[data-browse]').forEach((btn) => {
  btn.addEventListener('click', () => openPicker(btn.dataset.browse));
});

document.getElementById('picker-close').addEventListener('click', closePicker);
document.getElementById('picker-cancel').addEventListener('click', closePicker);
picker.addEventListener('click', (e) => {
  if (e.target === picker) closePicker(); // 背景クリックで閉じる
});

document.getElementById('picker-select').addEventListener('click', () => {
  if (pickerSelected && pickerTarget) {
    form.elements[pickerTarget].value = pickerSelected;
  }
  closePicker();
});

document.getElementById('picker-newfolder').addEventListener('click', async () => {
  if (!pickerSelected) {
    alert('先に親フォルダをツリーから選択してください');
    return;
  }
  const name = prompt(`「${pickerSelected}」の中に作る新しいフォルダ名を入力してください`);
  if (!name) return;
  try {
    await api('/api/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent: pickerSelected, name }),
    });
    alert('作成しました。親フォルダの ▶ を開き直すと一覧に表示されます。');
  } catch (err) {
    alert(err.message);
  }
});

// 自動更新（監視中のステータス・ログを反映）
refresh();
setInterval(refresh, 2000);
