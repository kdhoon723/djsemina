<script setup>

const props = defineProps({
  modelValue: { type: String, default: "ALL" }, // ALL | C | S | Z
});
const emit = defineEmits(["update:modelValue"]);

const options = [
  { label: "전체", value: "ALL" },
  { label: "캐럴실", value: "C" },
  { label: "세미나실", value: "S" },
  { label: "소강당", value: "Z" },
];

const update = (v) => emit("update:modelValue", v);
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="o in options"
      :key="o.value"
      class="px-3 py-1 rounded border"
      :class="
        o.value === modelValue
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white hover:bg-blue-50'
      "
      @click="update(o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
