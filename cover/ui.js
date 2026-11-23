// DOM side of the editor: hierarchy, inspector, project browser, console and the play HUD.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const BIO = "I'm a game developer who loves crafting immersive experiences and exploring innovative mechanics. My current work focuses on gamifying education to make learning more fun.";
const SKILLS = ['Unity', 'C#', 'C++', '3D Math', 'Blender'];

export function createUI(data, catalog, on) {
  const inspector = $('#inspector');
  const logEl = $('#console-log');
  let vecEls = [];
  let vecText = '';

  const transform = () => `
    <section class="comp"><h3>Transform</h3><div class="comp-body">
      <div class="row"><span>Position</span><span class="vec" id="insp-pos"><span data-axis="X">0.00</span><span data-axis="Y">0.00</span><span data-axis="Z">0.00</span></span></div>
    </div></section>`;

  function inspectorHTML(e, info) {
    if (e.kind === 'project') {
      return `
        <div class="insp-head"><span class="insp-cube" style="--c:${e.zone.css}"></span>
          <div><strong>${esc(e.title)}</strong><small>Tag: ${e.zone.label} · Layer: Projects</small></div></div>
        <a class="insp-thumb" style="--c:${e.zone.css}" href="${e.href}"><img src="${e.thumb}" alt="${esc(e.title)}"></a>
        <section class="comp"><h3>Project</h3><div class="comp-body">
          <p>${esc(e.desc)}</p>
          <a class="btn primary" href="${e.href}">Learn more</a>
          <button class="btn" type="button" data-act="focus">Focus</button>
        </div></section>${transform()}`;
    }
    if (e.kind === 'zone') {
      const rows = e.children.map((id) => `<li><button type="button" data-select="${id}">${esc(catalog.get(id).title)}</button></li>`).join('');
      return `
        <div class="insp-head"><span class="insp-cube" style="--c:${e.zone.css}"></span>
          <div><strong>${esc(e.title)}</strong><small>${e.children.length} project${e.children.length === 1 ? '' : 's'}</small></div></div>
        <section class="comp"><h3>Island</h3><div class="comp-body">
          <p>${esc(e.zone.blurb)}</p><ul class="links">${rows}</ul>
        </div></section>${transform()}`;
    }
    if (e.kind === 'camera') {
      return `
        <div class="insp-head"><span class="insp-cube"></span><div><strong>Main Camera</strong><small>Perspective · FOV 32</small></div></div>
        <section class="comp"><h3>Camera</h3><div class="comp-body">
          <p>Drag to orbit. Scroll or pinch to zoom.</p>
          <button class="btn" type="button" data-act="reset">Reset view</button>
        </div></section>${transform()}`;
    }
    if (e.kind === 'chest') {
      const body = info.complete
        ? `<p>Open. Thanks for playing the whole thing.</p><a class="btn primary" href="mailto:${data.email}">Email Frank</a>`
        : '<p>Locked. Find every gem and visit every island to open it.</p><button class="btn primary" type="button" data-act="play">Play</button>';
      return `
        <div class="insp-head"><span class="insp-cube" style="--c:var(--work)"></span>
          <div><strong>Treasure Chest</strong><small>${info.complete ? 'Unlocked' : 'Locked'}</small></div></div>
        <section class="comp"><h3>Reward</h3><div class="comp-body">${body}</div></section>${transform()}`;
    }
    return `
      <div class="insp-head"><img class="insp-face" src="${data.base}/images/profile_pic.jpg" alt="${esc(data.author)}">
        <div><strong>${esc(data.author)}</strong><small>Tag: Player · Game Developer</small></div></div>
      <section class="comp"><h3>Bio</h3><div class="comp-body">
        <p>${esc(BIO)}</p>
        <ul class="chips">${SKILLS.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        <button class="btn primary" type="button" data-act="play">Play as Frank</button>
        <a class="btn" href="${data.base}/about/">About me</a>
      </div></section>${transform()}
      <section class="comp"><h3>Links</h3><div class="comp-body"><ul class="links">
        <li><a href="${data.github}" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="${data.linkedin}" target="_blank" rel="noopener">LinkedIn</a></li>
        <li><a href="${data.twitter}" target="_blank" rel="noopener">X</a></li>
        <li><a href="mailto:${data.email}">Email</a></li>
      </ul></div></section>`;
  }

  function setSelection(e, info) {
    inspector.innerHTML = inspectorHTML(e, info);
    inspector.scrollTop = 0;
    vecEls = $$('#insp-pos span', inspector);
    vecText = '';
    $$('.tree button').forEach((b) => b.classList.toggle('sel', b.dataset.select === e.id));
    $$('.asset').forEach((a) => a.classList.toggle('sel', a.dataset.entity === e.id));
    const row = $(`.tree button[data-select="${e.id}"]`);
    if (row && row.offsetParent) row.scrollIntoView({ block: 'nearest' });
  }

  function setTransform(x, y, z) {
    if (vecEls.length !== 3) return;
    const text = `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}`;
    if (text === vecText) return;
    vecText = text;
    const parts = text.split('|');
    vecEls.forEach((el, i) => { el.textContent = parts[i]; });
  }

  function setHover(id) {
    $$('.tree button').forEach((b) => b.classList.toggle('hov', b.dataset.select === id));
    $$('.asset').forEach((a) => a.classList.toggle('hov', a.dataset.entity === id));
  }

  // msg is trusted markup written by this app; escape user input before passing it in.
  function log(msg, kind = '') {
    const ln = document.createElement('div');
    ln.className = `ln ${kind}`;
    const time = document.createElement('time');
    time.textContent = new Date().toTimeString().slice(0, 8);
    const text = document.createElement('span');
    text.innerHTML = msg;
    ln.append(time, text);
    logEl.append(ln);
    while (logEl.children.length > 150) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }
  const clearLog = () => { logEl.textContent = ''; };

  function setMode(mode) {
    const playing = mode === 'play';
    document.body.dataset.mode = mode;
    $('#tab-scene').classList.toggle('off', playing);
    $('#tab-game').classList.toggle('off', !playing);
  }

  // The hello note and the controls hint both leave once the visitor starts moving.
  const showIntro = (show) => {
    $('#title').classList.toggle('is-away', !show);
    $('#help').classList.toggle('is-away', !show);
  };
  const sheet = (open) => {
    $('#sheet').hidden = !open;
    if (open) $('#sheet-close').focus({ preventScroll: true });
  };

  function setLoading(frac, done) {
    $('#loading-bar').style.width = `${Math.round(frac * 100)}%`;
    if (done) $('#loading').classList.add('is-done');
  }

  const fpsEl = $('#fps');
  const setFps = (n) => { fpsEl.textContent = `${n} fps`; };

  const tip = $('#tooltip');
  function tooltip(text, x, y) {
    if (!text) { tip.hidden = true; return; }
    tip.textContent = text;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    tip.hidden = false;
  }

  // ---- Play HUD ----
  const hud = {
    // The gem counter only appears once the first gem is found.
    progress(gems, total) {
      $('#progress').hidden = gems === 0;
      $('#p-gems').textContent = `${gems}/${total}`;
    },
    toast(html) {
      const box = $('#toasts');
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = html;
      box.append(el);
      while (box.children.length > 3) box.firstChild.remove();
      setTimeout(() => el.remove(), 3300);
    },
    prompt(text) {
      const el = $('#prompt');
      el.hidden = !text;
      if (text) el.querySelector('span').textContent = text;
    },
    card(c) {
      const el = $('#level-card');
      if (!c) { el.hidden = true; return; }
      const img = $('#card-img');
      img.hidden = !c.img;
      if (c.img) img.src = c.img;
      $('#card-zone').textContent = c.kicker;
      $('#card-title').textContent = c.title;
      $('#card-desc').textContent = c.desc;
      const open = $('#card-open');
      open.href = c.href;
      open.textContent = c.action;
      el.hidden = false;
      open.focus({ preventScroll: true });
    },
  };

  // ---- Wiring ----
  $$('.tree button').forEach((b) => {
    const id = b.dataset.select;
    b.addEventListener('click', () => on.select(id, { focus: true }));
    b.addEventListener('dblclick', () => on.open(id));
    b.addEventListener('mouseenter', () => on.hover(id));
    b.addEventListener('mouseleave', () => on.hover(null));
  });
  $$('.asset').forEach((a) => {
    const id = a.dataset.entity;
    a.addEventListener('mouseenter', () => { on.hover(id); on.select(id, { focus: false }); });
    a.addEventListener('mouseleave', () => on.hover(null));
    a.addEventListener('focus', () => on.select(id, { focus: false }));
  });
  inspector.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) { on.act(act.dataset.act); return; }
    const sel = e.target.closest('[data-select]');
    if (sel) on.select(sel.dataset.select, { focus: true });
  });

  $$('#folders button').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.folder;
    $$('#folders button').forEach((x) => x.classList.toggle('on', x === b));
    $$('.asset').forEach((a) => { a.hidden = f !== 'all' && a.dataset.zone !== f; });
    $('#crumb').textContent = f === 'all' ? 'Assets / Projects' : `Assets / Projects / ${b.textContent.trim()}`;
  }));

  const dockTab = (which) => {
    $('#tab-project').classList.toggle('off', which !== 'project');
    $('#tab-console').classList.toggle('off', which !== 'console');
    $('#dock-project').hidden = which !== 'project';
    $('#dock-console').hidden = which !== 'console';
    if (which === 'console') { logEl.scrollTop = logEl.scrollHeight; $('#console-input').focus(); }
  };
  $('#tab-project').addEventListener('click', () => dockTab('project'));
  $('#tab-console').addEventListener('click', () => dockTab('console'));
  $('#console-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#console-input');
    on.command(input.value);
    input.value = '';
  });

  $('#btn-play').addEventListener('click', () => on.play());
  $('#tab-game').addEventListener('click', () => on.play());
  $('#tab-scene').addEventListener('click', () => on.stop());
  $('#btn-edit').addEventListener('click', () => on.stop());
  $('#btn-projects').addEventListener('click', () => on.sheet(true));
  $('#btn-list').addEventListener('click', () => on.sheet(true));
  $('#sheet-close').addEventListener('click', () => on.sheet(false));
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') on.sheet(false); });
  $('#prompt').addEventListener('click', () => on.interact());
  $('#card-close').addEventListener('click', () => on.closeCard());
  $('#level-card').addEventListener('click', (e) => { if (e.target.id === 'level-card') on.closeCard(); });

  return { setSelection, setTransform, setHover, log, clearLog, setMode, showIntro, sheet, setLoading, setFps, tooltip, hud };
}
