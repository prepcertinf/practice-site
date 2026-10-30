// App logic. You normally don't need to edit this file.
const app = document.getElementById("app");
document.title = CONFIG.siteTitle;

const esc = s => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function parse(text) {
  return text.trim().split(/\n\s*\n/).map(block => {
    const q = { topic: "", text: "", expl: "", opts: [] };
    block.split("\n").map(l => l.trim()).forEach(l => {
      if (/^T:/i.test(l)) q.topic = l.slice(2).trim();
      else if (/^Q:/i.test(l)) q.text = l.slice(2).trim();
      else if (/^E:/i.test(l)) q.expl = l.slice(2).trim();
      else if (/^A:/i.test(l)) {
        const t = l.slice(2).trim();
        q.opts.push({ t: t.replace(/\*\s*$/, "").trim(), c: /\*\s*$/.test(t) });
      }
    });
    return q.text && q.opts.length > 1 ? q : null;
  }).filter(Boolean);
}

const ALL = parse(QUESTIONS);
let qs, i, score, missed, answered;

function home() {
  const topics = [...new Set(ALL.map(q => q.topic).filter(Boolean))];
  app.innerHTML = `<h1>${esc(CONFIG.siteTitle)}</h1><p class="hint">${esc(CONFIG.subtitle)}</p>
    ${topics.length ? `<label for="topic">Topic</label><select id="topic"><option value="">All topics</option>${topics.map(t => `<option>${esc(t)}</option>`).join("")}</select>` : ""}
    <button class="go" id="start">${esc(CONFIG.startButton)}</button>`;
  document.getElementById("start").onclick = () => {
    const sel = document.getElementById("topic");
    start(sel ? sel.value : "");
  };
}

function start(topic) {
  let pool = topic ? ALL.filter(q => q.topic === topic) : ALL;
  if (CONFIG.shuffleQuestions) pool = shuffle(pool);
  if (CONFIG.questionsPerRound > 0) pool = pool.slice(0, CONFIG.questionsPerRound);
  qs = pool; i = 0; score = 0; missed = []; show();
}

function show() {
  if (i >= qs.length) return done();
  answered = false;
  const q = qs[i], opts = CONFIG.shuffleAnswers ? shuffle(q.opts) : q.opts;
  app.innerHTML = `<div class="top"><span>Question ${i + 1} of ${qs.length}</span><span>Score ${score}</span></div>
    <div class="bar"><i style="width:${i / qs.length * 100}%"></i></div>
    <h1>${esc(q.text)}</h1>
    <div class="slot" id="slot">Drag the correct answer here</div>
    <div class="chips">${opts.map((o, k) => `<button class="chip" data-k="${k}">${esc(o.t)}</button>`).join("")}</div>
    <div class="msg" id="msg" aria-live="polite"></div><div id="next"></div>`;
  const slot = document.getElementById("slot");
  app.querySelectorAll(".chip").forEach(chip => wire(chip, slot, opts[chip.dataset.k], q));
}

function wire(chip, slot, opt, q) {
  chip.addEventListener("pointerdown", e => {
    if (answered) return;
    const sx = e.clientX, sy = e.clientY, r = chip.getBoundingClientRect();
    let ghost = null;
    const over = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest("#slot"); };
    const move = ev => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        ghost = chip.cloneNode(true); ghost.className = "chip ghost"; ghost.style.width = r.width + "px"; document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = ev.clientX - r.width / 2 + "px"; ghost.style.top = ev.clientY - r.height / 2 + "px";
        slot.classList.toggle("hover", !!over(ev.clientX, ev.clientY));
      }
    };
    const up = ev => {
      ["pointermove", "pointerup", "pointercancel"].forEach((n, k) => window.removeEventListener(n, [move, up, up][k]));
      slot.classList.remove("hover");
      if (ghost) { ghost.remove(); if (over(ev.clientX, ev.clientY)) place(slot, opt, q); }
      else place(slot, opt, q); // a tap also places the answer
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
}

function place(slot, opt, q) {
  if (answered) return; answered = true;
  const msg = document.getElementById("msg"), right = q.opts.find(o => o.c);
  slot.textContent = opt.t; slot.classList.add(opt.c ? "ok" : "bad");
  app.querySelectorAll(".chip").forEach(c => c.classList.add("used"));
  if (opt.c) { score++; msg.className = "msg ok"; msg.textContent = "Correct"; }
  else {
    missed.push({ q: q.text, yours: opt.t, right: right ? right.t : "" });
    msg.className = "msg bad"; msg.innerHTML = `Not quite.<div class="hint">Correct answer: ${esc(right ? right.t : "")}</div>`;
  }
  if (CONFIG.showExplanations && q.expl) msg.innerHTML += `<div class="hint">${esc(q.expl)}</div>`;
  document.getElementById("next").innerHTML = `<button class="go" id="nx">${esc(i + 1 < qs.length ? CONFIG.nextButton : CONFIG.finishButton)}</button>`;
  const nx = document.getElementById("nx"); nx.focus(); nx.onclick = () => { i++; show(); };
}

function done() {
  const pct = qs.length ? Math.round(score / qs.length * 100) : 0;
  app.innerHTML = `<div class="bar"><i style="width:100%"></i></div>
    <h1>${pct >= CONFIG.passMark ? "Passed" : "Keep practicing"}</h1><div class="big">${pct}%</div>
    <div class="hint">${score} of ${qs.length} correct. Pass mark: ${CONFIG.passMark}%</div>
    ${missed.length ? `<h1 style="margin-top:28px;font-size:19px">Review these</h1>` + missed.map(m => `<div class="miss">${esc(m.q)}<small>You chose: ${esc(m.yours)}</small><small>Correct: ${esc(m.right)}</small></div>`).join("") : `<p>No missed questions.</p>`}
    <button class="go" id="again">${esc(CONFIG.retryButton)}</button>`;
  document.getElementById("again").onclick = home;
}

home();
