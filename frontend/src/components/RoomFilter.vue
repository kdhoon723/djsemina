<script setup>
const props = defineProps({
  modelValue: { type: String, default: "ALL" }, // ALL | C | S | Z
});
const emit = defineEmits(["update:modelValue"]);

const options = [
  { label: "전체", value: "ALL", icon: "mdi-view-grid-outline" },
  { label: "캐럴실", value: "C", icon: "mdi-desk" },
  { label: "세미나실", value: "S", icon: "mdi-account-group-outline" },
  { label: "소강당", value: "Z", icon: "mdi-presentation" },
];

const update = (v) => emit("update:modelValue", v);
</script>

<template>
  <div class="filter-container">
    <v-btn-toggle
      v-model="selectedFilter"
      mandatory
      density="comfortable"
      rounded="lg"
      class="filter-toggle"
    >
      <v-btn
        v-for="o in options"
        :key="o.value"
        :value="o.value"
        @click="update(o.value)"
        :prepend-icon="o.icon"
        :color="o.value === modelValue ? 'primary' : undefined"
        variant="tonal"
        class="filter-button"
      >
        {{ o.label }}
      </v-btn>
    </v-btn-toggle>
  </div>
</template>

<style scoped>
.filter-container {
  margin-bottom: 16px;
}

.filter-toggle {
  border: none;
  background-color: transparent;
}

.filter-button {
  font-weight: 500;
  transition: all 0.2s ease;
}

.filter-button:hover {
  transform: translateY(-2px);
}
</style>