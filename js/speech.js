// 일본어 TTS 발음 모듈 (모바일 대응: 일본어 음성 직접 지정)
const Speech = {

  /* 일본어 음성 캐시 + 선택 */
  _jaVoice: null,

  _pickVoice() {
    if (!window.speechSynthesis) return;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;               // 아직 로드 전 → onvoiceschanged에서 재시도
    // 1순위: 일본어 네이티브/Google 음성 → 2순위: ja 계열 아무거나
    this._jaVoice =
      voices.find(v => /^ja(-|_)?JP$/i.test(v.lang) && /Google|Kyoko|O-ren|Oyon|Siri/i.test(v.name))
      || voices.find(v => /^ja(-|_)?JP$/i.test(v.lang))
      || voices.find(v => (v.lang || "").toLowerCase().startsWith("ja"))
      || null;
  },

  speak(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();                 // 모바일 연속 재생 무시 방지
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    if (this._jaVoice) utter.voice = this._jaVoice;   // 일본어 음성 직접 지정 (핵심)
    utter.rate = 0.85;
    speechSynthesis.speak(utter);
  },

  speakSentence() {
    this.speak(App.currentSentence().full);
  },

  speakPart(part) {
    const s = App.currentSentence();
    if (part === "subject") this.speak(s.subject.jp);
    else if (part === "object") this.speak(s.object.jp);
    else this.speak(s.verbBase);
  }
};

/* 모바일은 음성 목록이 페이지 로드보다 늦게 도착하므로 로드 시점에 재선택 */
if (window.speechSynthesis) {
  Speech._pickVoice();
  speechSynthesis.onvoiceschanged = () => Speech._pickVoice();
}
