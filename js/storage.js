// localStorage 기반 진도 저장
const Storage = {

  PROGRESS_KEY: "jp_progress_v1",
  TODAY_KEY: "jp_today_v1",

  getDoneIds() {
    return JSON.parse(localStorage.getItem(this.PROGRESS_KEY) || "[]");
  },

 saveProgress(id) {
  // 오늘 학습 수: 매 클릭마다 +1 (반복 학습 포함)
  const today = new Date().toDateString();
  const record = JSON.parse(localStorage.getItem(this.TODAY_KEY) || "{}");

  if (record.date !== today) {
    localStorage.setItem(this.TODAY_KEY, JSON.stringify({ date: today, count: 1 }));
  } else {
    record.count++;
    localStorage.setItem(this.TODAY_KEY, JSON.stringify(record));
  }

  // 완료 목록: 중복 저장만 방지 (카운트는 위에서 항상 증가)
  const done = this.getDoneIds();
  if (!done.includes(id)) {
    done.push(id);
    localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(done));
  }
},


  getTodayCount() {
    const today = new Date().toDateString();
    const record = JSON.parse(localStorage.getItem(this.TODAY_KEY) || "{}");
    return record.date === today ? record.count : 0;
  },

  reset() {
    localStorage.removeItem(this.PROGRESS_KEY);
    localStorage.removeItem(this.TODAY_KEY);
  }
};
