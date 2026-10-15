/* =========================================================================
   Логика игры «Дари летит в Болгарию».
   Тексты — в data.js, оформление — в style.css.
   ========================================================================= */
(() => {
  "use strict";

  /* ---------- Главы ---------- */
  const CHAPTERS = [
    { id: "story",    e: "💬", title: "Как всё началось",      desc: "ВДНХ, наука и легендарное «неа пхахаха»",   color: "#2b5278", stamp: "ГЛАВВИНО", se: "🍷" },
    { id: "pole",     e: "🏮", title: "Фонарный пилон",         desc: "Мини-игра на ловкость: покори фонарь",      color: "#c99a12", stamp: "ФОНАРЬ",   se: "🏮" },
    { id: "memory",   e: "🎞️", title: "Мемори и мультик",       desc: "Найди пары и оживи 15 кадров",              color: "#c46a9c", stamp: "КАДР",     se: "🎞️" },
    { id: "dossier",  e: "🕵️‍♀️", title: "Досье: Дари",           desc: "Насколько хорошо ты помнишь нас?",          color: "#8e2a5a", stamp: "ДОСЬЕ",    se: "👑" },
    { id: "map",      e: "🗺️", title: "Карта Болгарии",         desc: `${PLACES.length} мест: от знаменитых до секретных`, color: "#00966e", stamp: "КАРТА", se: "🗺️" },
    { id: "academy",  e: "🎓", title: "Болгарская академия",    desc: "Кивок-наоборот, ложные друзья, разговорник", color: "#2b7bd6", stamp: "АКАДЕМИЯ", se: "🎓" },
    { id: "suitcase", e: "🧳", title: "Собери чемодан",         desc: "Что взять в новую жизнь, а что оставить",    color: "#7b4fc9", stamp: "БАГАЖ",    se: "🧳" },
    { id: "quizbg",   e: "📝", title: "Экзамен на болгарку",   desc: `${QUIZ_BG.length} вопросов, чтобы сойти за местную`, color: "#d62612", stamp: "НАЗДРАВЕ", se: "🥂" },
  ];
  const MAP_GOAL = 15; // сколько мест открыть на карте ради штампа

  /* ---------- Состояние (сохраняется в браузере) ---------- */
  const KEY = "dari-bg-v1";
  const state = Object.assign(
    { started: false, done: {}, seen: [], wish: [], vol: 45, muted: false, finaleSeen: false },
    load()
  );
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* приватный режим */ } }

  /* ---------- Утилиты ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $("#view");
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let cleanups = [];
  const onCleanup = (fn) => cleanups.push(fn);
  let routeToken = 0;

  function toast(msg, ms = 2600) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), ms);
  }

  /* ---------- Звук ---------- */
  const music = $("#music");
  const playBtn = $("#playBtn"), muteBtn = $("#muteBtn"), vol = $("#vol");
  let audioCtx = null;
  vol.value = state.vol;
  function applyVolume() {
    const v = state.vol / 100;
    music.volume = v * v;           // так регулировка ощущается ровнее
    music.muted = state.muted;
    muteBtn.textContent = state.muted || state.vol == 0 ? "🔇" : state.vol < 40 ? "🔉" : "🔊";
    muteBtn.classList.toggle("on", state.muted);
  }
  function syncPlayBtn() {
    const playing = !music.paused;
    playBtn.textContent = playing ? "❚❚" : "▶";
    playBtn.classList.toggle("on", playing);
  }
  function startMusic() {
    applyVolume();
    const p = music.play();
    if (p && p.catch) p.catch(() => {});
  }
  playBtn.onclick = () => { music.paused ? startMusic() : music.pause(); };
  muteBtn.onclick = () => { state.muted = !state.muted; applyVolume(); save(); };
  vol.oninput = () => {
    state.vol = +vol.value;
    if (state.vol > 0 && state.muted) state.muted = false;
    applyVolume(); save();
  };
  music.addEventListener("play", syncPlayBtn);
  music.addEventListener("pause", syncPlayBtn);
  music.addEventListener("error", () => toast("Не нашла файл audio/music.mp3 — музыка не играет"));
  applyVolume();

  // Короткие звуки-эффекты (без файлов, через Web Audio)
  function sfx(type) {
    if (state.muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = {
        ok: [[660, 0], [880, .09]], bad: [[220, 0], [180, .12]], flip: [[520, 0]],
        stamp: [[392, 0], [523, .1], [659, .2], [784, .3]], clink: [[1568, 0], [2093, .06], [1568, .18]],
      }[type] || [[440, 0]];
      const t0 = audioCtx.currentTime;
      const gainLevel = Math.max(.04, state.vol / 100 * .22);
      notes.forEach(([f, d]) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type === "bad" ? "sawtooth" : "triangle";
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + d);
        g.gain.linearRampToValueAtTime(gainLevel, t0 + d + .01);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + d + .22);
        o.connect(g).connect(audioCtx.destination);
        o.start(t0 + d); o.stop(t0 + d + .25);
      });
    } catch (e) { /* без звука — не страшно */ }
  }

  /* ---------- Конфетти ---------- */
  function confetti(n = 140) {
    const c = $("#confetti"), ctx = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    const colors = ["#ffffff", "#00966e", "#d62612", "#ffcf5c", "#f4bccb"];
    const parts = Array.from({ length: n }, () => ({
      x: Math.random() * c.width, y: -20 - Math.random() * c.height * .4,
      vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 6,
      a: Math.random() * 6, va: (Math.random() - .5) * .3, col: colors[Math.floor(Math.random() * colors.length)],
    }));
    let frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += .04; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.col; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      });
      if (++frames < 260) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
    })();
  }

  /* ---------- Штампы ---------- */
  const doneCount = () => CHAPTERS.filter((c) => state.done[c.id]).length;
  function giveStamp(id) {
    if (state.done[id]) return false;
    state.done[id] = true; save();
    const ch = CHAPTERS.find((c) => c.id === id);
    sfx("stamp"); confetti();
    toast(`Новый штамп в паспорте: ${ch.se} ${ch.stamp}!`);
    updateCount();
    return true;
  }
  function updateCount() {
    const sc = $("#stampsCount");
    sc.hidden = !state.started;
    sc.innerHTML = `штампов: <b>${doneCount()}</b> / ${CHAPTERS.length}`;
  }
  function stampHTML(ch, i) {
    return state.done[ch.id]
      ? `<div class="stamp got" style="--sc:${ch.color};--rot:${[-10, 7, -4, 12, -8, 5, -12, 9][i % 8]}deg"><div><span>${ch.se}</span>${ch.stamp}</div></div>`
      : `<div class="stamp" title="${esc(ch.title)}">${ch.e}</div>`;
  }

  function doneBanner(text, btns = "") {
    return `<div class="done-banner"><div class="txt"><b>Штамп получен!</b><br>${text}</div>${btns}<button class="btn" data-go="hub">В терминал ✈</button></div>`;
  }

  /* ---------- Роутер ---------- */
  function go(route) { location.hash = "#/" + route; }
  function route() {
    cleanups.forEach((f) => { try { f(); } catch (e) {} });
    cleanups = [];
    routeToken++;
    const r = location.hash.replace(/^#\/?/, "");
    if (!state.started && r !== "" && r !== "intro") { state.started = true; save(); }
    const [, chId] = r.split("/");
    view.innerHTML = "";
    scrollTo({ top: 0 });
    if (!state.started || r === "intro") renderIntro();
    else if (r === "") renderHub();
    else if (r === "hub") renderHub();
    else if (r === "finale") renderFinale();
    else if (r.startsWith("ch/") && RENDER[chId]) RENDER[chId](CHAPTERS.find((c) => c.id === chId));
    else renderHub();
    updateCount();
  }
  addEventListener("hashchange", route);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) { e.preventDefault(); go(b.dataset.go); }
  });
  $("#homeBtn").onclick = () => go(state.started ? "hub" : "intro");

  function mount(html) { const node = el(`<section class="screen">${html}</section>`); view.append(node); return node; }
  function chapterHead(ch, text) {
    const n = CHAPTERS.indexOf(ch) + 1;
    return `<div class="chapter-head">
      <button class="back" data-go="hub">← Терминал</button>
      <div class="ttl"><div class="num">Пункт ${n} из ${CHAPTERS.length}</div><h2>${ch.e} ${ch.title}</h2><p>${text}</p></div>
    </div>`;
  }

  /* ======================================================================
     ИНТРО
     ====================================================================== */
  function renderIntro() {
    const s = mount(`
      <div class="intro">
        <div>
          <div class="lamp"><div class="halo"></div></div>
          <h1>${GAME.heroName} летит<br>в <span class="glow">Болгарию</span></h1>
          <p class="sub">Игра-воспоминание о нас, о фонарях, о Главвино — и путеводитель по стране, где ты скоро будешь жить.</p>
          <div class="boarding">
            <div class="main">
              <div class="bp-top"><span>Посадочный талон</span><span>Boarding pass</span></div>
              <div class="bp-route">
                <div><div class="code">${GAME.flight.from}</div><div class="city">${GAME.flight.fromCity}</div></div>
                <div class="plane"><span>✈</span></div>
                <div><div class="code">${GAME.flight.to}</div><div class="city">${GAME.flight.toCity}</div></div>
              </div>
              <div class="bp-grid">
                <div>Пассажир<b>${GAME.heroName}</b></div>
                <div>Рейс<b>DR 1710</b></div>
                <div>Дата<b>${GAME.partyDate}</b></div>
                <div>Посадка<b>19:00</b></div>
                <div>Выход<b>Лофт «Альфа»</b></div>
                <div>Класс<b>Принцесса</b></div>
                <div>Место<b>1A у окна</b></div>
                <div>Багаж<b>Воспоминания</b></div>
              </div>
            </div>
            <div class="stub">
              <div class="bp-grid">
                <div>Пассажир<b>${GAME.heroName}</b></div>
                <div>Маршрут<b>${GAME.flight.from} → ${GAME.flight.to}</b></div>
                <div>Место<b>1A</b></div>
              </div>
              <div class="barcode"></div>
            </div>
          </div>
          <button class="btn" id="startBtn">Начать путешествие ✈</button>
          <p class="sub" style="font-size:14px;margin-top:16px">🔊 Будет музыка. Громкость и выключение — справа вверху.</p>
        </div>
      </div>`);
    $("#startBtn", s).onclick = () => {
      state.started = true; save();
      startMusic(); sfx("clink");
      go("hub");
    };
  }

  /* ======================================================================
     ХАБ
     ====================================================================== */
  function renderHub() {
    const all = doneCount() === CHAPTERS.length;
    const s = mount(`
      <div class="hub-top">
        <div class="hub-hello">
          <div class="hand">Посадка открыта!</div>
          <h1>Здравей, ${GAME.heroName}! 👋</h1>
          <p>Перед вылетом в Софию нужно пройти ${CHAPTERS.length} пунктов досмотра воспоминаний. За каждый — штамп в паспорт.</p>
          <p>Собери все штампы — и откроется секретный выход на посадку с подарком внутри.</p>
        </div>
        <div class="passport">
          <h3><span>Паспорт путешественницы</span><span>${doneCount()}/${CHAPTERS.length}</span></h3>
          <div class="stamp-grid">${CHAPTERS.map(stampHTML).join("")}</div>
        </div>
      </div>
      <div class="tickets">
        ${CHAPTERS.map((c, i) => `
          <button class="ticket" data-go="ch/${c.id}" style="--tc:${c.color}">
            <div class="side">${c.e}</div>
            <div class="body"><div class="n">Пункт ${i + 1}</div><h3>${c.title}</h3><p>${c.desc}</p></div>
            ${state.done[c.id] ? '<span class="ok">ПРОЙДЕНО</span>' : ""}
          </button>`).join("")}
        <button class="ticket final ${all ? "" : "locked"}" data-go="finale">
          <div class="side">${all ? "🎁" : "🔒"}</div>
          <div class="body"><div class="n">Выход на посадку</div>
            <h3>${all ? "Секретный выход открыт!" : "Секретный выход на посадку"}</h3>
            <p>${all ? "Заходи — там кое-что для тебя ❤️" : `Осталось штампов: ${CHAPTERS.length - doneCount()}`}</p></div>
        </button>
      </div>
      <div class="hub-foot">
        <span>Прогресс сохраняется в этом браузере.</span>
        <button class="linkbtn" id="resetBtn">Начать всё заново</button>
      </div>`);
    $("#resetBtn", s).onclick = () => {
      if (!confirm("Стереть все штампы и начать игру с начала?")) return;
      Object.assign(state, { started: false, done: {}, seen: [], wish: [], finaleSeen: false });
      save(); go("intro");
    };
  }

  /* ======================================================================
     ГЛАВА 1 — История и переписка
     ====================================================================== */
  const CAT_STICKER = `<svg class="cat-sticker" viewBox="0 0 130 140" aria-label="стикер с котом">
    <path d="M22 60 L28 8 L50 36 Q65 30 80 36 L102 8 L108 60 Q118 90 112 140 L18 140 Q12 90 22 60 Z" fill="#ff9d2e" stroke="#a5180e" stroke-width="5" stroke-linejoin="round"/>
    <path d="M40 30 Q65 18 90 30" stroke="#ffd84a" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M36 62 L50 70 L36 76 M94 62 L80 70 L94 76" stroke="#5a0d06" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M58 84 L72 84 L65 92 Z" fill="#a5180e"/>
    <path d="M56 116 Q65 122 74 116" stroke="#ffd84a" stroke-width="5" fill="none" stroke-linecap="round"/>
  </svg>`;

  function renderStory(ch) {
    const my = routeToken;
    const s = mount(`
      ${chapterHead(ch, "Вспоминаем, с чего всё началось. Листай историю, а потом откроется наша первая переписка.")}
      <div class="story-wrap">
        <div class="card story-card" id="storyCard"></div>
        <div class="tg">
          <div class="tg-head"><div class="tg-ava">Д</div><div><b>${GAME.heroName}</b><small id="tgStatus">была недавно</small></div></div>
          <div class="tg-body" id="tgBody"><div class="tg-date">17 декабря 2023</div></div>
          <div class="guess" id="guess" hidden></div>
        </div>
      </div>
      <div id="storyEnd"></div>`);
    let i = 0;
    const card = $("#storyCard", s);
    function showSlide() {
      const st = STORY[i];
      card.innerHTML = `<div class="big">${st.emoji}</div><h3>${st.title}</h3><p>${st.text}</p>
        <div class="dots">${STORY.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
        <div><button class="btn green" id="nextSlide">${i < STORY.length - 1 ? "Дальше →" : "Открыть переписку 📱"}</button></div>`;
      $("#nextSlide", card).onclick = () => {
        sfx("flip");
        if (i < STORY.length - 1) { i++; showSlide(); }
        else { $("#nextSlide", card).disabled = true; playChat(); }
      };
    }
    showSlide();

    const body = $("#tgBody", s), status = $("#tgStatus", s), guess = $("#guess", s);
    function addMsg(m) {
      const node = m.sticker
        ? el(`<div class="msg me sticker">${CAT_STICKER}</div>`)
        : el(`<div class="msg ${m.who}"><span>${esc(m.text)}</span><time>13:40</time></div>`);
      body.append(node);
    }
    async function typing(ms) {
      status.textContent = "печатает…";
      const t = el(`<div class="typing"><i></i><i></i><i></i></div>`);
      body.append(t); await sleep(ms); t.remove(); status.textContent = "в сети";
    }
    async function playChat() {
      for (const m of CHAT) {
        if (my !== routeToken) return;
        if (m.guess) {
          await typing(900);
          if (my !== routeToken) return;
          await askGuess();
        } else if (m.who === "dari") { await typing(1000); }
        else await sleep(700);
        if (my !== routeToken) return;
        addMsg(m); sfx("flip");
      }
      await sleep(600);
      if (my !== routeToken) return;
      giveStamp(ch.id);
      $("#storyEnd", s).innerHTML = `
        <div class="card" style="margin-top:22px">
          <p style="font-size:17px;margin-top:0">${CHAT_GUESS.after}</p>
          <p style="margin-bottom:6px;color:var(--ink-soft)">А вот и оригинал — исторический документ:</p>
          <img class="real-shot" src="img/chat.png" alt="Скриншот первой переписки">
        </div>
        ${doneBanner("Глава «Как всё началось» пройдена. Следующая остановка — фонари!", `<button class="btn ghost" data-go="ch/pole">К фонарям 🏮</button>`)}`;
    }
    function askGuess() {
      return new Promise((resolve) => {
        guess.hidden = false;
        guess.innerHTML = `<p>${CHAT_GUESS.question}</p><div class="opts">${CHAT_GUESS.options.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join("")}</div>`;
        $$(".opt", guess).forEach((b) => b.onclick = async () => {
          const k = +b.dataset.k, ok = k === CHAT_GUESS.correct;
          $$(".opt", guess).forEach((x) => { x.disabled = true; if (+x.dataset.k === CHAT_GUESS.correct) x.classList.add("right"); });
          if (!ok) b.classList.add("wrong");
          sfx(ok ? "ok" : "bad");
          toast(ok ? "Точно! Ты себя знаешь 😄" : "Не-а! Смотри, что было на самом деле 👇");
          await sleep(1300);
          guess.hidden = true;
          resolve();
        });
      });
    }
  }

  /* ======================================================================
     ГЛАВА 2 — Фонарный пилон (игра на точность)
     ====================================================================== */
  function renderPole(ch) {
    const s = mount(`
      ${chapterHead(ch, "Когда пилона рядом нет, а танцевать хочется — сгодится и фонарь. Жми «Хоп!» (или пробел), когда огонёк в зелёной зоне. Каждый трюк открывает фото.")}
      <div class="pole-wrap">
        <div class="pole-photo"><img id="poleImg" src="${PHOTOS[TRICKS[0].photo].src}" alt="">
          <div class="veil" id="veil"><div>🏮<br>Фото откроется<br>после трюка</div></div>
          <div class="trickname" id="trickName" hidden></div>
        </div>
        <div class="pole-panel">
          <h3 id="poleTitle">Трюк 1: ${TRICKS[0].name}</h3>
          <div class="lives" id="lives"></div>
          <div class="meter" id="meter"><div class="zone" id="zone"></div><div class="cursor" id="cursor"></div></div>
          <button class="btn" id="hop">Хоп! 💃</button> <span style="color:var(--muted-night);font-size:13px;margin-left:8px">или <span class="kbd">пробел</span></span>
          <ul class="trick-list" id="trickList"></ul>
          <div id="poleEnd"></div>
        </div>
      </div>`);
    let idx = 0, lives = 3, pos = 0, dir = 1, zoneL = 0, zoneW = 0, running = true, last = performance.now(), lock = false;
    const cursor = $("#cursor", s), zone = $("#zone", s), meter = $("#meter", s);
    function speed() { return 38 + idx * 13; }               // % ширины в секунду
    function newZone() {
      zoneW = Math.max(9, 26 - idx * 3.2);
      zoneL = 8 + Math.random() * (84 - zoneW);
      zone.style.left = zoneL + "%"; zone.style.width = zoneW + "%";
    }
    function drawList() {
      $("#trickList", s).innerHTML = TRICKS.map((t, k) =>
        `<li class="${k < idx ? "done" : k === idx ? "now" : ""}"><span>${k + 1}. ${t.name}</span><span>${k < idx ? "✓" : k === idx ? "←" : "🔒"}</span></li>`).join("");
      $("#lives", s).textContent = "❤️".repeat(lives) + "🤍".repeat(3 - lives);
      if (idx < TRICKS.length) $("#poleTitle", s).textContent = `Трюк ${idx + 1}: ${TRICKS[idx].name}`;
    }
    function loop(now) {
      if (!running) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      pos += dir * speed() * dt;
      if (pos > 100) { pos = 100; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
      cursor.style.left = pos + "%";
      raf = requestAnimationFrame(loop);
    }
    let raf = requestAnimationFrame(loop);
    onCleanup(() => { running = false; cancelAnimationFrame(raf); });

    function hop() {
      if (lock || idx >= TRICKS.length) return;
      if (lives <= 0) return;
      const hit = pos >= zoneL - 1.5 && pos <= zoneL + zoneW + 1.5;
      if (hit) {
        sfx("ok");
        const t = TRICKS[idx];
        $("#poleImg", s).src = PHOTOS[t.photo].src;
        $("#veil", s).classList.add("gone");
        const tn = $("#trickName", s); tn.hidden = false; tn.textContent = `✨ ${t.name}!`;
        idx++;
        if (idx >= TRICKS.length) { running = false; drawList(); finish(); return; }
        newZone(); drawList();
        lock = true; setTimeout(() => (lock = false), 350);
      } else {
        sfx("bad");
        lives--;
        meter.classList.remove("shake"); void meter.offsetWidth; meter.classList.add("shake");
        drawList();
        if (lives <= 0) {
          running = false;
          $("#poleEnd", s).innerHTML = `<div class="done-banner"><div class="txt"><b>Фонарь победил… в этот раз.</b><br>Пилон — дело тренировки. Ещё разок?</div><button class="btn" id="again">Ещё раз 🔁</button></div>`;
          $("#again", s).onclick = () => { idx = 0; lives = 3; $("#poleEnd", s).innerHTML = ""; $("#veil", s).classList.remove("gone"); $("#trickName", s).hidden = true; newZone(); drawList(); running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
        } else toast(["Соскользнула! Ещё попытка", "Почти! Лови момент", "Фонарь скользкий, давай снова"][lives % 3]);
      }
    }
    function finish() {
      giveStamp(ch.id);
      $("#poleEnd", s).innerHTML = doneBanner("Все трюки на фонаре выполнены. Москва аплодирует стоя!", `<button class="btn ghost" data-go="ch/memory">Смотреть мультик 🎞️</button>`);
    }
    $("#hop", s).onclick = hop;
    meter.onclick = hop;
    const key = (e) => { if (e.code === "Space") { e.preventDefault(); hop(); } };
    addEventListener("keydown", key);
    onCleanup(() => removeEventListener("keydown", key));
    newZone(); drawList();
  }

  /* ======================================================================
     ГЛАВА 3 — Мемори, мультик, галерея
     ====================================================================== */
  function renderMemory(ch) {
    const s = mount(`
      ${chapterHead(ch, "Фото с той самой ночной фотосессии. Найди все пары — получишь штамп. А во вкладке «Мультик» кадры оживают.")}
      <div class="tabs" id="tabs">
        <button class="tab on" data-t="mem">🃏 Мемори</button>
        <button class="tab" data-t="flip">🎞️ Мультик</button>
        <button class="tab" data-t="gal">🖼️ Галерея</button>
      </div>
      <div id="pane"></div>`);
    const pane = $("#pane", s);
    let stopFlip = null;
    function tab(t) {
      if (stopFlip) { stopFlip(); stopFlip = null; }
      $$(".tab", s).forEach((b) => b.classList.toggle("on", b.dataset.t === t));
      pane.innerHTML = "";
      if (t === "mem") memoryGame(); else if (t === "flip") stopFlip = flipbook(); else gallery();
    }
    $$(".tab", s).forEach((b) => b.onclick = () => tab(b.dataset.t));
    onCleanup(() => stopFlip && stopFlip());

    function memoryGame() {
      const picks = [0, 3, 5, 6, 8, 9, 10, 13];
      const deck = shuffle([...picks, ...picks]);
      pane.innerHTML = `<div class="mem-stats"><span>Ходов: <b id="moves">0</b></span><span>Пар: <b id="pairs">0</b> / ${picks.length}</span></div>
        <div class="memory">${deck.map((p, k) => `<button class="mcard" data-p="${p}" data-k="${k}" aria-label="карточка"><div class="in"><div class="face back"></div><div class="face front"><img src="${PHOTOS[p].src}" alt="" loading="lazy"></div></div></button>`).join("")}</div>
        <div id="memEnd"></div>`;
      let open = [], moves = 0, pairs = 0, busy = false;
      $$(".mcard", pane).forEach((c) => c.onclick = () => {
        if (busy || c.classList.contains("open") || c.classList.contains("matched")) return;
        c.classList.add("open"); sfx("flip"); open.push(c);
        if (open.length < 2) return;
        moves++; $("#moves", pane).textContent = moves;
        const [a, b] = open;
        if (a.dataset.p === b.dataset.p) {
          a.classList.add("matched"); b.classList.add("matched"); open = []; pairs++; sfx("ok");
          $("#pairs", pane).textContent = pairs;
          toast(PHOTOS[+a.dataset.p].cap, 1800);
          if (pairs === picks.length) {
            giveStamp(ch.id);
            $("#memEnd", pane).innerHTML = doneBanner(`Все пары найдены за ${moves} ходов! Теперь включи мультик — кадры шли подряд, и они оживают.`, `<button class="btn ghost" id="toFlip">Включить мультик 🎞️</button>`);
            $("#toFlip", pane).onclick = () => tab("flip");
          }
        } else {
          busy = true;
          setTimeout(() => { a.classList.remove("open"); b.classList.remove("open"); open = []; busy = false; }, 850);
        }
      });
    }

    function flipbook() {
      PHOTOS.forEach((p) => { const i = new Image(); i.src = p.src; });
      pane.innerHTML = `<div class="flip">
        <div class="flip-screen"><img id="frame" src="${PHOTOS[0].src}" alt=""><div class="rec"><i></i>REC</div><div class="frame-no" id="frameNo">1/${PHOTOS.length}</div></div>
        <div class="flip-controls">
          <div><h3 style="font-size:20px">Мультик «Девушка и фонарь»</h3>
          <p style="color:var(--muted-night);margin:0">Все ${PHOTOS.length} фото сняты подряд — если листать быстро, получается настоящий стоп-моушен. Покрути скорость!</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" id="fPlay">❚❚ Пауза</button>
            <button class="btn ghost small" id="fPrev">‹ кадр</button>
            <button class="btn ghost small" id="fNext">кадр ›</button>
            <button class="btn ghost small" id="fBoom">🔁 Бумеранг: выкл</button>
          </div>
          <label>Скорость: <b id="fpsLbl">6 кадров/сек</b><input type="range" id="fps" min="1" max="15" value="6"></label>
          <div class="filmstrip" id="strip">${PHOTOS.map((p, k) => `<button data-k="${k}" class="${k ? "" : "on"}"><img src="${p.src}" alt=""></button>`).join("")}</div>
          <p class="hand" id="fCap" style="font-size:26px;color:var(--lamp);margin:0">${esc(PHOTOS[0].cap)}</p>
        </div></div>`;
      let k = 0, dir = 1, playing = true, boom = false, fps = 6, timer = null;
      const frame = $("#frame", pane);
      function show(n) {
        k = (n + PHOTOS.length) % PHOTOS.length;
        frame.src = PHOTOS[k].src;
        $("#frameNo", pane).textContent = `${k + 1}/${PHOTOS.length}`;
        $("#fCap", pane).textContent = PHOTOS[k].cap;
        $$("#strip button", pane).forEach((b, i) => b.classList.toggle("on", i === k));
      }
      function step() {
        if (boom) {
          if (k + dir >= PHOTOS.length || k + dir < 0) dir = -dir;
          show(k + dir);
        } else show(k + 1);
      }
      function restart() { clearInterval(timer); if (playing) timer = setInterval(step, 1000 / fps); }
      $("#fPlay", pane).onclick = (e) => { playing = !playing; e.target.textContent = playing ? "❚❚ Пауза" : "▶ Играть"; restart(); };
      $("#fPrev", pane).onclick = () => { playing = false; $("#fPlay", pane).textContent = "▶ Играть"; restart(); show(k - 1); };
      $("#fNext", pane).onclick = () => { playing = false; $("#fPlay", pane).textContent = "▶ Играть"; restart(); show(k + 1); };
      $("#fBoom", pane).onclick = (e) => { boom = !boom; dir = 1; e.target.textContent = `🔁 Бумеранг: ${boom ? "вкл" : "выкл"}`; };
      $("#fps", pane).oninput = (e) => { fps = +e.target.value; $("#fpsLbl", pane).textContent = `${fps} кадр${fps === 1 ? "" : fps < 5 ? "а" : "ов"}/сек`; restart(); };
      $$("#strip button", pane).forEach((b) => b.onclick = () => { playing = false; $("#fPlay", pane).textContent = "▶ Играть"; restart(); show(+b.dataset.k); });
      restart();
      return () => clearInterval(timer);
    }

    function gallery() {
      pane.innerHTML = `<div class="gallery">${PHOTOS.map((p, k) => `<figure data-k="${k}"><img src="${p.src}" alt="" loading="lazy"><figcaption>${esc(p.cap)}</figcaption></figure>`).join("")}</div>`;
      $$("figure", pane).forEach((f) => f.onclick = () => lightbox(PHOTOS, +f.dataset.k));
    }
    tab("mem");
  }

  /* ======================================================================
     Универсальный квиз
     ====================================================================== */
  function quiz(box, questions, { onFinish, verdicts }) {
    let i = 0, score = 0;
    function show() {
      const q = questions[i];
      box.innerHTML = `<div class="card quiz">
        <div class="progress"><i style="width:${(i / questions.length) * 100}%"></i></div>
        <div class="qn">Вопрос ${i + 1} из ${questions.length}</div>
        <h3>${esc(q.q)}</h3>
        <div class="opts">${q.a.map((a, k) => `<button class="opt" data-k="${k}">${esc(a)}</button>`).join("")}</div>
        <div id="qNote"></div>
      </div>`;
      $$(".opt", box).forEach((b) => b.onclick = () => {
        const k = +b.dataset.k, ok = k === q.c;
        if (ok) score++;
        sfx(ok ? "ok" : "bad");
        $$(".opt", box).forEach((x) => { x.disabled = true; if (+x.dataset.k === q.c) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        $("#qNote", box).innerHTML = `<div class="note">${ok ? "✅ " : "❌ "}${esc(q.note)}</div>
          <div class="actions"><button class="btn green" id="qNext">${i < questions.length - 1 ? "Следующий →" : "Результат 🏁"}</button></div>`;
        $("#qNext", box).onclick = () => { i++; i < questions.length ? show() : result(); };
      });
    }
    function result() {
      const r = score / questions.length;
      const v = verdicts.find((x) => r >= x.min) || verdicts[verdicts.length - 1];
      box.innerHTML = `<div class="card quiz" style="text-align:center">
        <div class="score-big">${score}/${questions.length}</div>
        <h3 style="margin-top:12px">${v.title}</h3><p>${v.text}</p>
        <button class="btn ghost" id="qAgain" style="color:var(--ink)">Пройти ещё раз</button></div>`;
      $("#qAgain", box).onclick = () => { i = 0; score = 0; show(); };
      if (score === questions.length) confetti();
      onFinish && onFinish(score);
    }
    show();
  }

  /* ======================================================================
     ГЛАВА 4 — Досье
     ====================================================================== */
  function renderDossier(ch) {
    const s = mount(`
      ${chapterHead(ch, "Совершенно секретно: всё, что известно о главной героине. Проверь, хорошо ли ты помнишь нашу историю.")}
      <div class="dossier">
        <div>
          <div class="card dossier-card">
            <div class="stampy">СЕКРЕТНО</div>
            <img class="pic" src="${PHOTOS[8].src}" alt="${GAME.heroName}">
            <dl>
              <dt>Имя</dt><dd>${GAME.heroName}</dd>
              <dt>Кодовое имя</dt><dd>Принцесса Кудряшек</dd>
              <dt>Приметы</dt><dd>Кудри, которым завидует Мерида из «Храброго сердца»</dd>
              <dt>Навыки</dt><dd>Пилон (в том числе на фонарях), умение объяснить что угодно, помощь всем вокруг</dd>
              <dt>Ум</dt><dd>Опасно высокий</dd>
              <dt>Красота</dt><dd>Аналогично</dd>
              <dt>Слабость</dt><dd>Главвино (хотя в первый раз сказала «неа»)</dd>
              <dt>Новая база</dt><dd>София, Болгария <span class="flag-i"></span></dd>
              <dt>Статус</dt><dd>Уезжает надолго, но не навсегда</dd>
            </dl>
          </div>
          <div class="compliment">
            <div class="c-text" id="cText">Нажми кнопку — и узнаешь правду о себе</div>
            <button class="btn red small" id="cBtn">Генератор правды 💌</button>
          </div>
        </div>
        <div id="quizBox"></div>
      </div>
      <div id="dEnd"></div>`);
    let deck = [];
    $("#cBtn", s).onclick = () => {
      if (!deck.length) deck = shuffle(COMPLIMENTS);
      $("#cText", s).textContent = deck.pop(); sfx("flip");
    };
    quiz($("#quizBox", s), QUIZ_US, {
      verdicts: [
        { min: 1, title: "Идеально! 👑", text: "Ты помнишь всё. Досье подтверждено." },
        { min: .6, title: "Отлично!", text: "Почти всё помнишь. Остальное вспомним на проводах." },
        { min: 0, title: "Хм-м 😄", text: "Кажется, кто-то слишком много дегустировал. Попробуй ещё раз!" },
      ],
      onFinish: () => {
        giveStamp(ch.id);
        $("#dEnd", s).innerHTML = doneBanner("Досье закрыто. Дальше — вся Болгария на одной карте.", `<button class="btn ghost" data-go="ch/map">К карте 🗺️</button>`);
      },
    });
  }

  /* ======================================================================
     ГЛАВА 5 — Карта Болгарии
     ====================================================================== */
  const MAP_W = 1120, MAP_H = 670;
  const X = (lon) => (lon - 22.15) * 150;
  const Y = (lat) => (44.4 - lat) * 204;
  const pt = ([lon, lat]) => `${X(lon).toFixed(1)},${Y(lat).toFixed(1)}`;
  const BG_OUTLINE = [
    [22.68, 44.22], [22.98, 43.98], [23.35, 43.82], [23.75, 43.78], [24.0, 43.72], [24.45, 43.7], [24.9, 43.7], [25.35, 43.62], [25.6, 43.66], [25.95, 43.86],
    [26.35, 44.0], [26.65, 44.06], [27.0, 44.14], [27.27, 44.12], [27.65, 43.98], [27.95, 43.84], [28.25, 43.76], [28.58, 43.74],
    [28.6, 43.54], [28.5, 43.42], [28.47, 43.36], [28.35, 43.4], [28.16, 43.4], [28.05, 43.32], [27.95, 43.21], [27.92, 43.05], [27.89, 42.86], [27.9, 42.7],
    [27.75, 42.66], [27.62, 42.6], [27.48, 42.52], [27.47, 42.47], [27.6, 42.43], [27.7, 42.42], [27.76, 42.27], [27.86, 42.16], [27.95, 42.06], [28.03, 41.98],
    [27.75, 41.97], [27.5, 41.97], [27.3, 42.08], [27.05, 42.08], [26.8, 41.98], [26.55, 41.9], [26.36, 41.72], [26.17, 41.55], [26.08, 41.36], [25.75, 41.33],
    [25.3, 41.24], [24.95, 41.42], [24.6, 41.43], [24.3, 41.55], [23.95, 41.45], [23.6, 41.38], [23.2, 41.4], [22.93, 41.34],
    [22.97, 41.6], [22.87, 41.95], [22.6, 42.15], [22.36, 42.31], [22.45, 42.55], [22.47, 42.8], [22.75, 42.9], [22.98, 43.17], [22.8, 43.32],
    [22.53, 43.48], [22.4, 43.78], [22.53, 44.05],
  ];
  const SEA = [[28.66, 44.4], [28.66, 44.2], [28.62, 43.95], [28.58, 43.74], ...BG_OUTLINE.slice(18, 40), [28.1, 41.85], [28.3, 41.6], [28.6, 41.35], [28.9, 41.25], [29.4, 41.2]];
  const DANUBE = [[22.45, 44.45], [22.68, 44.22], ...BG_OUTLINE.slice(1, 14), [27.6, 44.2], [27.95, 44.5]];
  const MARITSA = [[23.65, 42.25], [24.1, 42.2], [24.75, 42.15], [25.3, 42.05], [25.75, 41.95], [26.2, 41.75], [26.36, 41.71], [26.5, 41.45], [26.4, 41.2]];
  const ISKAR = [[23.35, 42.35], [23.42, 42.65], [23.55, 42.95], [23.9, 43.3], [24.3, 43.62], [24.47, 43.7]];
  const MOUNTAINS = {
    plain: [[22.85, 43.35], [23.2, 43.12], [23.6, 42.97], [24.0, 42.86], [24.45, 42.8], [24.9, 42.76], [25.75, 42.76], [26.2, 42.8], [26.6, 42.83], [27.05, 42.86], [27.45, 42.87],
            [24.05, 42.53], [24.6, 42.5], [25.05, 42.48], [24.1, 41.85], [24.95, 41.78], [25.25, 41.6], [25.75, 41.5], [24.0, 41.6], [24.75, 41.55], [27.4, 42.05], [27.25, 42.15], [23.27, 42.55]],
    snow: [[23.55, 42.17], [23.7, 42.12], [23.48, 41.66], [23.58, 41.72]],
  };
  const CITIES = [["Бургас", 42.5, 27.47], ["Стара Загора", 42.43, 25.63], ["Шумен", 43.27, 26.92], ["Видин", 43.99, 22.88], ["Плевен", 43.42, 24.62]];
  const NUDGE = { buzludzha: [9, -5], shipka: [-7, 5], goldensands: [6, -9], aladzha: [-5, 6], boyana: [-8, 7], sofia: [5, -5], bansko: [5, -4], baikushev: [-4, 5] };

  function buildMapSVG() {
    const tri = (lon, lat, snow) => `<g transform="translate(${pt([lon, lat])})"><path d="M-14,9 L0,-12 L14,9 Z" fill="${snow ? "#9fb58f" : "#b9cfa4"}"/>${snow ? '<path d="M-5,-4.5 L0,-12 L5,-4.5 L2,-6 L0,-3.5 L-2,-6 Z" fill="#fff"/>' : ""}<path d="M2,-9 L12,9 L18,9 L7,-3 Z" fill="${snow ? "#8aa37a" : "#a9c193"}" opacity=".8"/></g>`;
    const line = (arr) => arr.map(pt).join(" ");
    const label = (txt, lon, lat, cls, extra = "") => `<text class="${cls}" x="${X(lon)}" y="${Y(lat)}" text-anchor="middle" ${extra}>${txt}</text>`;
    const pins = PLACES.slice().sort((a, b) => a.gem - b.gem).map((p) => {
      const [nx, ny] = NUDGE[p.id] || [0, 0];
      const x = X(p.lon) + nx, y = Y(p.lat) + ny, c = CATS[p.cat].color, right = x > 820;
      return `<g class="pin" data-id="${p.id}" data-cat="${p.cat}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(p.name)}">
        <g class="pin-in">
          <circle class="ring" r="10" stroke="${c}"/>
          <circle class="dot" r="8" fill="${c}"/>
          ${p.gem ? '<text y="3.5" text-anchor="middle" font-size="10" fill="#fff" pointer-events="none">★</text>' : ""}
          <text class="heart" x="7" y="-8" ${state.wish.includes(p.id) ? "" : 'visibility="hidden"'}>♥</text>
          <text class="lbl" x="${right ? -14 : 14}" y="4" text-anchor="${right ? "end" : "start"}">${esc(p.name)}</text>
        </g></g>`;
    }).join("");
    return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Карта Болгарии">
      <defs>
        <pattern id="waves" width="40" height="16" patternUnits="userSpaceOnUse"><path d="M0 8 Q10 2 20 8 T40 8" fill="none" stroke="#9fd2ee" stroke-width="1.4"/></pattern>
        <filter id="soft"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#1f2a26" flood-opacity=".25"/></filter>
      </defs>
      <rect width="${MAP_W}" height="${MAP_H}" fill="#efe7d3"/>
      <polygon points="${line(SEA)} ${MAP_W},${MAP_H} ${MAP_W},0" fill="#bfe3f5"/>
      <polygon points="${line(SEA)} ${MAP_W},${MAP_H} ${MAP_W},0" fill="url(#waves)" opacity=".6"/>
      <polygon points="${line(BG_OUTLINE)}" fill="#d7ebc4" stroke="#5f8f4e" stroke-width="3" stroke-linejoin="round" filter="url(#soft)"/>
      ${MOUNTAINS.plain.map(([lo, la]) => tri(lo, la, false)).join("")}
      ${MOUNTAINS.snow.map(([lo, la]) => tri(lo, la, true)).join("")}
      <polyline points="${line(DANUBE)}" fill="none" stroke="#5aa9d6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${line(MARITSA)}" fill="none" stroke="#7cbde0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${line(ISKAR)}" fill="none" stroke="#7cbde0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${label("РУМЫНИЯ", 25.4, 44.27, "region-lbl", 'font-size="20"')}
      ${label("ГРЕЦИЯ", 24.6, 41.27, "region-lbl", 'font-size="20"')}
      ${label("ТУРЦИЯ", 27.2, 41.62, "region-lbl", 'font-size="20"')}
      ${label("Дунай", 24.3, 43.82, "region-lbl", 'fill="#3d87b5"')}
      ${label("Стара-Планина", 24.3, 42.98, "region-lbl", 'transform="rotate(-8 ' + X(24.3) + " " + Y(42.98) + ')"')}
      ${label("Рила", 23.72, 42.02, "region-lbl")}
      ${label("Пирин", 23.72, 41.58, "region-lbl")}
      ${label("Родопы", 24.6, 41.68, "region-lbl")}
      ${label("Странджа", 27.25, 42.24, "region-lbl")}
      ${label("Марица", 25.3, 42.12, "region-lbl", 'fill="#3d87b5"')}
      <text class="sea-lbl" x="${X(29.05)}" y="${Y(42.75)}" text-anchor="middle" transform="rotate(90 ${X(29.05)} ${Y(42.75)})">Чёрное море</text>
      ${CITIES.map(([n, la, lo]) => `<circle cx="${X(lo)}" cy="${Y(la)}" r="3.5" fill="#44524c"/><text class="city-lbl" x="${X(lo) + 6}" y="${Y(la) + 14}">${n}</text>`).join("")}
      <g id="pins">${pins}</g>
    </svg>`;
  }

  function renderMap(ch) {
    const s = mount(`
      ${chapterHead(ch, `Твоя страна на одной карте: ${PLACES.length} мест, из них ★ ${PLACES.filter((p) => p.gem).length} малоизвестных — таких, о которых не трубят на каждом шагу. Открой хотя бы ${MAP_GOAL}, чтобы получить штамп. Сердечком отмечай, куда хочешь поехать.`)}
      <div class="tabs" id="mtabs">
        <button class="tab on" data-t="map">🗺️ Интерактивная карта</button>
        <button class="tab" data-t="drawn">✏️ Карта от руки</button>
        <button class="tab" data-t="wish">♥ Хочу поехать</button>
      </div>
      <div id="mpane"></div>
      <div id="mapEnd"></div>`);
    const mpane = $("#mpane", s);
    let filters = { cats: new Set(Object.keys(CATS)), gem: false, pick: false };
    let selected = null;

    function tab(t) {
      $$("#mtabs .tab", s).forEach((b) => b.classList.toggle("on", b.dataset.t === t));
      if (t === "map") mapPane(); else if (t === "drawn") drawnPane(); else wishPane();
    }
    $$("#mtabs .tab", s).forEach((b) => b.onclick = () => tab(b.dataset.t));

    function progressText() { return `открыто <b>${state.seen.length}</b> / ${PLACES.length}`; }
    function visible(p) { return filters.cats.has(p.cat) && (!filters.gem || p.gem) && (!filters.pick || p.pick); }

    function mapPane() {
      mpane.innerHTML = `
        <div class="filters" id="filters">
          ${Object.entries(CATS).map(([k, c]) => `<button class="chip" data-c="${k}" style="--cc:${c.color}"><i></i>${c.icon} ${c.label}</button>`).join("")}
          <button class="chip gem ${filters.gem ? "on" : ""}" data-g="gem">★ Только секретные</button>
          <button class="chip gem ${filters.pick ? "on" : ""}" data-g="pick">📌 Мои отметки для тебя</button>
          <span class="map-progress" id="mprog">${progressText()}</span>
        </div>
        <div class="map-layout">
          <div class="map-box" id="mapBox">${buildMapSVG()}</div>
          <div class="place-panel"><div class="card" id="panel"></div></div>
        </div>
        <div class="place-list" id="plist"></div>`;
      $$("#filters .chip[data-c]", mpane).forEach((b) => {
        b.classList.toggle("off", !filters.cats.has(b.dataset.c));
        b.onclick = () => {
          const c = b.dataset.c;
          // первый клик по категории — показать только её; дальше — переключать
          if (filters.cats.size === Object.keys(CATS).length) filters.cats = new Set([c]);
          else if (filters.cats.has(c)) { filters.cats.delete(c); if (!filters.cats.size) filters.cats = new Set(Object.keys(CATS)); }
          else filters.cats.add(c);
          $$("#filters .chip[data-c]", mpane).forEach((x) => x.classList.toggle("off", !filters.cats.has(x.dataset.c)));
          applyFilters();
        };
      });
      $$("#filters .chip[data-g]", mpane).forEach((b) => b.onclick = () => {
        filters[b.dataset.g] = !filters[b.dataset.g]; b.classList.toggle("on", filters[b.dataset.g]); applyFilters();
      });
      $$(".pin", mpane).forEach((g) => {
        g.addEventListener("click", () => select(g.dataset.id));
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(g.dataset.id); } });
      });
      scalePins();
      applyFilters();
      if (selected) select(selected, true); else emptyPanel();
    }
    function scalePins() {
      const box = $("#mapBox", mpane); if (!box) return;
      const k = Math.min(2.4, Math.max(1, 780 / box.clientWidth));
      $$(".pin-in", box).forEach((g) => g.setAttribute("transform", `scale(${k})`));
    }
    const onResize = () => scalePins();
    addEventListener("resize", onResize);
    onCleanup(() => removeEventListener("resize", onResize));

    function applyFilters() {
      $$(".pin", mpane).forEach((g) => {
        const p = PLACES.find((x) => x.id === g.dataset.id);
        g.classList.toggle("hidden", !visible(p));
      });
      const list = PLACES.filter(visible);
      $("#plist", mpane).innerHTML = list.map((p) =>
        `<button data-id="${p.id}" class="${state.seen.includes(p.id) ? "seen" : ""}" style="--cc:${CATS[p.cat].color}"><i></i><span>${esc(p.name)}</span>${p.gem ? "★" : ""}${state.seen.includes(p.id) ? " ✓" : ""}</button>`).join("");
      $$("#plist button", mpane).forEach((b) => b.onclick = () => { select(b.dataset.id); $(innerWidth <= 860 ? "#panel" : "#mapBox", mpane).scrollIntoView({ behavior: "smooth", block: "start" }); });
    }
    function emptyPanel() {
      $("#panel", mpane).innerHTML = `<div class="empty"><div class="big">📍</div>
        <h3 style="font-size:18px">Выбери точку на карте</h3>
        <p>Цвет — тип места, ★ — секретное место, 📌 — мои личные рекомендации специально для твоей карты на стене.</p>
        <button class="btn green" id="rnd">Удиви меня 🎲</button></div>`;
      $("#rnd", mpane).onclick = () => {
        const pool = PLACES.filter((p) => visible(p) && !state.seen.includes(p.id));
        const p = (pool.length ? pool : PLACES)[Math.floor(Math.random() * (pool.length || PLACES.length))];
        select(p.id);
      };
    }
    function select(id, silent) {
      selected = id;
      const p = PLACES.find((x) => x.id === id), c = CATS[p.cat];
      $$(".pin", mpane).forEach((g) => g.classList.toggle("sel", g.dataset.id === id));
      const pinEl = $(`.pin[data-id="${id}"]`, mpane);
      if (pinEl) pinEl.parentNode.append(pinEl); // поверх остальных
      const fresh = !state.seen.includes(id);
      if (fresh) { state.seen.push(id); save(); if (!silent) sfx("flip"); }
      const wished = state.wish.includes(id);
      $("#panel", mpane).innerHTML = `
        <div class="cat" style="--cc:${c.color}">${c.icon} ${c.label}</div>
        <h3>${esc(p.name)}${p.gem ? '<span class="gem-badge">★ секретное</span>' : ""}</h3>
        <div class="area">${esc(p.area)}</div>
        <p style="margin:0">${esc(p.text)}</p>
        <div class="fact"><b>Факт:</b> ${esc(p.fact)}</div>
        <div class="tip">${p.pick ? "📌 " : "💬 "}${esc(p.tip)}</div>
        <div class="row">
          <button class="btn small ${wished ? "heart-on" : "outline-ink"}" id="wishBtn">${wished ? "♥ Хочу поехать" : "♡ Хочу поехать"}</button>
          <button class="btn small green" id="nextBtn">Следующее →</button>
          <a class="btn small outline-ink" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}">На Google Maps</a>
        </div>`;
      $("#wishBtn", mpane).onclick = () => {
        const i = state.wish.indexOf(id);
        i >= 0 ? state.wish.splice(i, 1) : state.wish.push(id);
        save(); sfx(i >= 0 ? "flip" : "ok");
        const h = $(`.pin[data-id="${id}"] .heart`, mpane);
        if (h) h.setAttribute("visibility", i >= 0 ? "hidden" : "visible");
        select(id, true);
      };
      $("#nextBtn", mpane).onclick = () => {
        const list = PLACES.filter(visible);
        const unseen = list.filter((x) => !state.seen.includes(x.id));
        const pool = unseen.length ? unseen : list;
        const cur = pool.findIndex((x) => x.id === id);
        select(pool[(cur + 1) % pool.length].id);
      };
      $("#mprog", mpane).innerHTML = progressText();
      if (fresh) {
        const b = $(`#plist button[data-id="${id}"]`, mpane);
        if (b) { b.classList.add("seen"); b.innerHTML += " ✓"; }
      }
      checkDone();
    }
    function checkDone() {
      if (state.seen.length >= MAP_GOAL && !state.done[ch.id]) giveStamp(ch.id);
      if (state.done[ch.id] && !$("#mapEnd .done-banner", s)) {
        $("#mapEnd", s).innerHTML = doneBanner(`Ты открыла ${MAP_GOAL}+ мест — штамп твой! Но карту можно изучать и дальше: здесь ещё много секретов.`, `<button class="btn ghost" data-go="ch/academy">В академию 🎓</button>`);
      }
    }

    function drawnPane() {
      mpane.innerHTML = `<div class="drawn-map"><img src="img/map-drawing.webp" alt="Нарисованная карта Болгарии"></div>
        <p class="drawn-note">Эту карту я нарисовала для тебя ❤️ А на интерактивной — все места, куда стоит заглянуть.</p>`;
    }
    function wishPane() {
      const list = PLACES.filter((p) => state.wish.includes(p.id));
      mpane.innerHTML = list.length
        ? `<div class="picks">${list.map((p) => `<div class="pick"><b>${CATS[p.cat].icon} ${esc(p.name)}</b><p>${esc(p.area)}</p><p style="margin-top:6px">${esc(p.text)}</p></div>`).join("")}</div>`
        : `<div class="card" style="text-align:center"><div style="font-size:44px">♡</div><p>Пока пусто. Отмечай на карте сердечком места, куда хочешь поехать, — они соберутся здесь.</p></div>`;
    }
    tab("map");
    checkDone();
  }

  /* ======================================================================
     ГЛАВА 6 — Академия
     ====================================================================== */
  function renderAcademy(ch) {
    const s = mount(`
      ${chapterHead(ch, "Ускоренный курс болгарской жизни. Для штампа пройди тренажёр «Да или нет?» и найди всех ложных друзей.")}
      <div class="tabs" id="atabs">
        <button class="tab on" data-t="head">🙂 Да или нет? <span id="tk1"></span></button>
        <button class="tab" data-t="ff">🤝 Ложные друзья <span id="tk2"></span></button>
        <button class="tab" data-t="ph">🗣️ Разговорник</button>
        <button class="tab" data-t="facts">📚 Факты</button>
      </div>
      <div id="apane"></div>
      <div id="aEnd"></div>`);
    const apane = $("#apane", s);
    const prog = { head: false, ff: false };
    function marks() {
      $("#tk1", s).textContent = prog.head || state.done[ch.id] ? "✓" : "";
      $("#tk2", s).textContent = prog.ff || state.done[ch.id] ? "✓" : "";
      if (prog.head && prog.ff) giveStamp(ch.id);
      if (state.done[ch.id] && !$("#aEnd .done-banner", s))
        $("#aEnd", s).innerHTML = doneBanner("Академия окончена с отличием. Теперь ты точно не перепутаешь «да» и «нет»… наверное.", `<button class="btn ghost" data-go="ch/suitcase">Собирать чемодан 🧳</button>`);
    }
    function tab(t) {
      $$("#atabs .tab", s).forEach((b) => b.classList.toggle("on", b.dataset.t === t));
      speechSynthesis && speechSynthesis.cancel && speechSynthesis.cancel();
      ({ head: headPane, ff: ffPane, ph: phrasePane, facts: factsPane })[t]();
    }
    $$("#atabs .tab", s).forEach((b) => b.onclick = () => tab(b.dataset.t));

    function headPane() {
      let i = 0, score = 0;
      apane.innerHTML = `<div class="card"><div class="head-trainer">
        <div class="head" id="head"><div class="head-in"><div class="hair"></div><div class="face-c"></div><div class="eye l"></div><div class="eye r"></div><div class="cheek l"></div><div class="cheek r"></div><div class="mouth"></div></div></div>
        <div id="htBox"></div></div></div>`;
      const head = $("#head", apane), box = $("#htBox", apane);
      function animate(move) { head.classList.remove("nod", "shake"); void head.offsetWidth; head.classList.add(move); }
      function show() {
        const q = HEAD_TRAINER[i];
        box.innerHTML = `<div class="qn" style="font-size:13px;font-weight:800;color:var(--ink-soft)">СИТУАЦИЯ ${i + 1} ИЗ ${HEAD_TRAINER.length}</div>
          <h3 style="font-size:19px;margin:6px 0 14px">${esc(q.q)}</h3>
          <p style="margin:0 0 12px;color:var(--ink-soft)">Что тебе ответили?</p>
          <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn green" data-a="yes">Это «да»</button>
            <button class="btn red" data-a="no">Это «нет»</button>
            <button class="btn small outline-ink" id="again">↻ Ещё раз жест</button>
          </div><div id="htNote"></div>`;
        animate(q.move);
        $("#again", box).onclick = () => animate(q.move);
        $$("[data-a]", box).forEach((b) => b.onclick = () => {
          const ok = b.dataset.a === q.ans; if (ok) score++;
          sfx(ok ? "ok" : "bad");
          $$("[data-a]", box).forEach((x) => (x.disabled = true));
          $("#htNote", box).innerHTML = `<div class="note" style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#fff7dc;border-left:4px solid var(--glow)">
            ${ok ? "✅ Верно!" : "❌ Ловушка!"} ${q.move === "nod" ? "Кивок в Болгарии — это «нет»." : "Покачивание головой из стороны в сторону — это «да»."}</div>
            <div style="margin-top:12px;text-align:right"><button class="btn green" id="hNext">${i < HEAD_TRAINER.length - 1 ? "Дальше →" : "Готово 🏁"}</button></div>`;
          $("#hNext", box).onclick = () => {
            i++;
            if (i < HEAD_TRAINER.length) return show();
            prog.head = true; marks();
            box.innerHTML = `<h3>${score}/${HEAD_TRAINER.length} — ${score === HEAD_TRAINER.length ? 'ты уже почти болгарка! <span class="flag-i"></span>' : "мозг сопротивляется, это нормально 😄"}</h3>
              <p>Лайфхак: в Болгарии лучше отвечать словами — «да» и «не».</p><button class="btn outline-ink" id="hRe">Ещё раз</button>`;
            $("#hRe", box).onclick = headPane;
          };
        });
      }
      show();
    }

    function ffPane() {
      const left = shuffle(FALSE_FRIENDS.map((f, k) => ({ ...f, k }))), right = shuffle(FALSE_FRIENDS.map((f, k) => ({ ...f, k })));
      apane.innerHTML = `<div class="card">
        <p style="margin-top:0">Слова выглядят по-русски, но значат другое. Нажми болгарское слово, потом его настоящий перевод.</p>
        <div class="ff"><div class="col"><h4>по-болгарски</h4>${left.map((f) => `<button data-side="l" data-k="${f.k}">${esc(f.bg)}</button>`).join("")}</div>
        <div class="col"><h4>значит по-русски</h4>${right.map((f) => `<button data-side="r" data-k="${f.k}">${esc(f.ru)}</button>`).join("")}</div></div>
        <p id="ffStat" style="text-align:center;margin-bottom:0;color:var(--ink-soft)">Найдено: 0 / ${FALSE_FRIENDS.length}</p></div>`;
      let sel = null, found = 0;
      $$(".ff button", apane).forEach((b) => b.onclick = () => {
        if (!sel || sel.dataset.side === b.dataset.side) {
          $$(".ff button.sel", apane).forEach((x) => x.classList.remove("sel"));
          sel = b; b.classList.add("sel"); sfx("flip"); return;
        }
        if (sel.dataset.k === b.dataset.k) {
          sel.classList.remove("sel"); sel.classList.add("ok"); b.classList.add("ok"); found++; sfx("ok");
          const f = FALSE_FRIENDS[+b.dataset.k];
          toast(`«${f.bg}» = ${f.ru}`, 1600);
          $("#ffStat", apane).textContent = `Найдено: ${found} / ${FALSE_FRIENDS.length}`;
          if (found === FALSE_FRIENDS.length) { $("#ffStat", apane).textContent = "Все ложные друзья разоблачены! 🕵️‍♀️"; prog.ff = true; marks(); }
        } else {
          sfx("bad"); [sel, b].forEach((x) => { x.classList.remove("bad"); void x.offsetWidth; x.classList.add("bad"); });
          sel.classList.remove("sel");
        }
        sel = null;
      });
    }

    function phrasePane() {
      apane.innerHTML = `<p style="color:var(--muted-night);margin-top:0">Нажми 🔊, чтобы услышать фразу (если в браузере есть болгарский голос). Ударение — на заглавной букве.</p>
        <div class="phrases">${PHRASES.map((p, k) => `<div class="phrase"><div class="t"><b>${esc(p.bg)}</b><small>[${esc(p.tr)}]</small><em>${esc(p.ru)}</em></div><button class="say" data-k="${k}" aria-label="Произнести">🔊</button></div>`).join("")}</div>`;
      $$(".say", apane).forEach((b) => b.onclick = () => say(PHRASES[+b.dataset.k].bg));
    }
    function say(text) {
      if (!("speechSynthesis" in window)) return toast("Этот браузер не умеет говорить 😔");
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => /^bg/i.test(x.lang)) || voices.find((x) => /^(ru|uk|sr|mk)/i.test(x.lang));
      if (v) u.voice = v;
      u.lang = v ? v.lang : "bg-BG"; u.rate = .9;
      if (!voices.some((x) => /^bg/i.test(x.lang))) toast("Болгарского голоса нет — читаю как получится 😄", 1800);
      const wasPlaying = !music.paused; if (wasPlaying) music.volume = music.volume * .3;
      u.onend = () => applyVolume();
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }

    function factsPane() {
      apane.innerHTML = `<p style="color:var(--muted-night);margin-top:0">Нажимай на карточки, чтобы перевернуть.</p>
        <div class="facts-grid">${BG_FACTS.map((f) => `<button class="fcard"><div class="in"><div class="face f1"><div class="e">${f.e}</div><b>${esc(f.t)}</b><small>нажми</small></div><div class="face f2">${esc(f.d)}</div></div></button>`).join("")}</div>`;
      $$(".fcard", apane).forEach((b) => b.onclick = () => { b.classList.toggle("open"); sfx("flip"); });
    }
    onCleanup(() => { try { speechSynthesis.cancel(); } catch (e) {} });
    tab("head");
    marks();
  }

  /* ======================================================================
     ГЛАВА 7 — Чемодан
     ====================================================================== */
  function renderSuitcase(ch) {
    const s = mount(`
      ${chapterHead(ch, "Переезд — дело серьёзное. Нажимай на вещи, которые надо взять с собой в новую жизнь. Остальное оставь в Москве. Потом застегни чемодан.")}
      <div class="suitcase" id="items">${shuffle(SUITCASE.map((x, k) => ({ ...x, k }))).map((x) =>
        `<button class="item" data-k="${x.k}"><span class="e">${x.e}</span><b>${esc(x.item)}</b><span class="why">${esc(x.why)}</span></button>`).join("")}</div>
      <div class="suitcase-bar"><span class="case-ico">🧳</span><span id="cnt">В чемодане: 0</span><button class="btn" id="zip">Застегнуть чемодан</button></div>
      <div id="sEnd"></div>`);
    const box = $("#items", s);
    const count = () => ($("#cnt", s).textContent = `В чемодане: ${$$(".item.in", box).length}`);
    $$(".item", box).forEach((b) => b.onclick = () => { b.classList.toggle("in"); sfx("flip"); count(); });
    $("#zip", s).onclick = () => {
      let right = 0;
      $$(".item", box).forEach((b) => {
        const it = SUITCASE[+b.dataset.k], good = b.classList.contains("in") === it.take;
        if (good) right++;
        b.classList.add(good ? "good" : "bad");
      });
      box.classList.add("checked");
      sfx(right === SUITCASE.length ? "stamp" : "ok");
      $("#zip", s).disabled = true;
      $("#cnt", s).innerHTML = `<b>${right} из ${SUITCASE.length}</b> решений верные. ${right === SUITCASE.length ? "Идеальные сборы!" : "Под каждой вещью — объяснение."}`;
      giveStamp(ch.id);
      $("#sEnd", s).innerHTML = doneBanner("Чемодан собран! Осталось сдать экзамен на болгарку.", `<button class="btn ghost" id="reCase">Собрать заново</button><button class="btn ghost" data-go="ch/quizbg">На экзамен <span class="flag-i"></span></button>`);
      $("#reCase", s).onclick = () => route();
    };
  }

  /* ======================================================================
     ГЛАВА 8 — Экзамен
     ====================================================================== */
  function renderQuizBg(ch) {
    const s = mount(`
      ${chapterHead(ch, "Финальное испытание: проверим, сойдёшь ли ты за местную. Подсказки — в главах «Карта» и «Академия».")}
      <div id="qb"></div><div id="qEnd"></div>`);
    quiz($("#qb", s), QUIZ_BG, {
      verdicts: [
        { min: 1, title: 'Истинска българка! <span class="flag-i"></span>', text: "Настоящая болгарка. Наздраве!" },
        { min: .7, title: "Почти местная!", text: "Ещё пара месяцев в Софии — и никто не отличит." },
        { min: .4, title: "Туристка с потенциалом", text: "Загляни в академию и попробуй ещё раз." },
        { min: 0, title: "Добре дошла!", text: "Всё впереди — ты только начинаешь. Попробуй ещё раз!" },
      ],
      onFinish: () => {
        giveStamp(ch.id);
        const all = doneCount() === CHAPTERS.length;
        $("#qEnd", s).innerHTML = doneBanner(all ? "Все штампы собраны! Секретный выход открыт." : "Экзамен сдан. Проверь в терминале, какие штампы ещё не собраны.",
          all ? `<button class="btn red" data-go="finale">К секретному выходу 🎁</button>` : "");
      },
    });
  }

  /* ======================================================================
     ФИНАЛ
     ====================================================================== */
  function renderFinale() {
    const all = doneCount() === CHAPTERS.length;
    if (!all && !renderFinale.force) {
      const left = CHAPTERS.filter((c) => !state.done[c.id]);
      const s = mount(`<div class="finale" style="text-align:center">
        <div style="font-size:64px">🔒</div>
        <h2>Секретный выход пока закрыт</h2>
        <p style="color:var(--muted-night)">Не хватает штампов: ${left.length}. Осталось пройти:</p>
        <div class="tickets" style="margin:20px 0">${left.map((c) => `<button class="ticket" data-go="ch/${c.id}" style="--tc:${c.color}"><div class="side">${c.e}</div><div class="body"><h3>${c.title}</h3><p>${c.desc}</p></div></button>`).join("")}</div>
        <button class="linkbtn" id="force">я нетерпеливая, открыть сейчас</button></div>`);
      $("#force", s).onclick = () => { renderFinale.force = true; route(); };
      return;
    }
    const picks = PLACES.filter((p) => p.pick);
    const wishes = PLACES.filter((p) => state.wish.includes(p.id) && !p.pick);
    const s = mount(`<div class="finale">
      <div class="final-hero">
        <div class="hand">${all ? "Паспорт заполнен!" : "Ладно, заходи 😄"}</div>
        <h1>Счастливого пути, ${GAME.heroName}! ✈️</h1>
      </div>
      <div class="passport" style="max-width:520px;margin:0 auto 26px">
        <h3><span>Паспорт путешественницы</span><span>${doneCount()}/${CHAPTERS.length}</span></h3>
        <div class="stamp-grid">${CHAPTERS.map(stampHTML).join("")}</div>
      </div>
      <div class="letter">
        ${LETTER.map((p) => `<p>${esc(p)}</p>`).join("")}
        <p class="sign">Твоя ${esc(GAME.fromName)} ❤️</p>
      </div>
      <div class="section-title">📌 Мои отметки для твоей карты на стене</div>
      <p style="color:var(--muted-night);margin:0">Места, которые я очень хочу, чтобы ты увидела. Проезжай по ним и вспоминай нас.</p>
      <div class="picks">${picks.map((p) => `<div class="pick"><b>${CATS[p.cat].icon} ${esc(p.name)}</b><p>${esc(p.tip)}</p></div>`).join("")}</div>
      ${wishes.length ? `<div class="section-title">♥ А это ты отметила сама</div><div class="picks">${wishes.map((p) => `<div class="pick"><b>${CATS[p.cat].icon} ${esc(p.name)}</b><p>${esc(p.area)}</p></div>`).join("")}</div>` : ""}
      <div style="text-align:center;margin-top:34px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn red" id="cheers">🥂 Наздраве!</button>
        <button class="btn ghost" id="toGallery">Ещё раз посмотреть мультик 🎞️</button>
        <button class="btn ghost" data-go="ch/map">Открыть карту 🗺️</button>
      </div>
    </div>`);
    $("#cheers", s).onclick = () => { sfx("clink"); confetti(200); toast("Наздраве! За тебя и за Болгарию! 🥂"); };
    $("#toGallery", s).onclick = () => go("ch/memory");
    if (!state.finaleSeen) { state.finaleSeen = true; save(); setTimeout(() => { confetti(220); sfx("stamp"); }, 300); }
    renderFinale.force = false;
  }

  /* ---------- Лайтбокс ---------- */
  function lightbox(list, k) {
    const lb = $("#lightbox"), img = $("img", lb), cap = $("figcaption", lb);
    const show = (n) => { k = (n + list.length) % list.length; img.src = list[k].src; cap.textContent = list[k].cap || ""; };
    show(k); lb.hidden = false;
    $(".lb-prev", lb).onclick = () => show(k - 1);
    $(".lb-next", lb).onclick = () => show(k + 1);
    const close = () => { lb.hidden = true; removeEventListener("keydown", key); };
    const key = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(k - 1); if (e.key === "ArrowRight") show(k + 1); };
    $(".lb-close", lb).onclick = close;
    lb.onclick = (e) => { if (e.target === lb) close(); };
    addEventListener("keydown", key);
  }

  const RENDER = {
    story: renderStory, pole: renderPole, memory: renderMemory, dossier: renderDossier,
    map: renderMap, academy: renderAcademy, suitcase: renderSuitcase, quizbg: renderQuizBg,
  };

  // Если игра уже начата, музыка включится с первого клика где угодно (браузеры не дают играть звук без клика)
  document.addEventListener("pointerdown", function first(e) {
    if (first.done || e.target.closest("#audio")) return;
    first.done = true;
    if (state.started && music.paused) startMusic();
  });

  route();
})();
