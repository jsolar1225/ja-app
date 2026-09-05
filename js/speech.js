// 일본어 TTS 발음 모듈 (모바일 대응: 일본어 음성 직접 지정 + 미설치 시 안내)
const Speech = {

  /* 일본어 음성 캐시 + 선택 */
  _jaVoice: null,
  _checked: false,          // 음성 확인 완료 플래그
  _warned: false,           // 안내문 중복 표시 방지

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
    this._checked = true;
  },

  /* 일본어 음성 사용 가능 여부 */
  _hasJaVoice() {
    if (!this._checked) this._pickVoice();
    return !!this._jaVoice;
  },

  /* 일본어 음성 미설치 안내문 */
  _showNoVoiceGuide() {
    if (this._warned) return;                 // 세션당 1번만 표시
    this._warned = true;
    const isIOS = /iPhone|iPad/i.test(navigator.userAgent);
    const guide = isIOS
      ? "🔇 일본어 음성이 설치되어 있지 않습니다.\n\n"
        + "📥 설치 방법 (iOS):\n"
        + "설정 → 손쉬운 사용 → 말하기 → 음성 → 일본어 → 음성 다운로드"
      : "🔇 일본어 음성이 설치되어 있지 않습니다.\n\n"
        + "📥 설치 방법 (안드로이드):\n"
        + "설정 검색에서 '텍스트 음성 변환 출력' → Google 음성 서비스 ⚙️ → 언어 설치 → 일본어 다운로드\n\n"
        + "(기종에 따라 메뉴 위치가 다를 수 있습니다)";
    alert(guide);
  },

  speak(text) {
    if (!window.speechSynthesis) return;

    // 일본어 음성이 없으면 발화 대신 안내문 표시
    if (!this._hasJaVoice()) {
      this._showNoVoiceGuide();
      return;
    }

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
