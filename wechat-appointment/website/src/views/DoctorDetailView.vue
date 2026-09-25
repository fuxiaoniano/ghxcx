<template>
  <section v-if="doctor" class="doctor-detail">
    <div class="container">
      <div class="breadcrumb"><RouterLink to="/">首页</RouterLink><span>/</span><RouterLink to="/doctors">医生团队</RouterLink><span>/</span><span>{{doctor.name}}</span></div>
      <div class="doctor-profile">
        <div class="profile-photo"><img v-if="doctor.avatar" :src="doctor.avatar" :alt="`${doctor.name}${doctor.title}`" /><span v-else class="doctor-initial">{{doctor.name.slice(0,1)}}</span></div>
        <div class="profile-main">
          <p class="eyebrow">{{doctor.departments?.map(d=>d.name).join(' · ') || doctor.department?.name}}</p>
          <h1>{{doctor.name}} <small>{{doctor.title}}</small></h1>
          <p class="profile-label">专业擅长</p><p class="profile-specialty">{{doctor.specialty}}</p>
          <div class="profile-meta"><span v-if="doctor.clinic">出诊院区：{{doctor.clinic.name}}</span><span>出诊安排以预约确认为准</span></div>
          <a class="button button-primary" :href="settings?.appointmentUrl">预约该医生</a>
        </div>
      </div>
      <div class="detail-grid">
        <article class="content-panel"><h2>医生简介</h2><p class="pre-line">{{doctor.description}}</p><template v-if="doctor.images?.length"><h2>专业风采</h2><div class="profile-gallery"><img v-for="image in doctor.images" :key="image" :src="image" alt="医生专业风采" loading="lazy" /></div></template></article>
        <aside class="schedule-panel"><div class="schedule-heading"><div><p class="eyebrow">OUTPATIENT</p><h2>近期出诊</h2></div><span>未来 14 天</span></div><div v-if="scheduleDays.length" class="schedule-days"><article v-for="day in scheduleDays" :key="day.date" class="schedule-day"><header><strong>{{formatScheduleDate(day.date)}}</strong><small>{{formatWeekday(day.date)}}</small></header><div v-for="slot in day.slots" :key="slot.id" class="schedule-slot"><span>{{slot.timeSlot}}</span><b :class="{full:slot.status==='FULL'}">{{slot.status==='FULL'?'约满':'可预约'}}</b></div></article></div><p v-else>请在线预约或电话咨询具体出诊时间。</p><small>排期可能动态调整，以工作人员最终确认为准。</small></aside>
      </div>
    </div>
  </section>
  <div v-else class="state-card container">{{error || '正在加载医生资料…'}}</div>
</template>

<script setup lang="ts">
import { computed,ref,watch } from 'vue';
import { RouterLink,useRoute } from 'vue-router';
import { Doctor,websiteApi } from '../api';
import { setSeo,useSite } from '../site';
const route=useRoute();const doctor=ref<Doctor|null>(null),error=ref('');const {settings}=useSite();
const scheduleDays=computed(()=>{const groups=new Map<string,NonNullable<Doctor['schedules']>>();for(const item of doctor.value?.schedules||[]){const list=groups.get(item.date)||[];list.push(item);groups.set(item.date,list);}return Array.from(groups,([date,slots])=>({date,slots})).slice(0,14);});
function scheduleDate(value:string){return new Date(`${value}T00:00:00`);}
function formatScheduleDate(value:string){const date=scheduleDate(value);return `${date.getMonth()+1}.${date.getDate()}`;}
function formatWeekday(value:string){return new Intl.DateTimeFormat('zh-CN',{weekday:'short'}).format(scheduleDate(value));}
async function load(){doctor.value=null;error.value='';try{doctor.value=await websiteApi.doctor(String(route.params.id));setSeo({title:`${doctor.value.name} ${doctor.value.title}｜重庆种博士口腔`,description:doctor.value.specialty,image:doctor.value.avatar,canonicalPath:route.path});}catch(e){error.value=e instanceof Error?e.message:'医生资料加载失败';}}
watch(()=>route.params.id,load,{immediate:true});
</script>
