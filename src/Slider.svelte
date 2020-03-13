<script>
  import { createEventDispatcher } from 'svelte';
  import Rail from './Rail.svelte';
  import Thumb from './Thumb.svelte';

  export let value = [0.4, 0.7];
  export let onChange;

  let container;
  let activeIndex;
  let offset;
  let dispatch = createEventDispatcher();

  function getStartListener(index) {
    return (event) => {
      activeIndex = index;
      const { bbox } = event.detail;
      offset = bbox.width / 2 - (event.detail.x - bbox.left);
    }
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
      value[0] = value[1];
      return;
    } else if (activeIndex === 1 && value[1] < value[0]) {
      activeIndex = 0;
      value[1] = value[0];
      return;
    }

    if (value[activeIndex] === position) return;
    value[activeIndex] = position;
    dispatch('change', value);
    if (onChange) onChange(value);
  }
</script>

<div class="slider">
  <div bind:this={container}>
    <Rail {value}>
      <Thumb
        position={value[0]}
        on:dragstart={getStartListener(0)}
        on:dragging={moveListener}
      />
      <Thumb
        position={value[1]}
        on:dragstart={getStartListener(1)}
        on:dragging={moveListener}
      />
    </Rail>
  </div>
</div>

<style>
  .slider {
    padding: 8px;
  }
</style>
