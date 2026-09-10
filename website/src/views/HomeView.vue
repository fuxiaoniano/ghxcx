<template>
  <div v-if="!data" class="page-loading container" aria-live="polite"><span></span><span></span><span></span><p>正在加载专业服务内容…</p></div>
  <template v-else>
  <section class="hero-section">
    <div class="hero-glow"></div>
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">{{data?.settings.eyebrow}}</p>
        <h1>{{data?.settings.heroTitle}}</h1>
        <p class="hero-lead">{{data?.settings.heroDescription}}</p>
        <div class="hero-actions"><a class="button button-primary" :href="data?.settings.appointmentUrl">{{data?.settings.appointmentText}}</a><RouterLink class="button button-ghost" to="/doctors">了解医生团队</RouterLink></div>
        <div class="trust-row"><span><b>规范</b>诊疗流程</span><span><b>专业</b>医生团队</span><span><b>便捷</b>线上预约</span></div>
      </div>
      <div class="hero-visual">
        <img v-if="heroImage" :src="heroImage" alt="重庆种博士口腔专业诊疗环境" fetchpriority="high" />
        <div v-else class="hero-placeholder"><div class="visual-seal">ZBS</div><p>数字化口腔诊疗</p><span>DIGITAL DENTAL CARE</span></div>
        <div class="hero-note"><small>就诊服务</small><strong>从咨询到复诊<br>全流程用心陪伴</strong></div>
      </div>
    </div>
  </section>

  <section class="section services-preview">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">CLINICAL SERVICES</p><h2>一站式口腔诊疗服务</h2></div><RouterLink to="/services" class="text-link">查看全部科室 →</RouterLink></div>
      <div class="service-grid">
        <RouterLink v-for="(item,index) in data.categories.slice(0,8)" :key="item.id" :to="`/services#category-${item.id}`" class="service-card service-card-simple">
          <span class="service-number">{{String(index+1).padStart(2,'0')}}</span><img v-if="item.icon" :src="item.icon" :alt="item.name" loading="lazy" /><h3>{{item.name}}</h3><span class="card-link">查看科室</span>
        </RouterLink>
      </div>
    </div>
  </section>

  <section class="section authority-section">
    <div class="container authority-grid">
      <div class="authority-panel"><p class="eyebrow">PROFESSIONAL CARE</p><h2>专业不是一句口号，<br>而是每个诊疗环节的标准</h2><p>从初诊检查、方案沟通到治疗与复查，坚持清晰告知、规范操作与持续健康管理。</p><ul><li><strong>01</strong><span>充分沟通病情与可选方案</span></li><li><strong>02</strong><span>重视器械消毒与院感管理</span></li><li><strong>03</strong><span>建立治疗后的复查与维护建议</span></li></ul></div>
      <div class="authority-quote"><span>“</span><blockquote>把患者的理解与安心，放在每一次诊疗之前。</blockquote><p>重庆种博士口腔 · 服务理念</p></div>
    </div>
  </section>

  <section v-if="data?.doctors.length" class="section">
    <div class="container"><div class="section-heading"><div><p class="eyebrow">MEDICAL TEAM</p><h2>专业医生团队</h2></div><RouterLink to="/doctors" class="text-link">查看全部医生 →</RouterLink></div><div class="doctor-grid">
      <RouterLink v-for="doctor in data.doctors.slice(0,4)" :key="doctor.id" :to="`/doctors/${doctor.id}`" class="doctor-card"><div class="doctor-photo"><img v-if="doctor.avatar" :src="doctor.avatar" :alt="`${doctor.name}${doctor.title}`" loading="lazy" /><span v-else class="doctor-initial">{{doctor.name.slice(0,1)}}</span></div><div class="doctor-info"><p>{{doctor.departments?.map(d=>d.name).join(' · ') || doctor.department?.name}}</p><h3>{{doctor.name}} <small>{{doctor.title}}</small></h3><span>{{doctor.displayText || doctor.specialty}}</span><b>查看医生详情 →</b></div></RouterLink>
    </div></div>
  </section>

  <section v-if="data?.articles.length" class="section article-preview">
    <div class="container"><div class="section-heading"><div><p class="eyebrow">ORAL HEALTH NEWS</p><h2>口腔资讯</h2></div><RouterLink to="/articles" class="text-link">更多资讯内容 →</RouterLink></div><div class="article-grid">
      <RouterLink v-for="article in data.articles.slice(0,3)" :key="article.id" :to="`/articles/${article.slug}`" class="article-card"><div class="article-cover"><img v-if="article.coverUrl" :src="article.coverUrl" :alt="article.title" loading="lazy" /><span v-else>ORAL<br>HEALTH</span></div><div class="article-body"><time>{{formatDate(article.publishedAt)}}</time><h3>{{article.title}}</h3><p>{{article.digest || '了解专业、实用的口腔健康知识。'}}</p></div></RouterLink>
    </div></div>
  </section>

  <section class="cta-section"><div class="container cta-inner"><div><p class="eyebrow">APPOINTMENT</p><h2>让专业医生，更早了解您的需求</h2><p>在线提交预约信息，工作人员将与您联系确认就诊安排。</p></div><a class="button button-light" :href="data?.settings.appointmentUrl">立即在线预约</a></div></section>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { formatDate, useSite } from '../site';
const {state}=useSite();const data=computed(()=>state.data);const heroImage=computed(()=>data.value?.banners[0]?.imageUrl || '');
</script>
