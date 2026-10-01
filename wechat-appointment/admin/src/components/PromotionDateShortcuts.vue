<template>
  <el-button-group class="period-shortcuts" aria-label="快捷日期选择">
    <el-button v-for="item in presets" :key="item.label" size="small" @click="select(item.offset)">{{ item.label }}</el-button>
    <el-button size="small" @click="selectEarlier">{{ earlierLabel }}</el-button>
  </el-button-group>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Mode = 'day' | 'week' | 'month';
const props = defineProps<{ mode: Mode; modelValue?: string[] }>();
const emit = defineEmits<{ select: [value: [string, string]] }>();

const presets = computed(() => props.mode === 'day'
  ? [{ label: '今天', offset: 0 }, { label: '昨天', offset: -1 }, { label: '前天', offset: -2 }]
  : props.mode === 'week'
    ? [{ label: '本周', offset: 0 }, { label: '上周', offset: -1 }]
    : [{ label: '本月', offset: 0 }, { label: '上月', offset: -1 }]);
const earlierLabel = computed(() => props.mode === 'day' ? '前天+' : props.mode === 'week' ? '上周+' : '上月+');

function dateText(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rangeFor(mode: Mode, offset: number, anchor = new Date()): [string, string] {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (mode === 'day') {
    start.setDate(start.getDate() + offset);
    return [dateText(start), dateText(start)];
  }
  if (mode === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return [dateText(start), dateText(end)];
  }
  start.setDate(1);
  start.setMonth(start.getMonth() + offset);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return [dateText(start), dateText(end)];
}

function localDate(value?: string) {
  const matched = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return matched ? new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])) : null;
}

function select(offset: number) {
  emit('select', rangeFor(props.mode, offset));
}

function selectEarlier() {
  const fallbackOffset = props.mode === 'day' ? -2 : -1;
  const anchor = localDate(props.modelValue?.[0]) || localDate(rangeFor(props.mode, fallbackOffset)[0]) || new Date();
  emit('select', rangeFor(props.mode, -1, anchor));
}
</script>

<style scoped>
.period-shortcuts { display:inline-flex; flex-wrap:nowrap; }
.period-shortcuts :deep(.el-button) { min-width:48px; padding:6px 10px; }
@media(max-width:760px){.period-shortcuts{display:grid;width:100%;grid-template-columns:repeat(4,minmax(0,1fr))}.period-shortcuts :deep(.el-button){width:100%;margin:0;border-radius:0}.period-shortcuts :deep(.el-button:first-child){border-radius:6px 0 0 6px}.period-shortcuts :deep(.el-button:last-child){border-radius:0 6px 6px 0}}
</style>
