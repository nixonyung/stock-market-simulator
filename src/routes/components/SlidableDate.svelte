<!-- <script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Value = Temporal.PlainDate;

  let {
    value = $bindable(Temporal.Now.plainDateISO()),
    min,
    max,
    sensitivity = 1,
    class: classValue,
    oninput,
    onchange,
  }: {
    value?: Value;
    min?: Value;
    max?: Value;
    sensitivity?: number;
    class?: ClassValue;
    oninput?: (newValue: Value, prevValue: Value) => void | Promise<void>;
    onchange?: (newValue: Value, prevValue: Value) => void | Promise<void>;
  } = $props();

  const year = $derived(value.year);
  const month = $derived(value.month);
  const day = $derived(value.day);
  async function setValue(newValue: Value) {
    let isClamped = false;
    if (min && Temporal.PlainDate.compare(min, newValue) === 1) {
      newValue = min;
      isClamped = true;
    }
    if (max && Temporal.PlainDate.compare(newValue, max) === 1) {
      newValue = max;
      isClamped = true;
    }

    value = newValue;

    return isClamped;
  }

  let segmentDragging = $state<"year" | "month" | "day">();
  let prevValue = $state(value);
  let totalMovementX = $state(0);
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
    if (await setValue(totalMovementX >= 0 ? prevValue.add(dvalue) : prevValue.subtract(dvalue))) {
      totalMovementX -= movementX;
    }
    await oninput?.(value, prevValue);
  }}
  onmouseup={async () => {
    if (!segmentDragging) return;

    document.exitPointerLock();
    segmentDragging = undefined;
    totalMovementX = 0;
    await oninput?.(value, prevValue);
    await onchange?.(value, prevValue);
  }}
/>

<span class="{classValue} inline-flex items-center-safe">
  {#snippet segment(label: NonNullable<typeof segmentDragging>)}
    {@const segmentValue = label === "year" ? year : label === "month" ? month : day}

    <span
      class="kbd cursor-ew-resize text-[length:inherit] select-none {classValue}"
      onmousedown={async (e) => {
        await e.currentTarget.requestPointerLock();

        segmentDragging = label;
        prevValue = value;
      }}
      onwheel={async (e) => {
        e.preventDefault();

        const deltaY = e.deltaY;
        const dvalue: Temporal.DurationLike = {
          years: label === "year" ? 1 : undefined,
          months: label === "month" ? 1 : undefined,
          days: label === "day" ? 1 : undefined,
        };

        prevValue = value;
        await setValue(deltaY > 0 ? value.add(dvalue) : value.subtract(dvalue));
        await oninput?.(value, prevValue);
        await onchange?.(value, prevValue);
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
</span> -->
