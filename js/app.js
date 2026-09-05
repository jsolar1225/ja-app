// ============================================================
// 일본어 문장/단어 학습 앱 — v=62
// ★ v62: revealAnswer에 남아 있던 옛 조립 코드+여분 괄호 제거 (syntax error 해결)
// ★ v62: objBlock이 role:"명사"(목적어)를 찾도록 수정 — 번역에서 목적어 제거 작동
// ★ v62: 큰 문장/정답 조립 규칙 통일
//    - 명사+술어: 주어 + 조사(は/が) + 술어 (목적어·를 제외)
//    - 부사 문장: 부사 + 술어 (주어·조사 제외)
// ============================================================
const App = {

  sentences: [],
  queue: [],
  currentIndex: 0,
  selectedLevel: "all",
  mode: "forward",
  answered: false,
  MAX_SELECT: 2,
  predFilter: { noun: false, verb: false, iAdj: false, naAdj: false, adv: false },
   selectOrder: [],
  autoSec: 0,        // ★ 자동 다음 간격 (0 = 끄기)
  _autoRAF: null,    // ★ 진행바 애니메이션 핸들


  LEVELS: ["N5", "N4", "N3", "N2", "N1"],

  $: (id) => {
    const e = document.getElementById(id);
    if (e) return e;
    return {
      style: {}, dataset: {},
      classList: { add(){}, remove(){}, toggle(){} },
      textContent: "", innerHTML: "", onclick: null,
      disabled: false, title: "", offsetHeight: 0
    };
  },

  // ── Storage 안전 래퍼: storage.js의 실제 함수를 자동 감지 ──
  _store: {
    save(id) {
      const S = (typeof Storage !== "undefined" && Storage.saveProgress) ? Storage : {};

      try {
        if (typeof S.saveProgress === "function") { S.saveProgress(id); return; }
        if (typeof S.markDone === "function") S.markDone(id);
        if (typeof S.addTodayCount === "function") S.addTodayCount();
        if (typeof S.incrementToday === "function") S.incrementToday();
      } catch (e) { console.warn("진도 저장 실패:", e); }
    },
    doneIds() {
      const S = (typeof Storage !== "undefined" && Storage.saveProgress) ? Storage : {};

      try {
        if (typeof S.getDoneIds === "function") return S.getDoneIds() || [];
        if (typeof S.getDone === "function") return S.getDone() || [];
      } catch (e) {}
      return [];
    },
    todayCount() {
      const S = (typeof Storage !== "undefined" && Storage.saveProgress) ? Storage : {};

      try {
        if (typeof S.getTodayCount === "function") return S.getTodayCount();
      } catch (e) {}
      return 0;
    },
    clear() {
      const S = (typeof Storage !== "undefined" && Storage.saveProgress) ? Storage : {};

      try {
        if (typeof S.reset === "function") { S.reset(); return; }
        if (typeof S.resetAll === "function") { S.resetAll(); return; }
        if (typeof S.clearProgress === "function") { S.clearProgress(); return; }
      } catch (e) { console.warn("진도 초기화 실패:", e); }
    }
  },

  normLevel(lv) {
    return this.LEVELS.indexOf(lv) !== -1 ? lv : "";
  },

  currentSentence() { return this.queue[this.currentIndex] || null; },

  adjKindOf(adj) {
    const t = (adj && (adj.type || adj.kind)) || "";
    return (t === "na" || t === "naAdj") ? "naAdj" : "iAdj";
  },

  activeKinds() {
    const f = this.predFilter;
    const list = [];
    if (f.noun)  list.push("noun");
    if (f.verb)  list.push("verb");
    if (f.iAdj)  list.push("iAdj");
    if (f.naAdj) list.push("naAdj");
    if (f.adv)   list.push("adv");
    return list;
  },

  isWordMode() { return this.activeKinds().length === 1; },

  wordKind() {
    const list = this.activeKinds();
    return list.length === 1 ? list[0] : null;
  },

  clickedFirst(kindA, kindB) {
    const ia = this.selectOrder.indexOf(kindA);
    const ib = this.selectOrder.indexOf(kindB);
    return ia !== -1 && (ib === -1 || ia < ib);
  },

  isAdjNounModifier() {
    const f = this.predFilter;
    if (!f.noun) return false;
    const adjCount = (f.iAdj ? 1 : 0) + (f.naAdj ? 1 : 0);
    if (adjCount !== 1) return false;
    const adjKind = f.iAdj ? "iAdj" : "naAdj";
    return this.clickedFirst(adjKind, "noun");
  },

  hasConjugation(s) {
    if (!s) return false;
    if (s.wordMode) {
      return s.kind === "verb" || s.kind === "iAdj" || s.kind === "naAdj";
    }
    if (s.modifierMode) return false;
    return s.verbBase ? true : false;
  },

  init() {
    this.loadPredFilter();
    this.sentences = Generator.generate();
    console.log("✅ " + this.sentences.length.toLocaleString() + "개 문장 생성 완료");
    this.updateStats();
    this.updateLevelCounts();
    this.refreshPredButtons();
    this.buildQueue();
    this.loadCard();

    // ★ 저장된 자동 타이머 복원 + 버튼 연결
    try {
      const saved = Number(localStorage.getItem("jp_auto_sec"));
      if (saved > 0) {
        this.autoSec = saved;
        document.querySelectorAll(".at-btn").forEach(b => {
          b.classList.toggle("active", Number(b.dataset.sec) === saved);
        });
      }
    } catch(e){}
    document.querySelectorAll(".at-btn").forEach(btn => {
      btn.addEventListener("click", () => this.setAutoTimer(btn.dataset.sec, btn));
    });

  },

  setPred(target) {
    if (target === "noun" && this.predFilter.adv)  return;
    if (target === "adv"  && this.predFilter.noun) return;

    const isVerb = target === "verb";
    const isAdj  = (target === "iAdj" || target === "naAdj");
    const adjOn  = this.predFilter.iAdj || this.predFilter.naAdj;
    if (isVerb && adjOn) return;
    if (isAdj  && this.predFilter.verb) return;

    if (this.predFilter[target]) {
      // 해제: 필터와 순서에서 함께 제거
      this.predFilter[target] = false;
      this.selectOrder = this.selectOrder.filter(k => k !== target);
    } else {
      // 선택: MAX 초과 시 전부 초기화 후 새로 시작
      if (this.activeKinds().length >= this.MAX_SELECT) {
        this.predFilter = { noun: false, verb: false, iAdj: false, naAdj: false, adv: false };
        this.selectOrder = [];
      }
      this.predFilter[target] = true;
      // ★ 핵심: 순서를 클릭 순서로 완전히 재구축 (복원된 옛 순서 무시)
      this.selectOrder = this.activeKinds().filter(k => k !== target).concat([target]);
    }

    this.savePredFilter();
    try { localStorage.setItem("jp_pred_order", JSON.stringify(this.selectOrder)); } catch(e){}

    this.refreshPredButtons();
    this.updateStats();
    this.updateLevelCounts();
    this.buildQueue();
    this.loadCard();
  },

  savePredFilter() {
    try { localStorage.setItem("jp_pred_filter", JSON.stringify(this.predFilter)); } catch(e){}
  },

  loadPredFilter() {
    try {
      const saved = JSON.parse(localStorage.getItem("jp_pred_filter"));
      if (saved && typeof saved === "object") {
        this.predFilter = {
          noun:  saved.noun  === true,
          verb:  saved.verb  === true,
          iAdj:  saved.iAdj  === true,
          naAdj: saved.naAdj === true,
          adv:   saved.adv   === true
        };
        if (this.predFilter.adv && this.predFilter.noun) this.predFilter.noun = false;
        if (this.predFilter.verb && (this.predFilter.iAdj || this.predFilter.naAdj))
          this.predFilter.verb = false;

        const kinds = this.activeKinds();
        if (kinds.length > this.MAX_SELECT) {
          const keep = kinds.slice(0, this.MAX_SELECT);
          this.predFilter = {
            noun:  keep.includes("noun"),
            verb:  keep.includes("verb"),
            iAdj:  keep.includes("iAdj"),
            naAdj: keep.includes("naAdj"),
            adv:   keep.includes("adv")
          };
          if (this.predFilter.adv && this.predFilter.noun) this.predFilter.noun = false;
          if (this.predFilter.verb && (this.predFilter.iAdj || this.predFilter.naAdj))
            this.predFilter.verb = false;
        }

        try {
          const savedOrder = JSON.parse(localStorage.getItem("jp_pred_order"));
          if (Array.isArray(savedOrder)) {
            this.selectOrder = savedOrder.filter(k => this.predFilter[k]);
          } else {
            this.selectOrder = this.activeKinds();
          }
        } catch(e2) {
          this.selectOrder = this.activeKinds();
        }
        if (this.selectOrder.length !== this.activeKinds().length) {
          this.selectOrder = this.activeKinds();
        }
      }
    } catch(e){}
  },

  refreshPredButtons() {
    const f = this.predFilter;
    const adjOn = f.iAdj || f.naAdj;
    const map = [
      { id: "predNoun",  on: f.noun,  locked: f.adv,
        lockMsg: "부사와 명사는 조합할 수 없습니다" },
      { id: "predVerb",  on: f.verb,  locked: adjOn,
        lockMsg: "형용사와 동사는 조합할 수 없습니다" },
      { id: "predIAdj",  on: f.iAdj,  locked: f.verb,
        lockMsg: "형용사와 동사는 조합할 수 없습니다" },
      { id: "predNaAdj", on: f.naAdj, locked: f.verb,
        lockMsg: "형용사와 동사는 조합할 수 없습니다" },
      { id: "predAdv",   on: f.adv,   locked: f.noun,
        lockMsg: "부사와 명사는 조합할 수 없습니다" }
    ];

    map.forEach(m => {
      const btn = this.$(m.id);
      btn.classList.toggle("active", m.on);
      if (m.locked) {
        btn.disabled = true;
        btn.classList.add("locked");
        btn.title = m.lockMsg;
      } else {
        btn.disabled = false;
        btn.classList.remove("locked");
        btn.title = "";
      }
    });
  },

  predKindOf(s) {
    if (!s || !s.verbBase) return null;
    const adj = s.adjData || ADJS.find(a => a.jp === s.verbBase);
    if (adj) return this.adjKindOf(adj);
    if (VERBS.find(v => v.base === s.verbBase)) return "verb";
    return null;
  },

  filteredPool() {
    const f = this.predFilter;
    const kinds = this.activeKinds();
    if (kinds.length !== 2) return [];
    const predKinds = kinds.filter(k => k !== "noun" && k !== "adv");

    if (f.adv && predKinds.length === 1) {
      return this.sentences.filter(s =>
        s.hasAdverb && this.predKindOf(s) === predKinds[0]
      );
    }
    if (f.noun && predKinds.length === 1) {
      return this.sentences.filter(s =>
        !s.hasAdverb && (
          (predKinds.includes("verb")  && s.kind === "verb") ||
          (predKinds.includes("iAdj")  && s.kind === "iAdj") ||
          (predKinds.includes("naAdj") && s.kind === "naAdj")
        )
      );
    }
    return this.sentences.filter(s =>
      !s.hasAdverb && predKinds.includes(s.kind)
    );
  },

  buildModifierCards() {
    const f = this.predFilter;
    const adjKind = f.iAdj ? "iAdj" : "naAdj";
    const nouns = OBJECTS.concat(SUBJECTS);
    const lvCycle = ["N5", "N4", "N3", "N2", "N1"];
    const cards = [];

    ADJS.forEach(adj => {
      if (this.adjKindOf(adj) !== adjKind) return;
      nouns.forEach((n, ni) => {
        cards.push({
          modifierMode: true,
          kind: adjKind,
          level: this.normLevel(adj.level) || lvCycle[ni % lvCycle.length],
          id: "mod_" + adjKind + "_" + adj.jp + "_" + n.jp,
          full: (adj.jp || "") + (n.jp || ""),
          translation: this.modifierTranslation(adj.ko || "", n.ko || ""),
          blocks: [
            { role: "수식", jp: adj.jp, reading: adj.reading || "", ko: adj.ko || "" },
            { role: "명사", jp: n.jp,   reading: n.reading || "",   ko: (n.ko || "").split("/")[0] || "" }
          ],
          adjData: adj,
          tip: ""
        });
      });
    });
    return cards;
  },

   setMode(mode) {
    this.mode = mode;
    const btn = this.$("modeToggle");
    if (btn) {
      btn.textContent = (mode === "forward") ? "일본어 → 한국어" : "한국어 → 일본어 🔄";
      btn.classList.toggle("active", mode === "reverse");  // reverse일 때 강조색
    }
    this.buildQueue();
    this.loadCard();
  },

  // 버튼 1개로 forward ↔ reverse 전환
  toggleMode() {
    this.setMode(this.mode === "forward" ? "reverse" : "forward");
  },

  currentPool() {
    if (this.isAdjNounModifier()) return this.buildModifierCards();
    if (this.isWordMode()) return this.buildWordCards();
    return this.activeKinds().length > 0 ? this.filteredPool() : [];
  },

  updateStats() {
    // ★ 전체 문장 숫자 제거 — 학습 완료/오늘 학습만 갱신
    this.$("statDone").textContent = this._store.doneIds().length.toLocaleString();
    this.$("statToday").textContent = "🔥 " + this._store.todayCount();
  },


    updateLevelCounts() {
    // ★ 레벨 버튼은 레벨명만 표시 (숫자 제거 — 다른 곳에서 버튼 텍스트를 다시 쓰지 않음)
    document.querySelectorAll(".level-btn").forEach(btn => {
      const lv = btn.dataset.level;
      btn.textContent = (lv === "all") ? "전체" : lv;
    });
  },


  setLevel(level) {
    this.selectedLevel = level;
    document.querySelectorAll(".level-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.level === level);
    });
    this.buildQueue();
    this.loadCard();
  },

  buildQueue() {
    const done = this._store.doneIds();

    if (this.activeKinds().length === 0) {
      this.queue = [];
      this.currentIndex = 0;
      this.answered = false;
      return;
    }

    // ── 단어 모드 (블록 1개) ──
    if (this.isWordMode()) {
      let wpool = this.buildWordCards().filter(w =>
        this.selectedLevel === "all" || w.level === this.selectedLevel
      );
      const wUn = wpool.filter(w => !done.includes(w.id));
      if (wUn.length > 0) wpool = wUn;

      this.queue = wpool.sort(() => Math.random() - 0.5).slice(0, 20);
      this.currentIndex = 0;
      this.answered = false;
      return;
    }

    // ── 형용사+명사 관형 모드 ──
    if (this.isAdjNounModifier()) {
      let mpool = this.buildModifierCards().filter(s =>
        this.selectedLevel === "all" || s.level === this.selectedLevel
      );
      const mUn = mpool.filter(s => !done.includes(s.id));
      if (mUn.length > 0) mpool = mUn;

      this.queue = mpool.sort(() => Math.random() - 0.5).slice(0, 20);
      this.currentIndex = 0;
      this.answered = false;
      return;
    }

    // ── 문장 모드 (블록 2개) ──
    let pool = this.filteredPool().filter(s =>
      this.selectedLevel === "all" || s.level === this.selectedLevel
    );
    const unlearned = pool.filter(s => !done.includes(s.id));
    if (unlearned.length > 0) pool = unlearned;

    this.queue = pool.sort(() => Math.random() - 0.5).slice(0, 20);
    this.currentIndex = 0;
    this.answered = false;
  },

  buildWordCards() {
    const kind = this.wordKind();
    const lvCycle = ["N5", "N4", "N3", "N2", "N1"];
    const wpool = [];

    if (kind === "verb") {
      VERBS.forEach((v) => wpool.push({
        wordMode: true,
        kind: "verb",
        level: this.normLevel(v.level) || "N5",
        id: "word_verb_" + v.base,
        full: v.base,
        translation: (v.ko || "") + " (기본형)",
        blocks: [],
        verbBase: v.base,
        verbKo: v.ko || "",
        verbReading: v.reading || "",
        tip: "💡 동사 <b>기본형(辞書形)</b>이 사전에 실리는 형태예요. 「활용 보기」를 눌러보세요!"
      }));

    } else if (kind === "adv") {
      ADVERBS.forEach((a, ai) => wpool.push({
        wordMode: true,
        kind: "adv",
        level: this.normLevel(a.level) || lvCycle[ai % lvCycle.length],
        id: "_adv_" + a.jp,
        full: a.jp,
        translation: a.ko || "",
        blocks: [],
        verbKo: a.ko || "",
        verbReading: a.reading || "",
        tip: a.type === "adjMod"
          ? "💡 <b>형용사를 꾸미는 부사</b>예요. 형용사 바로 앞에 놓입니다. (とても元気です)"
          : "💡 <b>동사를 꾸미는 부사</b>예요. 조사 뒤·동사 앞에 놓입니다. (ゆっくり食べます)"
      }));

    } else if (kind === "noun") {
      const nouns = SUBJECTS.concat(OBJECTS);
      nouns.forEach((n, ni) => wpool.push({
        wordMode: true,
        kind: "noun",
        level: this.normLevel(n.level) || lvCycle[ni % lvCycle.length],
        id: "word_noun_" + n.jp,
        full: n.jp,
        translation: (n.ko || "").split("/")[0] || "",
        blocks: [],
        verbKo: (n.ko || "").split("/")[0] || "",
        verbReading: n.reading || "",
        tip: "💡 <b>명사</b>는 활용하지 않아요. 조사(は・が・を 등)와 함께 쓰입니다!"
      }));

    } else {
      ADJS.forEach((a, ai) => wpool.push({
        wordMode: true,
        kind: kind,
        level: this.normLevel(a.level) || (kind === "iAdj" ? Generator.getAdjLevel(ai) : "N5"),
        id: "word_adj_" + a.jp,
        full: a.jp,
        translation: a.ko || "",
        blocks: [],
        verbBase: a.jp,
        adjData: a,
        verbKo: a.ko || "",
        verbReading: a.reading || "",
        tip: kind === "iAdj"
          ? "💡 <b>い형용사</b>는 어미 い가 활용됩니다. (大きい→大きくない/大きかった)"
          : "💡 <b>な형용사</b>는 명사 수식 시 な를 붙입니다. (静かな人)"
      }));
    }

    return wpool;
  },

  predBase(s) {
    const adj = s.adjData || ADJS.find(a => a.jp === s.verbBase);
    if (adj) return { jp: adj.jp, reading: adj.reading || "", ko: adj.ko || "" };
    const v = VERBS.find(x => x.base === s.verbBase);
    if (v) return { jp: v.base, reading: v.reading || "", ko: v.ko || "" };
    return { jp: s.verbBase || "", reading: s.verbReading || "", ko: s.verbKo || "" };
  },

  advBlock(s) {
    const blocks = s.blocks || [];
    return blocks.find(b => b.role === "부사") || null;
  },
  objBlock(s) {
    // generator에서 목적어는 role:"명사" (pattern A의 세 번째 블록)
    const blocks = s.blocks || [];
    return blocks.find(b => b.role === "명사") || null;
  },

  wordReadingOf(s) {
    if (!s) return "";

    let r = s.verbReading || "";
    if (!r && s.adjData) r = s.adjData.reading || "";
    if (!r && s.blocks && s.blocks[0]) r = s.blocks[0].reading || "";
    if (!r) {
      const adj = ADJS.find(a => a.jp === (s.full || ""));
      if (adj) r = adj.reading || "";
    }
    if (!r) {
      const adv = ADVERBS.find(a => a.jp === (s.full || ""));
      if (adv) r = adv.reading || "";
    }
    if (!r) {
      const v = VERBS.find(x => x.base === (s.full || ""));
      if (v) r = v.reading || "";
    }
    if (!r) {
      const n = SUBJECTS.concat(OBJECTS).find(x => x.jp === (s.full || ""));
      if (n) r = n.reading || "";
    }
    return r;
  },

  translationOf(s) {
    if (!s) return "";
    const tr = s.translation || "";

    const isAdvSentence = (!s.wordMode && !s.modifierMode &&
                           this.predFilter.adv && s.hasAdverb);

    const isNounVerb = (!s.wordMode && !s.modifierMode &&
                        !s.hasAdverb && this.predFilter.noun && this.predFilter.verb);

    if (isNounVerb) {
      // 큰 문장에서 목적어를 뺐으므로 번역에서도 목적어 제거
      const objB = this.objBlock(s);
      let out = tr;
      if (objB && objB.ko) {
        const objKo = ((objB.ko || "").split("/")[0] || "").trim();
        if (objKo) {
          const re = new RegExp("\\s?" + objKo.replace(/[.*+?^{}()|[\]\\]/g, "\\$&") + "[을를]?\\s?", "g");
          out = out.replace(re, " ").replace(/\s+/g, " ").trim();
        }
      }
      return out || tr;
    }

    if (!isAdvSentence) return tr;

    // 부사 문장: 큰 문장에서 주어를 뺐으므로 번역에서도 주어 제거
    const blocks = s.blocks || [];
    const advB  = blocks.find(b => b.role === "부사");
    const subjB = blocks.find(b => b.role === "주어");

    let body = tr;
    if (subjB && subjB.ko && body.startsWith(subjB.ko)) {
      body = body.slice(subjB.ko.length);
      const sp = body.indexOf(" ");
      body = (sp !== -1) ? body.slice(sp + 1) : "";
    }
    body = body.trim();

    const advKo = (advB && advB.ko) ? advB.ko : "";
    if (advKo && body.startsWith(advKo)) return body;

    return (advKo + " " + body).trim() || tr;
  },

  // 한국어 형용사 관형형 변환: 크다→큰, 작다→작은, 유명하다→유명한
  adjAttributiveKo(ko) {
    let base = (ko || "").trim();
    const sp = base.indexOf("/");
    if (sp !== -1) base = base.slice(0, sp).trim();

    if (!base.endsWith("다")) return base;

    const IRREG = {
      "새롭다": "새로운",
      "춥다": "추운",
      "덥다": "더운",
      "드물다": "드문",
      "오래되다": "오래된",
      "멀다": "먼",
      "가깝다": "가까운",
      "그렇다": "그런", "이렇다": "이런", "저렇다": "저런", "어떻다": "어떤",
      "많지 않다": "많지 않은"
    };
    if (IRREG[base]) return IRREG[base];

    const stem = base.slice(0, -1);

    if (stem.endsWith("있") || stem.endsWith("없")) return stem + "는";

    const last = stem.slice(-1);
    const code = last.charCodeAt(0);
    const isHangul = code >= 0xAC00 && code <= 0xD7A3;
    const jongIdx = isHangul ? (code - 0xAC00) % 28 : 0;

    if (!isHangul || jongIdx > 0) return stem + "은";

    return String.fromCharCode(code + 4);
  },

  modifierTranslation(adjKo, nounKo) {
    const adj = this.adjAttributiveKo(adjKo);
    const noun = ((nounKo || "").split("/")[0] || "").trim();
    return (adj + " " + noun).trim();
  },

  kanjiRubyHtml(word, reading) {
    if (!word) return "";
    if (!reading || !/[\u4e00-\u9faf]/.test(word)) return word;

    const isKanji = ch => /[\u4e00-\u9faf]/.test(ch);
    const isKana  = ch => /[\u3040-\u30ff]/.test(ch);

    const segs = [];
    for (const ch of word) {
      const t = isKanji(ch) ? "k" : (isKana(ch) ? "a" : "o");
      if (segs.length && segs[segs.length - 1].t === t) {
        segs[segs.length - 1].s += ch;
      } else {
        segs.push({ t: t, s: ch });
      }
    }

    const kanjiCount = segs.filter(x => x.t === "k").length;
    if (kanjiCount === 0) return word;
    if (kanjiCount > 1) {
      return "<ruby>" + word + "<rt>" + reading + "</rt></ruby>";
    }
    const kIdx = segs.findIndex(x => x.t === "k");

    let r = reading;

    for (let i = 0; i < kIdx; i++) {
      const seg = segs[i];
      if (seg.t !== "a") break;
      if (r.startsWith(seg.s)) r = r.slice(seg.s.length);
      else break;
    }

    for (let i = segs.length - 1; i > kIdx; i--) {
      const seg = segs[i];
      if (seg.t !== "a") break;
      if (r.endsWith(seg.s)) r = r.slice(0, r.length - seg.s.length);
    }

    if (!r) return "<ruby>" + word + "<rt>" + reading + "</rt></ruby>";

    let html = "";
    for (let i = 0; i < segs.length; i++) {
      if (i === kIdx) html += "<ruby>" + segs[i].s + "<rt>" + r + "</rt></ruby>";
      else html += segs[i].s;
    }
    return html;
  },

  loadCard() {
    const s = this.currentSentence();

    if (!s) {
      this.$("levelBadge").textContent = "-";
      this.$("kindBadge").textContent = "";
      this.$("wordReading").textContent = "";
      this.$("subjLabel").textContent = "주어";
      this.$("partSubject").classList.remove("adv-mode");
      ["subjJp","subjReading","subjKo","predJp","predReading","predKo"]
        .forEach(id => { this.$(id).textContent = ""; });
      this.$("Jp").textContent = "";
      this.$("particleKo").textContent = "";
      this.$("particleTip").innerHTML = "";
      this.$("revealBtn").style.display = "none";
      this.$("translationBox").textContent = "";
      this.$("translationBox").classList.remove("show");
      this.$("conjBox").classList.remove("show");
      const fe0 = this.$("fullSentence");
      fe0.classList.remove("reverse-prompt");
      fe0.onclick = null;
      fe0.innerHTML = this.activeKinds().length === 0
        ? "👆 공부할 블록을 선택하세요"
        : "표시할 문장이 없습니다";
      this.toggleAnalysis(false);
      this.$("progressFill").style.width = "0%";
      return;
    }

    this.answered = false;
    this.$("levelBadge").textContent = s.level || "";
    // reverse 모드: 블록 분석 영역 숨김 (forward/단어 모드는 기존대로)
    const hideBlocks = (this.mode === "reverse" && !s.wordMode);
    this.toggleAnalysis(!s.wordMode && !hideBlocks);
  // reverse 모드: 발음 힌트 + 활용 보기 버튼 숨김
     const hintEl = this.$("hintText");
    if (hintEl) hintEl.style.display = (this.mode === "reverse") ? "none" : "";

    const blocks = s.blocks || [];
    const base = this.predBase(s);
    const pk = this.predKindOf(s);
    const isAdvSentence = (!s.wordMode && this.predFilter.adv && s.hasAdverb);
    const advB = isAdvSentence ? this.advBlock(s) : null;
    const isModifier = !!s.modifierMode;
    const hasConj = this.hasConjugation(s);
    const ctb = this.$("conjToggleBtn");
    if (ctb) ctb.style.display = hasConj ? "" : "none";

    let firstB;
    let showParticle;

    if (advB) {
      firstB = advB;
      showParticle = false;
    } else if (isModifier) {
      firstB = blocks[0] || {};
      showParticle = false;
    } else {
      firstB = blocks[0] || {};
      showParticle = !!s.firstParticle;
    }

    // reverse 모드에서는 조사 칸도 숨김 (hideBlocks는 아래에서 정의되므로 직접 계산)
    const hideForReverse = (this.mode === "reverse" && !s.wordMode && !s.modifierMode);
    this.$("partParticle").style.display = (showParticle && !hideForReverse) ? "" : "none";


    // ── 단어 모드: 요미가나 표시 ──
    this.$("wordReading").textContent = "";

    const kindEl = this.$("kindBadge");
    if (s.wordMode) {
      if (s.kind === "verb")       { kindEl.textContent = "동사 단어";      kindEl.className = "kind-badge k-verb"; }
      else if (s.kind === "iAdj")  { kindEl.textContent = "い형용사 단어"; kindEl.className = "kind-badge k-iadj"; }
      else if (s.kind === "naAdj") { kindEl.textContent = "な형용사 단어"; kindEl.className = "kind-badge k-naadj"; }
      else if (s.kind === "noun")  { kindEl.textContent = "명사 단어";      kindEl.className = "kind-badge k-noun"; }
      else                         { kindEl.textContent = "부사 단어";      kindEl.className = "kind-badge k-adv"; }
    } else if (isModifier) {
      kindEl.textContent = (s.kind === "iAdj" ? "い형용사 + 명사" : "な형용사 + 명사");
      kindEl.className = "kind-badge " + (s.kind === "iAdj" ? "k-iadj" : "k-naadj");
    } else if (advB) {
      kindEl.textContent = "부사 + " + (pk === "verb" ? "동사" : pk === "iAdj" ? "い형용사" : "な형용사");
      kindEl.className = "kind-badge " + (pk === "verb" ? "k-verb" : pk === "iAdj" ? "k-iadj" : "k-naadj");
    } else {
      if (pk === "verb")       { kindEl.textContent = "명사 + 동사";    kindEl.className = "kind-badge k-verb"; }
      else if (pk === "iAdj")  { kindEl.textContent = "명사 + い형용사"; kindEl.className = "kind-badge k-iadj"; }
      else if (pk === "naAdj") { kindEl.textContent = "명사 + な형용사"; kindEl.className = "kind-badge k-naadj"; }
      else                     { kindEl.textContent = "문장";            kindEl.className = "kind-badge"; }
    }

    // ── 첫 블록 표시 ──
    const firstJp = this.$("subjJp");
    firstJp.innerHTML = this.kanjiRubyHtml(firstB.jp || "", firstB.reading || "");
     this.$("subjReading").textContent = "";
    this.$("subjReading").style.display = "none";

    this.$("subjKo").textContent = firstB.ko || "";
    this.$("subjLabel").textContent = advB ? "부사" : (isModifier ? "수식" : "주어");
    if (advB) this.$("partSubject").classList.add("adv-mode");
    else this.$("partSubject").classList.remove("adv-mode");

     // ── 조사 표시 ──
    const tip = this.$("particleTip");
    const partB = blocks.find(b => b.role === "조사");

    // 조사 후보: firstParticle → particles[0] → blocks의 조사 블록
    // ★ .jp가 실제로 있는 후보를 찾을 때까지 순서대로 확인
    const candidates = [];
    if (s.firstParticle) candidates.push(s.firstParticle);
    if (s.particles && s.particles[0]) candidates.push(s.particles[0]);
    if (partB) candidates.push(partB);

    let fp = null;
     for (const c of candidates) {
      if (typeof c === "string" && c) { fp = { jp: c, ko: "", tip: "" }; break; }
      if (c && c.jp) { fp = c; break; }
    }


     if (showParticle && fp && fp.jp) {
      this.$("particleJp").textContent = fp.jp;
      this.$("particleKo").textContent = fp.ko || "";
      // 조사 팁 우선, 없으면 문장 팁
      let tipHtml = fp.tip || "";
      if (!tipHtml && hasConj && !isModifier && s.tip) tipHtml = s.tip;
      tip.innerHTML = tipHtml;
    } else {
      this.$("particleJp").textContent = "";
      this.$("particleKo").textContent = "";
      tip.innerHTML = (hasConj && !isModifier && s.tip) ? s.tip : "";
    }



    // ── 두 번째 블록(술어) 표시 ──
     if (isModifier) {
      const nounB = blocks[1] || {};
      this.$("predJp").innerHTML = this.kanjiRubyHtml(nounB.jp || "", nounB.reading || "");
      this.$("predReading").textContent = "";
      this.$("predReading").style.display = "none";
      this.$("predKo").textContent = nounB.ko || "";
    } else {
      this.$("predJp").innerHTML = this.kanjiRubyHtml(base.jp, base.reading);
      this.$("predReading").textContent = "";
      this.$("predReading").style.display = "none";
      this.$("predKo").textContent = base.ko || "";
    }

    // ── 활용 보기 버튼 ──
        const rb = this.$("revealBtn");
    if (hasConj) {

      rb.style.display = "";
      rb.textContent = "활용 보기";
      rb.onclick = () => this.toggleConj();
    } else {
      rb.style.display = "none";
    }

    // ── 정답/번역 상태 초기화 ──
    this.$("translationBox").classList.remove("show");
    this.$("conjBox").classList.remove("show");
    const fe = this.$("fullSentence");
    fe.classList.remove("reverse-prompt");

    // ── 첫 화면: 단어/문장 표시 (발음 클릭 연결) ──
 if (this.mode === "reverse") {
      fe.classList.add("reverse-prompt");
      fe.textContent = this.translationOf(s);
      fe.onclick = null;   // 큰 문장 클릭 비활성화
    } else if (s.wordMode) {

      fe.textContent = s.full || "";
      fe.onclick = () => { if (typeof Speech !== "undefined") Speech.speak(s.full || ""); };

    } else {
      // 큰 문장 조립 — 실제 role 구조 기준
      //  명사+술어: 주어 + 조사(は/が) + 술어 (목적어 명사·를 제외)
      //  부사 문장: 부사 + 술어 (주어·조사 제외)
      let txt = "";
      blocks.forEach(b => {
        if (advB) {
          if (b.role === "주어" || b.role === "조사") return;
        } else {
          if (b.role === "명사") return;
          if (b.role === "조사" && b.jp === "を") return;
          if (b.role === "부사") return;
        }
        txt += (txt ? " " : "") + (b.jp || "");
      });
      txt = txt.trim();
      fe.innerHTML = this.kanjiRubyHtml(txt, "");
      fe.onclick = () => { if (typeof Speech !== "undefined") Speech.speak(txt); };
    }

     // ── 진행바 ──
    const pct = ((this.currentIndex + 1) / Math.max(this.queue.length, 1)) * 100;
    this.$("progressFill").style.width = pct + "%";

    // ★ 자동 타이머 ON이면 새 카드에서 재시작
    this.startAutoTimer();

  },

  revealAnswer(withConj) {
    if (this.answered) return;
    const s = this.currentSentence();
    if (!s) return;
    this.answered = true;

    const fe = this.$("fullSentence");
    fe.classList.remove("reverse-prompt");
    fe.onclick = null;

    // ── 전체 문장 조립 ──
    let html = "";
    const blocks = s.blocks || [];

    if (s.modifierMode) {
      blocks.forEach(b => {
        html += this.kanjiRubyHtml(b.jp || "", b.reading || "");
      });

    } else if (s.wordMode) {
      html = this.kanjiRubyHtml(s.full || "", this.wordReadingOf(s));

    } else {
      // 정답 문장: 카드와 동일 규칙으로 조립
      const isAdv = this.predFilter.adv && s.hasAdverb;
      blocks.forEach(b => {
        if (isAdv) {
          if (b.role === "주어" || b.role === "조사") return;
        } else {
          if (b.role === "명사") return;
          if (b.role === "조사" && b.jp === "を") return;
          if (b.role === "부사") return;
        }
        html += this.kanjiRubyHtml(b.jp || "", b.reading || "") + " ";
      });
    }

    fe.innerHTML = html.trim();

       // ── 활용 박스 (withConj가 true일 때만) ──
    if (withConj && this.hasConjugation(s)) {
      const cb = this.$("conjBox");
      cb.innerHTML = this.conjugationHtml(s);
      cb.classList.add("show");
    }


     // ── 번역 박스 ──
    const tb = this.$("translationBox");
    if (this.mode === "reverse") {
      // reverse: 한국어로 출제했으므로 뜻 보기 후에도 해석은 숨김
      tb.textContent = "";
      tb.classList.remove("show");
    } else {
      tb.textContent = this.translationOf(s);
      tb.classList.add("show");
    }


  },
  // 활용 보기: 활용 박스만 토글 (다시 누르면 접힘)
  toggleConj() {
    const s = this.currentSentence();
    if (!s || !this.hasConjugation(s)) return;
    const cb = this.$("conjBox");
    if (cb.classList.contains("show")) {
      cb.classList.remove("show");
    } else {
      cb.innerHTML = this.conjugationHtml(s);
      cb.classList.add("show");
    }
  },

   conjugationHtml(s) {
    const base = this.predBase(s);
    const pk = this.predKindOf(s);
    const row = (label, sub, form) =>
      "<div class='conj-row'>" +
        "<span class='conj-label'>" + label + "<small>" + sub + "</small></span>" +
        "<span class='conj-form'>" + this.kanjiRubyHtml(form, "") + "</span>" +
      "</div>";

    // ── 동사: 기본형/ます形/て形/た形/ない形/可能形 ──
    if (pk === "verb") {
      const v = VERBS.find(x => x.base === s.verbBase) || {};
      const dict = base.jp;

      // 데이터에 있으면 우선, 없으면 규칙으로 생성
      const stem  = dict.slice(0, -1);          // 마지막 う 단 글자 제거
      const last  = dict.slice(-1);
      const iRow  = { "う":"い","く":"き","ぐ":"ぎ","す":"し","つ":"ち","ぬ":"に","ぶ":"び","む":"み","る":"り" };
      const tRow  = { "く":"いて","ぐ":"いで","す":"して","つ":"って","ぬ":"んで","ぶ":"んで","む":"んで","る":"って" };
      const taRow = { "く":"いた","ぐ":"いだ","す":"した","つ":"った","ぬ":"んだ","ぶ":"んだ","む":"んだ","る":"った" };
      const eRow  = { "う":"え","く":"け","ぐ":"げ","す":"せ","つ":"て","ぬ":"ね","ぶ":"べ","む":"め","る":"れ" };

      const masu   = v.masu   || (stem + (iRow[last] || "り") + "ます");
      const te     = v.te     || (stem + (tRow[last]  || "って"));
      const ta     = v.ta     || (stem + (taRow[last] || "った"));
      const nai    = v.nai    || (stem + (iRow[last] || "り") + "ない");
      const kanou  = v.potential || (stem + (eRow[last] || "れ") + "る");

      return row("기본형", "(辞書形)", dict) +
             row("ます形", "(정중)", masu) +
             row("て形",   "(~해서)", te) +
             row("た形",   "(과거)", ta) +
             row("ない形", "(부정)", nai) +
             row("可能形", "(~할 수 있다)", kanou);
    }

    // ── 형용사: 현재/부정/과거/부사형 ──
    const adj = s.adjData || ADJS.find(a => a.jp === s.verbBase);
    if (!adj) return "";

    const isNa = this.adjKindOf(adj) === "naAdj";
    const dict = base.jp;

    if (isNa) {
      const stem = dict; // な형용사는 어미 변화 없음
      return row("기본형", "(辞書形)", dict) +
             row("です形", "(정중)", adj.polite || (stem + "です")) +
             row("부정",   "(~이 아니다)", adj.neg || (stem + "じゃないです")) +
             row("과거",   "(였다)", adj.past || (stem + "でした")) +
             row("명사수식", "(~한)", adj.modNoun || (stem + "な + 명사"));
    }

    // い형용사
    const st = dict.slice(0, -1); // い 제거
    return row("기본형", "(辞書形)", dict) +
           row("です形", "(정중)", adj.polite || (st + "いです")) +
           row("부정",   "(~지 않다)", adj.neg || (st + "くないです")) +
           row("과거",   "(였다)", adj.past || (st + "かったです")) +
           row("부사형", "(~게)", adj.adverb || (st + "く"));

  },


  toggleAnalysis(show) {
    const el = this.$("blockAnalysis");
    if (el) el.style.display = show ? "" : "none";
  },
  // ★ 자동 다음 타이머 — 버튼 클릭 시 설정
  setAutoTimer(sec, btn) {
    this.stopAutoTimer();
    this.autoSec = Number(sec);
    document.querySelectorAll(".at-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    try { localStorage.setItem("jp_auto_sec", this.autoSec); } catch(e){}
    if (this.autoSec > 0 && this.currentSentence()) this.startAutoTimer();
  },

  // ★ 카드 로드 시 자동 타이머 시작 (진행바 포함)
  startAutoTimer() {
    this.stopAutoTimer();
    if (this.autoSec <= 0) return;

    const ms = this.autoSec * 1000;
    const start = Date.now();

    const nextBtn = document.querySelector(".btn-next");
    if (!nextBtn) { this._autoRAF = setTimeout(() => this.next(), ms); return; }

    let bar = nextBtn.querySelector(".auto-progress");
    if (!bar) {
      bar = document.createElement("span");
      bar.className = "auto-progress";
      nextBtn.appendChild(bar);
    }

    const tick = () => {
      const remain = ms - (Date.now() - start);
      if (remain <= 0) { this.next(); return; }   // 시간 경과 → 자동 다음 (카운트도 동일)
      bar.style.width = (100 * (1 - remain / ms)) + "%";
      this._autoRAF = requestAnimationFrame(tick);
    };
    this._autoRAF = requestAnimationFrame(tick);
  },

  // ★ 타이머 정지
  stopAutoTimer() {
    if (this._autoRAF) cancelAnimationFrame(this._autoRAF);
    this._autoRAF = null;
    const bar = document.querySelector(".auto-progress");
    if (bar) bar.remove();
  },

   next() {
    // 다음 버튼으로 넘어갈 때만 학습 완료 카운팅 (뜻 보기 여부 무관)
    const cur = this.currentSentence();
    if (cur && cur.id) {
      this._store.save(cur.id);
      this.updateStats();
    }

    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      this.loadCard();
    } else {
      this.buildQueue();
      this.loadCard();
    }
  },


  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadCard();
    }
  },

   speak() {
    const s = this.currentSentence();
    if (!s || typeof Speech === "undefined") return;

    // 단어/관형 카드: 그대로 읽기
    if (s.wordMode || s.modifierMode || !s.blocks) {
      Speech.speak(s.full || "");
      return;
    }

    // 문장 카드: 큰 문장과 동일한 규칙으로 조립해서 읽기
    //  명사+술어: 주어 + 조사(は/가) + 술어 (목적어·를 제외)
    //  부사 문장: 부사 + 술어 (주어·조사 제외)
    const isAdv = this.predFilter.adv && s.hasAdverb;
    let txt = "";
    s.blocks.forEach(b => {
      if (isAdv) {
        if (b.role === "주어" || b.role === "조사") return;
      } else {
        if (b.role === "명사") return;
        if (b.role === "조사" && b.jp === "を") return;
        if (b.role === "부사") return;
      }
      txt += (txt ? " " : "") + (b.jp || "");
    });

    Speech.speak(txt.trim() || s.full || "");
  },


  speakFirst() {
    const s = this.currentSentence();
    if (!s || typeof Speech === "undefined") return;
    const blocks = s.blocks || [];
    const b = blocks[0];
    if (b) Speech.speak(b.jp || "");
  },

  speakPred() {
    const s = this.currentSentence();
    if (!s || typeof Speech === "undefined") return;
    const base = this.predBase(s);
    if (base && base.jp) Speech.speak(base.jp);
  },

  reset() {
    if (!confirm("학습 진행 상황을 모두 초기화할까요?")) return;
    this._store.clear();
    this.updateStats();
    this.buildQueue();
    this.loadCard();
  }
};

document.addEventListener("DOMContentLoaded", function () {
  App.init();
});
