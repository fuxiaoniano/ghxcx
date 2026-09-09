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
        <aside class="schedule-panel"><h2>近期出诊</h2><div v-if="doctor.schedules?.length" class="schedule-list"><div v-for="item in doctor.schedules" :key="item.id"><span>{{item.date}} · {{item.timeSlot}}</span><b>{{item.status==='FULL'?'已约满':'可预约'}}</b></div></div><p v-else>请在线预约或电话咨询具体出诊时间。</p><small>排期可能动态调整，以工作人员最终确认为准。</small></aside>
      </div>
    </div>
  </section>
  <div v-else class="state-card container">{{error || '正在加载医生资料…'}}</div>
</template>

<script setup lang="ts">
import { ref,watch } from 'vue';
import { RouterLink,useRoute } from 'vue-router';
import { Doctor,websiteApi } from '../api';
import { setSeo,useSite } from '../site';
const route=useRoute();const doctor=ref<Doctor|null>(null),error=ref('');const {settings}=useSite();
async function load(){doctor.value=null;error.value='';try{doctor.value=await websiteApi.doctor(String(route.params.id));setSeo(`${doctor.value.name} ${doctor.value.title}｜重庆种博士口腔`,doctor.value.specialty);}catch(e){error.value=e instanceof Error?e.message:'医生资料加载失败';}}
watch(()=>route.params.id,load,{immediate:true});
</script>
