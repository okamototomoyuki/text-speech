<script>
  import { position, offset } from "caret-pos";
  import { onMount } from "svelte";

  const _KEY_TEXT = "SPEECH/TEXT";
  const _KEY_SPEED = "SPEECH/SPEED";
  const _SPEED_DEFAULT = 4;

  let domBtn = null;
  let domText = null;
  let domSpeed = null;

  // WebView2 活性時
  window["OnActive"] = async () => {
    domText.focus();

    // クリップボード読み込み
    const text = await navigator.clipboard.readText();
    domText.value = text;
  };

  onMount(async () => {
    // 前回のテキスト読込
    domText.value = localStorage.getItem(_KEY_TEXT);
    const speed = localStorage.getItem(_KEY_SPEED);
    domSpeed.value = isNaN(parseInt(speed)) == false ? speed : _SPEED_DEFAULT;

    // 再生されてる可能性があるので止める
    speechSynthesis.cancel();

    domBtn.innerText = "⏵";

    requestAnimationFrame(_loop);
  });

  const _loop = () => {
    requestAnimationFrame(_loop);
  };

  // ボタン押下
  const _onPlay = () => {
    if (speechSynthesis.speaking) {
      // 再生中

      // 止めて再生ボタン表示
      speechSynthesis.cancel();
      domBtn.innerText = "⏵";
    } else {
      // 停止中

      // 再生して停止ボタン表示
      const speech = new SpeechSynthesisUtterance();
      let text = domText.value;

      // 半角記号は読み上げない。
      text = text.replace(/[ -/:-@\[-\`\{-\~]/g, " ");
      // 全角記号も一部読み上げない。
      text = text.replace(
        /(　|。|、|：|（|）|⇒|？|・|，|＃|＞|＜|＿|\”|’|｜|‘)/g,
        " "
      );

      text = text.replace(/[\r|\n]/g, " ");
      // text = text.replace(/\s+/g, " ");

      speech.text = text;
      const speed = parseInt(domSpeed.value);
      speech.rate = isNaN(speed) ? 1 : speed;
      speech.lang = "ja-JP";
      speech.onstart = () => (domBtn.innerText = "■");
      speech.onboundary = (e) => {
        if (e.name != "word") return;
        domText.focus();
        domText.setSelectionRange(
          e.charIndex + e.charLength,
          e.charIndex + e.charLength
        );
        domText.scrollTop = offset(domText).top - domText.offsetHeight / 2;
      };
      speech.onend = () => {
        domBtn.innerText = "⏵";
      };

      speechSynthesis.speak(speech);
    }
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
    const speed = parseInt(domSpeed.value);
    if (isNaN(speed) == false) {
      localStorage.setItem(_KEY_SPEED, domSpeed.value);
    }
  };
</script>

<main>
  <div>
    <button class="play" bind:this={domBtn} on:click={_onPlay}> ▶ </button>
    x<input
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
