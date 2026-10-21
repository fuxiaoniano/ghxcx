<template>
  <div class="trend-chart">
    <div v-if="series.length" class="chart-summary">
      <span><strong>{{ visibleSeries.length }}</strong> 条趋势</span>
      <span><strong>{{ labels.length }}</strong> 天数据</span>
      <span>{{ valueType === 'rate' ? '百分比' : valueType === 'integer' ? '整数' : '数值' }}刻度</span>
      <small>图例为所选时间汇总，曲线为每日数据；点击图例可切换显示</small>
    </div>
    <div v-if="series.length" class="legend" role="list" aria-label="趋势图图例">
      <button v-for="item in series" :key="item.name" type="button" :class="{ muted: hiddenNames.includes(item.name) }" :aria-pressed="!hiddenNames.includes(item.name)" @click="toggleSeries(item.name)">
        <i :style="{ background: item.color }" /><span>{{ item.name }}</span><b>{{ formatValue(item.summaryValue ?? item.values[item.values.length - 1] ?? 0) }}</b>
      </button>
    </div>
    <div v-if="series.length" class="chart-stage" @pointerleave="hoveredIndex = null">
      <svg class="chart-svg" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" role="img" :aria-label="ariaLabel" @pointermove="handlePointerMove">
        <defs>
          <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" :stop-color="primarySeries?.color || '#457ea9'" stop-opacity="0.13" /><stop offset="100%" :stop-color="primarySeries?.color || '#457ea9'" stop-opacity="0" /></linearGradient>
        </defs>
        <rect class="plot-background" :x="padding.left" :y="padding.top" :width="plotWidth" :height="plotHeight" rx="10" />
        <g class="grid"><template v-for="tick in yTicks" :key="tick.y"><line :x1="padding.left" :x2="chartWidth-padding.right" :y1="tick.y" :y2="tick.y" /><text :x="padding.left-12" :y="tick.y+4" text-anchor="end">{{ compactNumber(tick.value) }}</text></template></g>
        <g class="x-labels"><template v-for="item in xLabels" :key="item.label"><line :x1="x(item.index)" :x2="x(item.index)" :y1="chartHeight-padding.bottom" :y2="chartHeight-padding.bottom+5" /><text :x="x(item.index)" :y="chartHeight-18" text-anchor="middle">{{ shortDate(item.label) }}</text></template></g>
        <path v-if="primarySeries && visibleSeries.length === 1" class="primary-area" :d="areaPath(primarySeries.values)" :fill="`url(#${gradientId})`" />
        <g v-for="item in plottedSeries" :key="item.name"><path class="trend-line" :d="item.path" :stroke="item.color" /><circle v-for="(point,index) in item.coordinates" v-show="labels.length<=15" :key="`${item.name}-${index}`" class="trend-point" :cx="point.x" :cy="point.y" r="3.5" fill="#fff" :stroke="item.color" /></g>
        <g v-if="hoveredIndex!==null" class="hover-layer"><line class="crosshair" :x1="x(hoveredIndex)" :x2="x(hoveredIndex)" :y1="padding.top" :y2="chartHeight-padding.bottom" /><circle v-for="item in plottedSeries" :key="item.name" :cx="item.coordinates[hoveredIndex]?.x" :cy="item.coordinates[hoveredIndex]?.y" r="5" :fill="item.color" /></g>
        <rect class="pointer-capture" :x="padding.left" :y="padding.top" :width="plotWidth" :height="plotHeight" />
      </svg>
      <div v-if="hoveredIndex!==null" class="chart-tooltip" :class="{right:tooltipOnRight}" :style="tooltipStyle"><strong>{{ labels[hoveredIndex] }}</strong><div v-for="item in plottedSeries" :key="item.name"><i :style="{background:item.color}" /><span>{{ item.name }}</span><b>{{ formatValue(item.values[hoveredIndex]||0) }}</b></div></div>
    </div>
    <div v-else class="empty"><strong>暂无趋势数据</strong><span>请调整筛选条件或日期范围</span></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
interface TrendSeries { name:string; color:string; values:number[]; summaryValue?:number }
const props=withDefaults(defineProps<{labels:string[];series:TrendSeries[];valueType?:'number'|'integer'|'rate'}>(),{valueType:'number'});
const gradientId=`trend-area-${useId().replace(/:/g,'')}`;
const chartWidth=1000,chartHeight=360,padding={top:22,right:28,bottom:48,left:78};
const plotWidth=chartWidth-padding.left-padding.right,plotHeight=chartHeight-padding.top-padding.bottom;
const hoveredIndex=ref<number|null>(null),hiddenNames=ref<string[]>([]);
watch(()=>props.series.map(item=>item.name),(names)=>{hiddenNames.value=hiddenNames.value.filter(name=>names.includes(name));});
const visibleSeries=computed(()=>props.series.filter(item=>!hiddenNames.value.includes(item.name)));
const primarySeries=computed(()=>visibleSeries.value[0]||null);
const rawMax=computed(()=>Math.max(0,...visibleSeries.value.flatMap(item=>item.values).filter(Number.isFinite)));
const niceMax=computed(()=>{const value=rawMax.value||1,magnitude=10**Math.floor(Math.log10(value)),normalized=value/magnitude,rounded=normalized<=1?1:normalized<=2?2:normalized<=5?5:10;return rounded*magnitude;});
const x=(index:number)=>padding.left+(props.labels.length<=1?plotWidth/2:index*plotWidth/(props.labels.length-1));
const y=(value:number)=>padding.top+plotHeight*(1-Math.max(0,value)/niceMax.value);
const yTicks=computed(()=>Array.from({length:6},(_,index)=>({value:niceMax.value*(5-index)/5,y:padding.top+index*plotHeight/5})));
const xLabels=computed(()=>{const step=Math.max(1,Math.ceil(props.labels.length/8));return props.labels.map((label,index)=>({label,index})).filter(item=>item.index%step===0||item.index===props.labels.length-1);});
// 保形三次曲线：在相邻数据点之间平滑，但不越过局部极值，避免视觉上虚构峰谷。
function linePath(points:Array<{x:number;y:number}>){
  if(points.length<2)return points.length?`M ${points[0].x} ${points[0].y}`:'';
  const slopes=points.slice(1).map((point,index)=>(point.y-points[index].y)/(point.x-points[index].x));
  const tangents=points.map((_,index)=>{
    if(index===0)return slopes[0];
    if(index===points.length-1)return slopes[slopes.length-1];
    const previous=slopes[index-1],next=slopes[index];
    return previous*next<=0?0:2*previous*next/(previous+next);
  });
  return points.slice(1).reduce((path,point,index)=>{
    const previous=points[index],width=point.x-previous.x;
    return `${path} C ${previous.x+width/3} ${previous.y+tangents[index]*width/3}, ${point.x-width/3} ${point.y-tangents[index+1]*width/3}, ${point.x} ${point.y}`;
  },`M ${points[0].x} ${points[0].y}`);
}
const plottedSeries=computed(()=>visibleSeries.value.map(item=>{const coordinates=item.values.map((value,index)=>({x:x(index),y:y(value)}));return{...item,coordinates,path:linePath(coordinates)};}));
function areaPath(values:number[]){const points=values.map((value,index)=>({x:x(index),y:y(value)}));return points.length?`${linePath(points)} L ${points[points.length-1].x} ${chartHeight-padding.bottom} L ${points[0].x} ${chartHeight-padding.bottom} Z`:'';}
const ariaLabel=computed(()=>`推广数据趋势图，共 ${props.labels.length} 天、${visibleSeries.value.length} 条趋势线`);
const shortDate=(value:string)=>value.slice(5).replace('-','/');
const tooltipOnRight=computed(()=>hoveredIndex.value!==null&&x(hoveredIndex.value)>chartWidth*.72);
const tooltipStyle=computed(()=>({left:`${hoveredIndex.value===null?0:x(hoveredIndex.value)/chartWidth*100}%`}));
function toggleSeries(name:string){hiddenNames.value=hiddenNames.value.includes(name)?hiddenNames.value.filter(item=>item!==name):[...hiddenNames.value,name];hoveredIndex.value=null;}
function handlePointerMove(event:PointerEvent){if(!props.labels.length)return;const rect=(event.currentTarget as SVGElement).getBoundingClientRect(),svgX=(event.clientX-rect.left)/rect.width*chartWidth;hoveredIndex.value=Math.max(0,Math.min(props.labels.length-1,Math.round((svgX-padding.left)/plotWidth*(props.labels.length-1))));}
function compactNumber(value:number){const scaled=props.valueType==='rate'?value*100:value;if(props.valueType==='rate')return`${scaled.toFixed(scaled>=10?0:1)}%`;if(scaled>=10000)return`${(scaled/10000).toFixed(scaled>=100000?0:1)}万`;if(scaled>=1000)return`${(scaled/1000).toFixed(1)}千`;return scaled.toFixed(props.valueType==='integer'?0:scaled>=100?0:2);}
function formatValue(value:number){if(props.valueType==='rate')return`${(value*100).toFixed(2)}%`;if(props.valueType==='integer')return Math.round(value).toLocaleString('zh-CN');return value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
</script>

<style scoped>
.trend-chart{min-height:410px}.chart-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 12px;color:var(--admin-text-muted);font-size:13px}.chart-summary>span{display:inline-flex;align-items:baseline;gap:4px;padding:5px 9px;border:1px solid var(--admin-border);border-radius:999px;background:var(--el-fill-color-lighter)}.chart-summary strong{color:var(--admin-text);font-size:14px}.chart-summary small{margin-left:auto;font-size:12px}.legend{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.legend button{display:inline-grid;grid-template-columns:9px auto auto;align-items:center;gap:7px;min-height:32px;padding:5px 9px;border:1px solid var(--admin-border);border-radius:8px;background:#fff;color:var(--admin-text);font:inherit;cursor:pointer;transition:border-color .2s,box-shadow .2s,opacity .2s}.legend button:hover{border-color:var(--el-color-primary);box-shadow:0 3px 10px rgba(69,126,169,.12)}.legend button.muted{opacity:.42;background:var(--el-fill-color-light)}.legend i,.chart-tooltip i{width:9px;height:9px;border-radius:50%}.legend span{font-size:13px}.legend b{padding-left:3px;color:var(--el-color-primary);font-size:13px;font-variant-numeric:tabular-nums}.chart-stage{position:relative;width:100%;overflow:hidden;border:1px solid var(--admin-border);border-radius:12px;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%)}.chart-svg{display:block;width:100%;height:auto;min-height:340px;touch-action:none}.plot-background{fill:rgba(204,224,244,.12)}.grid line{stroke:var(--admin-border);stroke-dasharray:4 6}.grid text,.x-labels text{fill:var(--admin-text-muted);font-size:12px;font-variant-numeric:tabular-nums}.x-labels line{stroke:var(--admin-border)}.trend-line{fill:none;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}.trend-point{stroke-width:2;vector-effect:non-scaling-stroke}.crosshair{stroke:var(--el-color-primary);stroke-width:1;stroke-dasharray:4 4}.hover-layer circle{stroke:#fff;stroke-width:2.5}.pointer-capture{fill:transparent;cursor:crosshair}.chart-tooltip{position:absolute;z-index:3;top:16px;min-width:190px;max-width:280px;padding:11px 12px;border:1px solid rgba(69,126,169,.24);border-radius:10px;background:rgba(255,255,255,.96);box-shadow:0 10px 30px rgba(39,76,105,.18);transform:translateX(12px);pointer-events:none;backdrop-filter:blur(6px)}.chart-tooltip.right{transform:translateX(calc(-100% - 12px))}.chart-tooltip>strong{display:block;margin-bottom:7px;color:var(--admin-text);font-size:13px}.chart-tooltip>div{display:grid;grid-template-columns:9px minmax(60px,1fr) auto;align-items:center;gap:7px;padding:3px 0;font-size:12px}.chart-tooltip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--admin-text-muted)}.chart-tooltip b{font-variant-numeric:tabular-nums;color:var(--admin-text)}.empty{display:flex;min-height:340px;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1px dashed var(--admin-border);border-radius:12px;color:var(--admin-text-muted)}.empty strong{color:var(--admin-text);font-size:15px}.empty span{font-size:13px}
@media(max-width:760px){.trend-chart{min-height:360px}.chart-summary small{display:none}.chart-summary>span{font-size:12px}.legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-height:none;overflow:visible}.legend button{min-width:0;width:100%;justify-content:start}.legend span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chart-svg{min-height:290px}.chart-tooltip{max-width:220px}.grid text,.x-labels text{font-size:13px}}
</style>
