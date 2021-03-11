(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Slider = factory());
}(this, (function () { 'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
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
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
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
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
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
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
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
        }
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
            on_disconnect: [],
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
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
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
            mount_component(component, options.target, options.anchor, options.customElement);
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

    /* src/Rail.svelte generated by Svelte v3.35.0 */

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let t;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			t = space();
    			if (default_slot) default_slot.c();
    			attr(div0, "class", "selected svelte-1u5xdj2");
    			set_style(div0, "left", /*value*/ ctx[0][0] * 100 + "%");
    			set_style(div0, "right", (1 - /*value*/ ctx[0][1]) * 100 + "%");
    			attr(div1, "class", "rail svelte-1u5xdj2");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div1, t);

    			if (default_slot) {
    				default_slot.m(div1, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*value*/ 1) {
    				set_style(div0, "left", /*value*/ ctx[0][0] * 100 + "%");
    			}

    			if (!current || dirty & /*value*/ 1) {
    				set_style(div0, "right", (1 - /*value*/ ctx[0][1]) * 100 + "%");
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 2) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { value } = $$props;

    	$$self.$$set = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	return [value, $$scope, slots];
    }

    class Rail extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { value: 0 });
    	}
    }

    /* src/Thumb.svelte generated by Svelte v3.35.0 */

    function create_fragment$1(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "thumb svelte-1p2qw86");
    			set_style(div, "left", /*position*/ ctx[0] * 100 + "%");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			/*div_binding*/ ctx[5](div);

    			if (!mounted) {
    				dispose = [
    					listen(div, "start", /*handleStart*/ ctx[2]),
    					listen(div, "move", /*handleMove*/ ctx[3]),
    					listen(div, "end", /*handleEnd*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*position*/ 1) {
    				set_style(div, "left", /*position*/ ctx[0] * 100 + "%");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			/*div_binding*/ ctx[5](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { position } = $$props;
    	let thumb;
    	const dispatch = createEventDispatcher();

    	function handleStart(event) {
    		event.preventDefault();
    		const x = event.clientX;
    		const bbox = event.target.getBoundingClientRect();
    		thumb.setPointerCapture(event.pointerId);
    		thumb.addEventListener("pointermove", handleMove);
    		thumb.addEventListener("pointerup", handleEnd);
    		dispatch("dragstart", { x, bbox });
    	}

    	function handleMove(event) {
    		event.preventDefault();
    		const x = event.clientX;
    		const bbox = event.target.getBoundingClientRect();
    		dispatch("dragging", { x, bbox });
    	}

    	function handleEnd(event) {
    		event.preventDefault();
    		thumb.removeEventListener("pointermove", handleMove);
    		thumb.removeEventListener("pointerup", handleEnd);
    		dispatch("dragend");
    	}

    	onMount(() => {
    		thumb.addEventListener("pointerdown", handleStart);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			thumb = $$value;
    			$$invalidate(1, thumb);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("position" in $$props) $$invalidate(0, position = $$props.position);
    	};

    	return [position, thumb, handleStart, handleMove, handleEnd, div_binding];
    }

    class Thumb extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { position: 0 });
    	}
    }

    /* src/Slider.svelte generated by Svelte v3.35.0 */

    function create_if_block(ctx) {
    	let thumb;
    	let current;
    	thumb = new Thumb({ props: { position: /*value*/ ctx[0][0] } });
    	thumb.$on("dragstart", /*getStartListener*/ ctx[3](0));
    	thumb.$on("dragging", /*moveListener*/ ctx[4]);
    	thumb.$on("dragend", endListener);

    	return {
    		c() {
    			create_component(thumb.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(thumb, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const thumb_changes = {};
    			if (dirty & /*value*/ 1) thumb_changes.position = /*value*/ ctx[0][0];
    			thumb.$set(thumb_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(thumb.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(thumb.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(thumb, detaching);
    		}
    	};
    }

    // (60:4) <Rail {value} on:set={onSet}>
    function create_default_slot(ctx) {
    	let t;
    	let thumb;
    	let current;
    	let if_block = !/*single*/ ctx[1] && create_if_block(ctx);
    	thumb = new Thumb({ props: { position: /*value*/ ctx[0][1] } });
    	thumb.$on("dragstart", /*getStartListener*/ ctx[3](1));
    	thumb.$on("dragging", /*moveListener*/ ctx[4]);
    	thumb.$on("dragend", endListener);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			t = space();
    			create_component(thumb.$$.fragment);
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t, anchor);
    			mount_component(thumb, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (!/*single*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*single*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			const thumb_changes = {};
    			if (dirty & /*value*/ 1) thumb_changes.position = /*value*/ ctx[0][1];
    			thumb.$set(thumb_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(thumb.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			transition_out(thumb.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(t);
    			destroy_component(thumb, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div1;
    	let div0;
    	let rail;
    	let current;

    	rail = new Rail({
    			props: {
    				value: /*value*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	rail.$on("set", onSet);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(rail.$$.fragment);
    			attr(div1, "class", "slider svelte-1cw3o64");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			mount_component(rail, div0, null);
    			/*div0_binding*/ ctx[5](div0);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const rail_changes = {};
    			if (dirty & /*value*/ 1) rail_changes.value = /*value*/ ctx[0];

    			if (dirty & /*$$scope, value, single*/ 515) {
    				rail_changes.$$scope = { dirty, ctx };
    			}

    			rail.$set(rail_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(rail.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(rail.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			destroy_component(rail);
    			/*div0_binding*/ ctx[5](null);
    		}
    	};
    }

    function endListener() {
    	document.body.style.cursor = "";
    }

    function onSet(event) {
    	console.log(event.detail);
    }

    function instance($$self, $$props, $$invalidate) {
    	let { value = [0, 1] } = $$props;
    	let { single = false } = $$props;
    	let container;
    	let activeIndex;
    	let offset;
    	let dispatch = createEventDispatcher();

    	function getStartListener(index) {
    		return event => {
    			activeIndex = index;
    			const { bbox } = event.detail;
    			offset = bbox.width / 2 - (event.detail.x - bbox.left);
    			document.body.style.cursor = "pointer";
    		};
    	}

    	function moveListener(event) {
    		const bbox = container.getBoundingClientRect();
    		const { x } = event.detail;
    		let position = (x - bbox.left + offset) / bbox.width;

    		if (position < 0) {
    			position = 0;
    		} else if (position > 1) {
    			position = 1;
    		}

    		if (activeIndex === 0 && value[0] > value[1]) {
    			activeIndex = 1;
    			$$invalidate(0, value[0] = value[1], value);
    			return;
    		} else if (activeIndex === 1 && value[1] < value[0]) {
    			activeIndex = 0;
    			$$invalidate(0, value[1] = value[0], value);
    			return;
    		}

    		if (value[activeIndex] === position) return;
    		$$invalidate(0, value[activeIndex] = position, value);
    		dispatch("change", value);
    	}

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			container = $$value;
    			$$invalidate(2, container);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("single" in $$props) $$invalidate(1, single = $$props.single);
    	};

    	return [value, single, container, getStartListener, moveListener, div0_binding];
    }

    class Slider extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { value: 0, single: 1 });
    	}
    }

    return Slider;

})));
//# sourceMappingURL=index.js.map
