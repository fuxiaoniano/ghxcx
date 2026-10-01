<template>
  <div class="page-heading"><div><h1 class="page-title">数据首页</h1><p>项目、渠道和账户趋势可分别选择时间、展示字段及筛选对象。</p></div></div>
  <div class="overview-strip">
    <div class="primary"><span>独立趋势图</span><strong>3</strong><small>时间和筛选互不影响</small></div>
    <div><span>项目</span><strong>{{ projectOptions.length }}</strong><small>可独立多选</small></div>
    <div><span>渠道</span><strong>{{ platformOptions.length }}</strong><small>可独立多选</small></div>
    <div><span>推广账户</span><strong>{{ accounts.length }}</strong><small>可独立多选</small></div>
  </div>
  <div class="chart-list">
    <section v-for="card in cards" :key="card.key" v-loading="loadingByCard[card.key]" class="content-panel chart-card">
      <div class="card-heading">
        <div class="card-title"><i :class="`accent-${card.key}`" /><div><h2>{{ card.title }}</h2><p>{{ card.description }}</p></div></div>
        <div class="card-filters">
          <el-select v-model="selections[card.key].metric" class="metric-picker" placeholder="展示字段"><el-option v-for="field in chartFields" :key="field.key" :label="field.label" :value="field.key" /></el-select>
          <el-select v-model="selections[card.key].entities" class="entity-picker" multiple collapse-tags collapse-tags-tooltip clearable filterable :placeholder="card.placeholder"><el-option v-for="option in optionsFor(card.key)" :key="option.value" :label="option.label" :value="option.value" /></el-select>
        </div>
      </div>
      <div class="time-controls">
        <span class="control-label">统计时间</span>
        <el-radio-group v-model="selections[card.key].period" size="small" @change="selectPeriod(card.key,$event)">
          <el-radio-button value="3">过去3天</el-radio-button><el-radio-button value="7">过去7天</el-radio-button><el-radio-button value="15">过去15天</el-radio-button><el-radio-button value="30">过去一个月</el-radio-button><el-radio-button value="custom">自定义</el-radio-button>
        </el-radio-group>
        <el-date-picker v-if="selections[card.key].period==='custom'" v-model="selections[card.key].dateRange" class="date-picker" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" :clearable="false" />
        <el-button v-if="selections[card.key].period==='custom'" type="primary" size="small" @click="loadCard(card.key)">查询</el-button>
        <span class="range-text">{{ selections[card.key].dateRange[0] }} 至 {{ selections[card.key].dateRange[1] }}</span>
      </div>
      <PromotionLineChart :labels="datesFor(card.key)" :series="seriesFor(card.key)" :value-type="fieldType(selections[card.key].metric)" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import PromotionLineChart from '../components/PromotionLineChart.vue';
import { getPromotionDashboard, type PromotionAccountItem, type PromotionDailyMetricItem, type PromotionMetricFieldItem } from '../api/admin';
type CardKey='project'|'platform'|'account';type ValueType='number'|'integer'|'rate';type TrendSeries={name:string;color:string;values:number[]};
const systemTypes:Record<string,ValueType>={spend:'number',impressions:'integer',clicks:'integer',clickRate:'rate',leads:'integer',validLeads:'integer',validRate:'rate',averageCost:'number',validCost:'number',appointments:'integer',transactions:'integer',conversionRate:'rate',arrivalRate:'rate',validArrivalRate:'rate',arrivalCost:'number',revenue:'number',roi:'number'};
const directKeys=new Set(['spend','impressions','clicks','leads','validLeads','appointments','transactions','revenue']);const calculatedKeys=new Set(['clickRate','validRate','averageCost','validCost','conversionRate','arrivalRate','validArrivalRate','arrivalCost','roi']);
const colors=['#457ea9','#838e7c','#d88961','#6d63a8','#4f9a87','#b88a45','#7d91b8','#a76882','#5f6f78','#8c9d4f','#bf6e54','#7398b7'];
const cards=[{key:'project' as const,title:'项目趋势',description:'对比各项目每日数据变化',placeholder:'全部项目'},{key:'platform' as const,title:'渠道趋势',description:'对比各推广渠道每日数据变化',placeholder:'全部渠道'},{key:'account' as const,title:'账户趋势',description:'对比各推广账户每日数据变化',placeholder:'全部账户'}];
const dateText=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function recentRange(days:number):[string,string]{const end=new Date();end.setDate(end.getDate()-1);const start=new Date(end);start.setDate(start.getDate()-days+1);return[dateText(start),dateText(end)];}
const selections=reactive<Record<CardKey,{metric:string;entities:string[];period:string;dateRange:string[]}>>({project:{metric:'spend',entities:[],period:'7',dateRange:recentRange(7)},platform:{metric:'spend',entities:[],period:'7',dateRange:recentRange(7)},account:{metric:'spend',entities:[],period:'7',dateRange:recentRange(7)}});
const rowsByCard=reactive<Record<CardKey,PromotionDailyMetricItem[]>>({project:[],platform:[],account:[]});const loadingByCard=reactive<Record<CardKey,boolean>>({project:false,platform:false,account:false});const fields=ref<PromotionMetricFieldItem[]>([]),accounts=ref<PromotionAccountItem[]>([]);
const projectOptions=computed(()=>[...new Set(accounts.value.map(item=>item.project))].sort((a,b)=>a.localeCompare(b,'zh-CN')));const platformOptions=computed(()=>[...new Set(accounts.value.map(item=>item.platform))].sort((a,b)=>a.localeCompare(b,'zh-CN')));const chartFields=computed(()=>fields.value.filter(field=>field.isVisible&&field.dataType==='NUMBER'));
function optionsFor(key:CardKey){if(key==='project')return projectOptions.value.map(value=>({value,label:value}));if(key==='platform')return platformOptions.value.map(value=>({value,label:value}));return accounts.value.map(item=>({value:item.id,label:`${item.project} · ${item.platform} · ${item.name}`}));}
function datesFor(key:CardKey){const result:string[]=[];const [from,to]=selections[key].dateRange;if(!from||!to)return result;const cursor=new Date(`${from}T00:00:00`),end=new Date(`${to}T00:00:00`);while(cursor<=end){result.push(dateText(cursor));cursor.setDate(cursor.getDate()+1);}return result;}
function fieldType(key:string):ValueType{return systemTypes[key]||'number';}function groupKey(row:PromotionDailyMetricItem,key:CardKey){return key==='project'?row.account.project:key==='platform'?row.account.platform:row.account.id;}function groupLabel(row:PromotionDailyMetricItem,key:CardKey){return key==='project'?row.account.project:key==='platform'?row.account.platform:row.account.name;}
function totals(source:PromotionDailyMetricItem[]){const sum=(key:'spend'|'impressions'|'clicks'|'leads'|'validLeads'|'appointments'|'transactions'|'revenue')=>source.reduce((total,row)=>total+Number(row[key]||0),0);const base={spend:sum('spend'),impressions:sum('impressions'),clicks:sum('clicks'),leads:sum('leads'),validLeads:sum('validLeads'),appointments:sum('appointments'),transactions:sum('transactions'),revenue:sum('revenue')};return{...base,clickRate:base.impressions?base.clicks/base.impressions:0,validRate:base.leads?base.validLeads/base.leads:0,averageCost:base.leads?base.spend/base.leads:0,validCost:base.validLeads?base.spend/base.validLeads:0,conversionRate:base.appointments?base.transactions/base.appointments:0,arrivalRate:base.leads?base.appointments/base.leads:0,validArrivalRate:base.validLeads?base.appointments/base.validLeads:0,arrivalCost:base.appointments?base.spend/base.appointments:0,roi:base.spend?base.revenue/base.spend:0};}
function metricValue(source:PromotionDailyMetricItem[],key:string){if(directKeys.has(key)||calculatedKeys.has(key))return Number(totals(source)[key as keyof ReturnType<typeof totals>]||0);return source.reduce((total,row)=>total+Number(row.customMetrics?.[key]||0),0);}
function seriesFor(key:CardKey):TrendSeries[]{const rows=rowsByCard[key];const chosen=selections[key].entities,available=optionsFor(key),ids=chosen.length?chosen:available.map(item=>item.value);return ids.map((id,index)=>{const matched=rows.filter(row=>groupKey(row,key)===id),fallback=available.find(item=>item.value===id)?.label||id;return{name:matched[0]?groupLabel(matched[0],key):fallback,color:colors[index%colors.length],values:datesFor(key).map(date=>metricValue(matched.filter(row=>row.statDate===date),selections[key].metric))};});}
async function loadCard(key:CardKey){const [dateFrom,dateTo]=selections[key].dateRange;if(!dateFrom||!dateTo)return;loadingByCard[key]=true;try{const result=await getPromotionDashboard({dateFrom,dateTo});rowsByCard[key]=result.rows;fields.value=result.fields;accounts.value=result.accounts;if(!chartFields.value.some(field=>field.key===selections[key].metric))selections[key].metric=chartFields.value[0]?.key||'spend';}finally{loadingByCard[key]=false;}}
async function selectPeriod(key:CardKey,value:string|number|boolean|undefined){if(value!=='custom'){selections[key].dateRange=recentRange(Number(value));await loadCard(key);}}
onMounted(()=>Promise.all(cards.map(card=>loadCard(card.key))));
</script>

<style scoped>
.page-heading{margin-bottom:18px}.page-title{margin:0 0 6px}.page-heading p,.card-heading p{margin:0;color:var(--admin-text-muted)}.overview-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.overview-strip>div{position:relative;overflow:hidden;padding:15px 18px;border:1px solid var(--admin-border);border-radius:12px;background:linear-gradient(145deg,#fff,#f8fbfe);box-shadow:0 5px 16px rgba(69,126,169,.06)}.overview-strip>div:after{content:"";position:absolute;right:-18px;bottom:-28px;width:74px;height:74px;border-radius:50%;background:rgba(204,224,244,.42)}.overview-strip>div.primary{border-left:3px solid var(--el-color-primary)}.overview-strip span{display:block;color:var(--admin-text-muted);font-size:12px}.overview-strip strong{display:block;margin-top:4px;color:var(--admin-text);font-size:22px}.overview-strip small{display:block;margin-top:2px;color:var(--admin-text-muted);font-size:12px}.chart-list{display:grid;gap:18px}.chart-card{padding:18px 20px;border-radius:14px;box-shadow:0 8px 24px rgba(45,75,98,.07)}.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.card-title{display:flex;align-items:flex-start;gap:11px}.card-title>i{width:5px;height:42px;border-radius:99px;background:#457ea9}.card-title>i.accent-platform{background:#838e7c}.card-title>i.accent-account{background:#8aaed0}.card-heading h2{margin:0 0 4px;font-size:18px;color:var(--admin-text)}.card-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;padding:6px;border:1px solid var(--admin-border);border-radius:10px;background:var(--el-fill-color-lighter)}.metric-picker{width:140px}.entity-picker{width:300px}.time-controls{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:14px 0 2px;padding:10px 12px;border-top:1px solid var(--admin-border);border-bottom:1px solid var(--admin-border);background:rgba(204,224,244,.12)}.control-label{font-size:13px;font-weight:650;color:var(--admin-text)}.date-picker{width:300px!important}.range-text{margin-left:auto;color:var(--admin-text-muted);font-size:12px;font-variant-numeric:tabular-nums}
@media(max-width:1200px){.overview-strip{grid-template-columns:repeat(2,1fr)}.card-heading{flex-direction:column}.card-filters{width:100%;justify-content:flex-start}.range-text{width:100%;margin-left:0}}
@media(max-width:760px){.overview-strip{grid-template-columns:1fr 1fr;gap:8px}.overview-strip>div{padding:12px}.chart-card{padding:14px 10px}.card-filters{display:grid;grid-template-columns:1fr;width:100%}.metric-picker,.entity-picker{width:100%!important}.time-controls{display:grid;grid-template-columns:1fr}.time-controls :deep(.el-radio-group){display:grid;grid-template-columns:repeat(2,1fr)}.time-controls :deep(.el-radio-button:last-child){grid-column:1/-1}.time-controls :deep(.el-radio-button__inner),.date-picker,.time-controls :deep(.el-button){width:100%!important}.range-text{text-align:center}}
</style>
