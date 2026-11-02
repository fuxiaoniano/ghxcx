<template>
  <div class="page-heading"><h1 class="page-title">公众号绑定</h1></div>
  <section v-if="canBind" class="content-panel" v-loading="bindingLoading">
    <h2>公众号凭证</h2>
    <el-form label-position="top" class="form-grid">
      <el-form-item label="启用公众号"><el-switch v-model="form.enabled" /></el-form-item>
      <el-form-item label="公众号 AppID"><el-input v-model="form.appId" autocomplete="off" /></el-form-item>
      <el-form-item label="AppSecret"><el-input v-model="form.appSecret" type="password" show-password autocomplete="new-password" :placeholder="status?.hasAppSecret?'已保存，留空不修改':'请输入 AppSecret'" /></el-form-item>
      <el-form-item label="服务器 Token"><el-input v-model="form.token" type="password" show-password autocomplete="new-password" :placeholder="status?.hasToken?'已保存，留空不修改':'请输入服务器 Token'" /></el-form-item>
      <el-form-item label="EncodingAESKey"><el-input v-model="form.encodingAesKey" type="password" show-password autocomplete="new-password" :placeholder="status?.hasEncodingAesKey?'已保存，留空不修改':'安全模式需要填写'" /></el-form-item>
      <el-form-item label="服务器回调地址" class="full"><el-input :model-value="status?.callbackUrl||''" readonly><template #append><el-button @click="copy">复制</el-button></template></el-input></el-form-item>
    </el-form>
    <el-button type="primary" :loading="saving" @click="save">保存公众号配置</el-button>
    <div class="login-preference"><div><strong>默认微信扫码登录</strong><p>关闭时默认显示账号密码登录；两种方式始终可手动切换。</p></div><el-switch v-model="defaultWechatLogin" :disabled="!bindingReady || loginPreferenceSaving" @change="saveLoginPreference" /></div>
  </section>
  <section v-if="canNotify" class="content-panel" v-loading="notifyLoading">
    <h2>新预约通知</h2>
    <el-form label-position="top" class="form-grid"><el-form-item label="启用新预约通知"><el-switch v-model="notify.enabled" /></el-form-item><el-form-item label="工作人员公众号模板 ID"><el-input v-model="notify.templateId" placeholder="公众号后台取得的模板 ID" /></el-form-item></el-form>
    <el-button type="primary" :loading="notifySaving" @click="saveNotify">保存预约通知设置</el-button>
    <h2 style="margin-top:24px">网咨表单分配通知</h2>
    <el-form label-position="top" class="form-grid"><el-form-item label="分配或转交后通知新跟进人"><el-switch v-model="notify.assignmentEnabled" /></el-form-item><el-form-item label="网咨分配公众号模板 ID"><el-input v-model="notify.assignmentTemplateId" placeholder="使用独立于预约通知的模板 ID" /></el-form-item></el-form>
    <p>新跟进人需绑定公众号微信。模板字段依次为：表单编号、姓名、项目、分配时间；备注包含脱敏电话和来源。</p>
    <el-button type="primary" :loading="notifySaving" @click="saveNotify">保存网咨通知设置</el-button>
  </section>
  <section class="content-panel guide"><h2>公众号后台设置步骤</h2><ol><li>登录微信公众平台，在“设置与开发”查看公众号 AppID，并取得 AppSecret，填入本页。</li><li>在“开发接口管理 / 基本配置”填写服务器 URL、Token 和 EncodingAESKey；URL 使用本页显示的回调地址，其余值必须与本页一致。</li><li>在网页授权设置中配置管理后台 OAuth 回调地址的域名，按平台提示完成域名验证。管理员扫码登录依赖网页授权。</li><li>在模板消息设置中分别取得新预约和网咨分配通知的模板 ID，填入各自设置；新跟进人需绑定接收通知的公众号微信。</li><li>保存后在登录页刷新扫码二维码并用手机确认，再用测试表单验证通知。</li></ol><p>公众号 access_token 由服务端自动获取，无需手动填写。更新凭证会清除旧缓存；AppSecret 和 Token 保存后不会回显。</p></section>
</template>
<script setup lang="ts">
import { computed,onMounted,reactive,ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getOfficialAccountBinding,type OfficialAccountBinding,updateOfficialAccountBinding,getAppointmentNotifyConfig,updateAppointmentNotifyConfig,getAdminLoginPreference,updateAdminLoginPreference } from '../api/admin';
import { useAuthStore } from '../stores/auth';
const auth=useAuthStore();const canBind=computed(()=>auth.hasPermission('SYSTEM_OFFICIAL_BINDING'));const canNotify=computed(()=>auth.hasPermission('SYSTEM_APPOINTMENT_NOTIFY'));
const status=ref<OfficialAccountBinding|null>(null),saving=ref(false),bindingLoading=ref(false),notifyLoading=ref(false),notifySaving=ref(false);
const defaultWechatLogin=ref(false),bindingReady=ref(false),loginPreferenceSaving=ref(false);
const form=reactive({enabled:false,appId:'',appSecret:'',token:'',encodingAesKey:''});const notify=reactive({enabled:true,templateId:'',assignmentEnabled:false,assignmentTemplateId:''});
async function loadBinding(){bindingLoading.value=true;try{const [binding,preference]=await Promise.all([getOfficialAccountBinding(),getAdminLoginPreference()]);status.value=binding;form.enabled=binding.enabled;form.appId=binding.appId;defaultWechatLogin.value=preference.defaultWechatLogin;bindingReady.value=preference.bindingReady;}finally{bindingLoading.value=false}}
async function loadNotify(){notifyLoading.value=true;try{const result=await getAppointmentNotifyConfig();notify.enabled=result.enabled;notify.templateId=result.templateId||'';notify.assignmentEnabled=result.assignmentEnabled||false;notify.assignmentTemplateId=result.assignmentTemplateId||'';}finally{notifyLoading.value=false}}
async function save(){if(form.enabled&&(!form.appId.trim()||(!status.value?.hasAppSecret&&!form.appSecret.trim())||(!status.value?.hasToken&&!form.token.trim())))return ElMessage.warning('启用公众号前请填写 AppID、AppSecret 和服务器 Token');saving.value=true;try{status.value=await updateOfficialAccountBinding({...form,appId:form.appId.trim()});form.appSecret='';form.token='';form.encodingAesKey='';const preference=await getAdminLoginPreference();defaultWechatLogin.value=preference.defaultWechatLogin;bindingReady.value=preference.bindingReady;ElMessage.success('公众号配置已保存');}finally{saving.value=false}}
async function saveLoginPreference(value:boolean|string|number){loginPreferenceSaving.value=true;try{const result=await updateAdminLoginPreference(value===true);defaultWechatLogin.value=result.defaultWechatLogin;bindingReady.value=result.bindingReady;ElMessage.success('默认登录方式已保存');}catch{defaultWechatLogin.value=!Boolean(value);}finally{loginPreferenceSaving.value=false}}
async function saveNotify(){notifySaving.value=true;try{await updateAppointmentNotifyConfig({enabled:notify.enabled,templateId:notify.templateId.trim(),assignmentEnabled:notify.assignmentEnabled,assignmentTemplateId:notify.assignmentTemplateId.trim()});ElMessage.success('通知设置已保存');}finally{notifySaving.value=false}}
async function copy(){if(status.value?.callbackUrl){await navigator.clipboard.writeText(status.value.callbackUrl);ElMessage.success('回调地址已复制')}}
onMounted(()=>{if(canBind.value)void loadBinding();if(canNotify.value)void loadNotify()});
</script>
<style scoped>.content-panel+.content-panel{margin-top:14px}.content-panel h2{margin:0 0 16px;font-size:18px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.form-grid .full{grid-column:1/-1}.form-grid :deep(.el-input){width:100%}.login-preference{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:20px;padding:16px;border:1px solid var(--admin-border);border-radius:12px}.login-preference p{margin:5px 0 0;color:var(--admin-text-muted);font-size:12px}.guide li{margin:8px 0;line-height:1.6}.guide p{color:var(--admin-text-muted);line-height:1.6}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.form-grid .full{grid-column:auto}}</style>
