<template>
  <div class="page-heading"><div><h1 class="page-title">医生管理</h1><p>维护医生资料、推荐状态、照片和出诊时段</p></div></div>
  <div class="content-panel">
    <div class="toolbar"><el-select v-model="departmentFilter" clearable placeholder="筛选科室"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-button type="primary" @click="editDoctor()">新增医生</el-button></div>
    <el-table :data="filteredDoctors">
      <el-table-column label="头像" width="80"><template #default="{row}"><el-avatar :src="row.avatar" shape="square" /></template></el-table-column>
      <el-table-column prop="name" label="姓名" width="110" /><el-table-column prop="title" label="职称" /><el-table-column prop="department.name" label="科室" /><el-table-column prop="clinic.name" label="医院" /><el-table-column prop="specialty" label="擅长" show-overflow-tooltip />
      <el-table-column label="推荐" width="80"><template #default="{row}"><el-tag :type="row.recommend?'warning':'info'">{{row.recommend?'推荐':'普通'}}</el-tag></template></el-table-column><el-table-column prop="sort" label="排序" width="70" />
      <el-table-column label="状态" width="80"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{row.status==='ACTIVE'?'启用':'停用'}}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="230"><template #default="{row}"><el-button text type="primary" @click="editDoctor(row)">编辑</el-button><el-button text @click="manageSchedule(row)">出诊</el-button><el-button text type="danger" @click="removeDoctor(row)">删除</el-button></template></el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="doctorDialog" :title="doctorForm.id?'编辑医生':'新增医生'" width="760px">
    <el-form label-width="95px">
      <div class="form-grid"><el-form-item label="姓名" required><el-input v-model="doctorForm.name" /></el-form-item><el-form-item label="职称" required><el-input v-model="doctorForm.title" /></el-form-item><el-form-item label="科室" required><el-select v-model="doctorForm.departmentId" style="width:100%"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="医院"><el-select v-model="doctorForm.clinicId" clearable style="width:100%"><el-option v-for="item in clinics" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item></div>
      <el-form-item label="头像" required><div class="upload-row"><el-input v-model="doctorForm.avatar" /><el-upload :show-file-list="false" :http-request="uploadAvatar" accept="image/*"><el-button>上传头像</el-button></el-upload></div></el-form-item>
      <el-form-item label="擅长" required><el-input v-model="doctorForm.specialty" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="详细简介" required><el-input v-model="doctorForm.description" type="textarea" :rows="5" /></el-form-item>
      <el-form-item label="医生照片"><el-input v-model="doctorForm.imagesText" type="textarea" :rows="3" placeholder="每行一个图片地址" /></el-form-item>
      <div class="form-grid"><el-form-item label="排序"><el-input-number v-model="doctorForm.sort" /></el-form-item><el-form-item label="推荐"><el-switch v-model="doctorForm.recommend" /></el-form-item><el-form-item label="状态"><el-switch v-model="doctorForm.active" active-text="启用" /></el-form-item></div>
    </el-form>
    <template #footer><el-button @click="doctorDialog=false">取消</el-button><el-button type="primary" @click="saveDoctor">保存</el-button></template>
  </el-dialog>

  <el-drawer v-model="scheduleDrawer" :title="`${currentDoctor?.name||''} · 出诊管理`" size="680px">
    <el-button type="primary" @click="editSchedule()">新增出诊</el-button>
    <el-table :data="schedules" style="margin-top:16px"><el-table-column prop="date" label="日期" width="150" /><el-table-column prop="timeSlot" label="时段" /><el-table-column label="名额"><template #default="{row}">{{row.bookedCount}} / {{row.capacity}}</template></el-table-column><el-table-column prop="status" label="状态" /><el-table-column label="操作" width="140"><template #default="{row}"><el-button text type="primary" @click="editSchedule(row)">编辑</el-button><el-button text type="danger" @click="removeSchedule(row)">删除</el-button></template></el-table-column></el-table>
  </el-drawer>
  <el-dialog v-model="scheduleDialog" :title="scheduleForm.id?'编辑出诊':'新增出诊'" width="520px">
    <el-form label-width="90px"><el-form-item label="日期" required><el-date-picker v-model="scheduleForm.date" value-format="YYYY-MM-DD" /></el-form-item><el-form-item label="时段" required><el-input v-model="scheduleForm.timeSlot" placeholder="例如 上午 / 09:00-10:00" /></el-form-item><el-form-item label="医院"><el-select v-model="scheduleForm.clinicId" clearable><el-option v-for="item in clinics" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="名额"><el-input-number v-model="scheduleForm.capacity" :min="1" /></el-form-item><el-form-item label="状态"><el-select v-model="scheduleForm.status"><el-option label="可预约" value="AVAILABLE" /><el-option label="已满" value="FULL" /><el-option label="停用" value="DISABLED" /></el-select></el-form-item></el-form>
    <template #footer><el-button @click="scheduleDialog=false">取消</el-button><el-button type="primary" @click="saveSchedule">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed,onMounted,reactive,ref } from 'vue';
import { ElMessage,ElMessageBox } from 'element-plus';
import { ClinicItem,DentalCategoryItem,DoctorItem,DoctorScheduleItem,createDoctorAdmin,createDoctorSchedule,deleteDoctorAdmin,deleteDoctorSchedule,getDentalCategories,getDoctorSchedules,getDoctorsAdmin,getEnterpriseClinics,updateDoctorAdmin,updateDoctorSchedule,uploadEnterpriseAsset } from '../api/admin';

// 医生资料和排期共用同一医生 ID，预约端可直接深链并自动选择。
const doctors=ref<DoctorItem[]>([]),categories=ref<DentalCategoryItem[]>([]),clinics=ref<ClinicItem[]>([]),schedules=ref<DoctorScheduleItem[]>([]);const departmentFilter=ref('');
const filteredDoctors=computed(()=>departmentFilter.value?doctors.value.filter(item=>item.departmentId===departmentFilter.value):doctors.value);
const doctorDialog=ref(false),scheduleDrawer=ref(false),scheduleDialog=ref(false),currentDoctor=ref<DoctorItem|null>(null);
const doctorForm=reactive({id:'',name:'',avatar:'',title:'',departmentId:'',clinicId:'',specialty:'',description:'',imagesText:'',sort:0,recommend:false,active:true});
const scheduleForm=reactive({id:'',doctorId:'',clinicId:'',date:'',timeSlot:'',capacity:1,sort:0,status:'AVAILABLE'});
async function load(){[doctors.value,categories.value,clinics.value]=await Promise.all([getDoctorsAdmin(),getDentalCategories(),getEnterpriseClinics()]);}
function editDoctor(row?:DoctorItem){Object.assign(doctorForm,{id:row?.id||'',name:row?.name||'',avatar:row?.avatar||'',title:row?.title||'',departmentId:row?.departmentId||categories.value[0]?.id||'',clinicId:row?.clinicId||'',specialty:row?.specialty||'',description:row?.description||'',imagesText:(row?.images||[]).join('\n'),sort:row?.sort||0,recommend:row?.recommend||false,active:row?.status!=='DISABLED'});doctorDialog.value=true;}
async function uploadAvatar(options:any){doctorForm.avatar=(await uploadEnterpriseAsset(options.file)).url;}
async function saveDoctor(){if(!doctorForm.name||!doctorForm.avatar||!doctorForm.title||!doctorForm.departmentId||!doctorForm.specialty||!doctorForm.description)return ElMessage.warning('请完整填写医生必填资料');const data={...doctorForm,images:doctorForm.imagesText.split(/\r?\n/).map(v=>v.trim()).filter(Boolean),status:doctorForm.active?'ACTIVE':'DISABLED'} as any;doctorForm.id?await updateDoctorAdmin(doctorForm.id,data):await createDoctorAdmin(data);doctorDialog.value=false;await load();}
async function removeDoctor(row:DoctorItem){await ElMessageBox.confirm('已有预约引用时将自动停用医生。','删除确认',{type:'warning'});await deleteDoctorAdmin(row.id);await load();}
async function manageSchedule(row:DoctorItem){currentDoctor.value=row;schedules.value=await getDoctorSchedules(row.id);scheduleDrawer.value=true;}
function editSchedule(row?:DoctorScheduleItem){Object.assign(scheduleForm,{id:row?.id||'',doctorId:currentDoctor.value?.id||'',clinicId:row?.clinicId||currentDoctor.value?.clinicId||'',date:row?.date?.slice(0,10)||'',timeSlot:row?.timeSlot||'',capacity:row?.capacity||1,sort:row?.sort||0,status:row?.status||'AVAILABLE'});scheduleDialog.value=true;}
async function saveSchedule(){if(!scheduleForm.doctorId||!scheduleForm.date||!scheduleForm.timeSlot)return ElMessage.warning('请填写日期和时段');const data={...scheduleForm} as Partial<DoctorScheduleItem>;scheduleForm.id?await updateDoctorSchedule(scheduleForm.id,data):await createDoctorSchedule(data);scheduleDialog.value=false;schedules.value=await getDoctorSchedules(scheduleForm.doctorId);}
async function removeSchedule(row:DoctorScheduleItem){await ElMessageBox.confirm('确认删除该出诊时段？','删除确认',{type:'warning'});await deleteDoctorSchedule(row.id);schedules.value=await getDoctorSchedules(row.doctorId);}
onMounted(load);
</script>
<style scoped>.page-heading p{margin:0 0 18px;color:var(--admin-text-secondary)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.upload-row{display:flex;width:100%;gap:10px}.upload-row .el-input{flex:1}@media(max-width:700px){.form-grid{grid-template-columns:1fr}}</style>
