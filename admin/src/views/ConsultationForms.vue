<template>
  <div class="page-heading">
    <div class="mobile-title-row"><h1 class="page-title">全部表单</h1><el-button class="mobile-refresh" :loading="loading" @click="load">刷新</el-button></div>
    <div class="heading-actions">
      <el-button @click="columnDialog = true">列表字段</el-button>
      <el-button v-if="can('CONSULTATION_IMPORT')" @click="importDialog = true">批量导入</el-button>
      <el-button v-if="can('CONSULTATION_EXPORT')" :loading="exporting" @click="doExport">导出</el-button>
      <el-button v-if="can('CONSULTATION_CREATE')" type="primary" @click="openCreate">手动录单</el-button>
    </div>
  </div>

  <section class="content-panel filter-panel">
    <button class="mobile-filter-toggle" type="button" :aria-expanded="mobileFiltersOpen" aria-controls="consultation-filters" @click="mobileFiltersOpen = !mobileFiltersOpen">
      <span>筛选{{ activeFilterCount ? ` · ${activeFilterCount}` : '' }}</span><span aria-hidden="true">{{ mobileFiltersOpen ? '收起⌃' : '展开⌄' }}</span>
    </button>
    <el-form id="consultation-filters" :inline="true" class="filters" :class="{ 'mobile-open': mobileFiltersOpen }">
      <el-form-item><el-input v-model="query.keyword" clearable placeholder="姓名或完整手机号" @keyup.enter="search" /></el-form-item>
      <el-form-item v-if="filterEnabled('project')"><el-select v-model="query.projectId" clearable placeholder="全部项目"><el-option v-for="item in metadata.projects" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      <el-form-item v-if="filterEnabled('channelSource')"><el-select v-model="query.channelSource" clearable placeholder="全部渠道"><el-option v-for="item in allChannels" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      <el-form-item v-if="filterEnabled('accountName')"><el-select v-model="query.promotionAccountId" clearable filterable placeholder="全部账户"><el-option v-for="item in metadata.promotionAccounts" :key="item.id" :label="`${item.name} · ${item.project}`" :value="item.id" /></el-select></el-form-item>
      <el-form-item v-if="filterEnabled('status')"><el-select v-model="query.statusIds" multiple collapse-tags clearable placeholder="状态"><el-option v-for="item in metadata.statuses" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      <el-form-item v-if="filterEnabled('tags')"><el-select v-model="query.tagIds" multiple collapse-tags clearable placeholder="标签"><el-option v-for="item in metadata.tags" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      <el-form-item v-if="filterEnabled('owner')"><el-select v-model="query.ownerAdminId" clearable filterable placeholder="负责人"><el-option v-for="item in metadata.members" :key="item.id" :label="item.nickname || item.username" :value="item.id" /></el-select></el-form-item>
      <el-form-item v-if="filterEnabled('createdAt')"><el-date-picker v-model="createdRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="创建开始" end-placeholder="创建结束" /></el-form-item>
      <el-form-item v-if="filterEnabled('lastFollowUpAt')"><el-date-picker v-model="followedRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="跟进开始" end-placeholder="跟进结束" /></el-form-item>
      <el-form-item v-if="filterEnabled('nextFollowUpAt')"><el-date-picker v-model="callbackRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="回访开始" end-placeholder="回访结束" /></el-form-item>
      <el-form-item v-for="field in customFilterFields" :key="field.id">
        <el-input v-if="field.type==='TEXT'||field.type==='TEXTAREA'" v-model="customFilters[field.code]" clearable :placeholder="field.name" />
        <el-input-number v-else-if="field.type==='NUMBER'" v-model="customFilters[field.code]" :placeholder="field.name" controls-position="right" />
        <el-select v-else-if="field.type==='SINGLE'||field.type==='MULTI'" v-model="customFilters[field.code]" :multiple="field.type==='MULTI'" clearable :placeholder="field.name"><el-option v-for="option in field.options" :key="option" :label="option" :value="option" /></el-select>
        <el-date-picker v-else v-model="customFilters[field.code]" :type="field.type==='DATETIME'?'datetime':'date'" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" clearable :placeholder="field.name" />
      </el-form-item>
      <el-form-item v-if="filterEnabled('overdue')"><el-checkbox v-model="query.overdue">仅逾期未回访</el-checkbox></el-form-item>
      <el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
    </el-form>
  </section>

  <section class="content-panel">
    <div v-if="selected.length" class="bulk-bar">
      <span>已选 {{ selected.length }} 条</span>
      <el-button v-if="can('CONSULTATION_ASSIGN')" size="small" @click="openBulkAssign">批量分配</el-button>
      <el-button v-if="can('CONSULTATION_EDIT')" size="small" @click="openBulkTags('add')">添加标签</el-button>
      <el-button v-if="can('CONSULTATION_EDIT')" size="small" @click="openBulkTags('remove')">移除标签</el-button>
    </div>
    <el-table ref="formTable" class="desktop-form-table" :data="rows" v-loading="loading" row-key="id" @selection-change="selected = $event" table-layout="fixed">
      <el-table-column type="selection" width="46" fixed="left" />
      <el-table-column label="序号" width="64" align="center" fixed="left"><template #default="{$index}">{{ rowNumber($index) }}</template></el-table-column>
      <template v-for="field in visibleFields" :key="field.code">
        <el-table-column :label="field.listTitle || field.name" :min-width="field.listWidth" show-overflow-tooltip>
          <template #default="{ row }">
            <div v-if="field.code === 'tags'" class="list-tags">
              <el-tag v-for="tag in row.tags" :key="tag.id" size="small" class="tag" :color="tag.color" effect="dark">{{ tag.name }}</el-tag>
              <span v-if="!row.tags?.length">—</span>
              <el-button v-if="can('CONSULTATION_EDIT')" link type="primary" size="small" @click="openTagEditor(row)">{{ row.tags?.length ? '修改' : '添加' }}</el-button>
            </div>
            <component v-else :is="cellComponent(field.code, row)" />
          </template>
        </el-table-column>
      </template>
      <el-table-column label="操作" :width="can('CONSULTATION_DELETE') ? 280 : 232" fixed="right" align="center">
        <template #default="{ row }"><div class="row-actions"><el-button link type="primary" @click="openDetail(row.id)">详情</el-button><el-button v-if="can('CONSULTATION_EDIT')" link type="primary" @click="openEdit(row)">编辑</el-button><el-button v-if="can('CONSULTATION_FOLLOW_UP')" link type="success" @click="openFollowUp(row)">跟进</el-button><el-dropdown v-if="can('CONSULTATION_ASSIGN')" @command="(id:string)=>quickAssign(row,id)"><el-button link>转交</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="member in metadata.members" :key="member.id" :command="member.id">{{ member.nickname || member.username }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown><el-button v-if="can('CONSULTATION_DELETE')" link type="danger" @click="deleteForm(row)">删除</el-button></div></template>
      </el-table-column>
    </el-table>
    <div class="mobile-form-list" v-loading="loading" aria-label="表单列表">
      <div v-if="rows.length" class="mobile-list-toolbar"><el-checkbox :model-value="rows.length > 0 && selected.length === rows.length" :indeterminate="selected.length > 0 && selected.length < rows.length" @change="toggleCurrentPage">全选本页</el-checkbox><span>共 {{ total }} 条</span></div>
      <article v-for="(row, index) in rows" :key="row.id" class="mobile-form-card">
        <div class="mobile-card-head"><el-checkbox :model-value="selected.some(item => item.id === row.id)" :aria-label="`选择${row.name}的表单`" @change="(checked:boolean)=>toggleMobileSelection(row,checked)" /><span class="mobile-card-index">#{{ rowNumber(index) }}</span><div class="mobile-card-title"><strong>{{ row.name }}</strong><span>{{ row.phoneMasked || row.phone }}</span></div><el-tag size="small" :color="row.status?.color" effect="dark">{{ row.status?.name || '—' }}</el-tag></div>
        <div class="mobile-card-main"><strong>{{ row.project?.name || '—' }}</strong><span>{{ row.channelSource || '—' }}<template v-if="row.accountName"> · {{ row.accountName }}</template></span></div>
        <div v-if="row.tags?.length" class="mobile-card-tags"><el-tag v-for="tag in row.tags" :key="tag.id" size="small" :color="tag.color" effect="dark">{{ tag.name }}</el-tag></div>
        <div class="mobile-card-grid"><div><span>负责人</span><strong>{{ row.owner?.nickname || row.owner?.username || '—' }}</strong></div><div><span>创建时间</span><strong>{{ fmt(row.createdAt) }}</strong></div><div v-if="row.nextFollowUpAt"><span>下次回访</span><strong :class="{ overdue: row.overdue }">{{ fmt(row.nextFollowUpAt) }}</strong></div><div v-if="row.lastFollowUpAt"><span>最近跟进</span><strong>{{ fmt(row.lastFollowUpAt) }}</strong></div><div v-for="field in mobileExtraFields" :key="field.code"><span>{{ field.listTitle || field.name }}</span><strong>{{ mobileFieldValue(field.code, row) }}</strong></div></div>
        <div class="mobile-card-actions"><el-button @click="openDetail(row.id)">详情</el-button><el-button v-if="can('CONSULTATION_FOLLOW_UP')" type="primary" @click="openFollowUp(row)">跟进</el-button><el-dropdown trigger="click" @command="(command:string)=>mobileCardAction(row,command)"><el-button>更多</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="can('CONSULTATION_EDIT')" command="edit">编辑</el-dropdown-item><el-dropdown-item v-if="can('CONSULTATION_ASSIGN')" command="assign">转交</el-dropdown-item><el-dropdown-item v-if="can('CONSULTATION_DELETE')" command="delete">删除</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
      </article>
      <el-empty v-if="!loading && !rows.length" description="暂无表单" />
    </div>
    <el-pagination class="pagination" layout="prev, pager, next, sizes, total" :total="total" :current-page="query.page" :page-size="query.pageSize" :page-sizes="[10,20,50,100,200]" @current-change="(value:number)=>{query.page=value;load()}" @size-change="(value:number)=>{query.pageSize=value;query.page=1;load()}" />
    <el-pagination class="mobile-pagination" small layout="prev, pager, next" :pager-count="5" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="(value:number)=>{query.page=value;load()}" />
  </section>

  <el-dialog v-model="formDialog" :title="form.id ? '编辑网咨表单' : '手动录单'" width="820px" class="consultation-form-dialog" destroy-on-close>
    <el-form label-position="top" class="edit-grid">
      <el-form-item label="姓名" required><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="电话" required><el-input v-model="form.phone" maxlength="11" /></el-form-item>
      <el-form-item label="项目" required><el-select v-model="form.projectId" placeholder="选择推广项目" @change="onProjectChange"><el-option v-for="item in metadata.projects" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      <el-form-item label="渠道来源" required><el-select v-model="form.channelSource" placeholder="选择推广渠道" :disabled="!form.projectId" @change="onChannelChange"><el-option v-for="item in formChannels" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      <el-form-item label="账户名称" required><el-select v-model="form.promotionAccountId" filterable placeholder="选择推广账户" :disabled="!form.channelSource"><el-option v-for="item in formAccounts" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      <el-form-item label="已预约"><el-switch v-model="form.appointmentScheduled" /></el-form-item>
      <el-form-item label="收款金额（元）"><el-input-number v-model="form.paymentAmount" :min="0" :precision="2" :step="100" style="width:100%" /></el-form-item>
      <el-form-item v-if="formEnabled('status')" label="状态"><el-select v-model="form.statusId"><el-option v-for="item in activeStatuses" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      <el-form-item v-if="can('CONSULTATION_ASSIGN') && formEnabled('owner')" label="负责人"><el-select v-model="form.ownerAdminId" filterable><el-option v-for="item in metadata.members" :key="item.id" :label="item.nickname || item.username" :value="item.id" /></el-select></el-form-item>
      <el-form-item v-if="formEnabled('tags')" label="标签" class="grid-full"><el-select v-model="form.tagIds" multiple><el-option v-for="item in activeTags" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      <el-form-item v-if="formEnabled('nextFollowUpAt')" label="下次回访时间"><el-date-picker v-model="form.nextFollowUpAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" clearable /></el-form-item>
      <el-form-item v-if="selectedStatusCategory === 'INVALID'" label="无效原因" required class="grid-full"><el-input v-model="form.invalidReason" type="textarea" /></el-form-item>
      <template v-for="field in customFormFields" :key="field.id"><el-form-item :label="field.name" :required="field.required" :class="field.type==='TEXTAREA'?'grid-full':''"><el-input v-if="field.type==='TEXT'||field.type==='TEXTAREA'" v-model="form.customData[field.code]" :type="field.type==='TEXTAREA'?'textarea':'text'" /><el-input-number v-else-if="field.type==='NUMBER'" v-model="form.customData[field.code]" /><el-select v-else-if="field.type==='SINGLE'" v-model="form.customData[field.code]"><el-option v-for="option in field.options" :key="option" :label="option" :value="option" /></el-select><el-select v-else-if="field.type==='MULTI'" v-model="form.customData[field.code]" multiple><el-option v-for="option in field.options" :key="option" :label="option" :value="option" /></el-select><el-date-picker v-else v-model="form.customData[field.code]" :type="field.type==='DATETIME'?'datetime':'date'" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" /></el-form-item></template>
      <template v-if="!form.id"><el-form-item label="首次跟进记录" class="grid-full"><el-input v-model="form.firstFollowUp" type="textarea" /></el-form-item></template>
    </el-form>
    <template #footer><el-button @click="formDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveForm">保存</el-button></template>
  </el-dialog>

  <el-drawer v-model="detailDrawer" title="网咨表单详情" size="min(760px, 92vw)">
    <template v-if="detail"><el-descriptions :column="2" border><el-descriptions-item label="姓名">{{ detail.name }}</el-descriptions-item><el-descriptions-item label="电话">{{ detail.phone }}</el-descriptions-item><el-descriptions-item label="项目">{{ detail.project.name }}</el-descriptions-item><el-descriptions-item label="渠道">{{ detail.channelSource }}</el-descriptions-item><el-descriptions-item label="账户名称">{{ detail.accountName || '—' }}</el-descriptions-item><el-descriptions-item label="状态"><el-tag :color="detail.status.color" effect="dark">{{ detail.status.name }}</el-tag></el-descriptions-item><el-descriptions-item label="负责人">{{ detail.owner.nickname || detail.owner.username }}</el-descriptions-item><el-descriptions-item label="下次回访">{{ fmt(detail.nextFollowUpAt) }}</el-descriptions-item><el-descriptions-item label="标签"><el-tag v-for="tag in detail.tags" :key="tag.id" class="tag">{{ tag.name }}</el-tag></el-descriptions-item><el-descriptions-item v-for="field in customDetailFields" :key="field.id" :label="field.name">{{ displayCustomValue(detail.customData?.[field.code]) }}</el-descriptions-item></el-descriptions><h3>跟进记录</h3><el-timeline><el-timeline-item v-for="item in detail.followUps" :key="item.id" :timestamp="fmt(item.createdAt)" placement="top"><el-card shadow="never"><p>{{ item.content }}</p><small>{{ item.createdBy?.nickname || item.createdBy?.username }}<span v-if="item.resultStatus"> · {{ item.resultStatus.name }}</span></small></el-card></el-timeline-item></el-timeline><el-empty v-if="!detail.followUps?.length" description="暂无跟进记录" /></template>
  </el-drawer>

  <el-dialog v-model="followDialog" title="新增跟进记录" width="560px"><el-form label-position="top"><el-form-item label="跟进内容" required><el-input v-model="followForm.content" type="textarea" :rows="5" /></el-form-item><el-form-item label="跟进结果状态"><el-select v-model="followForm.resultStatusId" clearable><el-option v-for="item in activeStatuses" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="下次回访时间"><el-date-picker v-model="followForm.nextFollowUpAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" clearable /></el-form-item></el-form><template #footer><el-button @click="followDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveFollowUp">保存跟进</el-button></template></el-dialog>

  <el-dialog v-model="tagDialog" title="修改表单标签" width="460px">
    <el-select v-model="tagForm.tagIds" multiple filterable clearable placeholder="选择标签" class="tag-editor-select">
      <el-option v-for="item in activeTags" :key="item.id" :label="item.name" :value="item.id" />
    </el-select>
    <template #footer><el-button @click="tagDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveTags">保存标签</el-button></template>
  </el-dialog>

  <el-dialog v-model="bulkDialog" :title="bulkMode==='assign'?'批量分配负责人':(bulkMode==='add'?'批量添加标签':'批量移除标签')" width="520px"><p>已选 {{ selected.length }} 条数据，服务端会逐条校验数据范围并返回失败原因。</p><el-select v-if="bulkMode==='assign'" v-model="bulkOwnerIds" multiple filterable collapse-tags placeholder="按顺序选择网咨负责人" @change="loadAssignPreview"><el-option v-for="item in metadata.members" :key="item.id" :label="item.nickname || item.username" :value="item.id" /></el-select><el-alert v-if="bulkMode==='assign'&&assignPreview" class="assign-preview" :title="`轮流分配：${assignPreview.targets.map((item:any)=>`${item.nickname} ${item.count} 条`).join('、')}；可分配 ${assignPreview.assignable} 条，不可分配 ${assignPreview.failed} 条`" :type="assignPreview.failed?'warning':'success'" :closable="false"/><el-select v-else-if="bulkMode!=='assign'" v-model="bulkTagIds" multiple placeholder="选择标签"><el-option v-for="item in activeTags" :key="item.id" :label="item.name" :value="item.id" /></el-select><template #footer><el-button @click="bulkDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="submitBulk">确认执行</el-button></template></el-dialog>
  <el-dialog v-model="mobileAssignDialog" title="转交网咨" width="min(420px, 94vw)"><el-select v-model="mobileAssignOwnerId" filterable placeholder="选择负责人" style="width:100%"><el-option v-for="item in metadata.members" :key="item.id" :label="item.nickname || item.username" :value="item.id" /></el-select><template #footer><el-button @click="mobileAssignDialog=false">取消</el-button><el-button type="primary" :disabled="!mobileAssignOwnerId" :loading="saving" @click="submitMobileAssign">确认转交</el-button></template></el-dialog>

  <el-dialog v-model="columnDialog" title="个人列表字段偏好" width="620px"><el-table :data="columnPrefs" row-key="code"><el-table-column prop="name" label="字段" /><el-table-column label="显示" width="90"><template #default="{row}"><el-switch v-model="row.visible" /></template></el-table-column><el-table-column label="顺序" width="150"><template #default="{row,$index}"><el-button link :disabled="$index===0" @click="moveColumn($index,-1)">上移</el-button><el-button link :disabled="$index===columnPrefs.length-1" @click="moveColumn($index,1)">下移</el-button></template></el-table-column><el-table-column label="列宽" width="150"><template #default="{row}"><el-input-number v-model="row.width" :min="60" :max="600" controls-position="right" /></template></el-table-column></el-table><template #footer><el-button @click="columnDialog=false">取消</el-button><el-button type="primary" @click="saveColumns">保存本人偏好</el-button></template></el-dialog>

  <el-dialog v-model="importDialog" title="批量导入网咨数据" width="900px"><div class="import-actions"><el-button @click="downloadConsultationTemplate">下载标准模板</el-button><el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx" :on-change="validateFile"><el-button type="primary" :loading="importing">选择并校验 Excel</el-button></el-upload></div><template v-if="importResult"><el-alert :title="`共 ${importResult.totalCount} 条，可导入 ${importResult.validCount} 条，失败 ${importResult.failedCount} 条，重复 ${importResult.duplicateCount} 条`" :type="importResult.failedCount?'warning':'success'" :closable="false" /><el-table :data="importResult.preview.slice(0,50)" max-height="360"><el-table-column prop="rowNumber" label="行" width="60"/><el-table-column prop="name" label="姓名"/><el-table-column prop="phoneMasked" label="电话"/><el-table-column prop="project" label="项目"/><el-table-column prop="latestFollowUp" label="最新跟进记录" min-width="180" show-overflow-tooltip /><el-table-column prop="valid" label="校验" width="80"><template #default="{row}"><el-tag :type="row.valid?'success':'danger'">{{row.valid?'通过':'失败'}}</el-tag></template></el-table-column></el-table><el-form-item label="重复手机号处理"><el-radio-group v-model="duplicateMode"><el-radio value="SKIP">跳过</el-radio><el-radio value="CREATE">仍创建新表单</el-radio><el-radio value="FOLLOW_UP">向原表单追加首次跟进</el-radio></el-radio-group></el-form-item><el-button v-if="importResult.failedCount" @click="downloadConsultationImportErrors(importResult.batchId)">下载错误明细</el-button></template><template #footer><el-button @click="importDialog=false">关闭</el-button><el-button v-if="importResult" type="primary" :loading="importing" @click="commitImport">导入有效行</el-button></template></el-dialog>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus';
import { useAuthStore } from '../stores/auth';
import { addConsultationFollowUp, assignConsultation, bulkAddConsultationTags, bulkAssignConsultations, bulkRemoveConsultationTags, commitConsultationImport, createConsultation, deleteConsultation, downloadConsultationImportErrors, downloadConsultationTemplate, exportConsultations, getConsultation, getConsultationMetadata, getConsultations, previewBulkAssignConsultations, saveConsultationListPreference, updateConsultation, validateConsultationImport, type ConsultationFormItem, type ConsultationMetadata } from '../api/admin';
const auth=useAuthStore(); const can=(p:string)=>auth.hasPermission(p);
const emptyMeta=():ConsultationMetadata=>({projects:[],promotionAccounts:[],statuses:[],tags:[],fields:[],members:[],preference:null});
const metadata=reactive<ConsultationMetadata>(emptyMeta()); const rows=ref<ConsultationFormItem[]>([]); const total=ref(0); const loading=ref(false); const saving=ref(false); const exporting=ref(false); const selected=ref<ConsultationFormItem[]>([]); const createdRange=ref<string[]>([]); const followedRange=ref<string[]>([]); const callbackRange=ref<string[]>([]); const customFilters=reactive<Record<string,any>>({});
const formTable=ref<any>(null); const mobileFiltersOpen=ref(false); const mobileAssignDialog=ref(false); const mobileAssignRow=ref<ConsultationFormItem|null>(null); const mobileAssignOwnerId=ref('');
const query=reactive<any>({keyword:'',projectId:'',promotionAccountId:'',channelSource:'',statusIds:[],tagIds:[],ownerAdminId:'',overdue:false,page:1,pageSize:20});
const formDialog=ref(false); const detailDrawer=ref(false); const followDialog=ref(false); const tagDialog=ref(false); const bulkDialog=ref(false); const columnDialog=ref(false); const importDialog=ref(false); const detail=ref<ConsultationFormItem|null>(null);
const blankForm=()=>({id:'',name:'',phone:'',projectId:'',channelSource:'',promotionAccountId:'',appointmentScheduled:false,paymentAmount:0,statusId:'',ownerAdminId:'',tagIds:[] as string[],nextFollowUpAt:'',invalidReason:'',customData:{} as Record<string,any>,firstFollowUp:''}); const form=reactive(blankForm());
const followForm=reactive({id:'',content:'',resultStatusId:'',nextFollowUpAt:''}); const bulkMode=ref<'assign'|'add'|'remove'>('assign'); const bulkOwnerIds=ref<string[]>([]); const bulkTagIds=ref<string[]>([]); const assignPreview=ref<any>(null); const columnPrefs=ref<any[]>([]); const importResult=ref<any>(null); const importing=ref(false); const duplicateMode=ref<'SKIP'|'CREATE'|'FOLLOW_UP'>('SKIP');
const tagForm=reactive<{id:string;tagIds:string[]}>({id:'',tagIds:[]});
const activeStatuses=computed(()=>metadata.statuses.filter(i=>i.enabled)); const activeTags=computed(()=>metadata.tags.filter(i=>i.enabled)); const customFormFields=computed(()=>metadata.fields.filter(i=>i.source==='CUSTOM'&&i.enabled&&i.showInForm)); const customFilterFields=computed(()=>metadata.fields.filter(i=>i.source==='CUSTOM'&&i.enabled&&i.filterable)); const customDetailFields=computed(()=>metadata.fields.filter(i=>i.source==='CUSTOM'&&i.enabled&&i.showInDetail)); const selectedStatusCategory=computed(()=>metadata.statuses.find(i=>i.id===form.statusId)?.category);
const allChannels=computed(()=>[...new Set(metadata.promotionAccounts.map(i=>i.channel))]);
const formChannels=computed(()=>[...new Set(metadata.promotionAccounts.filter(i=>i.project===form.projectId).map(i=>i.channel))]);
const formAccounts=computed(()=>metadata.promotionAccounts.filter(i=>i.project===form.projectId&&i.channel===form.channelSource));
const filterEnabled=(code:string)=>metadata.fields.some((field)=>field.code===code&&field.enabled&&field.filterable);
const formEnabled=(code:string)=>metadata.fields.some((field)=>field.code===code&&field.enabled&&field.showInForm);
const visibleFields=computed(()=>{const prefs=new Map(columnPrefs.value.map(i=>[i.code,i]));return metadata.fields.filter(i=>i.enabled&&i.showInList&&(prefs.has(i.code)?prefs.get(i.code).visible:true)).map(i=>({...i,listOrder:prefs.get(i.code)?.order??i.listOrder,listWidth:prefs.get(i.code)?.width??i.listWidth})).sort((a,b)=>a.listOrder-b.listOrder)});
const mobileExtraFields=computed(()=>visibleFields.value.filter(field=>!['name','phone','project','channelSource','accountName','status','tags','owner','createdAt','lastFollowUpAt','nextFollowUpAt'].includes(field.code)));
const activeFilterCount=computed(()=>[query.keyword,query.projectId,query.promotionAccountId,query.channelSource,query.ownerAdminId,query.overdue,query.statusIds.length,query.tagIds.length,createdRange.value?.length,followedRange.value?.length,callbackRange.value?.length,...Object.values(customFilters)].filter(value=>Array.isArray(value)?value.length:Boolean(value)).length);
const rowNumber=(index:number)=>(query.page-1)*query.pageSize+index+1;
function mobileFieldValue(code:string,row:ConsultationFormItem){let value:any;if(code==='overdue')value=row.overdue?'已逾期':'否';else if(code==='createdBy')value=row.createdBy?.nickname||row.createdBy?.username;else if(code==='lastFollowUpContent')value=row.lastFollowUpContent;else if(['recordedAt','updatedAt'].includes(code))value=fmt(row[code as 'recordedAt'|'updatedAt']);else value=row.customData?.[code];return Array.isArray(value)?value.join('、'):(value??'—')}
function cellComponent(code:string,row:any){let value:any='—';if(code==='name')value=row.name;else if(code==='phone')value=row.phone;else if(code==='project')value=row.project?.name;else if(code==='channelSource')value=row.channelSource;else if(code==='accountName')value=row.accountName;else if(code==='status')return{render:()=>h('span',{class:'status-pill',style:{background:row.status?.color}},row.status?.name)};else if(code==='tags')value=(row.tags||[]).map((i:any)=>i.name).join('、');else if(code==='owner')value=row.owner?.nickname||row.owner?.username;else if(code==='overdue')value=row.overdue?'已逾期':'否';else if(['recordedAt','lastFollowUpAt','nextFollowUpAt','createdAt','updatedAt'].includes(code))value=fmt(row[code]);else if(code==='createdBy')value=row.createdBy?.nickname||row.createdBy?.username;else if(code==='lastFollowUpContent')value=row.lastFollowUpContent;else value=row.customData?.[code];return{render:()=>h('span',Array.isArray(value)?value.join('、'):(value??'—'))}}
async function loadMeta(){Object.assign(metadata,await getConsultationMetadata());columnPrefs.value=metadata.fields.filter(i=>i.enabled&&i.showInList).map(i=>({code:i.code,name:i.listTitle||i.name,visible:metadata.preference?.find(p=>p.code===i.code)?.visible??true,order:metadata.preference?.find(p=>p.code===i.code)?.order??i.listOrder,width:metadata.preference?.find(p=>p.code===i.code)?.width??i.listWidth})).sort((a,b)=>a.order-b.order)}
function requestParams(){const filters=Object.fromEntries(Object.entries(customFilters).filter(([code,value])=>filterEnabled(code)&&value!==''&&value!==null&&value!==undefined&&(!Array.isArray(value)||value.length)));return{...query,projectId:filterEnabled('project')?query.projectId:undefined,promotionAccountId:filterEnabled('accountName')?query.promotionAccountId:undefined,channelSource:filterEnabled('channelSource')?query.channelSource:undefined,statusIds:filterEnabled('status')?query.statusIds:undefined,tagIds:filterEnabled('tags')?query.tagIds:undefined,ownerAdminId:filterEnabled('owner')?query.ownerAdminId:undefined,overdue:filterEnabled('overdue')?query.overdue:undefined,createdFrom:filterEnabled('createdAt')?createdRange.value?.[0]:undefined,createdTo:filterEnabled('createdAt')?createdRange.value?.[1]:undefined,followedFrom:filterEnabled('lastFollowUpAt')?followedRange.value?.[0]:undefined,followedTo:filterEnabled('lastFollowUpAt')?followedRange.value?.[1]:undefined,callbackFrom:filterEnabled('nextFollowUpAt')?callbackRange.value?.[0]:undefined,callbackTo:filterEnabled('nextFollowUpAt')?callbackRange.value?.[1]:undefined,customFilters:Object.keys(filters).length?JSON.stringify(filters):undefined}}
async function load(){loading.value=true;try{const result=await getConsultations(requestParams());rows.value=result.list;total.value=result.total}finally{loading.value=false}}
function search(){query.page=1;mobileFiltersOpen.value=false;load()} function reset(){Object.assign(query,{keyword:'',projectId:'',promotionAccountId:'',channelSource:'',statusIds:[],tagIds:[],ownerAdminId:'',overdue:false,page:1});createdRange.value=[];followedRange.value=[];callbackRange.value=[];for(const key of Object.keys(customFilters))delete customFilters[key];mobileFiltersOpen.value=false;load()}
async function openCreate(){await loadMeta();Object.assign(form,blankForm(),{statusId:activeStatuses.value.find(i=>i.code==='PENDING')?.id||'',ownerAdminId:auth.user?.id||''});formDialog.value=true}
async function deleteForm(row:ConsultationFormItem){await ElMessageBox.confirm(`彻底删除“${row.name}”的表单及跟进、标签记录？此操作无法撤销。`,'删除表单',{type:'warning',confirmButtonText:'彻底删除'});await deleteConsultation(row.id);ElMessage.success('已删除');await load()}
function openTagEditor(row:ConsultationFormItem){Object.assign(tagForm,{id:row.id,tagIds:row.tags.map(tag=>tag.id)});tagDialog.value=true}
async function saveTags(){saving.value=true;try{await updateConsultation(tagForm.id,{tagIds:tagForm.tagIds});tagDialog.value=false;ElMessage.success('表单标签已更新');await load()}finally{saving.value=false}}
function onProjectChange(){form.channelSource='';form.promotionAccountId=''}
function onChannelChange(){form.promotionAccountId=''}
async function openEdit(row:ConsultationFormItem){const current=await getConsultation(row.id);Object.assign(form,blankForm(),{id:current.id,name:current.name,phone:'',projectId:current.projectId,channelSource:current.channelSource,promotionAccountId:current.promotionAccountId||'',appointmentScheduled:current.appointmentScheduled,paymentAmount:current.paymentAmount,statusId:current.statusId,ownerAdminId:current.ownerAdminId,tagIds:current.tags.map(i=>i.id),nextFollowUpAt:current.nextFollowUpAt||'',invalidReason:current.invalidReason||'',customData:{...(current.customData||{})}});formDialog.value=true}
async function saveForm(){if(!form.name||(!form.id&&!/^1\d{10}$/.test(form.phone))||!form.projectId||!form.channelSource||!form.promotionAccountId)return ElMessage.warning('请完整填写姓名、电话、项目、渠道来源和账户名称');saving.value=true;try{const payload:any={...form};payload.nextFollowUpAt=form.nextFollowUpAt||null;if(form.id&&!form.phone)delete payload.phone;if(!can('CONSULTATION_ASSIGN'))delete payload.ownerAdminId;delete payload.id;if(form.id)await updateConsultation(form.id,payload);else await createConsultation(payload);formDialog.value=false;ElMessage.success('网咨表单已保存');await load()}catch(error:any){if(error?.response?.status===409){const reason=await ElMessageBox.prompt('手机号已有未完结表单。如仍需创建，请填写重复创建原因。','重复手机号',{confirmButtonText:'仍创建',cancelButtonText:'取消',inputValidator:(v)=>Boolean(v?.trim())||'请填写原因'}).catch(()=>null);if(reason){const payload:any={...form,id:undefined,forceDuplicate:true,duplicateReason:reason.value,nextFollowUpAt:form.nextFollowUpAt||null};if(!can('CONSULTATION_ASSIGN'))delete payload.ownerAdminId;await createConsultation(payload);formDialog.value=false;await load()}}}finally{saving.value=false}}
async function openDetail(id:string){detailDrawer.value=true;detail.value=await getConsultation(id)} function openFollowUp(row:ConsultationFormItem){Object.assign(followForm,{id:row.id,content:'',resultStatusId:'',nextFollowUpAt:row.nextFollowUpAt||''});followDialog.value=true}
async function saveFollowUp(){if(!followForm.content.trim())return ElMessage.warning('请填写跟进内容');saving.value=true;try{await addConsultationFollowUp(followForm.id,{content:followForm.content,resultStatusId:followForm.resultStatusId||undefined,nextFollowUpAt:followForm.nextFollowUpAt||null});followDialog.value=false;ElMessage.success('跟进记录已保存');await load()}finally{saving.value=false}}
async function quickAssign(row:ConsultationFormItem,ownerAdminId:string){await assignConsultation(row.id,{ownerAdminId});ElMessage.success('负责人已更新');load()}
function toggleMobileSelection(row:ConsultationFormItem,checked:boolean){formTable.value?.toggleRowSelection(row,checked)}
function toggleCurrentPage(){formTable.value?.toggleAllSelection()}
function mobileCardAction(row:ConsultationFormItem,command:string){if(command==='edit')void openEdit(row);else if(command==='delete')void deleteForm(row);else if(command==='assign'){mobileAssignRow.value=row;mobileAssignOwnerId.value=row.ownerAdminId;mobileAssignDialog.value=true}}
async function submitMobileAssign(){if(!mobileAssignRow.value||!mobileAssignOwnerId.value)return;saving.value=true;try{await quickAssign(mobileAssignRow.value,mobileAssignOwnerId.value);mobileAssignDialog.value=false}finally{saving.value=false}}
function openBulkAssign(){bulkMode.value='assign';bulkOwnerIds.value=[];assignPreview.value=null;bulkDialog.value=true} function openBulkTags(mode:'add'|'remove'){bulkMode.value=mode;bulkTagIds.value=[];bulkDialog.value=true}
async function loadAssignPreview(){assignPreview.value=bulkOwnerIds.value.length?await previewBulkAssignConsultations({ids:selected.value.map(i=>i.id),ownerAdminIds:bulkOwnerIds.value}):null}
async function submitBulk(){saving.value=true;try{const ids=selected.value.map(i=>i.id);if(bulkMode.value==='assign'){if(!bulkOwnerIds.value.length)return ElMessage.warning('请选择负责人');const result:any=await bulkAssignConsultations({ids,ownerAdminIds:bulkOwnerIds.value});ElMessage.success(`成功 ${result.success} 条，失败 ${result.failed} 条`)}else{if(!bulkTagIds.value.length)return ElMessage.warning('请选择标签');await(bulkMode.value==='add'?bulkAddConsultationTags:bulkRemoveConsultationTags)({ids,tagIds:bulkTagIds.value});ElMessage.success('批量标签操作完成')}bulkDialog.value=false;await load()}finally{saving.value=false}}
function moveColumn(index:number,direction:number){const next=index+direction;if(next<0||next>=columnPrefs.value.length)return;const rows=[...columnPrefs.value];[rows[index],rows[next]]=[rows[next],rows[index]];columnPrefs.value=rows.map((row,order)=>({...row,order}));}
async function saveColumns(){columnPrefs.value=columnPrefs.value.map((row,order)=>({...row,order}));await saveConsultationListPreference(columnPrefs.value.map(i=>({code:i.code,visible:i.visible,order:i.order,width:i.width})));columnDialog.value=false;ElMessage.success('列表偏好已按当前登录账号保存')}
async function doExport(){exporting.value=true;try{await exportConsultations(requestParams())}finally{exporting.value=false}}
async function validateFile(file:UploadFile){if(!file.raw)return;importing.value=true;try{importResult.value=await validateConsultationImport(file.raw)}finally{importing.value=false}}
async function commitImport(){importing.value=true;try{const result:any=await commitConsultationImport(importResult.value.batchId,duplicateMode.value);ElMessage.success(`导入成功 ${result.success} 条，失败 ${result.failed} 条`);importDialog.value=false;await load()}finally{importing.value=false}}
function fmt(value?:string){return value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—'}
function displayCustomValue(value:any){return Array.isArray(value)?value.join('、'):(value??'—')}
onMounted(async()=>{await loadMeta();await load()});
</script>

<style scoped>
.page-heading{display:flex;justify-content:space-between;gap:16px;margin-bottom:16px}.page-heading p{margin:4px 0 0;color:var(--admin-text-muted)}.heading-actions,.bulk-bar,.import-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.filter-panel{margin-bottom:14px}.filters :deep(.el-form-item){margin-bottom:8px}.filters :deep(.el-input),.filters :deep(.el-select){width:180px}.filters :deep(.el-date-editor){width:260px}.bulk-bar{padding:10px 12px;margin-bottom:10px;border-radius:8px;background:#e8f2ff}.pagination{justify-content:flex-end;margin-top:16px}.row-actions{display:flex;align-items:center;gap:4px;justify-content:center;white-space:nowrap;line-height:1}.row-actions :deep(.el-button){flex:0 0 auto;margin:0;padding:4px 3px}.row-actions :deep(.el-dropdown){display:inline-flex;flex:0 0 auto;vertical-align:middle}.edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.edit-grid :deep(.el-select),.edit-grid :deep(.el-date-editor){width:100%}.grid-full{grid-column:1/-1}.status-pill{display:inline-flex;padding:3px 8px;border-radius:12px;color:#fff}.tag{margin-right:4px;color:#fff;border:0;white-space:nowrap}.tag :deep(.el-tag__content){white-space:nowrap}.list-tags{display:flex;align-items:center;gap:4px;flex-wrap:nowrap;overflow:hidden}.list-tags .tag{flex:none;max-width:none}.list-tags :deep(.el-button){flex:none;white-space:nowrap;margin:0}.tag-editor-select{width:100%}.import-actions{margin-bottom:14px}.assign-preview{margin-top:12px}:global(.consultation-form-dialog){display:flex;flex-direction:column;max-height:67vh}:global(.consultation-form-dialog .el-dialog__body){min-height:0;overflow-y:auto}:global(.consultation-form-dialog .el-dialog__header),:global(.consultation-form-dialog .el-dialog__footer){flex:none}@media(max-width:760px){.page-heading{flex-direction:column}.edit-grid{grid-template-columns:1fr}.grid-full{grid-column:auto}.filters{display:grid}.filters :deep(.el-form-item),.filters :deep(.el-input),.filters :deep(.el-select),.filters :deep(.el-date-editor){width:100%;margin-right:0}.heading-actions>*{flex:1}}
</style>
<style scoped>
.mobile-filter-toggle,.mobile-form-list,.mobile-pagination,.mobile-refresh{display:none}
.overdue{color:#c45656}
@media(max-width:760px){
  .page-heading{gap:10px}
  .mobile-title-row{display:flex;align-items:center;justify-content:space-between;width:100%;gap:12px}
  .mobile-refresh{display:inline-flex;flex:none;min-height:40px;padding:0 16px;white-space:nowrap}
  .heading-actions{display:flex;flex-wrap:nowrap;width:100%;gap:6px}
  .heading-actions>*{flex:1 1 0;min-width:0;margin:0}
  .heading-actions :deep(.el-button){width:100%;min-width:0;min-height:42px;padding:0 3px;white-space:nowrap;font-size:clamp(11px,3vw,13px);line-height:1}
  .filter-panel{padding:0!important;overflow:hidden}
  .mobile-filter-toggle{display:flex;width:100%;min-height:48px;align-items:center;justify-content:space-between;padding:0 16px;border:0;background:transparent;color:var(--admin-text);font:inherit;font-weight:600;cursor:pointer}
  .filter-panel .filters{display:none;padding:4px 14px 14px}
  .filter-panel .filters.mobile-open{display:grid;grid-template-columns:minmax(0,1fr);gap:2px}
  .filter-panel .filters :deep(.el-form-item){min-width:0;margin:0 0 8px}
  .filter-panel .filters :deep(.el-form-item__content){width:100%;min-width:0}
  .filter-panel .filters :deep(.el-input),.filter-panel .filters :deep(.el-select),.filter-panel .filters :deep(.el-date-editor),.filter-panel .filters :deep(.el-input-number){width:100%;max-width:100%}
  .desktop-form-table,.pagination{display:none}
  .mobile-form-list{display:grid;gap:10px;min-width:0}
  .mobile-list-toolbar{display:flex;justify-content:space-between;align-items:center;min-height:40px;padding:0 2px;color:var(--admin-text-muted);font-size:13px}
  .mobile-form-card{min-width:0;padding:14px;border:1px solid var(--admin-border);border-radius:14px;background:#fff;box-shadow:0 2px 8px rgba(18,45,80,.04)}
  .mobile-card-head{display:flex;align-items:center;gap:10px;min-width:0}
  .mobile-card-head :deep(.el-checkbox){flex:none;margin-right:0;min-height:36px}
  .mobile-card-head :deep(.el-checkbox__inner){width:18px;height:18px}
  .mobile-card-index{flex:none;color:var(--admin-text-muted);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
  .mobile-card-title{display:flex;align-items:baseline;gap:8px;min-width:0;flex:1;flex-wrap:wrap}
  .mobile-card-title strong{font-size:16px;line-height:1.3;overflow-wrap:anywhere}
  .mobile-card-title span{color:var(--admin-text-muted);font-size:13px;white-space:nowrap}
  .mobile-card-head :deep(.el-tag){flex:none;max-width:38%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mobile-card-main{display:flex;flex-direction:column;gap:3px;margin:10px 0 0;min-width:0}
  .mobile-card-main strong{font-size:14px;overflow-wrap:anywhere}
  .mobile-card-main span{font-size:13px;color:var(--admin-text-muted);overflow-wrap:anywhere}
  .mobile-card-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
  .mobile-card-tags :deep(.el-tag){max-width:100%;height:auto;min-height:24px;white-space:normal;overflow-wrap:anywhere}
  .mobile-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;margin-top:12px;padding:12px 0;border-top:1px solid var(--admin-border);font-size:12px}
  .mobile-card-grid>div{display:grid;min-width:0;gap:3px}
  .mobile-card-grid span{color:var(--admin-text-muted)}
  .mobile-card-grid strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}
  .mobile-card-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .mobile-card-actions :deep(.el-button),.mobile-card-actions :deep(.el-dropdown){width:100%;min-width:0;margin:0}
  .mobile-card-actions :deep(.el-button){min-height:42px}
  .mobile-pagination{display:flex;justify-content:center;margin-top:14px;max-width:100%;overflow-x:auto}
  .bulk-bar{position:sticky;bottom:8px;z-index:2;box-shadow:0 5px 18px rgba(18,45,80,.15)}
}
@media(max-width:420px){
  .heading-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
  .mobile-card-head{gap:7px}
  .mobile-card-head :deep(.el-tag){max-width:34%}
}
</style>
