export class TTS {
  private enabled = true;
  private queue: { text: string; onDone?: () => void }[] = [];
  private speaking = false;
  private lastSpoken: number | null = null; // 公告 id 去重
  private lastSpokenText = '';
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    if (!('speechSynthesis' in window)) return;
    this.voices = window.speechSynthesis.getVoices();
  }

  private pickChinese(): SpeechSynthesisVoice | undefined {
    const list = this.voices.length ? this.voices : 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
    const zh = list.filter((v) => /zh|cmn|chinese|普通话|中文/i.test(`${v.lang} ${v.name}`));
    const score = (v: SpeechSynthesisVoice) =>
      (/^zh-CN/i.test(v.lang) ? 3 : 0) +
      (/普通话|Xiaoxiao|Huihui|Tingting|Yunxi|Yunyang|Yunxia/i.test(v.name) ? 2 : 0) +
      (/zh/i.test(v.lang) ? 1 : 0);
    return zh.sort((a, b) => score(b) - score(a))[0];
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
  }
  isEnabled() {
    return this.enabled;
  }

  /** 播放一段文本（入队） */
  speak(text: string, onDone?: () => void) {
    if (!this.enabled || !('speechSynthesis' in window)) {
      onDone?.();
      return;
    }
    this.queue.push({ text, onDone });
    this.pump();
  }

  /** 公告专用：同一公告只播一次；返回是否真的会播 */
  announce(id: number, text: string, force = false): boolean {
    if (!force && this.lastSpoken === id) return false;
    this.lastSpoken = id;
    this.lastSpokenText = text;
    this.speak(text);
    return true;
  }

  replayLast() {
    if (this.lastSpokenText) this.speak(this.lastSpokenText);
  }

  private pump() {
    if (this.speaking || !this.queue.length) return;
    const item = this.queue.shift()!;
    this.speaking = true;
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'zh-CN';
    const voice = this.pickChinese();
    if (voice) u.voice = voice;
    u.rate = 1;
    u.onend = () => {
      this.speaking = false;
      item.onDone?.();
      this.pump();
    };
    u.onerror = () => {
      this.speaking = false;
      item.onDone?.();
      this.pump();
    };
    window.speechSynthesis.speak(u);
  }

  stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.queue = [];
    this.speaking = false;
  }
}

export const tts = new TTS();
