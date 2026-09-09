<!-- <script lang="ts">
  import { clamp } from "es-toolkit";
  import type { ClassValue } from "svelte/elements";

  let {
    value = $bindable(),
    min = -Infinity,
    max = Infinity,
    step = 1,
    pixelDivider = 16,
    class: classValue,
  }: {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    pixelDivider?: number;
    class?: ClassValue;
  } = $props();

  $effect(() => {
    if (value < min) value = min;
    if (value > max) value = max;
  });

  let isPointerdown = $state(false);
  let startValue = $state(value);
  let startScreenX = $state(0);
</script>

<svelte:window
  onpointermove={({ screenX }) => {
    if (!isPointerdown) return;

    value = clamp(
      startValue + Math.floor((screenX - startScreenX) / pixelDivider) * step,
      min,
      max,
    );
  }}
  onpointerup={() => (isPointerdown = false)}
/>

<span
  class="{classValue} kbd cursor-ew-resize select-none"
  onpointerdown={({ screenX }) => {
    isPointerdown = true;
    startValue = value;
    startScreenX = screenX;
  }}
  role="slider"
  tabindex="-1"
  aria-valuenow={value}
  aria-valuemax={max}
  aria-valuemin={min}
>
  {value}
</span> -->
