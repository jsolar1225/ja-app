// ============================================================
// data-words.js — JLPT N5~N1 단어를 기존 배열 형식으로 변환 & 병합
// ※ 이 파일에는 단어 데이터가 없습니다 (단어는 data-n5.js ~ data-n1.js)
// ============================================================
(function () {

  var SRC = [
    ["N5", typeof N5_WORDS !== "undefined" ? N5_WORDS : []],
    ["N4", typeof N4_WORDS !== "undefined" ? N4_WORDS : []],
    ["N3", typeof N3_WORDS !== "undefined" ? N3_WORDS : []],
    ["N2", typeof N2_WORDS !== "undefined" ? N2_WORDS : []],
    ["N1", typeof N1_WORDS !== "undefined" ? N1_WORDS : []]
  ];

  var KIND_OVERRIDES = {
    "俄に": "adv", "一朝一夕": "adv", "咄嗟に": "adv", "断固": "adv",
    "華やか": "naAdj", "鮮やか": "naAdj", "賑やか": "naAdj",
    "半端": "naAdj", "贅沢": "naAdj"
  };

  function isKana(s) {
    return /^[\u3040-\u30ff]+$/.test(s || "");
  }

  function inferKind(w) {
    if (KIND_OVERRIDES[w.jp]) {
      return KIND_OVERRIDES[w.jp];
    }
    if (w.type === "skip") {
      return "skip";
    }
    if (w.type === "i") {
      return "iAdj";
    }
    if (w.type === "na") {
      return "naAdj";
    }
    if (w.jp.slice(-2) === "する") {
      return "verb";
    }
    if (isKana(w.jp) && !w.reading) {
      return "adv";
    }
    return "noun";
  }

  var U2I = {
    "う": "い", "く": "き", "ぐ": "ぎ", "す": "し", "つ": "ち",
    "ぬ": "に", "ぶ": "び", "む": "み", "る": "り"
  };

  function masuOf(base, reading) {
    if (base.slice(-2) === "する") {
      return base.slice(0, -2) + "します";
    }
    var r = reading || "";
    if (r.length < 2 || r.slice(-1) !== "る") {
      return base + "ます";
    }
    var secondLast = r.slice(-2, -1);
    if ("いえきげせぜてでねべめれ".indexOf(secondLast) !== -1) {
      return base.slice(0, -1) + "ます";
    }
    var last = base.slice(-1);
    return base.slice(0, -1) + (U2I[last] || last) + "ます";
  }

  function adjForms(jp, kind) {
    if (kind === "naAdj") {
      return {
        polite: jp + "です",
        neg: jp + "じゃないです",
        past: jp + "でした"
      };
    }
    if (jp.slice(-2) === "いい") {
      var s2 = jp.slice(0, -2);
      return {
        polite: jp + "です",
        neg: s2 + "よくないです",
        past: s2 + "よかったです"
      };
    }
    var s = jp.slice(0, -1);
    return {
      polite: jp + "です",
      neg: s + "くないです",
      past: s + "かったです"
    };
  }

  var seenAdj = {}, seenVerb = {}, seenAdv = {}, seenNoun = {};

  ADJS.forEach(function (a) { seenAdj[a.jp] = 1; });
  VERBS.forEach(function (v) { seenVerb[v.base] = 1; });
  if (typeof ADVERBS !== "undefined") {
    ADVERBS.forEach(function (a) { seenAdv[a.jp] = 1; });
  }
  OBJECTS.forEach(function (o) { seenNoun[o.jp] = 1; });
  if (typeof SUBJECTS !== "undefined") {
    SUBJECTS.forEach(function (s) { seenNoun[s.jp] = 1; });
  }

  var count = { iAdj: 0, naAdj: 0, verb: 0, adv: 0, noun: 0 };

  function mergeWord(w, level) {
    if (!w || !w.jp || !w.ko) {
      return;
    }
    var kind = inferKind(w);
    if (kind === "skip") {
      return;
    }

    if (kind === "iAdj" || kind === "naAdj") {
      if (seenAdj[w.jp]) {
        return;
      }
      seenAdj[w.jp] = 1;
      var f = adjForms(w.jp, kind);
      ADJS.push({
        type: kind, jp: w.jp, reading: w.reading || "", ko: w.ko,
        polite: f.polite, neg: f.neg, past: f.past,
        level: level, fits: []
      });
      count[kind]++;
      return;
    }

    if (kind === "verb") {
      if (seenVerb[w.jp]) {
        return;
      }
      seenVerb[w.jp] = 1;
      VERBS.push({
        base: w.jp, masu: masuOf(w.jp, w.reading),
        ko: (w.ko || "").split("/")[0], reading: w.reading || "",
        level: level, fits: []
      });
      count.verb++;
      return;
    }

    if (kind === "adv") {
      if (typeof ADVERBS === "undefined") {
        return;
      }
      if (seenAdv[w.jp]) {
        return;
      }
      seenAdv[w.jp] = 1;
      ADVERBS.push({
        jp: w.jp, reading: w.reading || w.jp,
        ko: w.ko, type: "verbPre", level: level
      });
      count.adv++;
      return;
    }

    if (seenNoun[w.jp]) {
      return;
    }
    seenNoun[w.jp] = 1;
    OBJECTS.push({
      jp: w.jp, reading: w.reading || "", ko: w.ko, level: level
    });
    count.noun++;
  }

  SRC.forEach(function (pair) {
    var level = pair[0];
    var list = pair[1];
    list.forEach(function (w) {
      mergeWord(w, level);
    });
  });

  console.log("✅ N5~N1 병합 완료 — い形:" + count.iAdj + " な形:" + count.naAdj +
    " 동사:" + count.verb + " 부사:" + count.adv + " 명사:" + count.noun +
    " | 합계 ADJS:" + ADJS.length + " VERBS:" + VERBS.length +
    (typeof ADVERBS !== "undefined" ? " ADVERBS:" + ADVERBS.length : "") +
    " OBJECTS:" + OBJECTS.length);

})();
