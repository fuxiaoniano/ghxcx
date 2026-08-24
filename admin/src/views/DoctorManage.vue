<template>
  <div class="page-heading"><div><h1 class="page-title">医生与出诊</h1><p>维护医生资料、多科室归属和未来 14 天上午/下午出诊名额</p></div></div>
  <div class="content-panel">
    <div class="toolbar"><el-select v-model="departmentFilter" clearable placeholder="筛选科室"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-button type="primary" @click="editDoctor()">新增医生</el-button></div>
    <el-table :data="filteredDoctors">
      <el-table-column label="头像" width="76"><template #default="{row}"><el-avatar :src="row.avatar" shape="square" /></template></el-table-column>
      <el-table-column prop="name" label="姓名" width="100" /><el-table-column prop="title" label="职称" width="120" />
      <el-table-column label="关联科室" min-width="180"><template #default="{row}"><el-tag v-for="item in doctorDepartments(row)" :key="item.id" size="small" class="department-tag">{{item.name}}</el-tag></template></el-table-column>
      <el-table-column prop="displayText" label="列表展示文案" min-width="150" show-overflow-tooltip /><el-table-column prop="clinic.name" label="出诊院区" min-width="130" />
      <el-table-column prop="specialty" label="擅长" min-width="180" show-overflow-tooltip />
      <el-table-column label="推荐" width="74"><template #default="{row}"><el-tag :type="row.recommend?'warning':'info'">{{row.recommend?'推荐':'普通'}}</el-tag></template></el-table-column><el-table-column prop="sort" label="排序" width="64" />
      <el-table-column label="状态" width="74"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{row.status==='ACTIVE'?'启用':'停用'}}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="210" fixed="right"><template #default="{row}"><el-button text type="primary" @click="editDoctor(row)">编辑</el-button><el-button text @click="manageSchedule(row)">出诊</el-button><el-button text type="danger" @click="removeDoctor(row)">删除</el-button></template></el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="doctorDialog" :title="doctorForm.id?'编辑医生':'新增医生'" width="780px">
    <el-form label-width="110px">
      <div class="form-grid"><el-form-item label="姓名" required><el-input v-model="doctorForm.name" /></el-form-item><el-form-item label="职称" required><el-input v-model="doctorForm.title" /></el-form-item></div>
      <el-form-item label="关联科室" required><el-select v-model="doctorForm.departmentIds" multiple collapse-tags collapse-tags-tooltip style="width:100%"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      <div class="form-grid"><el-form-item label="出诊院区"><el-select v-model="doctorForm.clinicId" clearable style="width:100%"><el-option v-for="item in clinics" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="列表展示文案"><el-input v-model="doctorForm.displayText" maxlength="120" placeholder="替代原院区位置，例如：数字化种植专家" /></el-form-item></div>
      <el-form-item label="头像" required><MediaPicker v-model="doctorForm.avatar" ratio-hint="1:1，建议 600×600 像素" /></el-form-item>
      <el-form-item label="擅长" required><el-input v-model="doctorForm.specialty" type="textarea" :rows="3" /><div class="field-tip">小程序医生列表最多展示 2 行，详细内容可在详情页查看。</div></el-form-item>
      <el-form-item label="医生简介" required><el-input v-model="doctorForm.description" type="textarea" :rows="5" /></el-form-item>
      <el-form-item label="医生照片"><el-input v-model="doctorForm.imagesText" type="textarea" :rows="3" placeholder="每行一个图片库地址" /></el-form-item>
      <div class="form-grid"><el-form-item label="排序"><el-input-number v-model="doctorForm.sort" /></el-form-item><el-form-item label="首页推荐"><el-switch v-model="doctorForm.recommend" /></el-form-item><el-form-item label="对外展示"><el-switch v-model="doctorForm.active" active-text="启用" /></el-form-item></div>
    </el-form>
    <template #footer><el-button @click="doctorDialog=false">取消</el-button><el-button type="primary" @click="saveDoctor">保存</el-button></template>
  </el-dialog>

  <el-drawer v-model="scheduleDrawer" :title="`${currentDoctor?.name||''} · 出诊管理`" size="760px">
    <el-alert title="系统会默认补齐包含今天在内未来 14 天的上午、下午时段；可在这里调整名额、院区或停用指定时段。" type="info" :closable="false" />
    <el-button type="primary" class="schedule-add" @click="editSchedule()">新增出诊</el-button>
    <el-table :data="schedules"><el-table-column prop="date" label="日期" width="130" /><el-table-column prop="timeSlot" label="时段" width="80" /><el-table-column prop="clinic.name" label="院区" min-width="120" /><el-table-column label="名额" width="90"><template #default="{row}">{{row.bookedCount}} / {{row.capacity}}</template></el-table-column><el-table-column label="状态" width="86"><template #default="{row}">{{scheduleStatus(row.status)}}</template></el-table-column><el-table-column label="操作" width="130"><template #default="{row}"><el-button text type="primary" @click="editSchedule(row)">编辑</el-button><el-button text type="danger" @click="removeSchedule(row)">删除</el-button></template></el-table-column></el-table>
  </el-drawer>
  <el-dialog v-model="scheduleDialog" :title="scheduleForm.id?'编辑出诊':'新增出诊'" width="520px">
    <el-form label-width="90px"><el-form-item label="日期" required><el-date-picker v-model="scheduleForm.date" value-format="YYYY-MM-DD" /></el-form-item><el-form-item label="预约时段" required><el-select v-model="scheduleForm.timeSlot"><el-option label="上午" value="上午" /><el-option label="下午" value="下午" /></el-select></el-form-item><el-form-item label="出诊院区"><el-select v-model="scheduleForm.clinicId" clearable><el-option v-for="item in clinics" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="预约名额"><el-input-number v-model="scheduleForm.capacity" :min="1" :max="1000" /></el-form-item><el-form-item label="状态"><el-select v-model="scheduleForm.status"><el-option label="可预约" value="AVAILABLE" /><el-option label="已约满" value="FULL" /><el-option label="停用" value="DISABLED" /></el-select></el-form-item></el-form>
    <template #footer><el-button @click="scheduleDialog=false">取消</el-button><el-button type="primary" @click="saveSchedule">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed,onMounted,reactive,ref } from 'vue';
import { ElMessage,ElMessageBox } from 'element-plus';
import { ClinicItem,DentalCategoryItem,DoctorItem,DoctorScheduleItem,createDoctorAdmin,createDoctorSchedule,deleteDoctorAdmin,deleteDoctorSchedule,getDentalCategories,getDoctorSchedules,getDoctorsAdmin,getEnterpriseClinics,updateDoctorAdmin,updateDoctorSchedule } from '../api/admin';
import MediaPicker from '../components/MediaPicker.vue';

const doctors=ref<DoctorItem[]>([]),categories=ref<DentalCategoryItem[]>([]),clinics=ref<ClinicItem[]>([]),schedules=ref<DoctorScheduleItem[]>([]);const departmentFilter=ref('');
const doctorDepartments=(row:DoctorItem)=>row.departments?.length?row.departments:(row.department?[row.department]:[]);
const filteredDoctors=computed(()=>departmentFilter.value?doctors.value.filter(item=>doctorDepartments(item).some(department=>department.id===departmentFilter.value)):doctors.value);
const doctorDialog=ref(false),scheduleDrawer=ref(false),scheduleDialog=ref(false),currentDoctor=ref<DoctorItem|null>(null);
const doctorForm=reactive({id:'',name:'',avatar:'',title:'',displayText:'',departmentIds:[] as string[],clinicId:'',specialty:'',description:'',imagesText:'',sort:0,recommend:false,active:true});
const scheduleForm=reactive({id:'',doctorId:'',clinicId:'',date:'',timeSlot:'上午',capacity:20,sort:0,status:'AVAILABLE'});
async function load(){[doctors.value,categories.value,clinics.value]=await Promise.all([getDoctorsAdmin(),getDentalCategories(),getEnterpriseClinics()]);}
function editDoctor(row?:DoctorItem){const departmentIds=row?doctorDepartments(row).map(item=>item.id):[categories.value[0]?.id].filter(Boolean);Object.assign(doctorForm,{id:row?.id||'',name:row?.name||'',avatar:row?.avatar||'',title:row?.title||'',displayText:row?.displayText||'',departmentIds,clinicId:row?.clinicId||'',specialty:row?.specialty||'',description:row?.description||'',imagesText:(row?.images||[]).join('\n'),sort:row?.sort||0,recommend:row?.recommend||false,active:row?.status!=='DISABLED'});doctorDialog.value=true;}
async function saveDoctor(){if(!doctorForm.name||!doctorForm.avatar||!doctorForm.title||!doctorForm.departmentIds.length||!doctorForm.specialty||!doctorForm.description)return ElMessage.warning('请完整填写医生必填资料');const data={...doctorForm,departmentId:doctorForm.departmentIds[0],images:doctorForm.imagesText.split(/\r?\n/).map(v=>v.trim()).filter(Boolean),status:doctorForm.active?'ACTIVE':'DISABLED'} as any;doctorForm.id?await updateDoctorAdmin(doctorForm.id,data):await createDoctorAdmin(data);doctorDialog.value=false;await load();}
async function removeDoctor(row:DoctorItem){await ElMessageBox.confirm('已有预约引用时将自动停用医生。','删除确认',{type:'warning'});await deleteDoctorAdmin(row.id);await load();}
async function manageSchedule(row:DoctorItem){currentDoctor.value=row;schedules.value=await getDoctorSchedules(row.id);scheduleDrawer.value=true;}
function editSchedule(row?:DoctorScheduleItem){Object.assign(scheduleForm,{id:row?.id||'',doctorId:currentDoctor.value?.id||'',clinicId:row?.clinicId||currentDoctor.value?.clinicId||'',date:row?.date?.slice(0,10)||'',timeSlot:row?.timeSlot==='下午'?'下午':'上午',capacity:row?.capacity||20,sort:row?.sort||0,status:row?.status||'AVAILABLE'});scheduleDialog.value=true;}
async function saveSchedule(){if(!scheduleForm.doctorId||!scheduleForm.date||!scheduleForm.timeSlot)return ElMessage.warning('请填写日期和时段');const data={...scheduleForm} as Partial<DoctorScheduleItem>;scheduleForm.id?await updateDoctorSchedule(scheduleForm.id,data):await createDoctorSchedule(data);scheduleDialog.value=false;schedules.value=await getDoctorSchedules(scheduleForm.doctorId);}
async function removeSchedule(row:DoctorScheduleItem){await ElMessageBox.confirm('确认删除该出诊时段？重新访问医生详情时，系统可能按默认规则补齐该时段；如需长期关闭请改为“停用”。','删除确认',{type:'warning'});await deleteDoctorSchedule(row.id);schedules.value=await getDoctorSchedules(row.doctorId);}
const scheduleStatus=(status:string)=>({AVAILABLE:'可预约',FULL:'已约满',DISABLED:'停用'}[status]||status);
onMounted(load);
</script>

<style scoped>.page-heading p{margin:0 0 18px;color:var(--admin-text-secondary)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.department-tag{margin:2px 5px 2px 0}.field-tip{margin-top:6px;color:var(--admin-text-muted);font-size:12px}.schedule-add{margin:16px 0}@media(max-width:700px){.form-grid{grid-template-columns:1fr}}</style>
