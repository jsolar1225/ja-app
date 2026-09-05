// 문장 생성 엔진 — 블록 구조
// 패턴 A: [명사]は/が[명사]を[동사]
// 패턴 B: [명사]は[형용사]
// 패턴 C: [부사]+[형용사] / 확장: [주어]+は+[부사]+[형용사]
// 패턴 D: [부사]+[동사]   / 확장: [주어]+は+[부사]+[動詞]
const Generator = {

  getJong: function (word) {
    if (!word || !word.length) return -1;
    var code = word[word.length - 1].charCodeAt(0);
    return (code >= 0xAC00 && code <= 0xD7A3) ? (code - 0xAC00) % 28 : -1;
  },
  firstMeaning: function (ko) { return ko ? ko.split("/")[0].trim() : ""; },
  getParticle: function (w) { return this.getJong(w) === 0 ? "를" : "을"; },
  getTopic: function (w)    { return this.getJong(w) === 0 ? "는" : "은"; },
  composeB: function (stem) {
    if (!stem || !stem.length) return "";
    var code = stem[stem.length - 1].charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3)
      return stem.slice(0, -1) + String.fromCharCode(code + 17);
    return stem;
  },

  politeExceptions: {
    "있다": "있습니다", "없다": "없습니다", "계시다": "계십니다",
    "곱다": "고웁니다", "깁다": "기웁니다",
    "모르다": "모릅니다", "부르다": "부릅니다", "빠르다": "빠릅니다",
    "고르다": "고릅니다", "다르다": "다릅니다", "자르다": "자릅니다",
    "누르다": "누릅니다", "흐르다": "흐릅니다", "따르다": "따릅니다",
    "기르다": "기릅니다", "쓰다": "씁니다"
  },

  toPolite: function (ko) {
    var first = ko.split("/")[0].trim();
    if (!first) return "";
    if (this.politeExceptions[first]) return this.politeExceptions[first];
    if (first.endsWith("하다")) return first.slice(0, -2) + "합니다";
    if (first.endsWith("되다")) return first.slice(0, -2) + "됩니다";
    if (first.endsWith("지다")) return first.slice(0, -2) + "집니다";
    var stem = first.slice(0, -1);
    if (!stem.length) return first;
    var sj = this.getJong(stem);
    if (sj === 8) {
      var oneL = {
        "팔다":"팝니다","놀다":"놉니다","알다":"압니다","갈다":"갑니다",
        "울다":"웁니다","굴다":"굽니다","불다":"붑니다","멀다":"멉니다",
        "길다":"깁니다","달다":"답니다","살다":"삽니다","말다":"맙니다"
      };
      if (stem.length === 1 && oneL[first]) return oneL[first];
      var lStem = stem.slice(0, -1);
      if (!lStem.length) return stem + "습니다";
      return this.composeB(lStem) + "니다";
    }
    if (sj === 0) return this.composeB(stem) + "니다";
    return stem + "습니다";
  },

  particleTipJa: {
    "は": "<strong>は</strong>는 '~은/는'처럼 <strong>주제</strong>를 묶어주는 조사예요.",
    "が": "<strong>が</strong>는 '~이/가'처럼 <strong>주어</strong>를 직접 지목하는 조사예요. 강조하고 싶을 때!",
    "を": "<strong>を</strong>는 동작의 <strong>대상(목적어)</strong>을 나타내는 조사예요."
  },
  particleTipKo: {
    "は": "~은/는 (주제)",
    "が": "~이/가 (주어 강조)",
    "を": "~을/를 (대상)"
  },

  getVerbLevel: function (vi) {
    var per = Math.floor(VERBS.length / 5);
    return ["N5","N4","N3","N2","N1"][Math.min(Math.floor(vi / per), 4)];
  },
  getAdjLevel: function (ai) {
    var per = Math.floor(ADJS.length / 5);
    return ["N5","N4","N3","N2","N1"][Math.min(Math.floor(ai / per), 4)];
  },

    actors: function () {
    var people = OBJECTS.filter(function (o) { return (o.tag || o.category) === "person"; });
    var dupFree = people.filter(function (p) {
      return !SUBJECTS.some(function (s) { return s.jp === p.jp; });
    });
    return SUBJECTS.concat(dupFree);
  },

  generate: function () {
    var result = [];
    var id = 1;
    var self = this;

    // ═══ 패턴 A: [명사]+は/が+[명사]+を+[동사] ═══
    VERBS.forEach(function (verb, vi) {
      var level = self.getVerbLevel(vi);
      var fits = verb.fits || verb.tags || [];

      OBJECTS.forEach(function (obj) {
        var objTag = obj.tag || obj.category || "";
        if (!fits.length || fits.indexOf(objTag) === -1) return;

        var objKo = self.firstMeaning(obj.ko);

        self.actors().forEach(function (subj) {
          var subjKo = self.firstMeaning(subj.ko);
          var topic = self.getTopic(subjKo);
          var objP = self.getParticle(objKo);

          ["は", "が"].forEach(function (p) {

            result.push({
              id: id++,
              kind: "verb",
              level: level,
              full: subj.jp + p + obj.jp + "を" + verb.masu,
              blocks: [
                { text: subj.jp, role: "주어", jp: subj.jp,
                  reading: subj.reading || "", ko: subjKo },
                { text: p, role: "조사", jp: p, reading: "", ko: "", particle: true },
                { text: obj.jp, role: "명사", jp: obj.jp,
                  reading: obj.reading || "", ko: objKo },
                { text: "を", role: "조사", jp: "を", reading: "", ko: "", particle: true },
                { text: verb.masu, role: "술어", jp: verb.base,
                  reading: verb.reading || "", ko: verb.ko }
              ],
              subject: subj,
              object: obj,
              particle: "を",
              firstParticle: p,
              verbBase: verb.base,
              verbReading: verb.reading || "",
              verbKo: verb.ko,
              tip: self.particleTipJa[p] +
                   " 또한 <strong>を</strong>는 동작의 대상을 나타내요.",
              translation: subjKo + topic + " " + objKo + objP + " " +
                           self.toPolite(verb.ko) + "."
            });

          });
        });
      });
    });

    // ═══ 패턴 B: [명사] + は + [형용사] ═══
    ADJS.forEach(function (adj, ai) {
      var level = self.getAdjLevel(ai);
      var fits = adj.fits || [];
      var allNouns = SUBJECTS.concat(OBJECTS);

      allNouns.forEach(function (noun) {
        var nTag = noun.tag || noun.category || "";
        if (!fits.length || fits.indexOf(nTag) === -1) return;

        var nounKo = self.firstMeaning(noun.ko);
        var topic = self.getTopic(nounKo);

        result.push({
          id: id++,
          kind: adj.type,
          level: level,
          full: noun.jp + "は" + adj.polite,
          blocks: [
            { text: noun.jp, role: "주어", jp: noun.jp,
              reading: noun.reading || "", ko: nounKo },
            { text: "は", role: "조사", jp: "は", reading: "", ko: "", particle: true },
            { text: adj.polite, role: "술어", jp: adj.jp,
              reading: adj.reading, ko: adj.ko }
          ],
          subject: noun,
          object: null,
          particle: "は",
          firstParticle: "は",
          verbBase: adj.jp,
          verbReading: adj.reading,
          verbKo: adj.ko,
          adjData: adj,
          tip: self.particleTipJa["は"],
          translation: nounKo + topic + " " + self.firstMeaning(adj.ko) + "."
        });
      });
    });

    // ═══ ★ 패턴 C: [부사] + [형용사] — とても元気です ═══
    ADVERBS.filter(function(a){ return a.type === "adjMod"; }).forEach(function (adv) {
      ADJS.forEach(function (adj, ai) {
        var level = adj.level || self.getAdjLevel(ai);   // ★ 형용사 레벨 따름

        // 짧은형: 부사 + 형용사
        result.push({
          id: id++,
          kind: "adv",
          level: level,
          full: adv.jp + adj.polite,
          blocks: [
            { text: adv.jp,     role: "부사", jp: adv.jp,
              reading: adv.reading, ko: adv.ko },
            { text: adj.polite, role: "술어", jp: adj.jp,
              reading: adj.reading, ko: adj.ko }
          ],
          firstParticle: null,
          verbBase: adj.jp,
          verbReading: adj.reading,
          verbKo: adv.ko + " " + adj.ko,
          adjData: adj,
          tip: "<strong>" + adv.jp + "</strong>(" + adv.ko +
               ")는 바로 뒤의 형용사를 꾸며줘요.",
          translation: adv.ko + " " + adj.ko + ".",
          hasAdverb: true
        });

        // 긴형: 주어 + は + 부사 + 형용사 — 私はとても元気です
        SUBJECTS.slice(0, 6).forEach(function (subj) {
          var subjKo = self.firstMeaning(subj.ko);
          var topic = self.getTopic(subjKo);

          result.push({
            id: id++,
            kind: "adv",
            level: level,
            full: subj.jp + "は" + adv.jp + adj.polite,
            blocks: [
              { text: subj.jp,    role: "주어", jp: subj.jp,
                reading: subj.reading || "", ko: subjKo },
              { text: "は",       role: "조사", jp: "は", particle: true },
              { text: adv.jp,     role: "부사", jp: adv.jp,
                reading: adv.reading, ko: adv.ko },
              { text: adj.polite, role: "술어", jp: adj.jp,
                reading: adj.reading, ko: adj.ko }
            ],
            firstParticle: "は",
            verbBase: adj.jp,
            verbReading: adj.reading,
            verbKo: adv.ko + " " + adj.ko,
            adjData: adj,
            tip: "<strong>" + adv.jp + "</strong>는 형용사 바로 앞에서 꾸며줘요.",
            translation: subjKo + topic + " " + adv.ko + " " + adj.ko + ".",
            hasAdverb: true
          });
        });
      });
    });

    // ═══ ★ 패턴 D: [부사] + [동사] — ゆっくり食べます ═══
    ADVERBS.filter(function(a){ return a.type === "verbPre"; }).forEach(function (adv) {
      VERBS.forEach(function (verb, vi) {                 // ★ 인덱스 추가
        var level = self.getVerbLevel(vi);                // ★ 동사 레벨 따름

        // 짧은형: 부사 + 동사
        result.push({
          id: id++,
          kind: "adv",
          level: level,
          full: adv.jp + verb.masu,
          blocks: [
            { text: adv.jp,    role: "부사", jp: adv.jp,
              reading: adv.reading, ko: adv.ko },
            { text: verb.masu, role: "술어", jp: verb.base,
              reading: verb.reading || "", ko: verb.ko }
          ],
          firstParticle: null,
          verbBase: verb.base,
          verbReading: verb.reading || "",
          verbKo: adv.ko + " " + verb.ko,
          tip: "<strong>" + adv.jp + "</strong>(" + adv.ko +
               ")는 동사 바로 앞에서 동작을 꾸며줘요.",
          translation: adv.ko + " " + self.toPolite(verb.ko) + ".",
          hasAdverb: true
        });

        // 긴형: 주어 + は + 부사 + 동사 — 私はゆっくり食べます
        SUBJECTS.slice(0, 6).forEach(function (subj) {
          var subjKo = self.firstMeaning(subj.ko);
          var topic = self.getTopic(subjKo);

          result.push({
            id: id++,
            kind: "adv",
            level: level,
            full: subj.jp + "は" + adv.jp + verb.masu,
            blocks: [
              { text: subj.jp,   role: "주어", jp: subj.jp,
                reading: subj.reading || "", ko: subjKo },
              { text: "は",      role: "조사", jp: "は", particle: true },
              { text: adv.jp,    role: "부사", jp: adv.jp,
                reading: adv.reading, ko: adv.ko },
              { text: verb.masu, role: "술어", jp: verb.base,
                reading: verb.reading || "", ko: verb.ko }
            ],
            firstParticle: "は",
            verbBase: verb.base,
            verbReading: verb.reading || "",
            verbKo: adv.ko + " " + verb.ko,
            tip: "부사는 <strong>조사 뒤 · 동사 앞</strong>에 와요!",
            translation: subjKo + topic + " " + adv.ko + " " +
                         self.toPolite(verb.ko) + ".",
            hasAdverb: true
          });
        });
      });
    });

    console.log("✅ " + result.length.toLocaleString() + "개 문장 생성 완료");
    return result;
  }
};
