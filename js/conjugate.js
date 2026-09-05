// 일본어 동사 활용 엔진 (그룹 자동 판별)
const Conjugate = {

  // 2군처럼 보이지만 실제 1군인 동사들
  exceptions: ["帰る", "入る", "走る", "切る", "知る", "要る", "滑る", "減る", "練る"],

  // 그룹 판별
  getGroup: function (base) {
    if (this.exceptions.includes(base)) return 1;
    if (base === "する" || base.endsWith("する")) return 3;
    if (base === "来る" || base === "くる") return 3;
    var last = base[base.length - 1];
    if (last === "る") {
      var prev = base[base.length - 2];
      var iDan = "いきしちにひみりぎじびぴ";
      var eDan = "えけせてねへめれげぜべぺ";
      if (iDan.includes(prev) || eDan.includes(prev)) return 2;
      return 1;
    }
    return 1;
  },

  realGroup: function (verb) { return this.getGroup(verb.base); },

  // ===== 활용형 생성 =====
  masuForm: function (v) {
    if (v.masu) return v.masu;   // 데이터에 있으면 우선 사용
    var g = this.realGroup(v);
    var b = v.base;
    if (g === 3) {
      if (b === "する") return "します";
      if (b.endsWith("する")) return b.slice(0, -2) + "します";
      return b.replace(/来る/, "来ます").replace(/くる/, "きます");
    }
    if (g === 2) return b.slice(0, -1) + "ます";
    var u = "うくぐすつぬぶむる";
    var i = "いますちにびみり";
    return b.slice(0, -1) + i[u.indexOf(b[b.length - 1])] + "ます";
  },

  teForm: function (v) {
    var g = this.realGroup(v);
    var b = v.base;

    // ★ 行く 특례: 일반 규칙으로는 行いて(틀림) → 정답은 行って
    if (b === "行く") return "行って";

    if (g === 3) {
      if (b === "する") return "して";
      if (b.endsWith("する")) return b.slice(0, -2) + "して";
      return b.replace(/来る/, "来て").replace(/くる/, "きて");
    }
    if (g === 2) return b.slice(0, -1) + "て";
    var last = b[b.length - 1];
    var map = {
      "う": "って", "つ": "って", "る": "って",
      "む": "んで", "ぶ": "んで", "ぬ": "んで",
      "く": "いて", "ぐ": "いで",
      "す": "して"
    };
    return b.slice(0, -1) + map[last];
  },

  taForm: function (v) {
    var te = this.teForm(v);   // teForm에서 行って 처리되므로 자동으로 行った 됨 ✅
    return te.slice(0, -1) + "た";
  },

  naiForm: function (v) {
    var g = this.realGroup(v);
    var b = v.base;
    if (g === 3) {
      if (b === "する") return "しない";
      if (b.endsWith("する")) return b.slice(0, -2) + "しない";
      return b.replace(/来る/, "来ない").replace(/くる/, "こない");
    }
    if (g === 2) return b.slice(0, -1) + "ない";
    var u = "うくぐすつぬぶむる";
    var a = "わかがさたなばまら";   // 주의: う → わ
    return b.slice(0, -1) + a[u.indexOf(b[b.length - 1])] + "ない";
  },

  kanouForm: function (v) {
    var g = this.realGroup(v);
    var b = v.base;
    if (g === 3) {
      if (b === "する") return "できる";
      if (b.endsWith("する")) return b.slice(0, -2) + "できる";
      return b.replace(/来る/, "来られる").replace(/くる/, "こられる");
    }
    if (g === 2) return b.slice(0, -1) + "られる";
    var u = "うくぐすつぬぶむる";
    var e = "えけげせてねべめれ";
    return b.slice(0, -1) + e[u.indexOf(b[b.length - 1])] + "る";
  }
};
