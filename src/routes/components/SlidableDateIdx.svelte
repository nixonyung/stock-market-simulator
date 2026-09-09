<script lang="ts">
  import { dateToIdx, S } from "#lib/utils.svelte.ts";
  import type { ClassValue } from "svelte/elements";

  let {
    idx = $bindable(0),
    sensitivity = 1,
    class: classValue,
    oninput,
    onchange,
  }: {
    idx?: number;
    sensitivity?: number;
    class?: ClassValue;
    oninput?: (idx: number, prevIdx: number) => void | Promise<void>;
    onchange?: (idx: number, prevIdx: number) => void | Promise<void>;
  } = $props();

  const date = $derived(S.allDates[idx]);
  const year = $derived(date.year);
  const month = $derived(date.month);
  const day = $derived(date.day);

  let prevIdx = $state(idx);
  const prevDate = $derived(S.allDates[prevIdx]);
  let segmentDragging = $state<"year" | "month" | "day">();
  let totalMovementX = $state(0);

  async function setDate(newDate: Temporal.PlainDate, forward: boolean) {
    const { result, isClamped } = dateToIdx(newDate, forward);
    idx = result;
    return isClamped;
  }
</script>

<svelte:window
  onmousemove={async ({ movementX }) => {
    if (!segmentDragging || !document.pointerLockElement) return;
    if (movementX === 0) return;

    totalMovementX += movementX;

    const d = Math.abs(Math.floor((totalMovementX * sensitivity) / 3));
    const dvalue: Temporal.DurationLike = {
      years: segmentDragging === "year" ? d : undefined,
      months: segmentDragging === "month" ? d : undefined,
      days: segmentDragging === "day" ? d : undefined,
    };
    if (
      await setDate(
        totalMovementX >= 0 ? prevDate.add(dvalue) : prevDate.subtract(dvalue),
        totalMovementX >= 0,
      )
    )
      totalMovementX -= movementX;

    await oninput?.(idx, prevIdx);
  }}
  onmouseup={async () => {
    if (!segmentDragging) return;

    document.exitPointerLock();

    segmentDragging = undefined;
    totalMovementX = 0;

    await oninput?.(idx, prevIdx);
    await onchange?.(idx, prevIdx);
  }}
/>

<span class="{classValue} inline-flex items-center-safe font-mono">
  {#snippet segment(label: NonNullable<typeof segmentDragging>)}
    {@const segmentValue = label === "year" ? year : label === "month" ? month : day}

    <span
      class="kbd cursor-ew-resize text-[length:inherit] select-none {classValue}"
      onmousedown={async ({ currentTarget }) => {
        await currentTarget.requestPointerLock();

        segmentDragging = label;
        prevIdx = idx;
      }}
      onwheel={async (event) => {
        event.preventDefault();

        const deltaY = event.deltaY;
        const dvalue: Temporal.DurationLike = {
          years: label === "year" ? 1 : undefined,
          months: label === "month" ? 1 : undefined,
          days: label === "day" ? 1 : undefined,
        };

        prevIdx = idx;
        await setDate(deltaY > 0 ? date.add(dvalue) : date.subtract(dvalue), deltaY > 0);
        await oninput?.(idx, prevIdx);
        await onchange?.(idx, prevIdx);
      }}
      role="slider"
      tabindex="-1"
      aria-valuenow={segmentValue}
    >
      {segmentValue.toString().padStart(2, "0")}
    </span>
  {/snippet}

  {@render segment("year")}
  <span>-</span>
  {@render segment("month")}
  <span>-</span>
  {@render segment("day")}
</span>
