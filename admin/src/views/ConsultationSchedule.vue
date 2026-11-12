<template>
  <div class="schedule-page">
    <div class="schedule-heading"><h1 class="page-title">网咨排班表</h1><div class="schedule-actions"><el-button @click="changeMonth(-1)">上月</el-button><el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" @change="load" /><el-button @click="changeMonth(1)">下月</el-button><el-button @click="load">刷新</el-button></div></div>
    <div class="content-panel" v-loading="loading">
      <div class="schedule-scroll"><table class="schedule-table"><thead><tr><th class="member-head">网咨</th><th v-for="day in days" :key="day" :class="{ today: dateAt(day) === today }">{{ day }}<small>{{ weekday(day) }}</small></th></tr></thead><tbody><tr v-for="member in result?.members || []" :key="member.id"><th class="member-head">{{ member.nickname || member.username }}</th><td v-for="day in days" :key="day"><button class="shift" :class="{ rest: shiftOf(member.id, day) === 'REST', editable: canEdit(member.id) }" :disabled="!canEdit(member.id) || saving === `${member.id}:${day}`" :title="canEdit(member.id) ? '点击切换早/休' : ''" @click="toggle(member.id, day)">{{ shiftOf(member.id, day) === 'REST' ? '休' : '早' }}</button></td></tr></tbody></table></div>
      <el-empty v-if="!loading && !result?.members.length" description="暂无可排班网咨成员" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getConsultationSchedule, saveConsultationSchedule, type ConsultationScheduleResult } from '../api/admin';
import { useAuthStore } from '../stores/auth';
const auth = useAuthStore();
const month = ref(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7));
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
const result = ref<ConsultationScheduleResult | null>(null);
const loading = ref(false); const saving = ref('');
const days = computed(() => Array.from({ length: result.value?.days || 0 }, (_, index) => index + 1));
const dateAt = (day: number) => `${month.value}-${String(day).padStart(2, '0')}`;
const weekday = (day: number) => '日一二三四五六'[new Date(`${dateAt(day)}T12:00:00+08:00`).getDay()];
const shiftOf = (id: string, day: number) => result.value?.entries.find((row) => row.adminUserId === id && row.date === dateAt(day))?.shift || 'MORNING';
const canEdit = (id: string) => id === auth.user?.id || auth.hasPermission('CONSULTATION_SCHEDULE_MANAGE');
async function load() { loading.value = true; try { result.value = await getConsultationSchedule(month.value); } finally { loading.value = false; } }
function changeMonth(offset: number) { const [year, current] = month.value.split('-').map(Number); const next = new Date(year, current - 1 + offset, 1); month.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`; load(); }
async function toggle(adminUserId: string, day: number) { const date = dateAt(day); const shift = shiftOf(adminUserId, day) === 'REST' ? 'MORNING' : 'REST'; saving.value = `${adminUserId}:${day}`; try { await saveConsultationSchedule({ adminUserId, date, shift }); await load(); } catch { ElMessage.error('排班保存失败'); } finally { saving.value = ''; } }
onMounted(load);
</script>
<style scoped>
.schedule-heading,.schedule-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.schedule-heading{margin-bottom:16px}.schedule-actions :deep(.el-date-editor){width:140px}.schedule-scroll{overflow:auto;max-width:100%}.schedule-table{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%;font-size:13px}.schedule-table th,.schedule-table td{border-right:1px solid #e5eaf0;border-bottom:1px solid #e5eaf0;text-align:center;min-width:40px;height:44px;padding:2px}.schedule-table thead th{background:#f3f7fb;position:sticky;top:0;z-index:1}.schedule-table th small{display:block;font-weight:400;color:#728299}.member-head{position:sticky!important;left:0;z-index:2!important;min-width:110px!important;text-align:left!important;padding-left:10px!important;background:#fff!important}.schedule-table thead .member-head{background:#f3f7fb!important;z-index:3!important}.schedule-table .today{background:#e8f3ff}.shift{border:0;border-radius:6px;background:transparent;color:#27374b;min-width:32px;min-height:32px;font:inherit}.shift.rest{background:#ffe38b;color:#5f4600;font-weight:700}.shift.editable{cursor:pointer}.shift.editable:hover{outline:1px solid #409eff}@media(max-width:760px){.schedule-heading{align-items:flex-start}.schedule-actions{width:100%}.schedule-table{font-size:12px}}
</style>
