<template>
  <div class="page-heading"><div><h1 class="page-title">科室管理</h1><p>维护预约流程左侧科室和右侧治疗项目</p></div></div>
  <el-tabs v-model="tab" class="content-panel">
    <el-tab-pane label="科室" name="categories">
      <div class="toolbar"><el-button type="primary" @click="editCategory()">新增科室</el-button></div>
      <el-table :data="categories">
        <el-table-column label="图标" width="80"><template #default="{row}"><el-image v-if="row.icon" :src="row.icon" class="icon-preview" /></template></el-table-column>
        <el-table-column prop="name" label="科室名称" /><el-table-column prop="sort" label="排序" width="90" />
        <el-table-column label="状态" width="100"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{ row.status==='ACTIVE'?'启用':'停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="170"><template #default="{row}"><el-button text type="primary" @click="editCategory(row)">编辑</el-button><el-button text type="danger" @click="removeCategory(row)">删除</el-button></template></el-table-column>
      </el-table>
    </el-tab-pane>
    <el-tab-pane label="科室项目" name="projects">
      <div class="toolbar"><el-select v-model="categoryFilter" clearable placeholder="筛选科室"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-button type="primary" @click="editProject()">新增项目</el-button></div>
      <el-table :data="filteredProjects">
        <el-table-column prop="category.name" label="所属科室" /><el-table-column prop="name" label="项目名称" /><el-table-column prop="description" label="说明" show-overflow-tooltip /><el-table-column prop="sort" label="排序" width="90" />
        <el-table-column label="状态" width="100"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{ row.status==='ACTIVE'?'启用':'停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="170"><template #default="{row}"><el-button text type="primary" @click="editProject(row)">编辑</el-button><el-button text type="danger" @click="removeProject(row)">删除</el-button></template></el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>

  <el-dialog v-model="categoryDialog" :title="categoryForm.id?'编辑科室':'新增科室'" width="520px">
    <el-form label-width="90px"><el-form-item label="名称" required><el-input v-model="categoryForm.name" /></el-form-item><el-form-item label="图标地址"><el-input v-model="categoryForm.icon" /></el-form-item><el-form-item label="排序"><el-input-number v-model="categoryForm.sort" /></el-form-item><el-form-item label="状态"><el-switch v-model="categoryForm.active" active-text="启用" /></el-form-item></el-form>
    <template #footer><el-button @click="categoryDialog=false">取消</el-button><el-button type="primary" @click="saveCategory">保存</el-button></template>
  </el-dialog>
  <el-dialog v-model="projectDialog" :title="projectForm.id?'编辑项目':'新增项目'" width="560px">
    <el-form label-width="90px"><el-form-item label="所属科室" required><el-select v-model="projectForm.categoryId" style="width:100%"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="项目名称" required><el-input v-model="projectForm.name" /></el-form-item><el-form-item label="说明"><el-input v-model="projectForm.description" type="textarea" /></el-form-item><el-form-item label="排序"><el-input-number v-model="projectForm.sort" /></el-form-item><el-form-item label="状态"><el-switch v-model="projectForm.active" active-text="启用" /></el-form-item></el-form>
    <template #footer><el-button @click="projectDialog=false">取消</el-button><el-button type="primary" @click="saveProject">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { DentalCategoryItem, DentalProjectItem, createDentalCategory, createDentalProject, deleteDentalCategory, deleteDentalProject, getDentalCategories, getDentalProjects, updateDentalCategory, updateDentalProject } from '../api/admin';

// 科室和项目保持独立实体，避免用前端硬编码模拟层级。
const tab=ref('categories'); const categories=ref<DentalCategoryItem[]>([]); const projects=ref<DentalProjectItem[]>([]); const categoryFilter=ref('');
const categoryDialog=ref(false); const projectDialog=ref(false);
const categoryForm=reactive({id:'',name:'',icon:'',sort:0,active:true});
const projectForm=reactive({id:'',categoryId:'',name:'',description:'',sort:0,active:true});
const filteredProjects=computed(()=>categoryFilter.value?projects.value.filter(item=>item.categoryId===categoryFilter.value):projects.value);
async function load(){[categories.value,projects.value]=await Promise.all([getDentalCategories(),getDentalProjects()]);}
function editCategory(row?:DentalCategoryItem){Object.assign(categoryForm,{id:row?.id||'',name:row?.name||'',icon:row?.icon||'',sort:row?.sort||0,active:row?.status!=='DISABLED'});categoryDialog.value=true;}
async function saveCategory(){if(!categoryForm.name.trim())return ElMessage.warning('请输入科室名称');const data={...categoryForm,status:categoryForm.active?'ACTIVE':'DISABLED'} as any;categoryForm.id?await updateDentalCategory(categoryForm.id,data):await createDentalCategory(data);categoryDialog.value=false;await load();}
async function removeCategory(row:DentalCategoryItem){await ElMessageBox.confirm('已有医生、项目或预约时将自动停用而不物理删除。','删除确认',{type:'warning'});await deleteDentalCategory(row.id);await load();}
function editProject(row?:DentalProjectItem){Object.assign(projectForm,{id:row?.id||'',categoryId:row?.categoryId||categories.value[0]?.id||'',name:row?.name||'',description:row?.description||'',sort:row?.sort||0,active:row?.status!=='DISABLED'});projectDialog.value=true;}
async function saveProject(){if(!projectForm.categoryId||!projectForm.name.trim())return ElMessage.warning('请选择科室并填写项目名称');const data={...projectForm,status:projectForm.active?'ACTIVE':'DISABLED'} as any;projectForm.id?await updateDentalProject(projectForm.id,data):await createDentalProject(data);projectDialog.value=false;await load();}
async function removeProject(row:DentalProjectItem){await ElMessageBox.confirm('已有预约引用时将自动停用。','删除确认',{type:'warning'});await deleteDentalProject(row.id);await load();}
onMounted(load);
</script>
<style scoped>.icon-preview{width:40px;height:40px;border-radius:8px}.page-heading p{margin:0 0 18px;color:var(--admin-text-secondary)}</style>
