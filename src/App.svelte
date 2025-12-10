<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { offset } from "caret-pos";

  const _KEY_TEXT = "SPEECH/TEXT";
  const _KEY_SPEED = "SPEECH/SPEED";
  const _SPEED_TARGET = 4;
  const _SPEED_DEFAULT = 2;

  let domText: HTMLTextAreaElement;
  let domSpeed: HTMLInputElement;
  let voiceTarget: SpeechSynthesisVoice | undefined;

  // Esc 押下中かどうか
  let escHeld = false;

  // WebView2 活性時（既存仕様を維持）
  (window as any).OnActive = async () => {
    domText.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Esc 押している間だけ再生
    if (e.key === "Escape") {
      // キーリピートで何度も走らないようにする
      if (!escHeld) {
        escHeld = true;
        e.preventDefault();
        startSpeechFromCaret();
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      escHeld = false;
      // キーを離したら停止
      if (speechSynthesis.speaking || speechSynthesis.paused) {
        speechSynthesis.cancel();
      }
    }
  };

  onMount(() => {
    // 前回のテキスト読込
    domText.value = localStorage.getItem(_KEY_TEXT) ?? "";

    // 再生されてる可能性があるので止める
    speechSynthesis.cancel();

    // キーイベント登録
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    requestAnimationFrame(loop);
  });

  onDestroy(() => {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
  });

  const loop = () => {
    // 声取得
    const voices = speechSynthesis.getVoices();
    voiceTarget = voices.find((v) => v.name.startsWith("Microsoft Haruka"));

    const speedStr = localStorage.getItem(_KEY_SPEED);
    const speed = speedStr != null ? parseInt(speedStr, 10) : NaN;

    if (!Number.isNaN(speed)) {
      domSpeed.value = String(speed);
    } else if (voiceTarget) {
      domSpeed.value = String(_SPEED_TARGET);
    } else {
      domSpeed.value = String(_SPEED_DEFAULT);
    }
  };

  // Esc 押下で呼ばれる：カーソル位置から再生開始
  const startSpeechFromCaret = () => {
    const fullText = domText.value ?? "";
    if (fullText.length === 0) return;

    // カーソル（または選択開始位置）を基準にする
    let baseIndex = 0;
    const selStart = domText.selectionStart;
    const selEnd = domText.selectionEnd;

    if (
      selStart != null &&
      selEnd != null &&
      (selStart !== 0 || selEnd !== 0)
    ) {
      baseIndex = Math.min(selStart, selEnd);
      if (baseIndex < 0) baseIndex = 0;
      if (baseIndex > fullText.length) baseIndex = fullText.length;
    }

    const speech = new SpeechSynthesisUtterance();

    // 選択位置以降のテキストだけ読み上げる
    let text = fullText.substring(baseIndex);

    // 半角記号は読み上げない。
    text = text.replace(/[ -/:-@\[-`\{-~]/g, " ");
    // 全角記号も一部読み上げない。
    text = text.replace(
      /(　|。|、|：|（|）|⇒|？|・|，|＃|＞|＜|＿|”|’|｜|‘|！|…|～)/g,
      " ",
    );

    text = text.replace(/[\r|\n]/g, " ");
    speech.text = text;

    const speedVal = parseInt(domSpeed.value, 10);
    speech.rate = Number.isNaN(speedVal) ? 1 : speedVal;
    speech.lang = "ja-JP";

    if (voiceTarget) {
      speech.voice = voiceTarget;
    }

    speech.onboundary = (ev: SpeechSynthesisEvent) => {
      if (ev.name !== "word") return;

      const anyEv = ev as any;
      const charLength: number =
        typeof anyEv.charLength === "number" ? anyEv.charLength : 1;

      const start = baseIndex + ev.charIndex;
      const end = start + charLength;

      domText.focus();
      domText.setSelectionRange(start, end);

      const off = offset(domText);
      domText.scrollTop = off.top - domText.offsetHeight / 2;
    };

    speech.onend = () => {
      // Esc を離す前に読み終わったときも、一応状態をリセットしておく
      escHeld = false;
    };

    speech.onerror = () => {
      escHeld = false;
    };

    // すでに何か読んでいた場合はキャンセルしてから開始
    if (speechSynthesis.speaking || speechSynthesis.paused) {
      speechSynthesis.cancel();
    }
    speechSynthesis.speak(speech);
  };

  /**
   * 文章変更時
   */
  const _onInputText = () => {
    localStorage.setItem(_KEY_TEXT, domText.value);
  };

  /**
   * スピード変更時
   */
  const _onChangeSpeed = () => {
    const speed = parseInt(domSpeed.value, 10);
    if (!Number.isNaN(speed)) {
      localStorage.setItem(_KEY_SPEED, domSpeed.value);
    }
  };
</script>

<main>
  <div class="top-bar">
    speed x
    <input
      type="text"
      class="speed-input"
      bind:this={domSpeed}
      on:change={_onChangeSpeed}
      value={_SPEED_DEFAULT}
    />
    <span class="hint">Esc 押しっぱなしで再生</span>
  </div>
  <div class="container">
    <textarea
      bind:this={domText}
      on:input={_onInputText}
      placeholder="再生するテキスト"
    ></textarea>
  </div>
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
  }

  :global(body) {
    box-sizing: border-box;
  }

  main {
    height: 100vh; /* ウインドウの縦いっぱい */
    display: flex;
    flex-direction: column;
  }

  .top-bar {
    padding: 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .speed-input {
    width: 32px;
  }

  .hint {
    opacity: 0.6;
  }

  .container {
    flex: 1; /* 残りを全部テキストエリアに */
  }

  textarea {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    margin: 0;
    border: 1px solid #ccc;
    resize: none; /* 右下の引き延ばしハンドルを無効化 */
  }

  textarea::selection {
    background-color: cyan;
  }
</style>
