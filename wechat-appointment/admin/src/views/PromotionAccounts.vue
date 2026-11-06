<template>
  <div class="page-heading"><div><h1 class="page-title">推广账户</h1><p>账户数据按账户隔离。其他成员只能查看管理员授予的范围；凭证仅账户负责人、创建人或管理员可维护，令牌明文不会回显。</p></div><div class="heading-actions"><el-button @click="openMyToken">我的腾讯 User Token</el-button><el-button style="margin-left:0" type="primary" @click="openAccount()">添加账户</el-button></div></div>
  <div class="content-panel"><el-table :data="accounts" border v-loading="loading"><el-table-column prop="project" label="项目" width="100"/><el-table-column prop="platform" label="渠道" width="130"/><el-table-column prop="name" label="账户名称" min-width="160"/><el-table-column prop="accountNo" label="户号" min-width="150"/><el-table-column label="归属员工" min-width="120" show-overflow-tooltip><template #default="{row}">{{row.owner?.nickname||row.owner?.username||'未分配'}}</template></el-table-column><el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip/><el-table-column label="状态" width="80"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{row.status==='ACTIVE'?'启用':'停用'}}</el-tag></template></el-table-column><el-table-column label="操作" min-width="285" fixed="right"><template #default="{row}"><div class="actions"><el-button v-if="row.canManageCredentials" link type="primary" @click="openCredential(row)">账户凭证</el-button><el-button v-if="isAdmin" link type="warning" @click="openGrants(row)">成员授权</el-button><el-button v-if="row.canManageCredentials" link @click="openAccount(row)">编辑</el-button><el-button v-if="isSuperAdmin" link type="danger" @click="remove(row)">删除</el-button></div></template></el-table-column></el-table></div>

  <el-dialog v-model="accountVisible" :title="accountForm.id?'编辑推广账户':'添加推广账户'" width="520px"><el-form :model="accountForm" label-width="90px"><el-form-item label="项目" required><el-radio-group v-model="accountForm.project"><el-radio value="重庆">重庆</el-radio><el-radio value="绵阳">绵阳</el-radio></el-radio-group></el-form-item><el-form-item label="渠道" required><el-input v-model="accountForm.platform" placeholder="如：腾讯广告、巨量引擎"/></el-form-item><el-form-item label="账户名称" required><el-input v-model="accountForm.name"/></el-form-item><el-form-item label="户号"><el-input v-model="accountForm.accountNo"/></el-form-item><el-form-item label="状态"><el-radio-group v-model="accountForm.status"><el-radio value="ACTIVE">启用</el-radio><el-radio value="DISABLED">停用</el-radio></el-radio-group></el-form-item><el-form-item label="备注"><el-input v-model="accountForm.remark" type="textarea"/></el-form-item></el-form><template #footer><el-button @click="accountVisible=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveAccount">保存</el-button></template></el-dialog>

  <el-dialog v-model="credentialVisible" :title="`账户凭证 · ${selected?.name||''}`" width="680px" destroy-on-close>
    <el-alert type="info" :closable="false" show-icon title="账户授权凭证独立加密保存，留空保持原值。腾讯 User Token 在“我的腾讯 User Token”统一配置，同一登录账号可供有权限的腾讯账户共用。"/>
    <el-form :model="credentialForm" label-width="130px" class="credential-form">
      <el-form-item :label="selected?.platform.includes('腾讯')?'腾讯 Access Token':'账户 Access Token'"><el-input v-model="credentialForm.accessToken" type="password" show-password autocomplete="new-password" placeholder="留空保持不变"/><small v-if="selected?.platform.includes('腾讯')">获取方法：在腾讯广告开放平台创建并审核应用，在应用详情获取 App ID、Client Secret；按本广告主账户完成 Marketing API OAuth 授权，取得 Access Token 和 Refresh Token。请勿复用其他账户授权。</small><small v-else>获取方法：在对应平台开放平台创建并审核应用，按本广告账户完成授权后获取 Access Token；只配置当前账户的令牌，不跨账户复用。</small></el-form-item>
      <el-form-item v-if="selected?.platform.includes('腾讯')" label="腾讯应用 ID"><el-input v-model="credentialForm.clientId" placeholder="开发者应用 ID"/><small>腾讯广告开放平台应用详情中的 App ID。</small></el-form-item>
      <el-form-item v-if="selected?.platform.includes('腾讯')" label="腾讯 Client Secret"><el-input v-model="credentialForm.clientSecret" type="password" show-password autocomplete="new-password" placeholder="留空保持不变"/></el-form-item>
      <el-form-item v-if="selected?.platform.includes('腾讯')" label="腾讯 Refresh Token"><el-input v-model="credentialForm.refreshToken" type="password" show-password autocomplete="new-password" placeholder="留空保持不变"/><small>通过上述 OAuth 授权取得；系统刷新时会自动轮换保存。</small></el-form-item>
      <el-form-item v-if="selected?.platform.includes('腾讯')" label="腾讯 User Token"><small>使用当前登录账号的共用 User Token，无需为每个推广账户重复扫码。请在页面上方“我的腾讯 User Token”配置；原账户级令牌保留兼容。</small></el-form-item>
      <el-form-item v-if="credentialStatus" label="已保存状态"><div class="status-tags"><el-tag v-for="[label,ready] in credentialItems" :key="label" :type="ready?'success':'info'">{{label}}{{ready?'已配置':'未配置'}}</el-tag></div></el-form-item>
      <el-form-item label="清除凭证"><el-checkbox v-model="credentialForm.clearAccessToken">Access Token</el-checkbox><el-checkbox v-if="selected?.platform.includes('腾讯')" v-model="credentialForm.clearClientSecret">Client Secret</el-checkbox><el-checkbox v-if="selected?.platform.includes('腾讯')" v-model="credentialForm.clearRefreshToken">Refresh Token</el-checkbox></el-form-item>
    </el-form>
    <template #footer><el-button @click="credentialVisible=false">关闭</el-button><el-button type="primary" :loading="saving" @click="saveCredential">保存凭证</el-button></template>
  </el-dialog>

  <el-dialog v-model="myTokenVisible" title="我的腾讯 User Token" width="520px" destroy-on-close>
    <el-alert type="info" :closable="false" show-icon title="同一个后台登录账号只需授权一次；系统在该账号有权操作的腾讯账户创建创意时自动使用。推广账户的 Access Token 与账户权限仍分别校验。"/>
    <el-form label-position="top" class="credential-form">
      <el-form-item label="授权状态"><el-tag :type="myTokenStatus?.hasUserToken?'success':'warning'">{{myTokenStatus?.hasUserToken?'已授权':'未授权或已过期'}}</el-tag><small v-if="myTokenStatus?.userTokenExpiresAt">到期：{{formatDate(myTokenStatus.userTokenExpiresAt)}}</small></el-form-item>
      <el-form-item label="User Token"><div class="token-row"><span class="muted">令牌仅由服务端接收并加密保存，不经过浏览器。</span><el-button type="primary" :loading="saving" @click="startUserTokenAuth">扫码授权</el-button></div></el-form-item>
    </el-form>
    <template #footer><el-button v-if="myTokenStatus?.hasUserToken" type="danger" text :loading="saving" @click="clearMyToken">清除我的令牌</el-button><el-button @click="myTokenVisible=false">关闭</el-button></template>
  </el-dialog>

  <el-dialog v-model="grantVisible" :title="`成员授权 · ${selected?.name||''}`" width="820px" destroy-on-close>
    <el-alert type="warning" :closable="false" show-icon title="仅管理员可授权。授权成员仍需具有对应后台页面权限；此处只限定其可访问的账户范围。凭证不随数据授权共享。"/>
    <el-table :data="grantMembers" border max-height="520">
      <el-table-column label="成员" min-width="160"><template #default="{row}">{{row.nickname||row.username}} <span class="muted">{{row.role==='MANAGER'?'管理员':'员工'}}</span></template></el-table-column>
      <el-table-column label="推广数据" width="110" align="center"><template #default="{row}"><el-checkbox v-model="row.canViewData"/></template></el-table-column>
      <el-table-column label="素材分析" width="110" align="center"><template #default="{row}"><el-checkbox v-model="row.canViewMaterials"/></template></el-table-column>
      <el-table-column label="查看创意" width="110" align="center"><template #default="{row}"><el-checkbox v-model="row.canViewCreatives"/></template></el-table-column>
      <el-table-column label="创建创意" width="110" align="center"><template #default="{row}"><el-checkbox v-model="row.canCreateCreatives" @change="row.canCreateCreatives && (row.canViewCreatives=true)"/></template></el-table-column>
    </el-table>
    <template #footer><el-button @click="grantVisible=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveGrants">保存授权</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createMyTencentUserTokenAuthorization, createPromotionAccount, deletePromotionAccount, getMyTencentUserToken, getPromotionAccountAccessGrants, getPromotionAccountCredential, getPromotionAccounts, saveMyTencentUserToken, savePromotionAccountAccessGrants, savePromotionAccountCredential, type PromotionAccountAccessGrantItem, type PromotionAccountCredentialStatus, type PromotionAccountItem, type TencentUserTokenStatus, updatePromotionAccount } from '../api/admin';
import { useAuthStore } from '../stores/auth';

const authStore=useAuthStore(); const isAdmin=computed(()=>authStore.user?.role==='SUPER_ADMIN'||authStore.user?.role==='MANAGER'); const isSuperAdmin=computed(()=>authStore.user?.role==='SUPER_ADMIN');
const accounts=ref<PromotionAccountItem[]>([]); const loading=ref(false); const saving=ref(false); const accountVisible=ref(false); const credentialVisible=ref(false); const grantVisible=ref(false); const selected=ref<PromotionAccountItem>(); const credentialStatus=ref<PromotionAccountCredentialStatus>(); const grantMembers=ref<Array<PromotionAccountAccessGrantItem & {canViewData:boolean;canViewMaterials:boolean;canViewCreatives:boolean;canCreateCreatives:boolean}>>([]);
const myTokenVisible=ref(false); const myTokenStatus=ref<TencentUserTokenStatus>();
const blankAccount=()=>({id:'',project:'重庆' as '重庆'|'绵阳',platform:'',name:'',accountNo:'',status:'ACTIVE' as 'ACTIVE'|'DISABLED',remark:''}); const accountForm=reactive(blankAccount());
const blankCredential=()=>({accessToken:'',clientId:'',clientSecret:'',refreshToken:'',userToken:'',userTokenExpiresAt:'',clearAccessToken:false,clearClientSecret:false,clearRefreshToken:false,clearUserToken:false}); const credentialForm=reactive(blankCredential());
const credentialItems=computed(()=>credentialStatus.value?Object.entries({AccessToken:credentialStatus.value.hasAccessToken,ClientSecret:credentialStatus.value.hasClientSecret,RefreshToken:credentialStatus.value.hasRefreshToken}):[]);
async function load(){loading.value=true;try{accounts.value=await getPromotionAccounts()}finally{loading.value=false}}
function openAccount(row?:PromotionAccountItem){Object.assign(accountForm,blankAccount(),row||{});accountVisible.value=true}
async function saveAccount(){if(!accountForm.name.trim()||!accountForm.platform.trim())return ElMessage.warning('请填写渠道和账户名称');saving.value=true;try{const{id,...data}=accountForm;if(id)await updatePromotionAccount(id,data);else await createPromotionAccount(data);ElMessage.success('账户已保存');accountVisible.value=false;await load()}finally{saving.value=false}}
async function openCredential(row:PromotionAccountItem){selected.value=row;Object.assign(credentialForm,blankCredential());credentialVisible.value=true;credentialStatus.value=await getPromotionAccountCredential(row.id)}
async function saveCredential(){if(!selected.value)return;saving.value=true;try{credentialStatus.value=await savePromotionAccountCredential(selected.value.id,credentialForm);Object.assign(credentialForm,blankCredential());ElMessage.success('账户凭证已加密保存')}finally{saving.value=false}}
async function openMyToken(){myTokenStatus.value=await getMyTencentUserToken();myTokenVisible.value=true}
async function clearMyToken(){await ElMessageBox.confirm('清除后，这个登录账号将不能使用共用 User Token 创建腾讯创意。确认清除吗？','清除令牌',{type:'warning'});saving.value=true;try{myTokenStatus.value=await saveMyTencentUserToken({clearUserToken:true});ElMessage.success('已清除当前登录账号的共用令牌')}finally{saving.value=false}}
async function openGrants(row:PromotionAccountItem){selected.value=row;grantVisible.value=true;const entries=await getPromotionAccountAccessGrants(row.id);grantMembers.value=entries.map(entry=>({ ...entry, adminUserId:entry.id, canViewData:entry.grant?.canViewData||false,canViewMaterials:entry.grant?.canViewMaterials||false,canViewCreatives:entry.grant?.canViewCreatives||false,canCreateCreatives:entry.grant?.canCreateCreatives||false }))}
async function saveGrants(){if(!selected.value)return;saving.value=true;try{await savePromotionAccountAccessGrants(selected.value.id,grantMembers.value.map(({adminUserId,canViewData,canViewMaterials,canViewCreatives,canCreateCreatives})=>({adminUserId,canViewData,canViewMaterials,canViewCreatives,canCreateCreatives})));ElMessage.success('成员授权已更新');grantVisible.value=false;await load()}finally{saving.value=false}}
async function remove(row:PromotionAccountItem){await ElMessageBox.confirm(`删除账户“${row.name}”会同时删除其推广日统计和账户授权，确认继续吗？`,'删除确认',{type:'warning'});await deletePromotionAccount(row.id);ElMessage.success('已删除');await load()}
async function startUserTokenAuth(){saving.value=true;try{const result=await createMyTencentUserTokenAuthorization();window.location.assign(result.authorizationUrl)}finally{saving.value=false}}
async function handleUserTokenCallback(){const url=new URL(window.location.href);const status=url.searchParams.get('user_token_status');if(!status)return;url.searchParams.delete('user_token_status');window.history.replaceState({},document.title,`${url.pathname}${url.search}${url.hash}`);if(status==='success'){myTokenStatus.value=await getMyTencentUserToken();myTokenVisible.value=true;ElMessage.success('当前登录账号的 User Token 已由服务端加密保存')}else if(status==='cancelled')ElMessage.warning('腾讯授权未完成');else ElMessage.error('腾讯授权结果处理失败，请重新扫码')}
function formatDate(value:string){return new Date(value).toLocaleString('zh-CN')}
onMounted(async()=>{await handleUserTokenCallback();await load()});
</script>

<style scoped>.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}.page-title{margin:0 0 6px}.page-heading p,.muted{margin:0;color:var(--admin-text-muted)}.heading-actions{display:flex;gap:8px;flex-wrap:wrap}.actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.credential-form{margin-top:18px}.credential-form small{display:block;margin-top:5px;color:var(--admin-text-muted);line-height:1.5}.token-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;width:100%}.status-tags{display:flex;gap:6px;flex-wrap:wrap}.status-tags :deep(.el-tag){margin:0}@media(max-width:600px){.page-heading{flex-direction:column}.heading-actions,.heading-actions :deep(.el-button){width:100%}.token-row{grid-template-columns:1fr}.token-row :deep(.el-button){width:100%;margin:0}}</style>
