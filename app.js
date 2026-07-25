// =====================================================================
// 人生ものさし年表 — 計算と表示
// =====================================================================

const MS_PER_DAY = 86400000;
const LIFESPAN = 80; // 「人生◯年」として使う基準

let lastResult = null; // 最後に計算した結果(シェア・くらべる機能で使う)
let lastOther = null;  // 「くらべる」で入れた相手(見取り図に重ねて表示する)

// ---------- 小さな道具たち ----------
function el(id) { return document.getElementById(id); }
function fmtDate(d) { return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; }
function fmtNum(n) { return Math.round(n).toLocaleString("ja-JP"); }

// 満年齢(◯歳◯ヶ月◯日)
function calcAge(birth, now) {
  let y = now.getFullYear() - birth.getFullYear();
  let m = now.getMonth() - birth.getMonth();
  let d = now.getDate() - birth.getDate();
  if (d < 0) {
    m--;
    d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (m < 0) { y--; m += 12; }
  return { y, m, d };
}

// 和暦
function wareki(date) {
  const eras = [
    { name: "令和", start: new Date(2019, 4, 1) },
    { name: "平成", start: new Date(1989, 0, 8) },
    { name: "昭和", start: new Date(1926, 11, 25) },
    { name: "大正", start: new Date(1912, 6, 30) },
    { name: "明治", start: new Date(1868, 9, 23) },
  ];
  for (const e of eras) {
    if (date >= e.start) {
      const y = date.getFullYear() - e.start.getFullYear() + 1;
      return `${e.name}${y === 1 ? "元" : y}年`;
    }
  }
  return "";
}

// 学年の区切り(4月2日〜翌4月1日が同じ学年)
function cohortYear(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  const early = m < 4 || (m === 4 && d === 1); // 早生まれ
  return early ? date.getFullYear() - 1 : date.getFullYear();
}
function isEarlyBirth(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  return m < 4 || (m === 4 && d === 1);
}

// 干支(十二支)
function eto(year) {
  const animals = ["子(ね)", "丑(うし)", "寅(とら)", "卯(う)", "辰(たつ)", "巳(み)",
                   "午(うま)", "未(ひつじ)", "申(さる)", "酉(とり)", "戌(いぬ)", "亥(い)"];
  return animals[(((year - 4) % 12) + 12) % 12];
}

// ---------- 年・月・日の入力欄 ----------

const MIN_YEAR = 1900;
const rebuilders = {}; // 「日」の選択肢を作り直す関数を、入力欄ごとに覚えておく

function setupDateFields(prefix) {
  const fy = el(prefix + "-y"), fm = el(prefix + "-m"), fd = el(prefix + "-d");
  const thisYear = new Date().getFullYear();
  fy.min = MIN_YEAR;
  fy.max = thisYear;

  const options = n => '<option value="">--</option>' +
    Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  fm.innerHTML = options(12);

  // 選んだ年と月に合わせて「日」の選択肢を作り直す(2月なら28日か29日まで)
  const rebuildDays = () => {
    const keep = fd.value;
    const y = parseInt(fy.value, 10), m = parseInt(fm.value, 10);
    const last = (y && m) ? new Date(y, m, 0).getDate() : 31;
    fd.innerHTML = options(last);
    if (keep && Number(keep) <= last) fd.value = keep;
  };
  rebuildDays();
  fy.addEventListener("input", rebuildDays);
  fm.addEventListener("change", rebuildDays);
  rebuilders[prefix] = rebuildDays;

  // どの欄でもEnterで実行できるようにする
  const go = prefix === "birth" ? run : runCompare;
  [fy, fm, fd].forEach(f => f.addEventListener("keydown", e => { if (e.key === "Enter") go(); }));
}

// 入力欄から日付を取り出す。おかしければ理由を返す
function readDateFields(prefix) {
  const y = parseInt(el(prefix + "-y").value, 10);
  const m = parseInt(el(prefix + "-m").value, 10);
  const d = parseInt(el(prefix + "-d").value, 10);
  const thisYear = new Date().getFullYear();
  if (!y || !m || !d) return { error: "生年月日をすべて選んでください。" };
  if (y < MIN_YEAR || y > thisYear) return { error: `年は ${MIN_YEAR}〜${thisYear} の間で入力してください。` };
  const date = new Date(y, m - 1, d);
  if (date.getDate() !== d) return { error: `${m}月${d}日という日は存在しません。` };
  if (date >= new Date()) return { error: "過去の日付を入力してください。" };
  return { date };
}

function writeDateFields(prefix, iso) {
  const [y, m, d] = iso.split("-").map(Number);
  el(prefix + "-y").value = y;
  el(prefix + "-m").value = m;
  rebuilders[prefix]();
  el(prefix + "-d").value = d;
}

function toISO(date) {
  const p = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// ---------- メイン ----------
function run() {
  const parsed = readDateFields("birth");
  if (parsed.error) { showError(parsed.error); return; }

  const birth = parsed.date;
  const now = new Date();

  hideError();
  localStorage.setItem("birthdate", toISO(birth));

  const age = calcAge(birth, now);
  const daysLived = Math.floor((now - birth) / MS_PER_DAY);
  const secondsLived = Math.floor((now - birth) / 1000);

  lastResult = { birth, now, age, daysLived };

  lastOther = null;

  renderBasic(birth, now, age, daysLived, secondsLived);
  renderTimeline();
  renderBirthdayTwins(birth);
  renderClassmates(birth);
  renderCapsule(birth);
  renderSelfHistory(birth, now);
  renderLifeClock(birth, now);
  renderFuture(birth, now);
  renderRemaining(birth, now, age);
  renderHistory(age.y);
  renderCharacters(age.y);
  renderEarth();
  renderMirror(birth, now);
  renderPlanets(birth, now, daysLived);
  renderAnimals(age.y);
  renderMilestones(birth, now, daysLived);
  renderBody(age, daysLived);
  renderJanet(age.y);
  renderSchool(birth);

  for (const id of ["results", "tabs", "share-bar", "age-headline"]) {
    el(id).classList.remove("hidden");
  }
  showTab(localStorage.getItem("activeTab") || "me");
}

// ---------- タブの切り替え ----------

function showTab(name) {
  const buttons = document.querySelectorAll(".tab-btn");
  const known = [...buttons].some(b => b.dataset.tab === name);
  if (!known) name = "me";

  buttons.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tabpanel").forEach(p => {
    p.classList.toggle("active", p.id === "panel-" + name);
  });
  localStorage.setItem("activeTab", name);

  // 下までスクロールした状態で切り替えたとき、中身の先頭に戻す
  const tabs = el("tabs");
  if (window.scrollY > tabs.offsetTop) tabs.scrollIntoView();
}

function showError(msg) { const e = el("error-msg"); e.textContent = msg; e.classList.remove("hidden"); }
function hideError() { el("error-msg").classList.add("hidden"); }

// ---------- 各セクション ----------

function renderBasic(birth, now, age, daysLived, secondsLived) {
  // 年齢はタブの外(ヘッダー)に出して、どのタブでも見えるようにする
  el("age-headline").textContent = `あなたは今 ${age.y}歳${age.m}ヶ月${age.d}日`;
  el("basic-content").innerHTML = `
    <table class="plain">
      <tr><th>生まれた日</th><td>${fmtDate(birth)}(${wareki(birth)})</td></tr>
      <tr><th>干支</th><td>${eto(birth.getFullYear())}年</td></tr>
      <tr><th>生きた日数</th><td>${fmtNum(daysLived)} 日</td></tr>
      <tr><th>生きた時間</th><td>約 ${fmtNum(daysLived * 24)} 時間</td></tr>
      <tr><th>生きた秒数</th><td>約 ${fmtNum(secondsLived)} 秒</td></tr>
    </table>`;
}

function renderLifeClock(birth, now) {
  const ageYears = (now - birth) / (MS_PER_DAY * 365.2425);
  if (ageYears >= LIFESPAN) {
    el("lifeclock-content").innerHTML = `
      <p>時計は <span class="clock-time">24:00</span> を回りました。</p>
      <p>人生${LIFESPAN}年の一日を走りきって、いまは<strong>延長戦(ボーナスタイム)${Math.floor(ageYears - LIFESPAN) + 1}年目</strong>です。おめでとうございます!</p>`;
    return;
  }
  const totalMin = (ageYears / LIFESPAN) * 24 * 60;
  const h = Math.floor(totalMin / 60);
  const m = Math.floor(totalMin % 60);
  const labels = [
    [4, "まだ真夜中。夜はこれからです"],
    [6, "夜明け前。空が白み始めたころ"],
    [9, "さわやかな朝。一日はまだ始まったばかり"],
    [12, "午前中。頭が一番よく働く時間帯"],
    [15, "昼下がり。ここからが本番という人も多い時間"],
    [18, "午後もいいところ。夕方の予定を立て始めるころ"],
    [21, "夕食どき。一日を振り返りつつ、夜はまだ長い"],
    [24, "夜のくつろぎタイム。まだ寝るには早い"],
  ];
  const label = labels.find(([limit]) => h < limit)[1];
  const pct = ((ageYears / LIFESPAN) * 100).toFixed(1);
  el("lifeclock-content").innerHTML = `
    <p>あなたの人生は、いま</p>
    <p class="clock-time">${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}</p>
    <p>${label}。</p>
    <div class="bar"><div style="width:${pct}%"></div></div>
    <p class="note">人生を${LIFESPAN}年とした場合、${pct}% が経過した計算です。</p>`;
}

function renderHistory(userAge) {
  const exact = [], near = [], future = [];
  for (const f of HISTORICAL_FIGURES) {
    for (const ev of f.events) {
      const diff = ev.age - userAge;
      if (diff === 0) exact.push({ f, ev });
      else if (Math.abs(diff) === 1) near.push({ f, ev });
      else if (diff > 0) future.push({ f, ev, diff });
    }
  }
  let html = "";
  const item = ({ f, ev }) =>
    `<li><span class="age-label">${ev.age}歳</span><span class="person">${f.name}</span>(${f.born}年生まれ)… ${ev.text}</li>`;

  if (exact.length > 0) {
    html += `<p>あなたと同じ <strong>${userAge}歳</strong> のとき──</p><ul class="list">${exact.map(item).join("")}</ul>`;
  }
  if (exact.length < 3 && near.length > 0) {
    html += `<p class="subhead">ほぼ同じ年齢(±1歳)のとき</p><ul class="list">${near.slice(0, 4).map(item).join("")}</ul>`;
  }
  if (exact.length === 0 && near.length === 0) {
    html += `<p>ちょうど${userAge}歳の記録はまだデータにありません(<code>data.js</code> に追加できます)。</p>`;
  }
  if (future.length > 0) {
    future.sort((a, b) => a.diff - b.diff);
    html += `<p class="subhead">これからのお楽しみ</p><ul class="list">${future.slice(0, 3).map(({ f, ev, diff }) =>
      `<li><span class="age-label">${diff}年後</span><span class="person">${f.name}</span>は${ev.age}歳で… ${ev.text}</li>`).join("")}</ul>`;
  }
  el("history-content").innerHTML = html;
}

function renderCharacters(userAge) {
  const withDiff = CHARACTERS.map(c => ({ ...c, diff: Math.abs(c.age - userAge) }));
  let matches = withDiff.filter(c => c.diff <= 2).sort((a, b) => a.diff - b.diff);
  let heading = `あなた(${userAge}歳)の同世代(±2歳)はこの人たち!`;
  if (matches.length === 0) {
    matches = withDiff.sort((a, b) => a.diff - b.diff).slice(0, 3);
    heading = `ぴったり同世代はまだデータにいませんが、いちばん近いのはこの人たち(<code>data.js</code> に追加できます)`;
  }
  el("characters-content").innerHTML = `
    <p>${heading}</p>
    <ul class="list">${matches.map(c =>
      `<li><span class="age-label">${c.age}歳</span><span class="person">${c.name}</span> <span class="work">${c.work}</span>${c.note ? `<span class="work">(${c.note})</span>` : ""}</li>`).join("")}
    </ul>`;
}

function renderEarth() {
  const SCALE = 100 / 4.6e9; // 実際の1年 → スケール上の年
  const rows = EARTH_EVENTS.map(ev => {
    const scaleYearsAgo = ev.yearsAgo * SCALE;
    let when;
    if (scaleYearsAgo >= 0.5) {
      when = `${(100 - scaleYearsAgo).toFixed(1)}歳のとき`;
    } else {
      const days = scaleYearsAgo * 365.25;
      if (days >= 1) when = `${days.toFixed(1)}日前`;
      else {
        const min = days * 24 * 60;
        when = min >= 60 ? `${(min / 60).toFixed(1)}時間前` : `${Math.round(min)}分前`;
      }
    }
    return `<tr><th>${when}</th><td>${ev.label}</td></tr>`;
  });
  const humanLifeSec = Math.round(LIFESPAN * SCALE * 365.25 * 86400);
  el("earth-content").innerHTML = `
    <p>地球(46億歳)を「100歳のおばあちゃん」だとすると、これまでの出来事はこうなります。</p>
    <table class="plain">${rows.join("")}</table>
    <p class="note">このスケールでは1年=実際の4,600万年。そして「今」が100歳ちょうど。
    あなたの人生${LIFESPAN}年は、この時計ではたったの <strong>約${humanLifeSec}秒</strong> です。</p>`;
}

function renderMirror(birth, now) {
  const mirror = new Date(birth.getTime() - (now.getTime() - birth.getTime()));
  const w = mirror.getFullYear() >= 1869 ? `(${wareki(mirror)})` : "";
  const t = TIME_CAPSULE[mirror.getFullYear()];
  const capsuleNote = t
    ? `<p>この年の世の中は…「${[t.news, t.culture].filter(Boolean).join("」「")}」</p>`
    : "";
  el("mirror-content").innerHTML = `
    <p>あなたが生まれてから今日までと同じ長さだけ、生まれた日からさらに過去へ遡ると──</p>
    <p class="big">${fmtDate(mirror)}${w}</p>
    ${capsuleNote}
    <p class="note">つまり、この日の出来事はあなたにとって「自分が生きてきた時間のぶんだけ昔」。
    子どものころ「大昔」と思っていた出来事が、意外と近くに見えてきませんか?</p>`;
}

function renderPlanets(birth, now, daysLived) {
  const planets = [
    { name: "水星", days: 87.97 },
    { name: "金星", days: 224.70 },
    { name: "火星", days: 686.98 },
    { name: "木星", days: 4332.59 },
    { name: "土星", days: 10759.22 },
  ];
  const rows = planets.map(p =>
    `<tr><th>${p.name}</th><td>${(daysLived / p.days).toFixed(1)} 歳</td></tr>`).join("");
  const mars = planets[2];
  const nextMarsBirthday = new Date(birth.getTime() + Math.ceil(daysLived / mars.days) * mars.days * MS_PER_DAY);
  el("planets-content").innerHTML = `
    <p>その星の「1年(太陽のまわりを1周する時間)」で数えると…</p>
    <table class="plain">${rows}</table>
    <p class="note">次の「火星誕生日」は ${fmtDate(nextMarsBirthday)} です。お祝いしましょう。</p>`;
}

function renderAnimals(userAge) {
  // 犬・猫の換算(最初の1年=人間の15歳分、2年目=+9歳分、以降1年=+4歳分)の逆算
  function dogCat(h) {
    if (h <= 15) return h / 15;
    if (h <= 24) return 1 + (h - 15) / 9;
    return 2 + (h - 24) / 4;
  }
  const dc = dogCat(userAge);
  const turtle = userAge * (150 / LIFESPAN);  // ゾウガメ(寿命約150年)
  const mouseMonths = userAge * (30 / LIFESPAN); // ネズミ(寿命約2年半=30ヶ月)
  el("animals-content").innerHTML = `
    <table class="plain">
      <tr><th>🐕 犬・🐈 猫なら</th><td>約 ${dc.toFixed(1)} 歳</td></tr>
      <tr><th>🐢 ゾウガメなら</th><td>約 ${turtle.toFixed(0)} 歳(寿命150年で換算)</td></tr>
      <tr><th>🐭 ネズミなら</th><td>約 ${mouseMonths.toFixed(1)} ヶ月(寿命2年半で換算)</td></tr>
    </table>`;
}

function renderMilestones(birth, now, daysLived) {
  const rows = [];
  const dateOfDay = n => new Date(birth.getTime() + n * MS_PER_DAY);
  const dateOfSec = s => new Date(birth.getTime() + s * 1000);
  const secondsLived = (now - birth) / 1000;

  // 次の「1000日区切り」
  const nextK = (Math.floor(daysLived / 1000) + 1) * 1000;
  rows.push(`<tr><th>生後 ${fmtNum(nextK)} 日目</th><td>${fmtDate(dateOfDay(nextK))}(あと${fmtNum(nextK - daysLived)}日)</td></tr>`);

  // 大きな節目
  const bigDays = [10000, 20000, 30000];
  for (const n of bigDays) {
    const d = dateOfDay(n);
    rows.push(`<tr><th>生後 ${fmtNum(n)} 日目</th><td>${fmtDate(d)}${n <= daysLived ? "(済み🎉)" : `(あと${fmtNum(n - daysLived)}日)`}</td></tr>`);
  }
  const bigSecs = [1e9, 2e9];
  for (const s of bigSecs) {
    const d = dateOfSec(s);
    rows.push(`<tr><th>生後 ${s / 1e8}億秒</th><td>${fmtDate(d)}${s <= secondsLived ? "(済み🎉)" : ""}</td></tr>`);
  }
  el("milestones-content").innerHTML = `
    <table class="plain">${rows.join("")}</table>
    <p class="note">10億秒はだいたい31年8ヶ月。知らないうちに通り過ぎがちな記念日です。</p>`;
}

function renderBody(age, daysLived) {
  el("body-content").innerHTML = `
    <table class="plain">
      <tr><th>心臓が打った回数</th><td>約 ${fmtNum(daysLived * 100000)} 回(1日約10万回)</td></tr>
      <tr><th>呼吸した回数</th><td>約 ${fmtNum(daysLived * 20000)} 回</td></tr>
      <tr><th>まばたきした回数</th><td>約 ${fmtNum(daysLived * 15000)} 回</td></tr>
      <tr><th>太陽のまわりを回った回数</th><td>${age.y} 周</td></tr>
      <tr><th>月が地球を回った回数</th><td>約 ${fmtNum(daysLived / 27.32)} 周</td></tr>
    </table>`;
}

function renderJanet(userAge) {
  // ジャネーの法則: 体感時間は年齢に反比例する、という説
  // 5歳〜80歳の対数スケールで「体感上どこまで来たか」を出す
  if (userAge <= 5) {
    el("janet-content").innerHTML = `<p>この計算は5歳から。いまが人生でいちばん時間がゆっくり流れている時期です。</p>`;
    return;
  }
  const pct = Math.min(100, (Math.log(userAge / 5) / Math.log(LIFESPAN / 5)) * 100);
  el("janet-content").innerHTML = `
    <p>「歳を取ると1年が短く感じる」という説(ジャネーの法則)で計算すると、
    体感時間では人生の <span class="big">${pct.toFixed(0)}%</span> がもう過ぎています。</p>
    <div class="bar"><div style="width:${pct.toFixed(1)}%"></div></div>
    <p class="note">この計算だと体感の折り返し地点は20歳ごろ。だからこそ、これからの1年を大事に…という話です。</p>`;
}

function renderSchool(birth) {
  const early = isEarlyBirth(birth);
  const cohort = cohortYear(birth);
  const rows = [
    ["小学校 入学", `${cohort + 7}年4月`],
    ["中学校 入学", `${cohort + 13}年4月`],
    ["高校 入学", `${cohort + 16}年4月`],
    ["大学 入学(現役の場合)", `${cohort + 19}年4月`],
    ["二十歳のつどい(成人式)", `${cohort + 21}年1月ごろ`],
  ].map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");
  el("school-content").innerHTML = `
    <p>${early ? "早生まれ(1月1日〜4月1日生まれ)なので、ひとつ上の学年組です。" : "4月2日〜12月31日生まれの学年組です。"}</p>
    <table class="plain">${rows}</table>`;
}

function renderCapsule(birth) {
  const y = birth.getFullYear();
  const t = TIME_CAPSULE[y];
  if (!t) {
    el("capsule-content").innerHTML =
      `<p>${y}年のデータはまだ登録されていません(<code>data.js</code> の TIME_CAPSULE に追加できます)。</p>`;
    return;
  }
  const rows = [
    ["この年の出来事", t.news],
    ["流行・文化", t.culture],
  ];
  if (t.born) rows.push(["あなたと同い年のモノ", t.born]);

  // 当時の物価の目安(データがある年代のみ)
  const postcard = [...POSTCARD_PRICES].reverse().find(([from]) => from <= y);
  if (postcard) rows.push(["当時のはがき代", `${postcard[1]}円(今は85円)`]);
  const salary = [...STARTING_SALARY].reverse().find(([from]) => from <= y);
  if (salary) rows.push(["当時の大卒初任給(目安)", `約${salary[1].toLocaleString("ja-JP")}円`]);

  el("capsule-content").innerHTML = `
    <p>あなたが生まれた <strong>${y}年(${wareki(birth)})</strong> は、こんな年でした。</p>
    <table class="plain">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;
}

function renderSelfHistory(birth, now) {
  const startY = birth.getFullYear();
  const rows = [];
  for (let y = startY; y <= now.getFullYear(); y++) {
    const t = TIME_CAPSULE[y];
    if (!t) continue; // データのない年は飛ばす
    const label = y === startY ? "誕生🎉" : `${y - startY}歳`;
    const items = [t.news, t.culture].filter(Boolean).join(" / ");
    rows.push(`<tr><th>${y}年<br><span class="work">${label}</span></th><td>${items}</td></tr>`);
  }
  if (rows.length === 0) {
    el("selfhistory-content").innerHTML =
      `<p>この年代のデータはまだ登録されていません(<code>data.js</code> の TIME_CAPSULE に追加できます)。</p>`;
    return;
  }
  el("selfhistory-content").innerHTML = `
    <p>あなたの人生と、世の中の歴史を重ねた年表です。<span class="work">(年齢はその年の誕生日をむかえたあとのもの)</span></p>
    <div class="scrollbox"><table class="plain">${rows.join("")}</table></div>`;
}

function renderFuture(birth, now) {
  const birthYear = birth.getFullYear();
  const upcoming = FUTURE_EVENTS
    .filter(ev => ev.year >= now.getFullYear())
    .sort((a, b) => a.year - b.year);
  const rows = upcoming.map(ev => {
    const age = ev.year - birthYear;
    const when = `${ev.year}年${ev.month ? ev.month + "月" : ""}`;
    const ageText = age > 105 ? `${age}歳になる年(長生きチャレンジ!)` : `${age}歳になる年`;
    return `<tr><th>${when}</th><td>${ev.label}<br><span class="work">あなたが${ageText}</span></td></tr>`;
  });
  el("future-content").innerHTML = `
    <p>これから起こる(と予想されている)出来事と、そのときのあなたの年齢です。</p>
    <table class="plain">${rows.join("")}</table>`;
}

function renderRemaining(birth, now, age) {
  const ageYears = (now - birth) / (MS_PER_DAY * 365.2425);
  const yearsLeft = LIFESPAN - ageYears;
  let inner;
  if (yearsLeft <= 0) {
    inner = `<p>人生${LIFESPAN}年の基準はすでに超えています。ここから先の桜も満月も、ぜんぶボーナスです。一回一回を楽しみましょう。</p>`;
  } else {
    // 夏のオリンピックの回数(次は2028年ロサンゼルス、以降4年ごと)
    const endYear = birth.getFullYear() + LIFESPAN;
    let olympics = 0;
    for (let y = 2028; y <= endYear; y += 4) olympics++;
    inner = `
      <table class="plain">
        <tr><th>🌸 桜(お花見)</th><td>あと 約${Math.max(0, LIFESPAN - age.y)} 回</td></tr>
        <tr><th>🎂 誕生日</th><td>あと 約${Math.max(0, LIFESPAN - age.y)} 回</td></tr>
        <tr><th>🏅 夏のオリンピック</th><td>あと 約${olympics} 回</td></tr>
        <tr><th>🌕 満月</th><td>あと 約${fmtNum(yearsLeft * 12.37)} 回</td></tr>
        <tr><th>🌅 初日の出</th><td>あと 約${Math.max(0, Math.round(yearsLeft))} 回</td></tr>
      </table>
      <p class="note">人生${LIFESPAN}年とした場合の概算です。日本人の平均寿命(男性約81歳・女性約87歳)で考えれば、実際はもう少し多いはず。
      「意外と少ない」と感じたら、それは一回一回を大事にできるということです。</p>`;
  }
  el("remaining-content").innerHTML = `
    <details>
      <summary>数字を見る(少ししんみりするかもしれません)</summary>
      ${inner}
    </details>`;
}

// ---------- 人生の見取り図(横棒の年表) ----------

function renderTimeline() {
  const { birth, now, age } = lastResult;
  const ageExact = (now - birth) / (MS_PER_DAY * 365.2425);
  const maxAge = Math.max(80, Math.ceil(ageExact / 10) * 10);
  const pct = a => (Math.min(a, maxAge) / maxAge) * 100;

  // 人生の節目(帯の上に小さな目印を置き、説明は下にまとめて書く)
  const marks = [
    { a: 6, t: "小学校入学" },
    { a: 20, t: "二十歳" },
    { a: 60, t: "還暦" },
    { a: 84, t: "平均寿命あたり" },
  ].filter(m => m.a <= maxAge);

  const nowPct = pct(ageExact);
  const labelPct = Math.min(92, Math.max(8, nowPct)); // 端で文字がはみ出さないように

  let rows = `
    <div class="tl-row">
      <div class="tl-label">${lastOther ? "あなた" : ""}</div>
      <div class="tl-track">
        <div class="tl-fill" style="width:${nowPct.toFixed(1)}%"></div>
        ${marks.map(m => `<div class="tl-mark" style="left:${pct(m.a).toFixed(1)}%"></div>`).join("")}
        <div class="tl-now" style="left:${nowPct.toFixed(1)}%"></div>
        <div class="tl-nowlabel" style="left:${labelPct.toFixed(1)}%">今 ${age.y}歳</div>
      </div>
    </div>`;

  if (lastOther) {
    const oAge = (now - lastOther) / (MS_PER_DAY * 365.2425);
    rows += `
      <div class="tl-row">
        <div class="tl-label">相手</div>
        <div class="tl-track sm">
          <div class="tl-fill other" style="width:${pct(oAge).toFixed(1)}%"></div>
        </div>
      </div>`;
  }

  // 10年ごとの目盛り
  const scale = [];
  for (let a = 0; a <= maxAge; a += 10) scale.push(`<span>${a}</span>`);
  rows += `
    <div class="tl-row">
      <div class="tl-label"></div>
      <div class="tl-scale">${scale.join("")}</div>
    </div>`;

  const note = lastOther
    ? "細いほうの帯は、「くらべる」で入力した相手の人生です。"
    : "「くらべる」タブで相手の生年月日を入れると、その人の人生もここに並べて表示されます。";

  el("timeline-content").innerHTML = `
    <div class="tl">${rows}</div>
    <p class="tl-legend">帯の上の細い線 … ${marks.map(m => `${m.a}歳 ${m.t}`).join(" ・ ")}</p>
    <p class="note">色が濃い部分が、これまでに生きてきた時間です。下の数字は年齢の目盛り。${note}</p>`;
}

// ---------- 同じ誕生日・同学年の有名人 ----------

// 1月1日からの通算日(誕生日どうしの近さを測るのに使う)
function dayOfYear(m, d) {
  return Math.round((new Date(2001, m - 1, d) - new Date(2001, 0, 1)) / MS_PER_DAY);
}

function renderBirthdayTwins(birth) {
  const m = birth.getMonth() + 1, d = birth.getDate();
  const myYear = birth.getFullYear();

  const line = p => {
    const diff = myYear - p.y;
    const rel = diff === 0 ? "あなたと同い年!" : diff > 0 ? `あなたより${diff}歳年上` : `あなたより${-diff}歳年下`;
    return `<li><span class="age-label">${p.y}年</span><span class="person">${p.name}</span>
      <span class="work">${p.field} / ${rel}</span></li>`;
  };

  const same = FAMOUS_PEOPLE.filter(p => p.m === m && p.d === d).sort((a, b) => a.y - b.y);
  if (same.length > 0) {
    el("birthday-content").innerHTML = `
      <p><strong>${m}月${d}日</strong>生まれの有名人です。誕生日おめでとうを言い合える仲間。</p>
      <ul class="list">${same.map(line).join("")}</ul>`;
    return;
  }

  // ぴったり同じ日がいないときは、日付が近い人を出す
  const myDoy = dayOfYear(m, d);
  const near = FAMOUS_PEOPLE
    .map(p => {
      const gap = Math.abs(dayOfYear(p.m, p.d) - myDoy);
      return { p, gap: Math.min(gap, 365 - gap) };
    })
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 4);
  el("birthday-content").innerHTML = `
    <p>${m}月${d}日ぴったりの人はまだデータにいませんが、誕生日が近いのはこの人たちです。
    <span class="work">(<code>data.js</code> の FAMOUS_PEOPLE に追加できます)</span></p>
    <ul class="list">${near.map(({ p, gap }) =>
      `<li><span class="age-label">${p.m}月${p.d}日</span><span class="person">${p.name}</span>
        <span class="work">${p.field} / ${gap}日ちがい</span></li>`).join("")}</ul>`;
}

function renderClassmates(birth) {
  const myCohort = cohortYear(birth);
  const all = FAMOUS_PEOPLE.map(p => {
    const dt = new Date(p.y, p.m - 1, p.d);
    return { p, dt, cohort: cohortYear(dt) };
  });
  // 4月始まりの順に並べる
  const inYearOrder = (a, b) =>
    ((a.p.m - 4 + 12) % 12) * 100 + a.p.d - (((b.p.m - 4 + 12) % 12) * 100 + b.p.d);

  const line = x => {
    const early = isEarlyBirth(x.dt) ? ' <span class="work">(早生まれ)</span>' : "";
    return `<li><span class="age-label">${x.p.m}月${x.p.d}日</span><span class="person">${x.p.name}</span>
      <span class="work">${x.p.field}</span>${early}</li>`;
  };

  const label = c => `${c}年4月〜${c + 1}年3月生まれ`;
  const same = all.filter(x => x.cohort === myCohort).sort(inYearOrder);
  const mine = `<p>あなたは <strong>${label(myCohort)}</strong> の学年です。${isEarlyBirth(birth) ? "(早生まれなので、ひとつ上の学年組)" : ""}</p>`;

  if (same.length > 0) {
    el("classmates-content").innerHTML = `
      ${mine}
      <p class="subhead">同じ学年の有名人</p>
      <ul class="list">${same.map(line).join("")}</ul>`;
    return;
  }

  const near = all.filter(x => Math.abs(x.cohort - myCohort) === 1)
    .sort((a, b) => a.cohort - b.cohort || inYearOrder(a, b));
  el("classmates-content").innerHTML = `
    ${mine}
    <p>同じ学年の有名人はまだデータにいません。前後の学年にはこの人たちがいます。
    <span class="work">(<code>data.js</code> の FAMOUS_PEOPLE に追加できます)</span></p>
    <ul class="list">${near.slice(0, 6).map(x =>
      `<li><span class="age-label">${x.cohort < myCohort ? "1コ上" : "1コ下"}</span>
        <span class="person">${x.p.name}</span> <span class="work">${x.p.field}</span></li>`).join("")}</ul>`;
}

// ---------- 表示テーマ(明るい/暗い) ----------

function currentTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeBtn() {
  const dark = currentTheme() === "dark";
  const b = el("theme-btn");
  b.textContent = dark ? "☀️" : "🌙";
  b.title = dark ? "明るい表示に切り替える" : "暗い表示に切り替える";
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  updateThemeBtn();
}

// ---------- くらべる ----------

function runCompare() {
  const content = el("compare-content");
  if (!lastResult) {
    content.innerHTML = `<p class="note">先に上であなたの生年月日を入力してください。</p>`;
    return;
  }
  const parsed = readDateFields("other");
  if (parsed.error) {
    content.innerHTML = `<p class="note">${parsed.error}</p>`;
    return;
  }
  const other = parsed.date;
  const { birth, now } = lastResult;

  const me = lastResult.age;
  const otherAge = calcAge(other, now);
  const olderFirst = other < birth; // 相手のほうが年上か
  const diff = olderFirst ? calcAge(other, birth) : calcAge(birth, other);
  const diffText = (diff.y === 0 && diff.m === 0 && diff.d === 0)
    ? "なんと同じ日生まれ!"
    : `${diff.y > 0 ? diff.y + "歳" : ""}${diff.m > 0 ? diff.m + "ヶ月" : ""}${diff.y === 0 && diff.m === 0 ? diff.d + "日" : ""}、${olderFirst ? "相手が年上" : "あなたが年上"}`;

  const rows = [
    ["いまの年齢", `あなた ${me.y}歳 / 相手 ${otherAge.y}歳`],
    ["年の差", diffText],
    ["干支", `あなた ${eto(birth.getFullYear())} / 相手 ${eto(other.getFullYear())}`],
  ];

  // 相手があなたの今の年齢だった(になる)日
  const myAgeMs = now - birth;
  const d1 = new Date(other.getTime() + myAgeMs);
  if (olderFirst) {
    const memo = d1 < birth
      ? `あなたが生まれる${Math.max(1, Math.round((birth - d1) / (MS_PER_DAY * 365.25)))}年ほど前`
      : `あなたは${calcAge(birth, d1).y}歳だった`;
    rows.push([`相手が今のあなた(${me.y}歳)だった日`, `${fmtDate(d1)}(${memo})`]);
    // あなたが相手の今の年齢になる日
    const d2 = new Date(birth.getTime() + (now - other));
    rows.push([`あなたが今の相手(${otherAge.y}歳)になる日`, `${fmtDate(d2)}(${Math.round((d2 - now) / (MS_PER_DAY * 365.25))}年後)`]);
  } else if (other > birth) {
    rows.push([`相手が今のあなた(${me.y}歳)になる日`, `${fmtDate(d1)}(${Math.round((d1 - now) / (MS_PER_DAY * 365.25))}年後)`]);
    const d2 = new Date(birth.getTime() + (now - other));
    rows.push([`あなたが今の相手(${otherAge.y}歳)だった日`, `${fmtDate(d2)}`]);
  }

  // ふたりの人生時計
  const clock = b => {
    const yrs = (now - b) / (MS_PER_DAY * 365.2425);
    if (yrs >= LIFESPAN) return "24:00+(延長戦)";
    const min = (yrs / LIFESPAN) * 24 * 60;
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;
  };
  rows.push(["人生時計(80年=24時間)", `あなた ${clock(birth)} / 相手 ${clock(other)}`]);

  content.innerHTML = `<table class="plain">${rows.map(([k, v2]) => `<tr><th>${k}</th><td>${v2}</td></tr>`).join("")}</table>
    <p class="note">「わたし」タブの人生の見取り図に、相手の帯も重ねて表示しました。</p>`;

  // 見取り図に相手を重ねて描き直す
  lastOther = other;
  renderTimeline();
}

// ---------- シェア(画像・テキスト) ----------

// シェア用のひとことデータを組み立てる
function buildShareLines() {
  const { birth, now, age, daysLived } = lastResult;
  const ageYears = (now - birth) / (MS_PER_DAY * 365.2425);
  const lines = [];
  lines.push(`いま ${age.y}歳${age.m}ヶ月${age.d}日(生きて${fmtNum(daysLived)}日目)`);
  if (ageYears < LIFESPAN) {
    const min = (ageYears / LIFESPAN) * 24 * 60;
    lines.push(`人生時計(80年=24時間)… ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`);
  } else {
    lines.push(`人生時計は24:00を超えて延長戦!`);
  }
  lines.push(`火星ではまだ ${(daysLived / 686.98).toFixed(1)}歳`);
  // 同じ年齢の歴史人物をひとり
  for (const f of HISTORICAL_FIGURES) {
    const ev = f.events.find(e => e.age === age.y);
    if (ev) { lines.push(`同じ${age.y}歳のとき、${f.name}は「${ev.text}」`); break; }
  }
  return lines;
}

function shareStatus(msg) { el("share-status").textContent = msg; }

function makeShareCanvas() {
  const { birth, age } = lastResult;
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1350;
  const x = c.getContext("2d");

  x.fillStyle = "#f7f4ee";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#b3552e";
  x.fillRect(0, 0, c.width, 14);
  x.fillRect(0, c.height - 14, c.width, 14);

  x.textAlign = "center";
  x.fillStyle = "#b3552e";
  x.font = "bold 56px sans-serif";
  x.fillText("🕰️ 人生ものさし年表", c.width / 2, 130);

  x.fillStyle = "#6f6a5e";
  x.font = "36px sans-serif";
  x.fillText(`${fmtDate(birth)}生まれ`, c.width / 2, 220);

  x.fillStyle = "#2b2a26";
  x.font = "bold 110px sans-serif";
  x.fillText(`${age.y}歳${age.m}ヶ月${age.d}日`, c.width / 2, 380);

  x.strokeStyle = "#e5dfd2";
  x.lineWidth = 3;
  x.beginPath(); x.moveTo(120, 440); x.lineTo(c.width - 120, 440); x.stroke();

  x.textAlign = "left";
  x.fillStyle = "#2b2a26";
  x.font = "40px sans-serif";
  let yPos = 540;
  for (const line of buildShareLines().slice(1)) {
    // 長い行は2行に折り返す
    const max = 22;
    if (line.length <= max) {
      x.fillText(`・${line}`, 110, yPos);
      yPos += 90;
    } else {
      x.fillText(`・${line.slice(0, max)}`, 110, yPos);
      x.fillText(`  ${line.slice(max, max * 2 + 4)}${line.length > max * 2 + 4 ? "…" : ""}`, 110, yPos + 58);
      yPos += 148;
    }
  }

  x.textAlign = "center";
  x.fillStyle = "#6f6a5e";
  x.font = "30px sans-serif";
  x.fillText(`${fmtDate(lastResult.now)} 時点`, c.width / 2, c.height - 70);
  return c;
}

function downloadShareImage() {
  if (!lastResult) { shareStatus("先に生年月日を入力してください。"); return; }
  const a = document.createElement("a");
  a.href = makeShareCanvas().toDataURL("image/png");
  a.download = "jinsei-monosashi.png";
  a.click();
  shareStatus("画像を保存しました(ダウンロードフォルダをご確認ください)。");
}

async function copyShareText() {
  if (!lastResult) { shareStatus("先に生年月日を入力してください。"); return; }
  const text = ["🕰️ 人生ものさし年表", ...buildShareLines().map(l => "・" + l)].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    shareStatus("コピーしました!そのままメールやSNSに貼り付けられます。");
  } catch {
    // クリップボードが使えない環境向けの代替(テキストを選択状態で表示)
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    shareStatus("コピーしました!");
  }
}

// ---------- 起動 ----------
setupDateFields("birth");
setupDateFields("other");

el("calc-btn").addEventListener("click", run);
el("compare-btn").addEventListener("click", runCompare);
document.querySelectorAll(".tab-btn").forEach(b => {
  b.addEventListener("click", () => showTab(b.dataset.tab));
});

// 表示テーマ。前回選んだ設定がなければ、パソコン・スマホの設定に合わせる
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark" || savedTheme === "light") {
  document.documentElement.setAttribute("data-theme", savedTheme);
}
updateThemeBtn();
el("theme-btn").addEventListener("click", toggleTheme);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updateThemeBtn);
el("share-img-btn").addEventListener("click", downloadShareImage);
el("share-copy-btn").addEventListener("click", copyShareText);

// 前回入力した生年月日を覚えておく
const saved = localStorage.getItem("birthdate");
if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
  writeDateFields("birth", saved);
  run();
}
