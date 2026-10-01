<template>
  <div class="page-heading">
    <div><h1 class="page-title">工资测算</h1><p>按日统计自动汇总月度表现，并根据最近数据测算工资档位与下一档调整方向。</p></div>
    <div class="actions">
      <el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" @change="load" />
      <el-button @click="openSettings">工资规则设置</el-button>
      <el-button type="primary" :loading="loading" @click="load">重新测算</el-button>
    </div>
  </div>

  <div v-loading="loading" class="salary-page">
    <section class="salary-overview">
      <article class="salary-card primary"><span>本月当前档位</span><strong>{{ yuan(report?.currentSalary) }}</strong><small>按所选月份截至当前的数据计算</small></article>
      <article class="salary-card"><span>最近数据测算</span><strong>{{ yuan(report?.forecastSalary) }}</strong><small>{{ recentRangeText }}</small></article>
      <article class="salary-card"><span>下一档工资</span><strong>{{ report?.nextTier ? yuan(report.nextTier.salary) : '已达最高档' }}</strong><small>{{ report?.nextTier ? `还需满足 ${pendingCriteriaCount} 项指标` : '继续保持当前数据表现' }}</small></article>
      <article class="salary-card"><span>统计进度</span><strong>{{ report?.elapsedDays || 0 }} / {{ report?.totalDays || 0 }} 天</strong><small>数据截至 {{ report?.dataThrough || '暂无录入' }}</small></article>
    </section>

    <section class="content-panel metrics-panel">
      <div class="section-heading"><div><h2>地区数据表现</h2><p>本月数据用于当前工资，最近 {{ report?.config.recentDays || 7 }} 天数据用于趋势测算。</p></div></div>
      <div class="region-grid">
        <article v-for="project in projects" :key="project" class="region-card">
          <div class="region-title"><strong>{{ project }}</strong><el-tag size="small" effect="plain">{{ region(project)?.recordedDays || 0 }} 个录入日</el-tag></div>
          <div class="metric-grid">
            <div><span>本月总表单</span><b>{{ region(project)?.leads || 0 }}</b></div>
            <div><span>本月日均表单</span><b>{{ decimal(region(project)?.averageDailyLeads) }}</b></div>
            <div><span>本月有效率</span><b>{{ percent(region(project)?.validRate) }}</b></div>
            <div><span>本月表单成本</span><b>{{ money(region(project)?.averageCost) }}</b></div>
          </div>
          <div class="recent-strip">
            <span>最近数据</span><b>日均 {{ decimal(recentRegion(project)?.averageDailyLeads) }}</b><b>有效率 {{ percent(recentRegion(project)?.validRate) }}</b><b>成本 {{ money(recentRegion(project)?.averageCost) }}</b>
          </div>
        </article>
      </div>
    </section>

    <section class="content-panel next-panel">
      <div class="section-heading"><div><h2>下一档调整建议</h2><p v-if="report?.nextTier">目标工资 {{ yuan(report.nextTier.salary) }}，按最近 {{ report.recent.days }} 天数据逐项对比。</p><p v-else>当前最近数据已达到最高工资档位。</p></div></div>
      <div v-if="report?.nextTier" class="criteria-grid">
        <article v-for="item in report.nextTier.criteria" :key="item.key" :class="['criterion-card', { achieved: item.achieved }]">
          <div class="criterion-title"><span>{{ item.project }} · {{ item.label }}</span><el-tag :type="item.achieved ? 'success' : 'warning'" size="small">{{ item.achieved ? '已达标' : '需调整' }}</el-tag></div>
          <div class="criterion-values"><strong>{{ criterionValue(item.current, item.unit) }}</strong><span>目标 {{ criterionTarget(item.target, item.unit) }}</span></div>
          <el-progress :percentage="criterionProgress(item)" :status="item.achieved ? 'success' : undefined" :stroke-width="8" :show-text="false" />
          <p>{{ item.recommendation }}</p>
        </article>
      </div>
      <div class="recommendations">
        <div v-for="(item, index) in report?.recommendations || []" :key="item"><i>{{ index + 1 }}</i><span>{{ item }}</span></div>
      </div>
    </section>

    <section class="content-panel rules-panel">
      <div class="section-heading"><div><h2>当前工资规则</h2><p>两个地区的三项指标必须同时达标；表单成本按“低于目标值”判断。</p></div><el-button size="small" @click="openSettings">修改规则</el-button></div>
      <div class="rules-table-wrap"><table class="rules-table"><thead><tr><th>工资档位</th><th>地区</th><th>日均表单量</th><th>有效率</th><th>表单成本</th><th>本月</th><th>最近数据</th></tr></thead><tbody><template v-for="tier in report?.tiers || []" :key="tier.salary"><tr><td rowspan="2" class="salary-cell">{{ yuan(tier.salary) }}</td><td>重庆</td><td>≥ {{ decimal(tier.chongqing.minDailyLeads) }}</td><td>≥ {{ percent(tier.chongqing.minValidRate) }}</td><td>&lt; {{ money(tier.chongqing.maxAverageCost) }}</td><td rowspan="2"><el-tag :type="tier.achieved ? 'success' : 'info'">{{ tier.achieved ? '已达到' : '未达到' }}</el-tag></td><td rowspan="2"><el-tag :type="tier.recentAchieved ? 'success' : 'info'">{{ tier.recentAchieved ? '可达到' : '未达到' }}</el-tag></td></tr><tr><td>绵阳</td><td>≥ {{ decimal(tier.mianyang.minDailyLeads) }}</td><td>≥ {{ percent(tier.mianyang.minValidRate) }}</td><td>&lt; {{ money(tier.mianyang.maxAverageCost) }}</td></tr></template></tbody></table></div>
      <p class="base-salary">未达到第一档时，基础工资为 <strong>{{ yuan(report?.config.baseSalary) }}</strong>。</p>
    </section>
  </div>

  <el-dialog v-model="settingsVisible" title="工资测算规则设置" width="920px" class="salary-settings-dialog" destroy-on-close>
    <div class="base-settings"><el-form-item label="基础工资"><el-input-number v-model="settingsForm.baseSalary" :min="0" :step="500" /></el-form-item><el-form-item label="最近测算天数"><el-input-number v-model="settingsForm.recentDays" :min="1" :max="31" /></el-form-item></div>
    <div class="tier-settings">
      <section v-for="(tier, index) in settingsForm.tiers" :key="index" class="tier-setting-card">
        <div class="tier-setting-heading"><strong>第 {{ index + 1 }} 档</strong><el-form-item label="工资"><el-input-number v-model="tier.salary" :min="0" :step="500" /></el-form-item></div>
        <div class="region-settings">
          <div v-for="item in settingProjects" :key="item.key" class="region-setting">
            <h3>{{ item.label }}</h3>
            <el-form-item label="日均表单量"><el-input-number v-model="tier[item.key].minDailyLeads" :min="0" :precision="2" :step="0.1" /></el-form-item>
            <el-form-item label="有效率"><el-input-number v-model="tier[item.key].minValidRatePercent" :min="0" :max="100" :precision="2" /><span class="suffix">%</span></el-form-item>
            <el-form-item label="表单成本"><el-input-number v-model="tier[item.key].maxAverageCost" :min="0" :precision="2" /><span class="suffix">元以下</span></el-form-item>
          </div>
        </div>
      </section>
    </div>
    <template #footer><el-button @click="settingsVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveSettings">保存并重新测算</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getPromotionSalary, updatePromotionSalaryConfig, type PromotionSalaryCriterion, type PromotionSalaryMetrics, type PromotionSalaryReport } from '../api/admin';

type SettingRegion = { minDailyLeads: number; minValidRatePercent: number; maxAverageCost: number };
type SettingTier = { salary: number; chongqing: SettingRegion; mianyang: SettingRegion };
const projects = ['重庆', '绵阳'] as const;
const settingProjects = [{ key: 'chongqing' as const, label: '重庆' }, { key: 'mianyang' as const, label: '绵阳' }];
const now = new Date();
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
const report = ref<PromotionSalaryReport | null>(null);
const loading = ref(false); const saving = ref(false); const settingsVisible = ref(false);
const settingsForm = reactive<{ baseSalary: number; recentDays: number; tiers: SettingTier[] }>({ baseSalary: 6000, recentDays: 7, tiers: [] });
const yuan = (value?: number | null) => value === null || value === undefined ? '—' : `¥${value.toLocaleString('zh-CN')}`;
const decimal = (value?: number | null) => value === null || value === undefined || !Number.isFinite(value) ? '—' : Number(value.toFixed(2)).toString();
const money = (value?: number | null) => value === null || value === undefined || !Number.isFinite(value) ? '—' : `¥${value.toFixed(2)}`;
const percent = (value?: number | null) => value === null || value === undefined || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(2)}%`;
const region = (project: typeof projects[number]) => report.value?.regions.find((item) => item.project === project);
const recentRegion = (project: typeof projects[number]) => report.value?.recent.regions.find((item) => item.project === project);
const recentRangeText = computed(() => report.value?.recent.dateFrom ? `${report.value.recent.dateFrom} 至 ${report.value.recent.dateTo}` : '暂无最近数据');
const pendingCriteriaCount = computed(() => report.value?.nextTier?.criteria.filter((item) => !item.achieved).length || 0);
function criterionValue(value: number | null, unit: PromotionSalaryCriterion['unit']) { return unit === 'rate' ? percent(value) : unit === 'money' ? money(value) : decimal(value); }
function criterionTarget(value: number, unit: PromotionSalaryCriterion['unit']) { return unit === 'rate' ? `≥ ${percent(value)}` : unit === 'money' ? `< ${money(value)}` : `≥ ${decimal(value)}`; }
function criterionProgress(item: PromotionSalaryCriterion) { if (item.achieved) return 100; if (item.current === null || item.target <= 0) return 0; return Math.max(0, Math.min(99, Math.round(item.unit === 'money' ? item.target / item.current * 100 : item.current / item.target * 100))); }
async function load() { if (!month.value) return; loading.value = true; try { report.value = await getPromotionSalary(month.value); } finally { loading.value = false; } }
function openSettings() {
  if (!report.value) return;
  settingsForm.baseSalary = report.value.config.baseSalary; settingsForm.recentDays = report.value.config.recentDays;
  settingsForm.tiers = report.value.config.tiers.map((tier) => ({ salary: tier.salary, chongqing: { minDailyLeads: tier.chongqing.minDailyLeads, minValidRatePercent: tier.chongqing.minValidRate * 100, maxAverageCost: tier.chongqing.maxAverageCost }, mianyang: { minDailyLeads: tier.mianyang.minDailyLeads, minValidRatePercent: tier.mianyang.minValidRate * 100, maxAverageCost: tier.mianyang.maxAverageCost } }));
  settingsVisible.value = true;
}
async function saveSettings() {
  if (!settingsForm.tiers.length) return ElMessage.warning('至少保留一个工资档位');
  saving.value = true;
  try {
    await updatePromotionSalaryConfig({ baseSalary: settingsForm.baseSalary, recentDays: settingsForm.recentDays, tiers: settingsForm.tiers.map((tier) => ({ salary: tier.salary, chongqing: { minDailyLeads: tier.chongqing.minDailyLeads, minValidRate: tier.chongqing.minValidRatePercent / 100, maxAverageCost: tier.chongqing.maxAverageCost }, mianyang: { minDailyLeads: tier.mianyang.minDailyLeads, minValidRate: tier.mianyang.minValidRatePercent / 100, maxAverageCost: tier.mianyang.maxAverageCost } })) });
    ElMessage.success('工资规则已保存，并已按最近数据重新测算'); settingsVisible.value = false; await load();
  } finally { saving.value = false; }
}
onMounted(load);
</script>

<style scoped>
.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.page-title{margin:0 0 6px}.page-heading p,.section-heading p{margin:0;color:var(--admin-text-muted)}.actions{display:flex;gap:10px;align-items:center}.salary-page{display:grid;gap:16px}.salary-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.salary-card{position:relative;overflow:hidden;padding:17px 18px;border:1px solid var(--admin-border);border-radius:12px;background:linear-gradient(145deg,#fff,#f7fbfe);box-shadow:0 6px 18px rgba(69,126,169,.07)}.salary-card:after{content:"";position:absolute;right:-18px;bottom:-28px;width:76px;height:76px;border-radius:50%;background:rgba(204,224,244,.5)}.salary-card.primary{border-left:4px solid var(--admin-primary);background:linear-gradient(145deg,#f8fcff,#e8f3fb)}.salary-card span{display:block;color:var(--admin-text-muted);font-size:13px}.salary-card strong{display:block;margin:5px 0;color:var(--admin-text);font-size:25px}.salary-card small{color:var(--admin-text-muted);font-size:12px}.section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:15px}.section-heading h2{margin:0 0 4px;color:var(--admin-text);font-size:18px}.region-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.region-card{padding:15px;border:1px solid var(--admin-border);border-radius:11px;background:#fff}.region-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.region-title strong{font-size:17px}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.metric-grid>div{padding:10px;border-radius:8px;background:var(--el-fill-color-lighter);text-align:center}.metric-grid span{display:block;color:var(--admin-text-muted);font-size:12px}.metric-grid b{display:block;margin-top:4px;color:var(--admin-text);font-size:16px}.recent-strip{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;padding:9px 11px;border-left:3px solid #838e7c;background:rgba(131,142,124,.08);font-size:13px}.recent-strip span{color:var(--admin-text-muted)}.criteria-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.criterion-card{padding:13px;border:1px solid #ead9bd;border-radius:10px;background:#fffbf3}.criterion-card.achieved{border-color:#c8ddce;background:#f5fbf6}.criterion-title,.criterion-values{display:flex;justify-content:space-between;gap:8px;align-items:center}.criterion-title span{font-weight:650}.criterion-values{margin:10px 0 8px}.criterion-values strong{font-size:20px}.criterion-values span{color:var(--admin-text-muted);font-size:12px}.criterion-card p{margin:9px 0 0;color:var(--admin-text-muted);font-size:12px;line-height:1.6}.recommendations{display:grid;gap:8px;margin-top:14px}.recommendations>div{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;border-radius:8px;background:var(--el-fill-color-lighter)}.recommendations i{display:inline-flex;flex:0 0 22px;height:22px;align-items:center;justify-content:center;border-radius:50%;background:var(--admin-primary);color:#fff;font-style:normal;font-size:12px}.rules-table-wrap{overflow-x:auto}.rules-table{width:100%;border-collapse:collapse;text-align:center}.rules-table th,.rules-table td{padding:9px 8px;border:1px solid var(--admin-border)}.rules-table th{background:var(--el-fill-color-light);color:var(--admin-text)}.rules-table .salary-cell{font-size:16px;font-weight:700;color:var(--admin-primary)}.base-salary{margin:12px 0 0;color:var(--admin-text-muted)}.base-salary strong{color:var(--admin-primary)}.base-settings{display:flex;gap:22px;padding:12px 14px;border:1px solid var(--admin-border);border-radius:9px;background:var(--el-fill-color-lighter)}.base-settings :deep(.el-form-item){margin:0}.tier-settings{display:grid;gap:12px;margin-top:13px}.tier-setting-card{padding:13px;border:1px solid var(--admin-border);border-radius:10px}.tier-setting-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.tier-setting-heading>strong{color:var(--admin-primary);font-size:16px}.tier-setting-heading :deep(.el-form-item){margin:0}.region-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.region-setting{padding:11px;border-radius:8px;background:var(--el-fill-color-lighter)}.region-setting h3{margin:0 0 9px;font-size:14px}.region-setting :deep(.el-form-item){margin-bottom:9px}.region-setting :deep(.el-form-item:last-child){margin-bottom:0}.suffix{margin-left:7px;color:var(--admin-text-muted);font-size:12px}
@media(max-width:1100px){.salary-overview{grid-template-columns:repeat(2,1fr)}.metric-grid{grid-template-columns:repeat(2,1fr)}.criteria-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.page-heading{flex-direction:column}.actions{display:grid;width:100%;grid-template-columns:1fr 1fr}.actions :deep(.el-date-editor){grid-column:1/-1;width:100%}.actions :deep(.el-button){width:100%;margin:0}.salary-overview,.region-grid,.criteria-grid,.region-settings{grid-template-columns:1fr}.salary-card{padding:14px}.metric-grid{grid-template-columns:repeat(2,1fr)}.base-settings{display:grid;gap:10px}.salary-settings-dialog{width:calc(100vw - 24px)!important}}
</style>
