const toast = document.querySelector('.toast');

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(window.toastTimer);
  window.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2400);
}

const screenStage = document.querySelector('#screen-stage');
const overviewView = document.querySelector('#overview');

// Display scale. The dashboard is drawn in fixed pixel sizes, so growing the
// text alone would break every layout that depends on them; zooming the shell
// scales type and geometry together instead.
const SCALE_STORAGE_KEY = 'bpom.displayScale';
const SCALE_MIN = 75;
const SCALE_MAX = 200;

function readDisplayScale() {
  const stored = Number(window.localStorage.getItem(SCALE_STORAGE_KEY));
  if (!Number.isFinite(stored) || stored <= 0) return 100;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(stored)));
}

function applyDisplayScale(percent, { persist = true } = {}) {
  const value = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(percent)));
  document.documentElement.style.setProperty('--ui-scale', String(value / 100));
  if (persist) window.localStorage.setItem(SCALE_STORAGE_KEY, String(value));
  document.querySelectorAll('[data-scale-readout]').forEach((el) => { el.textContent = `${value}%`; });
  document.querySelectorAll('[data-scale-slider]').forEach((el) => { el.value = String(value); });
  // Media queries see the unzoomed viewport, so scaling up on a narrow screen
  // can push the desktop layout wider than the window. Let it scroll rather
  // than be clipped by the overflow-x:hidden that guards the normal case.
  document.body.style.overflowX = value > 100 ? 'auto' : '';
  // Canvases size themselves from their box, which zoom has just changed.
  window.dispatchEvent(new Event('resize'));
  return value;
}

applyDisplayScale(readDisplayScale(), { persist: false });

function stopDotPlotAnimation(plot = document.querySelector('.dot-plot')) {
  if (!plot || !plot._waveFrame) return;
  cancelAnimationFrame(plot._waveFrame);
  plot._waveFrame = null;
}
const viewLabels = {
  overview: 'Support Operations',
  live: 'Live Calls',
  escalations: 'Escalations',
  history: 'Call History',
  knowledge: 'Knowledge Base',
  analytics: 'Analytics',
  office: 'Virtual Office',
  settings: 'Settings',
};

function screenHeader(kicker, title, description, action = '') {
  return `<div class="screen-heading"><div><p class="eyebrow">${kicker}</p><h2>${title}</h2><p class="subtle">${description}</p></div>${action}</div>`;
}

function screenStat(label, value, note, tone = 'cyan') {
  return `<article class="screen-stat"><span class="stat-mark ${tone}"></span><p>${label}</p><strong>${value}</strong><small>${note}</small></article>`;
}

const officeShell = () => `${screenHeader('LIVE OPERATIONS FLOOR', 'Virtual Office', 'Visualisasi real-time kantor call center BPOM: meja agent AI menjawab panggilan, kasus yang tidak bisa dijawab diantar ke meja petugas untuk ditindaklanjuti pada jam kerja.')}
  <div id="office-mount" class="office-mount"><p class="subtle office-hint">Memuat kantor…</p></div>`;

const screenTemplates = {
  live: () => `${screenHeader('REAL-TIME OPERATIONS', 'Live Calls', 'Pantau percakapan yang sedang berjalan dan ambil alih jika AI membutuhkan bantuan.', '<button class="primary-button" data-action="simulate-call">＋ Simulate incoming call</button>')}
    <div class="screen-stats">${screenStat('ACTIVE CALLS', '03', 'Semua AI sedang online', 'green')}${screenStat('WAITING QUEUE', '02', 'Rata-rata tunggu 00:18', 'amber')}${screenStat('AI HANDLING', '92%', 'Dari panggilan aktif', 'cyan')}${screenStat('PETUGAS ONLINE', '04', 'Siap mengambil alih', 'violet')}</div>
    <div class="two-column-screen"><article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">LIVE QUEUE</p><h3>Active conversations</h3></div><span class="status-pill live-pill">● LIVE</span></div><div class="live-call-cards"><div class="live-call-card"><div class="caller-icon">A</div><div><strong>08••• 8214</strong><span>Registrasi pangan olahan</span></div><b>02:14</b><em class="answering">ANSWERING</em><button data-action="observe">Observe</button></div><div class="live-call-card"><div class="caller-icon secondary">R</div><div><strong>08••• 4416</strong><span>Laporan efek samping obat</span></div><b>01:38</b><em class="searching">SEARCHING KB</em><button data-action="observe">Observe</button></div><div class="live-call-card"><div class="caller-icon third">S</div><div><strong>08••• 9031</strong><span>Akun e-registration</span></div><b>00:47</b><em class="answering">ANSWERING</em><button data-action="takeover">Take over</button></div></div></article><article class="table-panel transcript-panel"><div class="table-panel-head"><div><p class="panel-kicker">SELECTED CALL · 08••• 8214</p><h3>Live transcript</h3></div><span class="signal">◉ 42 ms</span></div><div class="transcript"><div class="transcript-line ai"><small>AI · 10:42:08</small><p>Selamat datang di layanan informasi BPOM. Ada yang bisa saya bantu?</p></div><div class="transcript-line caller"><small>CALLER · 10:42:16</small><p>Saya mau daftar izin edar pangan olahan, tapi berkas saya selalu ditolak.</p></div><div class="transcript-line ai"><small>AI · 10:42:22</small><p>Baik, saya sedang mencari ketentuan registrasi yang sesuai.</p></div></div><button class="outline-button" data-action="takeover">Take over conversation ↗</button></article></div>`,
  escalations: () => `${screenHeader('ACTION REQUIRED', 'Escalations', 'Kasus yang belum dapat diselesaikan AI dan membutuhkan tindak lanjut petugas.', '<button class="primary-button" data-action="refresh">↻ Refresh queue</button>')}
    <div class="screen-stats">${screenStat('OPEN CASES', '12', '＋3 sejak 1 jam terakhir', 'amber')}${screenStat('HIGH PRIORITY', '03', 'Perlu respons segera', 'red')}${screenStat('AVG. RESPONSE', '04:18', '−32s dari kemarin', 'green')}${screenStat('RESOLVED TODAY', '38', '91% selesai hari ini', 'cyan')}</div>
    <article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">CASE QUEUE</p><h3>Needs human attention</h3></div><div class="filter-pills"><button class="active">All 12</button><button>High 03</button><button>Mine 02</button></div></div><div class="data-table"><div class="data-row data-head"><span>CASE</span><span>TOPIC</span><span>REASON</span><span>AGE</span><span>STATUS</span><span></span></div><div class="data-row"><span><b class="case-id">#CX-0182</b><small>08••• 4218</small></span><span>Registrasi produk</span><span>Foto identitas gagal divalidasi</span><span class="mono">04m</span><span><em class="priority-high">HIGH</em></span><button class="row-action" data-action="assign">Assign</button></div><div class="data-row"><span><b class="case-id">#CX-0181</b><small>08••• 1903</small></span><span>Sertifikat CPOB</span><span>Tidak ditemukan pada knowledge base</span><span class="mono">12m</span><span><em class="priority-medium">MED</em></span><button class="row-action" data-action="assign">Assign</button></div><div class="data-row"><span><b class="case-id">#CX-0179</b><small>08••• 8881</small></span><span>Data NIK</span><span>Memerlukan pengecekan data personal</span><span class="mono">18m</span><span><em class="priority-medium">MED</em></span><button class="row-action" data-action="assign">Assign</button></div><div class="data-row"><span><b class="case-id">#CX-0176</b><small>08••• 5570</small></span><span>Efek samping obat</span><span>Pengguna meminta penilaian keamanan produk</span><span class="mono">26m</span><span><em class="priority-low">LOW</em></span><button class="row-action" data-action="assign">Assign</button></div></div></article>`,
  history: () => `${screenHeader('SERVICE RECORDS', 'Call History', 'Riwayat panggilan, transkrip, dan hasil penanganan layanan BPOM.', '<label class="screen-search">⌕ <input placeholder="Search caller or topic..." /></label>')}
    <div class="screen-stats">${screenStat('TOTAL CALLS', '1,284', '7 hari terakhir', 'cyan')}${screenStat('RESOLVED', '1,106', '86.1% resolved', 'green')}${screenStat('ESCALATED', '178', '13.9% to staff', 'amber')}${screenStat('AVG. HANDLE TIME', '03:42', '−18s improvement', 'violet')}</div>
    <article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">ALL INTERACTIONS</p><h3>Recent call history</h3></div><div class="filter-pills"><button class="active">Last 7 days</button><button>Resolved</button><button>Escalated</button></div></div><div class="data-table history-table"><div class="data-row data-head"><span>CALL ID</span><span>CALLER</span><span>TOPIC</span><span>DATE</span><span>RESULT</span><span></span></div><div class="data-row"><span class="case-id">#CALL-7421</span><span>08••• 8214</span><span>Registrasi produk</span><span class="mono">Today 10:42</span><span><em class="resolved">RESOLVED AI</em></span><button class="row-action" data-action="details">Details</button></div><div class="data-row"><span class="case-id">#CALL-7420</span><span>08••• 4416</span><span>Efek samping obat</span><span class="mono">Today 10:39</span><span><em class="priority-medium">ESCALATED</em></span><button class="row-action" data-action="details">Details</button></div><div class="data-row"><span class="case-id">#CALL-7419</span><span>08••• 9031</span><span>Akun e-registration</span><span class="mono">Today 10:34</span><span><em class="resolved">RESOLVED AI</em></span><button class="row-action" data-action="details">Details</button></div><div class="data-row"><span class="case-id">#CALL-7418</span><span>08••• 5570</span><span>Izin edar kosmetik</span><span class="mono">Today 10:30</span><span><em class="resolved">RESOLVED AI</em></span><button class="row-action" data-action="details">Details</button></div></div></article>`,
  knowledge: () => `<div id="rag-management-root" class="rag-management-root"><div class="rag-loading-shell"><span class="rag-spinner"></span><p>Memuat visualisasi memory RAG…</p></div></div>`,
  analytics: () => `${screenHeader('SERVICE INTELLIGENCE', 'Analytics', 'Pahami pola pertanyaan pengguna dan efektivitas AI dari waktu ke waktu.', '<div class="period-picker screen-period"><button>Day</button><button class="active">7 days</button><button>Month</button></div>')}
    <div class="screen-stats">${screenStat('CONTAINMENT RATE', '86.1%', '+4.8% this period', 'green')}${screenStat('AVG. RESPONSE', '1.8s', '−0.3s improvement', 'cyan')}${screenStat('CUSTOMER SENTIMENT', '4.6/5', 'Based on 312 ratings', 'violet')}${screenStat('TOPIC COVERAGE', '92%', 'Official KB match', 'amber')}</div>
    <div class="analytics-grid"><article class="table-panel analytics-chart"><div class="table-panel-head"><div><p class="panel-kicker">QUESTION VOLUME</p><h3>Topics over time</h3></div><span class="muted-label">7 DAYS · 1,284 CALLS</span></div><div class="mini-bars"><i style="height:43%"></i><i style="height:58%"></i><i style="height:48%"></i><i style="height:76%"></i><i style="height:66%"></i><i style="height:93%"></i><i style="height:81%"></i><i style="height:100%"></i><i style="height:87%"></i><i style="height:72%"></i><i style="height:90%"></i><i style="height:61%"></i></div><div class="mini-axis"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></article><article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">TOP INTENTS</p><h3>What users ask</h3></div></div><ol class="rank-list"><li><span>01</span><strong>Registrasi produk</strong><b>32%</b></li><li><span>02</span><strong>Izin edar</strong><b>24%</b></li><li><span>03</span><strong>Sertifikat CPOB</strong><b>18%</b></li><li><span>04</span><strong>Efek samping obat</strong><b>14%</b></li><li><span>05</span><strong>Akun e-registration</strong><b>12%</b></li></ol></article></div>`,
  office: officeShell,
  settings: () => `${screenHeader('SYSTEM CONFIGURATION', 'Settings', 'Atur perilaku agent, routing eskalasi, dan koneksi operasional.', '<button class="primary-button" data-action="save-settings">Save changes</button>')}
    <div class="settings-grid"><article class="table-panel settings-panel display-scale-panel"><div class="table-panel-head"><div><p class="panel-kicker">TAMPILAN</p><h3>Skala tampilan</h3></div><span class="status-pill live-pill" data-scale-readout>100%</span></div><p class="subtle">Memperbesar tata letak dan teks sekaligus. Tersimpan di peramban ini.</p><input class="scale-slider" type="range" min="${SCALE_MIN}" max="${SCALE_MAX}" step="5" value="${readDisplayScale()}" data-scale-slider aria-label="Skala tampilan" /><div class="scale-ticks"><span>${SCALE_MIN}%</span><span>100%</span><span>${SCALE_MAX}%</span></div><div class="scale-presets">${[90, 100, 125, 150, 175].map((value) => `<button data-scale-preset="${value}">${value}%</button>`).join('')}</div></article><article class="table-panel settings-panel"><div class="table-panel-head"><div><p class="panel-kicker">AI AGENT</p><h3>Response policy</h3></div><span class="status-pill live-pill">● CONFIGURED</span></div><label class="setting-row"><span><strong>Use official sources only</strong><small>AI menolak jawaban di luar knowledge base.</small></span><input type="checkbox" checked /></label><label class="setting-row"><span><strong>Escalate personal questions</strong><small>Data personal selalu diteruskan ke petugas.</small></span><input type="checkbox" checked /></label><label class="setting-row"><span><strong>Record transcript</strong><small>Simpan transkrip untuk audit dan evaluasi.</small></span><input type="checkbox" checked /></label></article><article class="table-panel settings-panel"><div class="table-panel-head"><div><p class="panel-kicker">OPERATIONS</p><h3>Routing & notifications</h3></div></div><label class="field-label">Escalation team<select><option>BPOM Support Desk</option><option>Layanan Pelaku Usaha</option></select></label><label class="field-label">Priority threshold<select><option>Personal or transactional</option><option>Low confidence only</option></select></label><label class="field-label">Notification channel<select><option>Dashboard + Email</option><option>Dashboard only</option></select></label></article></div>`,
};

/**
 * The Virtual Office runs a simulation and an animation loop, so unlike the
 * other views it cannot simply be thrown away with the markup — leaving it
 * mounted would keep a full frame loop running behind whatever view replaced it.
 */
let officeSession = null;
let officeToken = 0;
let ragSession = null;
let ragToken = 0;

function teardownOffice() {
  officeToken += 1;
  if (officeSession) {
    officeSession.destroy();
    officeSession = null;
  }
}

function teardownRagManagement() {
  ragToken += 1;
  if (ragSession) {
    ragSession.destroy();
    ragSession = null;
  }
}

function mountOfficeView() {
  const token = officeToken;
  const mount = screenStage.querySelector('#office-mount');
  import('/static/office/index.js')
    .then(({ mountOffice }) => {
      // The user may have navigated away while the module was still loading.
      if (token !== officeToken || !mount.isConnected) return null;
      return mountOffice(mount);
    })
    .then((session) => {
      if (!session) return;
      if (token !== officeToken) session.destroy();
      else officeSession = session;
    })
    .catch((error) => {
      mount.innerHTML = `<p class="subtle office-hint">Gagal memuat Virtual Office: ${error.message}</p>`;
    });
}

function mountRagManagement() {
  const token = ragToken;
  const mount = screenStage.querySelector('#rag-management-root');
  import('/static/rag-management.js')
    .then(({ mountRagManagement: mountRag }) => {
      if (token !== ragToken || !mount?.isConnected) return null;
      return mountRag(mount, notify);
    })
    .then((session) => {
      if (!session) return;
      if (token !== ragToken) session.destroy();
      else ragSession = session;
    })
    .catch((error) => {
      if (mount?.isConnected) {
        const failure = document.createElement('div');
        const title = document.createElement('strong');
        const detail = document.createElement('p');
        failure.className = 'rag-fatal';
        title.textContent = 'RAG Management gagal dimuat.';
        detail.textContent = error.message;
        failure.append(title, detail);
        mount.replaceChildren(failure);
      }
    });
}

function navigateToView(view) {
  if (view !== 'overview') stopDotPlotAnimation();
  teardownOffice();
  teardownRagManagement();
  document.querySelectorAll('.nav-item').forEach((entry) => entry.classList.toggle('active', entry.dataset.view === view));
  document.querySelector('#page-title').textContent = viewLabels[view] || view;
  const breadcrumb = document.querySelector('.breadcrumb');
  if (breadcrumb) {
    breadcrumb.replaceChildren(
      document.createTextNode('DASHBOARD '),
      Object.assign(document.createElement('span'), { textContent: '›' }),
      document.createTextNode(` ${(viewLabels[view] || view).toUpperCase()}`),
    );
  }
  if (view === 'overview') {
    overviewView.hidden = false;
    screenStage.hidden = true;
    renderDotPlot();
    return;
  }
  overviewView.hidden = true;
  screenStage.hidden = false;
  screenStage.innerHTML = screenTemplates[view] ? screenTemplates[view]() : screenTemplates.overview?.() || '';
  if (view === 'office') mountOfficeView();
  if (view === 'knowledge') mountRagManagement();
  screenStage.querySelectorAll('.filter-pills button').forEach((button) => button.addEventListener('click', () => {
    screenStage.querySelectorAll('.filter-pills button').forEach((entry) => entry.classList.remove('active'));
    button.classList.add('active');
    notify(`Filter ${button.textContent} dipilih.`);
  }));
  notify(`${viewLabels[view]} dibuka.`);
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => navigateToView(item.dataset.view));
});

screenStage.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const messages = {
    'simulate-call': 'Panggilan demo masuk ke antrean live.',
    observe: 'Mode observasi percakapan diaktifkan.',
    takeover: 'Petugas mengambil alih percakapan.',
    assign: 'Kasus ditugaskan ke Hariz A.',
    details: 'Detail transkrip dibuka.',
    upload: 'Dialog sumber knowledge base siap digunakan.',
    'open-source': 'Dokumen sumber dibuka.',
    sync: 'Sinkronisasi sumber resmi dimulai.',
    refresh: 'Antrean diperbarui.',
    'refresh-workflow': 'Status eksekusi n8n diperbarui.',
    'run-workflow': 'Test execution n8n sedang berjalan.',
    'zoom-in': 'Canvas diperbesar.',
    'zoom-out': 'Canvas diperkecil.',
    'save-settings': 'Pengaturan tersimpan.',
  };
  notify(messages[button.dataset.action] || 'Aksi dijalankan.');
});

screenStage.addEventListener('input', (event) => {
  const slider = event.target.closest('[data-scale-slider]');
  if (slider) applyDisplayScale(Number(slider.value));
});

screenStage.addEventListener('click', (event) => {
  const preset = event.target.closest('[data-scale-preset]');
  if (!preset) return;
  notify(`Skala tampilan ${applyDisplayScale(Number(preset.dataset.scalePreset))}%.`);
});

document.querySelectorAll('[data-view-target]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.viewTarget;
    document.querySelector(`.nav-item[data-view="${target}"]`)?.click();
  });
});

document.querySelectorAll('.period-picker button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.period-picker button').forEach((entry) => entry.classList.remove('active'));
    button.classList.add('active');
    notify(`Rentang data diubah ke ${button.dataset.period}.`);
  });
});

document.querySelectorAll('.load-period-picker button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.load-period-picker button').forEach((entry) => entry.classList.remove('active'));
    button.classList.add('active');
    const chartMode = { Harian: 'daily', Mingguan: 'weekly', Bulanan: 'monthly' }[button.dataset.chartPeriod] || 'weekly';
    renderDotPlot(chartMode);
    notify(`Grafik beban panggilan diubah ke tampilan ${button.dataset.chartPeriod.toLowerCase()}.`);
  });
});

document.querySelectorAll('.take-button').forEach((button) => {
  button.addEventListener('click', () => notify('Mode observasi panggilan diaktifkan.'));
});

const chartProfiles = {
  daily: {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
    columns: [2, 3, 4, 6, 9, 14, 19, 24, 31, 38, 42, 36, 30, 25, 20, 17, 22, 29, 34, 31, 26, 20, 15, 11, 8, 6, 5, 4, 3, 3, 2, 2, 2, 1, 1],
    total: '86',
    headlineDelta: '+8 (+8.2%)',
    peak: 'Puncak panggilan: 12:00–14:00',
    delta: '+8.2% dibanding kemarin',
  },
  weekly: {
    labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    columns: [6, 9, 12, 10, 7, 5, 3, 2, 2, 3, 4, 6, 10, 14, 15, 14, 15, 16, 15, 14, 8, 6, 5, 4, 4, 5, 7, 10, 14, 13, 9, 7, 7, 10, 8, 6, 7, 12, 10, 8, 7, 11, 8, 5, 6, 10, 13, 8, 9, 13, 15, 14, 10, 7, 4, 2],
    total: '524',
    headlineDelta: '+24 (+4.8%)',
    peak: 'Puncak panggilan: Rabu, 10:00–12:00',
    delta: '+4.8% dibanding minggu lalu',
  },
  monthly: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'],
    columns: [7, 8, 10, 12, 9, 8, 6, 5, 6, 9, 13, 15, 18, 16, 14, 12, 10, 9, 11, 14, 17, 20, 18, 16, 13, 12, 10, 11, 15, 19, 23, 21, 18, 16, 14, 13, 15, 18, 22, 26, 24, 20, 17, 14, 12, 11, 13, 16, 19, 22, 20, 17, 14, 12, 10, 8],
    total: '2,184',
    headlineDelta: '+246 (+12.6%)',
    peak: 'Puncak panggilan: Week 4, awal periode lapor',
    delta: '+12.6% dibanding bulan lalu',
  },
};

function renderDotPlot(mode = 'weekly') {
  const plot = document.querySelector('.dot-plot');
  if (!plot) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const profile = chartProfiles[mode] || chartProfiles.weekly;
  const { labels } = profile;
  const sourceColumns = profile.columns;
  const sampledColumns = Array.from({ length: 56 }, (_, index) => sourceColumns[Math.floor(index * sourceColumns.length / 56)]);
  const sampledMax = Math.max(...sampledColumns);
  const columns = sampledColumns.map((value) => Math.max(1, Math.round((value * 16) / sampledMax)));
  const plotLeft = 53;
  const plotRight = 705;
  const baseline = 144;
  const columnStep = (plotRight - plotLeft) / columns.length;
  const groupSize = columns.length / labels.length;
  const maxHeight = Math.max(...columns);
  const dotStep = maxHeight > 1 ? Math.min(7.2, (baseline - 14) / (maxHeight - 1)) : 7.2;

  stopDotPlotAnimation(plot);
  plot.dataset.mode = mode;
  plot.replaceChildren();
  [16, 48, 80, 112, 144].forEach((y, index) => {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', plotLeft);
    line.setAttribute('x2', plotRight);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('class', 'plot-grid');
    plot.appendChild(line);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', 0);
    label.setAttribute('y', y + 3);
    label.setAttribute('class', 'plot-y-label');
    label.textContent = String(80 - index * 20);
    plot.appendChild(label);
  });

  columns.forEach((height, index) => {
    const x = plotLeft + columnStep * index + columnStep / 2;
    for (let dot = 0; dot < height; dot += 1) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', x.toFixed(2));
      circle.setAttribute('cy', baseline);
      circle.setAttribute('r', '2.35');
      circle.setAttribute('class', dot === height - 1 && index % 5 === 0 ? 'plot-dot accent' : 'plot-dot');
      circle.style.opacity = '0';
      circle.dataset.targetCy = String(baseline - dot * dotStep);
      const dayGroup = Math.floor(index / groupSize);
      const columnInDay = index % groupSize;
      circle.dataset.revealStart = String(dayGroup * 22 + columnInDay * 9 + dot * 34);
      circle.dataset.collapseOffset = String((height - 1 - dot) * 26 + columnInDay * 6 + dayGroup * 10);
      plot.appendChild(circle);
    }
  });

  labels.forEach((day, index) => {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', plotLeft + columnStep * (index * groupSize + groupSize / 2));
    label.setAttribute('y', 178);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'plot-day-label');
    label.textContent = day;
    plot.appendChild(label);
  });

  const footer = plot.closest('.load-panel')?.querySelector('.chart-footer');
  const loadTitle = plot.closest('.load-panel')?.querySelector('.load-title h3');
  if (loadTitle) loadTitle.innerHTML = `${profile.total} <span>calls</span><small>${profile.headlineDelta}</small>`;
  if (footer) {
    footer.querySelector('span:first-child').innerHTML = `<i class="pulse"></i> ${profile.peak}`;
    footer.querySelector('span:last-child').textContent = profile.delta;
  }

  const dots = [...plot.querySelectorAll('.plot-dot')];
  const dotState = dots.map((circle) => {
    const targetCy = Number(circle.dataset.targetCy);
    return {
      circle,
      revealStart: Number(circle.dataset.revealStart),
      targetCy,
      distance: baseline - targetCy,
      collapseOffset: Number(circle.dataset.collapseOffset),
      lastCy: Number.NaN,
      lastOpacity: Number.NaN,
    };
  });
  const revealDuration = 110;
  const resetDuration = 180;
  const holdDuration = 2500;
  const maxReveal = Math.max(...dotState.map(({ revealStart }) => revealStart + revealDuration));
  const collapseBase = maxReveal + holdDuration;
  const maxCollapse = Math.max(...dotState.map(({ collapseOffset }) => collapseOffset));
  const cycleDuration = collapseBase + maxCollapse + resetDuration;
  const updateDot = (state, cy, opacity) => {
    const { circle } = state;
    if (!Number.isNaN(state.lastCy) && Math.abs(state.lastCy - cy) < 0.05 && Math.abs(state.lastOpacity - opacity) < 0.015) return;
    if (Number.isNaN(state.lastCy) || Math.abs(state.lastCy - cy) >= 0.05) {
      circle.setAttribute('cy', cy.toFixed(2));
      state.lastCy = cy;
    }
    if (Number.isNaN(state.lastOpacity) || Math.abs(state.lastOpacity - opacity) >= 0.015) {
      circle.style.opacity = String(opacity);
      state.lastOpacity = opacity;
    }
  };

  const loopStartedAt = performance.now();
  const revealDots = (now) => {
    if (overviewView.hidden || document.hidden) {
      plot._waveFrame = null;
      return;
    }
    const phase = (now - loopStartedAt) % cycleDuration;
    dotState.forEach((state) => {
      const { revealStart, targetCy, distance, collapseOffset } = state;
      if (phase < maxReveal) {
        const progress = Math.min(1, Math.max(0, (phase - revealStart) / revealDuration));
        const eased = 1 - ((1 - progress) ** 3);
        updateDot(state, baseline - distance * eased, eased);
      } else if (phase < collapseBase) {
        updateDot(state, targetCy, 1);
      } else {
        const collapseStart = collapseBase + collapseOffset;
        const collapseProgress = Math.min(1, Math.max(0, (phase - collapseStart) / resetDuration));
        if (collapseProgress === 0) {
          updateDot(state, targetCy, 1);
        } else if (collapseProgress < 1) {
          updateDot(state, targetCy + distance * collapseProgress, 1 - collapseProgress);
        } else {
          updateDot(state, baseline, 0);
        }
      }
    });
    plot._waveFrame = requestAnimationFrame(revealDots);
  };
  plot._waveFrame = requestAnimationFrame(revealDots);
}

renderDotPlot('weekly');

document.addEventListener('visibilitychange', () => {
  const plot = document.querySelector('.dot-plot');
  if (document.hidden) {
    stopDotPlotAnimation(plot);
  } else if (!overviewView.hidden && plot) {
    renderDotPlot(plot.dataset.mode || 'weekly');
  }
});

async function updateSystemStatus() {
  const status = document.querySelector('#system-status');
  const count = document.querySelector('#knowledge-count');
  try {
    const response = await fetch('/health');
    if (!response.ok) throw new Error('Health check failed');
    const health = await response.json();
    status.textContent = health.status === 'ok' ? 'SYSTEM ONLINE' : 'SYSTEM CHECK';
    count.textContent = `${health.knowledge_chunks.toLocaleString('id-ID')} knowledge chunks ready`;
  } catch {
    status.textContent = 'SYSTEM OFFLINE';
    status.style.color = '#ff7070';
    count.textContent = 'API belum dapat dihubungi';
  }
}

updateSystemStatus();
