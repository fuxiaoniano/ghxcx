<template>
  <div class="html-editor">
    <div class="editor-toolbar">
      <el-radio-group v-model="mode" size="small">
        <el-radio-button value="visual">可视化</el-radio-button>
        <el-radio-button value="source">HTML</el-radio-button>
      </el-radio-group>
      <template v-if="mode === 'visual'">
        <el-tooltip content="加粗"><button type="button" class="tool-button tool-bold" @click="command('bold')">B</button></el-tooltip>
        <el-tooltip content="斜体"><button type="button" class="tool-button tool-italic" @click="command('italic')">I</button></el-tooltip>
        <el-tooltip content="下划线"><button type="button" class="tool-button tool-underline" @click="command('underline')">U</button></el-tooltip>
        <el-select class="heading-select" size="small" placeholder="段落" @change="heading">
          <el-option label="正文" value="p" />
          <el-option label="标题 1" value="h1" />
          <el-option label="标题 2" value="h2" />
          <el-option label="标题 3" value="h3" />
        </el-select>
        <el-color-picker size="small" @change="color" />
      </template>
    </div>
    <div
      v-show="mode === 'visual'"
      ref="visualEditor"
      class="visual-editor"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      @input="emitVisualValue"
      @blur="emitVisualValue"
    />
    <el-input
      v-show="mode === 'source'"
      v-model="sourceValue"
      type="textarea"
      :rows="10"
      resize="vertical"
      @input="emitSourceValue"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();

const mode = ref<'visual' | 'source'>('visual');
const visualEditor = ref<HTMLElement | null>(null);
const sourceValue = ref(props.modelValue || '');

watch(
  () => props.modelValue,
  async (value) => {
    const next = value || '';
    sourceValue.value = next;
    await nextTick();
    if (visualEditor.value && visualEditor.value !== document.activeElement && visualEditor.value.innerHTML !== next) {
      visualEditor.value.innerHTML = next;
    }
  },
  { immediate: true }
);

watch(mode, async (value) => {
  await nextTick();
  if (value === 'visual' && visualEditor.value) {
    visualEditor.value.innerHTML = sourceValue.value;
  }
});

function emitVisualValue() {
  const value = visualEditor.value?.innerHTML || '';
  sourceValue.value = value;
  emit('update:modelValue', value);
}

function emitSourceValue(value: string) {
  emit('update:modelValue', value);
}

function command(name: string) {
  visualEditor.value?.focus();
  document.execCommand(name, false);
  emitVisualValue();
}

function heading(tag: string) {
  visualEditor.value?.focus();
  document.execCommand('formatBlock', false, tag);
  emitVisualValue();
}

function color(value: string | null) {
  if (!value) return;
  visualEditor.value?.focus();
  document.execCommand('styleWithCSS', false, 'true');
  document.execCommand('foreColor', false, value);
  emitVisualValue();
}
</script>

<style scoped>
.html-editor {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  background: #fff;
}

.editor-toolbar {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-bottom: 1px solid var(--admin-border);
  background: #f7f9f8;
}

.tool-button {
  width: 30px;
  height: 30px;
  border: 1px solid #d8dfdc;
  border-radius: 4px;
  background: #fff;
  color: #26332f;
  cursor: pointer;
}

.tool-button:hover,
.tool-button:focus-visible {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  outline: none;
}

.tool-bold { font-weight: 700; }
.tool-italic { font-style: italic; }
.tool-underline { text-decoration: underline; }
.heading-select { width: 104px; }

.visual-editor {
  min-height: 220px;
  padding: 16px;
  color: #20262d;
  line-height: 1.65;
  outline: none;
}

.visual-editor:focus {
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
}

.html-editor :deep(.el-textarea__inner) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
  font-family: Consolas, "Courier New", monospace;
}

.visual-editor :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
