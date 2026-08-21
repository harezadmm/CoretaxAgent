const toast = document.querySelector('.toast');

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(window.toastTimer);
  window.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2400);
}

const screenStage = document.querySelector('#screen-stage');
const overviewView = document.querySelector('#overview');
const viewLabels = {
  overview: 'Support Operations',
  live: 'Live Calls',
  escalations: 'Escalations',
  history: 'Call History',
  knowledge: 'Knowledge Base',
  analytics: 'Analytics',
  workflow: 'Workflow Monitor',
  settings: 'Settings',
};

function screenHeader(kicker, title, description, action = '') {
  return `<div class="screen-heading"><div><p class="eyebrow">${kicker}</p><h2>${title}</h2><p class="subtle">${description}</p></div>${action}</div>`;
}

function screenStat(label, value, note, tone = 'cyan') {
  return `<article class="screen-stat"><span class="stat-mark ${tone}"></span><p>${label}</p><strong>${value}</strong><small>${note}</small></article>`;
}

function workflowIcon(title, fallback) {
  const key = /Incoming Call|Webhook/.test(title) ? 'webhook'
    : /Twilio|Send Answer/.test(title) ? 'twilio'
    : /Schedule KB/.test(title) ? 'schedule'
    : /Get Coretax Docs/.test(title) ? 'github'
    : /Extract.*Chunk|Documents/.test(title) ? 'document'
    : /Vector Search|Upsert Vectors/.test(title) ? 'postgres'
    : /Generate Embedding|Speech to Text|Detect Language|Coretax Agent|Generate Embeddings/.test(title) ? 'openai'
    : /Text Normalization|Format Context|Validate Answer|Caller Metadata/.test(title) ? 'code'
    : /User Query|Answer Ready/.test(title) ? 'pencil'
    : /Can AI Answer/.test(title) ? 'decision'
    : /Text to Speech/.test(title) ? 'tts'
    : /Create Escalation/.test(title) ? 'http'
    : /Notify Agent Team/.test(title) ? 'gmail'
    : /Save Transcript/.test(title) ? 'drive'
    : /Dashboard Update/.test(title) ? 'chart'
    : /Alert on Failure/.test(title) ? 'slack'
    : /Call Session|Update Session/.test(title) ? 'sheets'
    : 'generic';
  const paths = {
    webhook: '<path d="M12 4v4M7 18l3-5M17 18l-3-5"/><circle cx="12" cy="4" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><circle cx="12" cy="12" r="3"/>',
    twilio: '<circle cx="12" cy="12" r="8"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/>',
    sheets: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h6M12 9v10"/>',
    schedule: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    github: '<path d="M8 8l-3 4 3 4M16 8l3 4-3 4M13 6l-2 12"/>',
    document: '<path d="M7 3h7l3 3v15H7z"/><path d="M14 3v4h4M10 12h4M10 16h4"/>',
    postgres: '<path d="M7 6c0-3 10-3 10 0v9c0 3-10 3-10 0z"/><path d="M8 6c0 3 8 3 8 0M10 17v3M14 17v3"/>',
    openai: '<path d="M12 4a4 4 0 0 1 4 4v1a4 4 0 0 1 4 4 4 4 0 0 1-4 4h-1a4 4 0 0 1-4 4 4 4 0 0 1-4-4v-1a4 4 0 0 1-4-4 4 4 0 0 1 4-4h1a4 4 0 0 1 4-4z"/><path d="M8 8l8 8M16 8l-8 8"/>',
    code: '<path d="M9 7 5 12l4 5M15 7l4 5-4 5"/>',
    pencil: '<path d="m5 16 1-4 9-9 3 3-9 9zM5 16l4-1"/>',
    decision: '<path d="m12 4 7 4-7 4-7-4zM5 14l7 4 7-4M5 18l7 4 7-4"/>',
    tts: '<path d="M6 10v4h3l4 4V6l-4 4zM17 9a4 4 0 0 1 0 6M19 7a7 7 0 0 1 0 10"/>',
    http: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"/>',
    gmail: '<path d="M4 7l8 6 8-6v11H4zM4 7l8 6 8-6"/>',
    drive: '<path d="m9 4 6 0 5 9H8zM9 4 4 13l4 7h10l-5-7"/>',
    chart: '<path d="M5 19V9M10 19V5M15 19v-7M20 19V3"/>',
    slack: '<circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><path d="M10 8h4M8 10v4M14 16h-4M16 14v-4"/>',
    generic: `<text x="12" y="16" text-anchor="middle">${fallback}</text>`,
  };
  return `<i class="node-icon ${iconClassForWorkflowKey(key)}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg></i>`;
}

function iconClassForWorkflowKey(key) { return `icon-${key}`; }

function workflowNode(iconClass, icon, title, subtitle, meta, state = 'SUCCESS') {
  return `<div class="n8n-node flow-node"><span class="workflow-rendered-icon">${workflowIcon(title, icon)}</span><strong>${title}</strong><small>${subtitle}</small><em class="node-${state.toLowerCase()}">${state}</em>${meta ? `<span class="flow-node-meta">${meta}</span>` : ''}</div>`;
}

function workflowArrow(type = 'sync') {
  return `<span class="flow-arrow ${type === 'async' ? 'async' : ''}" aria-hidden="true">›</span>`;
}

const workflowScreen = () => `${screenHeader('AUTOMATION CONTROL PLANE', 'Workflow Monitor', 'Pantau workflow n8n AI Agent Coretax dari panggilan masuk sampai jawaban atau eskalasi petugas.', '<button class="primary-button" data-action="run-workflow">▶ Run test execution</button>')}
  <div class="workflow-summary"><span class="status-pill live-pill">● WORKFLOW ACTIVE</span><span>Last execution <b>2m 14s ago</b></span><span>Success rate <b class="success-text">98.7%</b></span><span>Avg. execution <b>1.84s</b></span><button class="outline-button" data-action="refresh-workflow">↻ Refresh</button></div>
  <div class="workflow-layout workflow-v2"><article class="workflow-canvas-panel"><div class="workflow-toolbar"><div><p class="panel-kicker">N8N WORKFLOW · CORETAX AI AGENT V2</p><h3>Inbound call → Coretax answer → human escalation</h3></div><div class="canvas-tools"><button data-action="zoom-out">−</button><span>100%</span><button data-action="zoom-in">＋</button></div></div><div class="n8n-canvas workflow-canvas-v2"><div class="canvas-grid"></div><div class="workflow-zones">
    <section class="workflow-zone zone-trigger"><div class="zone-heading"><span>1.</span> TRIGGER &amp; INPUT <em>REAL-TIME</em></div><div class="workflow-chain">${workflowNode('trigger','⚡','Incoming Call','Twilio Webhook','webhook','RUNNING')}${workflowArrow()}${workflowNode('voice','◉','Twilio','get: call','telephony')}${workflowArrow()}${workflowNode('data','▤','Call Session','Init · append','session')}${workflowArrow()}${workflowNode('code','{ }','Caller Metadata','Extract + sanitize','set')}</div></section>
    <section class="workflow-zone zone-voice"><div class="zone-heading"><span>2.</span> VOICE PROCESSING <em>REAL-TIME</em></div><div class="workflow-chain">${workflowNode('search','◎','Download Audio','from Twilio','HTTP Request')}${workflowArrow()}${workflowNode('brain','✦','Speech to Text','Whisper ASR','OpenAI')}${workflowArrow()}${workflowNode('code','{ }','Normalize Text','Clean + format','Code')}${workflowArrow()}${workflowNode('brain','✦','Detect Language','Bahasa Indonesia','Classifier')}${workflowArrow()}${workflowNode('context','✎','User Query','Sanitized input','set')}</div></section>
    <section class="workflow-zone zone-understanding"><div class="zone-heading"><span>3.</span> AI UNDERSTANDING <em>LLM + RAG</em></div><div class="workflow-chain">${workflowNode('brain','✦','Generate Embedding','User query','OpenAI')}${workflowArrow()}${workflowNode('data','▤','Vector Search','Coretax KB','pgvector')}${workflowArrow()}${workflowNode('code','{ }','Format Context','RAG prompt','Code')}${workflowArrow()}${workflowNode('brain','✦','Coretax Agent','Generate answer','LLM')}${workflowArrow()}${workflowNode('code','{ }','Validate Answer','Guardrails','Code')}${workflowArrow()}${workflowNode('context','✎','Answer Ready','Prepared response','set','RUNNING')}${workflowArrow()}${workflowNode('decision','◆','Can AI Answer?','Confidence check','if','RUNNING')}</div></section>
    <section class="workflow-zone zone-decision"><div class="zone-heading"><span>4.</span> DECISION &amp; ESCALATION <em>HUMAN HANDOVER</em></div><div class="workflow-branch-row"><div class="branch-path branch-true"><span class="branch-label">true</span>${workflowNode('voice','◖','Text to Speech','Voice response','ElevenLabs')}${workflowArrow()}${workflowNode('trigger','↗','Send Answer','Back to caller','Twilio')}${workflowArrow()}${workflowNode('data','▤','Update Session','Answered','sheet')}</div><div class="branch-path branch-false"><span class="branch-label">false</span>${workflowNode('search','◎','Create Escalation','FastAPI ticket','HTTP Request','IDLE')}${workflowArrow('async')}${workflowNode('alert','✉','Notify Agent Team','Email + dashboard','Gmail','IDLE')}${workflowArrow('async')}${workflowNode('data','▤','Update Session','Escalated','sheet','IDLE')}</div></div></section>
    <section class="workflow-zone zone-knowledge"><div class="zone-heading"><span>5.</span> KNOWLEDGE BASE <em>ASYNC / BACKGROUND</em></div><div class="workflow-chain">${workflowNode('trigger','◷','Schedule KB Sync','Daily trigger','cron')}${workflowArrow('async')}${workflowNode('data','⌂','Get Coretax Docs','GitHub / Drive','source')}${workflowArrow('async')}${workflowNode('code','{ }','Extract &amp; Chunk','Documents','splitter')}${workflowArrow('async')}${workflowNode('brain','✦','Generate Embeddings','Document chunks','OpenAI')}${workflowArrow('async')}${workflowNode('data','▤','Upsert Vectors','Postgres KB','pgvector')}</div></section>
    <section class="workflow-zone zone-monitoring"><div class="zone-heading"><span>6.</span> MONITORING &amp; LOGGING <em>ASYNC</em></div><div class="workflow-chain">${workflowNode('data','▤','Call Session Log','Transcript + status','append')}${workflowArrow('async')}${workflowNode('data','◆','Save Transcript','Drive archive','Google Drive')}${workflowArrow('async')}${workflowNode('chart','▥','Dashboard Update','Live metrics','HTTP Request')}${workflowArrow('async')}${workflowNode('alert','✦','Alert on Failure','Operator channel','Slack','IDLE')}</div></section>
  </div></div></article><aside class="execution-panel"><div class="table-panel-head"><div><p class="panel-kicker">EXECUTION LOG</p><h3>Latest runs</h3></div><button class="text-button">View all ›</button></div><div class="execution-list"><div class="execution-item"><i class="exec-state success">✓</i><div><strong>Run #001284</strong><small>Inbound call · Aktivasi akun</small></div><b>1.84s</b></div><div class="execution-item"><i class="exec-state success">✓</i><div><strong>Run #001283</strong><small>Inbound call · Kode billing</small></div><b>2.12s</b></div><div class="execution-item"><i class="exec-state warning">!</i><div><strong>Run #001282</strong><small>Escalated · Data NIK</small></div><b>3.48s</b></div><div class="execution-item"><i class="exec-state success">✓</i><div><strong>Run #001281</strong><small>Inbound call · Login</small></div><b>1.63s</b></div></div><div class="workflow-legend"><span><i class="legend-node success"></i>Completed</span><span><i class="legend-node running"></i>Running</span><span><i class="legend-node idle"></i>Idle</span></div></aside></div>`;

const workflowScreenExact = () => `${screenHeader('AUTOMATION CONTROL PLANE', 'Workflow Monitor', 'Pantau workflow n8n AI Agent Coretax dari panggilan masuk sampai jawaban atau eskalasi petugas.', '<button class="primary-button" data-action="run-workflow">&#9654; Run test execution</button>')}
  <article class="workflow-reference-panel"><div class="workflow-toolbar"><div><p class="panel-kicker">N8N WORKFLOW · CORETAX AI AGENT V2</p><h3>Inbound call → Coretax answer → human escalation</h3></div><div class="canvas-tools"><button data-action="zoom-out">−</button><span>100%</span><button data-action="zoom-in">＋</button></div></div><div class="n8n-canvas workflow-reference-canvas"><div class="canvas-grid"></div><div class="workflow-reference-content">
    <div class="workflow-reference-top"><section class="workflow-zone zone-trigger"><div class="zone-heading"><span>1.</span> TRIGGER &amp; INPUT <em>REAL-TIME</em></div><div class="workflow-chain">${workflowNode('trigger','⚡','Incoming Call','Twilio Webhook','webhook','RUNNING')}${workflowArrow()}${workflowNode('voice','◉','Twilio','get: call','success')}${workflowArrow()}${workflowNode('data','▤','Call Session','Init · append','sheet')}${workflowArrow()}${workflowNode('code','{ }','Extract Caller Info &amp; Metadata','set','')}</div></section><section class="workflow-zone zone-voice"><div class="zone-heading"><span>2.</span> VOICE PROCESSING (REAL-TIME)</div><div class="workflow-chain">${workflowNode('search','◎','Download Audio from Twilio','HTTP Request','')}${workflowArrow()}${workflowNode('brain','✦','Speech to Text','Whisper ASR','OpenAI Whisper')}${workflowArrow()}${workflowNode('code','{ }','Text Normalization &amp; Clean','Code','')}${workflowArrow()}${workflowNode('brain','✦','Detect Language','Bahasa Indonesia','Chat Model')}${workflowArrow()}${workflowNode('context','✎','User Query','Sanitized Input','set')}</div></section></div>
    <section class="workflow-zone zone-understanding"><div class="zone-heading"><span>3.</span> AI UNDERSTANDING (LLM + RAG)</div><div class="workflow-chain">${workflowNode('brain','✦','Generate Embedding','User Query','OpenAI Embeddings')}${workflowArrow()}${workflowNode('data','▤','Vector Search','Coretax KB','Postgres PGVector')}${workflowArrow()}${workflowNode('code','{ }','Format Context','RAG Prompt','Code')}${workflowArrow()}${workflowNode('brain','✦','LLM · Coretax Agent','Generate answer','OpenAI Chat Model')}${workflowArrow()}${workflowNode('code','{ }','Validate Answer','Guardrails','Code')}${workflowArrow()}${workflowNode('context','✎','Answer Ready','Prepared response','set')}${workflowArrow()}${workflowNode('decision','◆','Can AI Answer?','Confidence check','if','RUNNING')}</div></section>
    <section class="workflow-zone zone-decision"><div class="zone-heading"><span>4.</span> DECISION &amp; ESCALATION <em>HUMAN HANDOVER</em></div><div class="workflow-branch-row"><div class="branch-path branch-true"><span class="branch-label">true</span>${workflowNode('voice','◖','Text to Speech','Voice response','ElevenLabs')}${workflowArrow()}${workflowNode('trigger','↗','Send Answer back to Caller','Twilio','')}${workflowArrow()}${workflowNode('data','▤','Update Session','Answered','sheet')}</div><div class="branch-path branch-false"><span class="branch-label">false</span>${workflowNode('search','◎','Create Escalation','FastAPI ticket','HTTP Request','IDLE')}${workflowArrow('async')}${workflowNode('alert','✉','Notify Agent Team','Email + dashboard','Gmail','IDLE')}${workflowArrow('async')}${workflowNode('data','▤','Update Session','Escalated','sheet','IDLE')}</div></div></section>
    <div class="workflow-reference-async"><section class="workflow-zone zone-knowledge"><div class="zone-heading"><span>5.</span> KNOWLEDGE BASE (ASYNC / BACKGROUND)</div><div class="workflow-chain">${workflowNode('trigger','◷','Schedule KB Sync','Daily trigger','cron')}${workflowArrow('async')}${workflowNode('data','⌂','Get Coretax Docs','GitHub / Drive','source')}${workflowArrow('async')}${workflowNode('code','{ }','Extract &amp; Chunk Documents','Text splitter','')}${workflowArrow('async')}${workflowNode('brain','✦','Generate Embeddings','Document chunks','OpenAI Embeddings')}${workflowArrow('async')}${workflowNode('data','▤','Upsert Vectors to Postgres','Postgres PGVector','')}</div></section><section class="workflow-zone zone-monitoring"><div class="zone-heading"><span>6.</span> MONITORING &amp; LOGGING (ASYNC)</div><div class="workflow-chain">${workflowNode('data','▤','Call Session Log','Transcript + status','append')}${workflowArrow('async')}${workflowNode('data','◆','Save Transcript','Drive archive','Google Drive')}${workflowArrow('async')}${workflowNode('chart','▥','Dashboard Update','Live metrics','HTTP Request')}${workflowArrow('async')}${workflowNode('alert','✦','Alert on Failure','Operator channel','Slack','IDLE')}</div></section></div>
    <div class="workflow-reference-notes"><article class="workflow-info-panel"><h4>KETERANGAN ALUR</h4><ol><li>Panggilan masuk → Twilio webhook menerima event.</li><li>Audio diproses real-time → STT menjadi teks.</li><li>LLM + RAG mencari jawaban berdasarkan knowledge base Coretax.</li><li>Jika bisa dijawab → TTS → kirim jawaban ke caller.</li><li>Jika tidak → eskalasi ke petugas.</li><li>Semua interaksi dicatat untuk monitoring dan evaluasi.</li></ol></article><article class="workflow-info-panel"><h4>TEKNOLOGI &amp; INTEGRASI <small>(n8n Nodes)</small></h4><div class="workflow-tech-grid"><span>◉ Webhook</span><span>✦ OpenAI Chat Model</span><span>◎ HTTP Request</span><span>✦ OpenAI Embeddings</span><span>◷ Schedule Trigger</span><span>▤ Postgres PGVector</span><span>◉ Twilio</span><span>{ } Code / Function</span><span>▤ Google Sheets</span><span>⌂ Google Drive</span><span>✉ Gmail</span><span>◈ GitHub</span><span>◆ Slack</span></div></article><article class="workflow-info-panel"><h4>KOMPONEN UTAMA CORETAX AGENT</h4><ul><li>Voice Processing (STT + TTS)</li><li>LLM + RAG (Understanding)</li><li>Knowledge Base (Dokumen Resmi Coretax)</li><li>Decision &amp; Escalation (AI / Human Handover)</li><li>Monitoring &amp; Logging (Transparansi &amp; Evaluasi)</li></ul></article><article class="workflow-info-panel"><h4>ALUR EKSEKUSI</h4><div class="workflow-legend-lines"><span><i class="line-solid"></i>Real-time (Synchronous)</span><span><i class="line-dashed"></i>Asinkron (Background)</span><span><i class="line-dotted"></i>Data / Knowledge Flow</span></div></article></div>
  </div></div></article>`;

const screenTemplates = {
  live: () => `${screenHeader('REAL-TIME OPERATIONS', 'Live Calls', 'Pantau percakapan yang sedang berjalan dan ambil alih jika AI membutuhkan bantuan.', '<button class="primary-button" data-action="simulate-call">＋ Simulate incoming call</button>')}
    <div class="screen-stats">${screenStat('ACTIVE CALLS', '03', 'Semua AI sedang online', 'green')}${screenStat('WAITING QUEUE', '02', 'Rata-rata tunggu 00:18', 'amber')}${screenStat('AI HANDLING', '92%', 'Dari panggilan aktif', 'cyan')}${screenStat('PETUGAS ONLINE', '04', 'Siap mengambil alih', 'violet')}</div>
    <div class="two-column-screen"><article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">LIVE QUEUE</p><h3>Active conversations</h3></div><span class="status-pill live-pill">● LIVE</span></div><div class="live-call-cards"><div class="live-call-card"><div class="caller-icon">A</div><div><strong>08••• 8214</strong><span>Aktivasi akun Coretax</span></div><b>02:14</b><em class="answering">ANSWERING</em><button data-action="observe">Observe</button></div><div class="live-call-card"><div class="caller-icon secondary">R</div><div><strong>08••• 4416</strong><span>Pelaporan SPT tahunan</span></div><b>01:38</b><em class="searching">SEARCHING KB</em><button data-action="observe">Observe</button></div><div class="live-call-card"><div class="caller-icon third">S</div><div><strong>08••• 9031</strong><span>Login Coretax</span></div><b>00:47</b><em class="answering">ANSWERING</em><button data-action="takeover">Take over</button></div></div></article><article class="table-panel transcript-panel"><div class="table-panel-head"><div><p class="panel-kicker">SELECTED CALL · 08••• 8214</p><h3>Live transcript</h3></div><span class="signal">◉ 42 ms</span></div><div class="transcript"><div class="transcript-line ai"><small>AI · 10:42:08</small><p>Selamat datang di layanan informasi Coretax. Ada yang bisa saya bantu?</p></div><div class="transcript-line caller"><small>CALLER · 10:42:16</small><p>Saya mau aktivasi akun Coretax, tapi foto saya selalu gagal.</p></div><div class="transcript-line ai"><small>AI · 10:42:22</small><p>Baik, saya sedang mencari panduan aktivasi akun yang sesuai.</p></div></div><button class="outline-button" data-action="takeover">Take over conversation ↗</button></article></div>`,
  escalations: () => `${screenHeader('ACTION REQUIRED', 'Escalations', 'Kasus yang belum dapat diselesaikan AI dan membutuhkan tindak lanjut petugas.', '<button class="primary-button" data-action="refresh">↻ Refresh queue</button>')}
    <div class="screen-stats">${screenStat('OPEN CASES', '12', '＋3 sejak 1 jam terakhir', 'amber')}${screenStat('HIGH PRIORITY', '03', 'Perlu respons segera', 'red')}${screenStat('AVG. RESPONSE', '04:18', '−32s dari kemarin', 'green')}${screenStat('RESOLVED TODAY', '38', '91% selesai hari ini', 'cyan')}</div>
    <article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">CASE QUEUE</p><h3>Needs human attention</h3></div><div class="filter-pills"><button class="active">All 12</button><button>High 03</button><button>Mine 02</button></div></div><div class="data-table"><div class="data-row data-head"><span>CASE</span><span>TOPIC</span><span>REASON</span><span>AGE</span><span>STATUS</span><span></span></div><div class="data-row"><span><b class="case-id">#CX-0182</b><small>08••• 4218</small></span><span>Aktivasi akun</span><span>Foto identitas gagal divalidasi</span><span class="mono">04m</span><span><em class="priority-high">HIGH</em></span><button class="row-action" data-action="assign">Assign</button></div><div class="data-row"><span><b class="case-id">#CX-0181</b><small>08••• 1903</small></span><span>Kode billing</span><span>Tidak ditemukan pada knowledge base</span><span class="mono">12m</span><span><em class="priority-medium">MED</em></span><button class="row-action" data-action="assign">Assign</button></div><div class="data-row"><span><b class="case-id">#CX-0179</b><small>08••• 8881</small></span><span>Data NIK</span><span>Memerlukan pengecekan data personal</span><span class="mono">18m</span><span><em class="priority-medium">MED</em></span><button class="row-action" data-action="assign">Assign</button></div><div class="data-row"><span><b class="case-id">#CX-0176</b><small>08••• 5570</small></span><span>Pelaporan SPT</span><span>Pengguna meminta keputusan pajak</span><span class="mono">26m</span><span><em class="priority-low">LOW</em></span><button class="row-action" data-action="assign">Assign</button></div></div></article>`,
  history: () => `${screenHeader('SERVICE RECORDS', 'Call History', 'Riwayat panggilan, transkrip, dan hasil penanganan layanan Coretax.', '<label class="screen-search">⌕ <input placeholder="Search caller or topic..." /></label>')}
    <div class="screen-stats">${screenStat('TOTAL CALLS', '1,284', '7 hari terakhir', 'cyan')}${screenStat('RESOLVED', '1,106', '86.1% resolved', 'green')}${screenStat('ESCALATED', '178', '13.9% to staff', 'amber')}${screenStat('AVG. HANDLE TIME', '03:42', '−18s improvement', 'violet')}</div>
    <article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">ALL INTERACTIONS</p><h3>Recent call history</h3></div><div class="filter-pills"><button class="active">Last 7 days</button><button>Resolved</button><button>Escalated</button></div></div><div class="data-table history-table"><div class="data-row data-head"><span>CALL ID</span><span>CALLER</span><span>TOPIC</span><span>DATE</span><span>RESULT</span><span></span></div><div class="data-row"><span class="case-id">#CALL-7421</span><span>08••• 8214</span><span>Aktivasi akun</span><span class="mono">Today 10:42</span><span><em class="resolved">RESOLVED AI</em></span><button class="row-action" data-action="details">Details</button></div><div class="data-row"><span class="case-id">#CALL-7420</span><span>08••• 4416</span><span>Pelaporan SPT</span><span class="mono">Today 10:39</span><span><em class="priority-medium">ESCALATED</em></span><button class="row-action" data-action="details">Details</button></div><div class="data-row"><span class="case-id">#CALL-7419</span><span>08••• 9031</span><span>Login Coretax</span><span class="mono">Today 10:34</span><span><em class="resolved">RESOLVED AI</em></span><button class="row-action" data-action="details">Details</button></div><div class="data-row"><span class="case-id">#CALL-7418</span><span>08••• 5570</span><span>Kode otorisasi DJP</span><span class="mono">Today 10:30</span><span><em class="resolved">RESOLVED AI</em></span><button class="row-action" data-action="details">Details</button></div></div></article>`,
  knowledge: () => `${screenHeader('RETRIEVAL SOURCES', 'Knowledge Base', 'Kelola dokumen resmi yang digunakan AI untuk menjawab pertanyaan Coretax.', '<button class="primary-button" data-action="upload">＋ Add source</button>')}
    <div class="screen-stats">${screenStat('ACTIVE SOURCES', '284', '230 FAQ + 54 PDF', 'green')}${screenStat('RAG CHUNKS', '3,035', 'Deduplicated content', 'cyan')}${screenStat('LAST SYNC', '12m ago', 'All sources up to date', 'violet')}${screenStat('NEEDS REVIEW', '06', 'Marked by operators', 'amber')}</div>
    <div class="knowledge-grid"><article class="table-panel source-list"><div class="table-panel-head"><div><p class="panel-kicker">SOURCE LIBRARY</p><h3>Official Coretax content</h3></div><label class="screen-search">⌕ <input placeholder="Search documents..." /></label></div><div class="source-item"><span class="file-icon pdf">PDF</span><div><strong>BUKU MANUAL CORETAX 2024</strong><small>Official DJP · 1,530 chunks · updated 12m ago</small></div><em class="source-live">ACTIVE</em><button class="row-action" data-action="open-source">Open</button></div><div class="source-item"><span class="file-icon faq">FAQ</span><div><strong>CORETAXPEDIA FAQ COLLECTION</strong><small>Official FAQ · 230 pages · updated 12m ago</small></div><em class="source-live">ACTIVE</em><button class="row-action" data-action="open-source">Open</button></div><div class="source-item"><span class="file-icon pdf">PDF</span><div><strong>PANDUAN AKTIVASI AKUN 2025</strong><small>Official DJP · 75 chunks · updated yesterday</small></div><em class="source-review">REVIEW</em><button class="row-action" data-action="open-source">Open</button></div></article><article class="table-panel source-health"><div class="table-panel-head"><div><p class="panel-kicker">RAG HEALTH</p><h3>Retrieval quality</h3></div><span class="status-pill live-pill">● HEALTHY</span></div><div class="health-score"><strong>98.4</strong><span>/ 100</span></div><div class="health-bars"><div><span>Source coverage</span><b>100%</b><i><em style="width:100%"></em></i></div><div><span>Duplicate control</span><b>96%</b><i><em style="width:96%"></em></i></div><div><span>Freshness</span><b>98%</b><i><em style="width:98%"></em></i></div></div><button class="outline-button" data-action="sync">↻ Sync official sources</button></article></div>`,
  analytics: () => `${screenHeader('SERVICE INTELLIGENCE', 'Analytics', 'Pahami pola pertanyaan pengguna dan efektivitas AI dari waktu ke waktu.', '<div class="period-picker screen-period"><button>Day</button><button class="active">7 days</button><button>Month</button></div>')}
    <div class="screen-stats">${screenStat('CONTAINMENT RATE', '86.1%', '+4.8% this period', 'green')}${screenStat('AVG. RESPONSE', '1.8s', '−0.3s improvement', 'cyan')}${screenStat('CUSTOMER SENTIMENT', '4.6/5', 'Based on 312 ratings', 'violet')}${screenStat('TOPIC COVERAGE', '92%', 'Official KB match', 'amber')}</div>
    <div class="analytics-grid"><article class="table-panel analytics-chart"><div class="table-panel-head"><div><p class="panel-kicker">QUESTION VOLUME</p><h3>Topics over time</h3></div><span class="muted-label">7 DAYS · 1,284 CALLS</span></div><div class="mini-bars"><i style="height:43%"></i><i style="height:58%"></i><i style="height:48%"></i><i style="height:76%"></i><i style="height:66%"></i><i style="height:93%"></i><i style="height:81%"></i><i style="height:100%"></i><i style="height:87%"></i><i style="height:72%"></i><i style="height:90%"></i><i style="height:61%"></i></div><div class="mini-axis"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></article><article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">TOP INTENTS</p><h3>What users ask</h3></div></div><ol class="rank-list"><li><span>01</span><strong>Aktivasi akun</strong><b>32%</b></li><li><span>02</span><strong>Kode otorisasi</strong><b>24%</b></li><li><span>03</span><strong>Kode billing</strong><b>18%</b></li><li><span>04</span><strong>Pelaporan SPT</strong><b>14%</b></li><li><span>05</span><strong>Login Coretax</strong><b>12%</b></li></ol></article></div>`,
  workflow: () => `${screenHeader('AUTOMATION CONTROL PLANE', 'Workflow Monitor', 'Pantau workflow n8n AI Agent Coretax dari panggilan masuk sampai jawaban atau eskalasi petugas.', '<button class="primary-button" data-action="run-workflow">▶ Run test execution</button>')}
    <div class="workflow-summary"><span class="status-pill live-pill">● WORKFLOW ACTIVE</span><span>Last execution <b>2m 14s ago</b></span><span>Success rate <b class="success-text">98.7%</b></span><span>Avg. execution <b>1.84s</b></span><button class="outline-button" data-action="refresh-workflow">↻ Refresh</button></div>
    <div class="workflow-layout"><article class="workflow-canvas-panel"><div class="workflow-toolbar"><div><p class="panel-kicker">N8N WORKFLOW · CORETAX AI AGENT V1</p><h3>Inbound call → AI answer → human escalation</h3></div><div class="canvas-tools"><button data-action="zoom-out">−</button><span>100%</span><button data-action="zoom-in">＋</button></div></div><div class="n8n-canvas"><div class="canvas-grid"></div><div class="workflow-link link-a"></div><div class="workflow-link link-b"></div><div class="workflow-link link-c"></div><div class="workflow-link link-d"></div><div class="workflow-link link-e"></div><div class="workflow-link link-f"></div><div class="workflow-link link-g"></div><div class="workflow-link link-h"></div><div class="n8n-node node-trigger"><i class="node-icon trigger">◷</i><strong>Incoming Call</strong><small>Webhook / Twilio</small><em class="node-ok">SUCCESS</em></div><div class="n8n-node node-context"><i class="node-icon context">✎</i><strong>Set Context</strong><small>Caller + session</small><em class="node-ok">SUCCESS</em></div><div class="n8n-node node-stt"><i class="node-icon voice">◒</i><strong>Speech to Text</strong><small>Whisper / ASR</small><em class="node-ok">SUCCESS</em></div><div class="n8n-node node-router"><i class="node-icon code">{ }</i><strong>Intent Router</strong><small>Classify question</small><em class="node-running">RUNNING</em></div><div class="n8n-node node-rag"><i class="node-icon search">⌕</i><strong>Coretax RAG</strong><small>3,035 chunks</small><em class="node-ok">SUCCESS</em></div><div class="n8n-node node-llm"><i class="node-icon brain">✦</i><strong>AI Agent</strong><small>LLM + Guardrails</small><em class="node-ok">SUCCESS</em></div><div class="n8n-node node-tts"><i class="node-icon voice">◖</i><strong>Text to Speech</strong><small>Return voice response</small><em class="node-ok">SUCCESS</em></div><div class="n8n-node node-escalate"><i class="node-icon alert">⚠</i><strong>Create Escalation</strong><small>Case + staff queue</small><em class="node-idle">IDLE</em></div><div class="n8n-node node-log"><i class="node-icon data">▤</i><strong>Log Conversation</strong><small>Save transcript</small><em class="node-ok">SUCCESS</em></div><div class="n8n-node node-notify"><i class="node-icon notify">✉</i><strong>Notify Staff</strong><small>Email / dashboard</small><em class="node-idle">IDLE</em></div></div></article><aside class="execution-panel"><div class="table-panel-head"><div><p class="panel-kicker">EXECUTION LOG</p><h3>Latest runs</h3></div><button class="text-button">View all ›</button></div><div class="execution-list"><div class="execution-item"><i class="exec-state success">✓</i><div><strong>Run #001284</strong><small>Inbound call · Aktivasi akun</small></div><b>1.84s</b></div><div class="execution-item"><i class="exec-state success">✓</i><div><strong>Run #001283</strong><small>Inbound call · Kode billing</small></div><b>2.12s</b></div><div class="execution-item"><i class="exec-state warning">!</i><div><strong>Run #001282</strong><small>Escalated · Data NIK</small></div><b>3.48s</b></div><div class="execution-item"><i class="exec-state success">✓</i><div><strong>Run #001281</strong><small>Inbound call · Login</small></div><b>1.63s</b></div></div><div class="workflow-legend"><span><i class="legend-node success"></i>Completed</span><span><i class="legend-node running"></i>Running</span><span><i class="legend-node idle"></i>Idle</span></div></aside></div>`,
  workflow: workflowScreenExact,
  settings: () => `${screenHeader('SYSTEM CONFIGURATION', 'Settings', 'Atur perilaku agent, routing eskalasi, dan koneksi operasional.', '<button class="primary-button" data-action="save-settings">Save changes</button>')}
    <div class="settings-grid"><article class="table-panel settings-panel"><div class="table-panel-head"><div><p class="panel-kicker">AI AGENT</p><h3>Response policy</h3></div><span class="status-pill live-pill">● CONFIGURED</span></div><label class="setting-row"><span><strong>Use official sources only</strong><small>AI menolak jawaban di luar knowledge base.</small></span><input type="checkbox" checked /></label><label class="setting-row"><span><strong>Escalate personal questions</strong><small>Data personal selalu diteruskan ke petugas.</small></span><input type="checkbox" checked /></label><label class="setting-row"><span><strong>Record transcript</strong><small>Simpan transkrip untuk audit dan evaluasi.</small></span><input type="checkbox" checked /></label></article><article class="table-panel settings-panel"><div class="table-panel-head"><div><p class="panel-kicker">OPERATIONS</p><h3>Routing & notifications</h3></div></div><label class="field-label">Escalation team<select><option>Coretax Support Desk</option><option>Taxpayer Service</option></select></label><label class="field-label">Priority threshold<select><option>Personal or transactional</option><option>Low confidence only</option></select></label><label class="field-label">Notification channel<select><option>Dashboard + Email</option><option>Dashboard only</option></select></label></article></div>`,
};

function navigateToView(view) {
  document.querySelectorAll('.nav-item').forEach((entry) => entry.classList.toggle('active', entry.dataset.view === view));
  document.querySelector('#page-title').textContent = viewLabels[view] || view;
  if (view === 'overview') {
    overviewView.hidden = false;
    screenStage.hidden = true;
    renderDotPlot();
    return;
  }
  overviewView.hidden = true;
  screenStage.hidden = false;
  screenStage.innerHTML = screenTemplates[view] ? screenTemplates[view]() : screenTemplates.overview?.() || '';
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

  if (plot._waveFrame) cancelAnimationFrame(plot._waveFrame);
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
  const revealDuration = 110;
  const resetDuration = 180;
  const holdDuration = 2500;
  const maxReveal = Math.max(...dots.map((circle) => Number(circle.dataset.revealStart) + revealDuration));
  const collapseBase = maxReveal + holdDuration;
  const maxCollapse = Math.max(...dots.map((circle) => Number(circle.dataset.collapseOffset)));
  const cycleDuration = collapseBase + maxCollapse + resetDuration;

  const loopStartedAt = performance.now();
  const revealDots = (now) => {
    const phase = (now - loopStartedAt) % cycleDuration;
    dots.forEach((circle) => {
      const start = Number(circle.dataset.revealStart);
      const targetCy = Number(circle.dataset.targetCy);
      const distance = baseline - targetCy;
      if (phase < maxReveal) {
        const progress = Math.min(1, Math.max(0, (phase - start) / revealDuration));
        const eased = 1 - ((1 - progress) ** 3);
        circle.setAttribute('cy', (baseline - distance * eased).toFixed(2));
        circle.style.opacity = String(eased);
      } else if (phase < collapseBase) {
        circle.setAttribute('cy', targetCy.toFixed(2));
        circle.style.opacity = '1';
      } else {
        const collapseStart = collapseBase + Number(circle.dataset.collapseOffset);
        const collapseProgress = Math.min(1, Math.max(0, (phase - collapseStart) / resetDuration));
        if (collapseProgress === 0) {
          circle.setAttribute('cy', targetCy.toFixed(2));
          circle.style.opacity = '1';
        } else if (collapseProgress < 1) {
          circle.setAttribute('cy', (targetCy + distance * collapseProgress).toFixed(2));
          circle.style.opacity = String(1 - collapseProgress);
        } else {
          circle.setAttribute('cy', baseline);
          circle.style.opacity = '0';
        }
      }
    });
    plot._waveFrame = requestAnimationFrame(revealDots);
  };
  plot._waveFrame = requestAnimationFrame(revealDots);
}

renderDotPlot('weekly');

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
