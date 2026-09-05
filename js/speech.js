// 일본어 TTS 발음 모듈
const Speech = {

  speak(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
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
