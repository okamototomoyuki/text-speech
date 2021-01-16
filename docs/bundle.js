
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    var attributes = ['borderBottomWidth', 'borderLeftWidth', 'borderRightWidth', 'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderTopWidth', 'boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'height', 'letterSpacing', 'lineHeight', 'marginBottom', 'marginLeft', 'marginRight', 'marginTop', 'outlineWidth', 'overflow', 'overflowX', 'overflowY', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingTop', 'textAlign', 'textOverflow', 'textTransform', 'whiteSpace', 'wordBreak', 'wordWrap'];
    /**
     * Create a mirror
     *
     * @param {Element} element The element
     * @param {string} html The html
     *
     * @return {object} The mirror object
     */

    var createMirror = function createMirror(element, html) {
      /**
       * The mirror element
       */
      var mirror = document.createElement('div');
      /**
       * Create the CSS for the mirror object
       *
       * @return {object} The style object
       */

      var mirrorCss = function mirrorCss() {
        var css = {
          position: 'absolute',
          left: -9999,
          top: 0,
          zIndex: -2000
        };

        if (element.tagName === 'TEXTAREA') {
          attributes.push('width');
        }

        attributes.forEach(function (attr) {
          css[attr] = getComputedStyle(element)[attr];
        });
        return css;
      };
      /**
       * Initialize the mirror
       *
       * @param {string} html The html
       *
       * @return {void}
       */


      var initialize = function initialize(html) {
        var styles = mirrorCss();
        Object.keys(styles).forEach(function (key) {
          mirror.style[key] = styles[key];
        });
        mirror.innerHTML = html;
        element.parentNode.insertBefore(mirror, element.nextSibling);
      };
      /**
       * Get the rect
       *
       * @return {Rect} The bounding rect
       */


      var rect = function rect() {
        var marker = mirror.ownerDocument.getElementById('caret-position-marker');
        var boundingRect = {
          left: marker.offsetLeft,
          top: marker.offsetTop,
          height: marker.offsetHeight
        };
        mirror.parentNode.removeChild(mirror);
        return boundingRect;
      };

      initialize(html);
      return {
        rect: rect
      };
    };

    function _typeof(obj) {
      "@babel/helpers - typeof";

      if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        _typeof = function (obj) {
          return typeof obj;
        };
      } else {
        _typeof = function (obj) {
          return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
        };
      }

      return _typeof(obj);
    }

    /**
     * Check if a DOM Element is content editable
     *
     * @param {Element} element  The DOM element
     *
     * @return {bool} If it is content editable
     */
    var isContentEditable = function isContentEditable(element) {
      return !!(element.contentEditable ? element.contentEditable === 'true' : element.getAttribute('contenteditable') === 'true');
    };
    /**
     * Get the context from settings passed in
     *
     * @param {object} settings The settings object
     *
     * @return {object} window and document
     */

    var getContext = function getContext() {
      var settings = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var customPos = settings.customPos,
          iframe = settings.iframe,
          noShadowCaret = settings.noShadowCaret;

      if (iframe) {
        return {
          iframe: iframe,
          window: iframe.contentWindow,
          document: iframe.contentDocument || iframe.contentWindow.document,
          noShadowCaret: noShadowCaret,
          customPos: customPos
        };
      }

      return {
        window: window,
        document: document,
        noShadowCaret: noShadowCaret,
        customPos: customPos
      };
    };
    /**
     * Get the offset of an element
     *
     * @param {Element} element The DOM element
     * @param {object} ctx The context
     *
     * @return {object} top and left
     */

    var getOffset = function getOffset(element, ctx) {
      var win = ctx && ctx.window || window;
      var doc = ctx && ctx.document || document;
      var rect = element.getBoundingClientRect();
      var docEl = doc.documentElement;
      var scrollLeft = win.pageXOffset || docEl.scrollLeft;
      var scrollTop = win.pageYOffset || docEl.scrollTop;
      return {
        top: rect.top + scrollTop,
        left: rect.left + scrollLeft
      };
    };
    /**
     * Check if a value is an object
     *
     * @param {any} value The value to check
     *
     * @return {bool} If it is an object
     */

    var isObject = function isObject(value) {
      return _typeof(value) === 'object' && value !== null;
    };

    /**
     * Create a Input caret object.
     *
     * @param {Element} element The element
     * @param {Object} ctx The context
     */

    var createInputCaret = function createInputCaret(element, ctx) {
      /**
       * Get the current position
       *
       * @returns {int} The caret position
       */
      var getPos = function getPos() {
        return element.selectionStart;
      };
      /**
       * Set the position
       *
       * @param {int} pos The position
       *
       * @return {Element} The element
       */


      var setPos = function setPos(pos) {
        element.setSelectionRange(pos, pos);
        return element;
      };
      /**
       * The offset
       *
       * @param {int} pos The position
       *
       * @return {object} The offset
       */


      var getOffset$1 = function getOffset$1(pos) {
        var rect = getOffset(element);
        var position = getPosition(pos);
        return {
          top: rect.top + position.top + ctx.document.body.scrollTop,
          left: rect.left + position.left + ctx.document.body.scrollLeft,
          height: position.height
        };
      };
      /**
       * Get the current position
       *
       * @param {int} pos The position
       *
       * @return {object} The position
       */


      var getPosition = function getPosition(pos) {
        var format = function format(val) {
          var value = val.replace(/<|>|`|"|&/g, '?').replace(/\r\n|\r|\n/g, '<br/>');
          return value;
        };

        if (ctx.customPos || ctx.customPos === 0) {
          pos = ctx.customPos;
        }

        var position = pos === undefined ? getPos() : pos;
        var startRange = element.value.slice(0, position);
        var endRange = element.value.slice(position);
        var html = "<span style=\"position: relative; display: inline;\">".concat(format(startRange), "</span>");
        html += '<span id="caret-position-marker" style="position: relative; display: inline;">|</span>';
        html += "<span style=\"position: relative; display: inline;\">".concat(format(endRange), "</span>");
        var mirror = createMirror(element, html);
        var rect = mirror.rect();
        rect.pos = getPos();
        return rect;
      };

      return {
        getPos: getPos,
        setPos: setPos,
        getOffset: getOffset$1,
        getPosition: getPosition
      };
    };

    /**
     * Create an Editable Caret
     * @param {Element} element The editable element
     * @param {object|null} ctx The context
     *
     * @return {EditableCaret}
     */
    var createEditableCaret = function createEditableCaret(element, ctx) {
      /**
       * Set the caret position
       *
       * @param {int} pos The position to se
       *
       * @return {Element} The element
       */
      var setPos = function setPos(pos) {
        var sel = ctx.window.getSelection();

        if (sel) {
          var offset = 0;
          var found = false;

          var find = function find(position, parent) {
            for (var i = 0; i < parent.childNodes.length; i++) {
              var node = parent.childNodes[i];

              if (found) {
                break;
              }

              if (node.nodeType === 3) {
                if (offset + node.length >= position) {
                  found = true;
                  var range = ctx.document.createRange();
                  range.setStart(node, position - offset);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  break;
                } else {
                  offset += node.length;
                }
              } else {
                find(pos, node);
              }
            }
          };

          find(pos, element);
        }

        return element;
      };
      /**
       * Get the offset
       *
       * @return {object} The offset
       */


      var getOffset = function getOffset() {
        var range = getRange();
        var offset = {
          height: 0,
          left: 0,
          right: 0
        };

        if (!range) {
          return offset;
        }

        var hasCustomPos = ctx.customPos || ctx.customPos === 0; // endContainer in Firefox would be the element at the start of
        // the line

        if (range.endOffset - 1 > 0 && range.endContainer !== element || hasCustomPos) {
          var clonedRange = range.cloneRange();
          var fixedPosition = hasCustomPos ? ctx.customPos : range.endOffset;
          clonedRange.setStart(range.endContainer, fixedPosition - 1 < 0 ? 0 : fixedPosition - 1);
          clonedRange.setEnd(range.endContainer, fixedPosition);
          var rect = clonedRange.getBoundingClientRect();
          offset = {
            height: rect.height,
            left: rect.left + rect.width,
            top: rect.top
          };
          clonedRange.detach();
        }

        if ((!offset || offset && offset.height === 0) && !ctx.noShadowCaret) {
          var _clonedRange = range.cloneRange();

          var shadowCaret = ctx.document.createTextNode('|');

          _clonedRange.insertNode(shadowCaret);

          _clonedRange.selectNode(shadowCaret);

          var _rect = _clonedRange.getBoundingClientRect();

          offset = {
            height: _rect.height,
            left: _rect.left,
            top: _rect.top
          };
          shadowCaret.parentNode.removeChild(shadowCaret);

          _clonedRange.detach();
        }

        if (offset) {
          var doc = ctx.document.documentElement;
          offset.top += ctx.window.pageYOffset - (doc.clientTop || 0);
          offset.left += ctx.window.pageXOffset - (doc.clientLeft || 0);
        }

        return offset;
      };
      /**
       * Get the position
       *
       * @return {object} The position
       */


      var getPosition = function getPosition() {
        var offset = getOffset();
        var pos = getPos();
        var rect = element.getBoundingClientRect();
        var inputOffset = {
          top: rect.top + ctx.document.body.scrollTop,
          left: rect.left + ctx.document.body.scrollLeft
        };
        offset.left -= inputOffset.left;
        offset.top -= inputOffset.top;
        offset.pos = pos;
        return offset;
      };
      /**
       * Get the range
       *
       * @return {Range|null}
       */


      var getRange = function getRange() {
        if (!ctx.window.getSelection) {
          return;
        }

        var sel = ctx.window.getSelection();
        return sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      };
      /**
       * Get the caret position
       *
       * @return {int} The position
       */


      var getPos = function getPos() {
        var range = getRange();
        var clonedRange = range.cloneRange();
        clonedRange.selectNodeContents(element);
        clonedRange.setEnd(range.endContainer, range.endOffset);
        var pos = clonedRange.toString().length;
        clonedRange.detach();
        return pos;
      };

      return {
        getPos: getPos,
        setPos: setPos,
        getPosition: getPosition,
        getOffset: getOffset,
        getRange: getRange
      };
    };

    var createCaret = function createCaret(element, ctx) {
      if (isContentEditable(element)) {
        return createEditableCaret(element, ctx);
      }

      return createInputCaret(element, ctx);
    };
    /**
     *
     * @param {Element} element The DOM element
     * @param {number|undefined} value The value to set
     * @param {object} settings Any settings for context
     */

    var offset = function offset(element, value) {
      var settings = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var options = settings;

      if (isObject(value)) {
        options = value;
        value = null;
      }

      var ctx = getContext(options);
      var caret = createCaret(element, ctx);
      return caret.getOffset(value);
    };

    /* src\App.svelte generated by Svelte v3.31.2 */

    function create_fragment(ctx) {
    	let main;
    	let div0;
    	let button;
    	let t1;
    	let input;
    	let t2;
    	let div1;
    	let textarea;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			main = element("main");
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "▶";
    			t1 = text("\n    x");
    			input = element("input");
    			t2 = space();
    			div1 = element("div");
    			textarea = element("textarea");
    			attr(button, "class", "play");
    			attr(input, "type", "text");
    			set_style(input, "width", "32px");
    			input.value = _SPEED_DEFAULT;
    			attr(textarea, "placeholder", "再生するテキスト");
    			attr(textarea, "class", "svelte-1hp6xvt");
    			attr(div1, "class", "container svelte-1hp6xvt");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, div0);
    			append(div0, button);
    			/*button_binding*/ ctx[6](button);
    			append(div0, t1);
    			append(div0, input);
    			/*input_binding*/ ctx[7](input);
    			append(main, t2);
    			append(main, div1);
    			append(div1, textarea);
    			/*textarea_binding*/ ctx[8](textarea);

    			if (!mounted) {
    				dispose = [
    					listen(button, "click", /*_onPlay*/ ctx[3]),
    					listen(input, "change", /*_onChangeSpeed*/ ctx[5]),
    					listen(textarea, "input", /*_onInputText*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			/*button_binding*/ ctx[6](null);
    			/*input_binding*/ ctx[7](null);
    			/*textarea_binding*/ ctx[8](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    const _KEY_TEXT = "SPEECH/TEXT";
    const _KEY_SPEED = "SPEECH/SPEED";
    const _SPEED_DEFAULT = 4;

    function instance($$self, $$props, $$invalidate) {
    	let domBtn = null;
    	let domText = null;
    	let domSpeed = null;

    	// WebView2 活性時
    	window["OnActive"] = async () => {
    		domText.focus();

    		// クリップボード読み込み
    		const text = await navigator.clipboard.readText();

    		$$invalidate(1, domText.value = text, domText);
    	};

    	onMount(async () => {
    		// 前回のテキスト読込
    		$$invalidate(1, domText.value = localStorage.getItem(_KEY_TEXT), domText);

    		const speed = localStorage.getItem(_KEY_SPEED);
    		$$invalidate(2, domSpeed.value = isNaN(parseInt(speed)) == false ? speed : _SPEED_DEFAULT, domSpeed);

    		// 再生されてる可能性があるので止める
    		speechSynthesis.cancel();

    		$$invalidate(0, domBtn.innerText = "⏵", domBtn);
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

    			$$invalidate(0, domBtn.innerText = "⏵", domBtn);
    		} else {
    			// 停止中
    			// 再生して停止ボタン表示
    			const speech = new SpeechSynthesisUtterance();

    			let text = domText.value;

    			// 半角記号は読み上げない。
    			text = text.replace(/[ -/:-@\[-\`\{-\~]/g, " ");

    			// 全角記号も一部読み上げない。
    			text = text.replace(/(　|。|、|：|（|）|⇒|？|・|，|＃|＞|＜|＿|\”|’|｜|‘)/g, " ");

    			text = text.replace(/[\r|\n]/g, " ");

    			// text = text.replace(/\s+/g, " ");
    			speech.text = text;

    			const speed = parseInt(domSpeed.value);
    			speech.rate = isNaN(speed) ? 1 : speed;
    			speech.lang = "ja-JP";
    			speech.onstart = () => $$invalidate(0, domBtn.innerText = "■", domBtn);

    			speech.onboundary = e => {
    				if (e.name != "word") return;
    				domText.focus();
    				domText.setSelectionRange(e.charIndex + e.charLength, e.charIndex + e.charLength);
    				$$invalidate(1, domText.scrollTop = offset(domText).top - domText.offsetHeight / 2, domText);
    			};

    			speech.onend = () => {
    				$$invalidate(0, domBtn.innerText = "⏵", domBtn);
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

    	function button_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			domBtn = $$value;
    			$$invalidate(0, domBtn);
    		});
    	}

    	function input_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			domSpeed = $$value;
    			$$invalidate(2, domSpeed);
    		});
    	}

    	function textarea_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			domText = $$value;
    			$$invalidate(1, domText);
    		});
    	}

    	return [
    		domBtn,
    		domText,
    		domSpeed,
    		_onPlay,
    		_onInputText,
    		_onChangeSpeed,
    		button_binding,
    		input_binding,
    		textarea_binding
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world',
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
