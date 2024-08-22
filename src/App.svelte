<script>
  import { position, offset } from "caret-pos";
  import { onMount } from "svelte";

  const _KEY_TEXT = "SPEECH/TEXT";
  const _KEY_SPEED = "SPEECH/SPEED";
  const _SPEED_TARGET = 4;
  const _SPEED_DEFAULT = 2;

  let domBtn = null;
  let domText = null;
  let domSpeed = null;
  let voiceTarget = null;

  // WebView2 活性時
  window["OnActive"] = async () => {
    domText.focus();

    // // クリップボード読み込み
    // ※誤爆するので廃止
    // const text = await navigator.clipboard.readText();
    // if (text?.length > 0) {
    //   domText.value = text;
    //   await navigator.clipboard.writeText("");
    // }
  };

  onMount(async () => {
    // 前回のテキスト読込
    domText.value = localStorage.getItem(_KEY_TEXT);

    // 再生されてる可能性があるので止める
    speechSynthesis.cancel();

    domBtn.innerText = "Play";

    // ctrl + スペースで再生
    document.onkeypress = (e) => {
      if (e?.ctrlKey && e?.code == "KeyS") {
        _onPlay();
      }
    };

    requestAnimationFrame(loop);
  });

  const loop = () => {
    // 声が読み込まれるまでループ
    const voices = speechSynthesis.getVoices();
    if (voices) {
      voiceTarget = voices.filter((e) =>
        e.name.startsWith("Microsoft Haruka"),
      )[0];
      const speed = localStorage.getItem(_KEY_SPEED);
      if (isNaN(parseInt(speed)) == false) {
        domSpeed.value = speed;
      } else if (voiceTarget) {
        domSpeed.value = _SPEED_TARGET;
      } else {
        domSpeed.value = _SPEED_DEFAULT;
      }
    } else {
      requestAnimationFrame(loop);
    }
  };

  // ボタン押下
  const _onPlay = () => {
    if (speechSynthesis.speaking) {
      // 再生中

      // 止めて再生ボタン表示
      speechSynthesis.cancel();
      domBtn.innerText = "Play";
    } else {
      // 停止中

      // 再生して停止ボタン表示
      const speech = new SpeechSynthesisUtterance();
      let text = domText.value;

      // 半角記号は読み上げない。
      text = text.replace(/[ -/:-@\[-\`\{-\~]/g, " ");
      // 全角記号も一部読み上げない。
      text = text.replace(
        /(　|。|、|：|（|）|⇒|？|・|，|＃|＞|＜|＿|\”|’|｜|‘|！|…|～)/g,
        " ",
      );

      text = text.replace(/[\r|\n]/g, " ");
      // text = text.replace(/\s+/g, " ");
      speech.text = text;
      const speed = parseInt(domSpeed.value);
      speech.rate = isNaN(speed) ? 1 : speed;
      speech.lang = "ja-JP";
      // ※ マイクロソフト製の声じゃないとイベントは場所はとれない
      if (voiceTarget) {
        speech.voice = voiceTarget;
      }
      speech.onstart = () => (domBtn.innerText = "Stop");
      speech.onboundary = (e) => {
        if (e.name != "word") return;
        domText.focus();
        domText.setSelectionRange(e.charIndex, e.charIndex + e.charLength);
        domText.scrollTop = offset(domText).top - domText.offsetHeight / 2;
      };
      speech.onend = () => {
        domBtn.innerText = "Play";
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
    <button class="play" bind:this={domBtn} on:click={_onPlay}>Play</button>
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
