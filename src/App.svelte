<script lang="ts">
  import { onMount } from "svelte";
  import { offset } from "caret-pos";

  const _KEY_TEXT = "SPEECH/TEXT";
  const _KEY_SPEED = "SPEECH/SPEED";
  const _SPEED_TARGET = 4;
  const _SPEED_DEFAULT = 2;

  let domBtn: HTMLButtonElement | null = null;
  let domText: HTMLTextAreaElement | null = null;
  let domSpeed: HTMLInputElement | null = null;
  let voiceTarget: SpeechSynthesisVoice | null = null;

  // WebView2 活性時（既存仕様を維持）
  (window as any).OnActive = async () => {
    domText?.focus();
  };

  onMount(() => {
    if (!domText || !domBtn || !domSpeed) return;

    // 前回のテキスト読込
    domText.value = localStorage.getItem(_KEY_TEXT) ?? "";

    // 再生されてる可能性があるので止める
    speechSynthesis.cancel();

    domBtn.innerText = "Play";

    // ctrl + S で再生
    document.onkeypress = (e: KeyboardEvent) => {
      if (e?.ctrlKey && e?.code === "KeyS") {
        _onPlay();
      }
    };

    requestAnimationFrame(loop);
  });

  const loop = () => {
    if (!domSpeed) {
      requestAnimationFrame(loop);
      return;
    }

    // 声が読み込まれるまでループ
    const voices = speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      requestAnimationFrame(loop);
      return;
    }

    voiceTarget =
      voices.find((v) => v.name.startsWith("Microsoft Haruka")) ?? null;

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

  // ボタン押下
  const _onPlay = () => {
    if (!domBtn || !domText || !domSpeed) return;

    if (speechSynthesis.speaking) {
      // 再生中 → 止めて再生ボタン表示
      speechSynthesis.cancel();
      domBtn.innerText = "Play";
      return;
    }

    // 停止中 → 再生開始
    const fullText = domText.value ?? "";
    if (fullText.length === 0) return;

    // ▼ 選択位置（またはキャレット位置）から再開
    let selStart = domText.selectionStart ?? 0;
    let selEnd = domText.selectionEnd ?? selStart;
    let baseIndex = Math.min(selStart, selEnd);
    if (baseIndex < 0) baseIndex = 0;
    if (baseIndex > fullText.length) baseIndex = fullText.length;
    // ▲

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

    // ※ マイクロソフト製の声じゃないとイベントは場所はとれない
    if (voiceTarget) {
      speech.voice = voiceTarget;
    }

    speech.onstart = () => {
      if (domBtn) domBtn.innerText = "Stop";
    };

    speech.onboundary = (ev: SpeechSynthesisEvent) => {
      if (ev.name !== "word" || !domText) return;

      // TypeScript の定義には charLength が無いので any 経由で取得
      const anyEv = ev as any;
      const charLength: number =
        typeof anyEv.charLength === "number" ? anyEv.charLength : 1;

      // ev.charIndex は「読み上げテキストの先頭」からのオフセット
      const start = baseIndex + ev.charIndex;
      const end = start + charLength;

      domText.focus();
      domText.setSelectionRange(start, end);

      const off = offset(domText);
      domText.scrollTop = off.top - domText.offsetHeight / 2;
    };

    speech.onend = () => {
      if (domBtn) domBtn.innerText = "Play";
    };

    speechSynthesis.speak(speech);
  };

  /**
   * 文章変更時
   */
  const _onInputText = () => {
    if (!domText) return;
    localStorage.setItem(_KEY_TEXT, domText.value);
  };

  /**
   * スピード変更時
   */
  const _onChangeSpeed = () => {
    if (!domSpeed) return;
    const speed = parseInt(domSpeed.value, 10);
    if (!Number.isNaN(speed)) {
      localStorage.setItem(_KEY_SPEED, domSpeed.value);
    }
  };
</script>

<main>
  <div>
    <button class="play" bind:this={domBtn} on:click={_onPlay}>Play</button>
    x
    <input
      type="text"
      style="width:32px;"
      bind:this={domSpeed}
      on:change={_onChangeSpeed}
      value={_SPEED_DEFAULT}
    />
  </div>
  <div class="container">
    <textarea
      bind:this={domText}
      on:input={_onInputText}
      placeholder="再生するテキスト"
    />
  </div>
</main>

<style>
  .container {
    height: 200px;
  }
  textarea {
    width: 100%;
    height: 100%;
  }
  textarea::selection {
    background-color: cyan;
  }
</style>
