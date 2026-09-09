<script lang="ts">
  import type { ClassValue, MouseEventHandler } from "svelte/elements";

  let {
    title,
    class: classValue,
    onclick,
  }: {
    title: string;
    class?: ClassValue;
    onclick?: MouseEventHandler<HTMLButtonElement>;
  } = $props();

  let timerId = $state<number>();
</script>

<button
  class="{classValue} flex cursor-pointer items-center rounded-full px-2 py-1 opacity-50 hover:opacity-100 {timerId !==
    undefined && 'bg-error text-error-content opacity-100 brightness-66 saturate-120'}"
  {title}
  onclick={(e) => {
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      timerId = undefined;

      onclick?.(e);
    } else {
      timerId = window.setTimeout(() => (timerId = undefined), 1000);
    }
  }}
>
  <span class="icon-[tabler--trash]"></span>
  <span class={timerId === undefined ? "invisible" : ""}>?</span>
</button>
