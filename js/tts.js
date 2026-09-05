// ─────────────────────────────────────────────
// TTS 모듈 (일본어 음성)
// ─────────────────────────────────────────────
const TTS = {
  voice: null,

  init() {
    var self = this;
    function pickVoice() {
      var voices = speechSynthesis.getVoices();
      if (!voices.length) return; // 아직 준비 안 됨 → 다음 이벤트 대기
      // 일본어 보이스 우선 검색
      self.voice =
        voices.find(function (v) { return v.lang === "ja-JP"; }) ||
        voices.find(function (v) { return v.lang.indexOf("ja") === 0; }) ||
        null;
      console.log(self.voice
        ? "🔊 TTS 준비 완료: " + self.voice.name
        : "⚠️ 일본어 보이스 없음 — 기본 보이스 사용");
    }
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
    // 일부 브라우저는 이벤트가 안 오므로 재시도
    setTimeout(pickVoice, 500);
    setTimeout(pickVoice, 1500);
  },

  speak(text, rate) {
    if (!("speechSynthesis" in window)) {
      alert("이 브라우저는 음성 합성을 지원하지 않습니다.");
      return;
    }
    speechSynthesis.cancel(); // 이전 발화 중단 (안 눌리는 문제 방지)
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    if (this.voice) u.voice = this.voice;
    u.rate = rate || 1.0;
    speechSynthesis.speak(u);
  },

  speakSlow(text) { this.speak(text, 0.6); }
};

document.addEventListener("DOMContentLoaded", function () { TTS.init(); });
