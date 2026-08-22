<template>
  <div class="page-heading"><div><h1 class="page-title">套餐管理</h1><p>维护套餐分类、价格、详情和多图排序；本系统不处理支付</p></div></div>
  <el-tabs v-model="tab" class="content-panel">
    <el-tab-pane label="套餐" name="packages">
      <div class="toolbar"><el-select v-model="categoryFilter" clearable placeholder="筛选分类"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-button type="primary" @click="editPackage()">新增套餐</el-button></div>
      <el-table :data="filteredPackages"><el-table-column label="封面" width="100"><template #default="{row}"><el-image :src="row.cover" class="cover" fit="cover" /></template></el-table-column><el-table-column prop="title" label="套餐名称" /><el-table-column prop="category.name" label="分类" /><el-table-column label="价格" width="150"><template #default="{row}"><strong class="price">¥{{row.salePrice}}</strong><del>¥{{row.originalPrice}}</del></template></el-table-column><el-table-column prop="salesCount" label="申请人数" width="100" /><el-table-column prop="sort" label="排序" width="70" /><el-table-column label="状态" width="80"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{row.status==='ACTIVE'?'启用':'停用'}}</el-tag></template></el-table-column><el-table-column label="操作" width="230"><template #default="{row}"><el-button text type="primary" @click="editPackage(row)">编辑</el-button><el-button text @click="editImages(row)">详情图</el-button><el-button text type="danger" @click="removePackage(row)">删除</el-button></template></el-table-column></el-table>
    </el-tab-pane>
    <el-tab-pane label="套餐分类" name="categories">
      <div class="toolbar"><el-button type="primary" @click="editCategory()">新增分类</el-button></div>
      <el-table :data="categories"><el-table-column prop="name" label="分类名称" /><el-table-column prop="icon" label="图标地址" show-overflow-tooltip /><el-table-column prop="sort" label="排序" width="80" /><el-table-column label="状态" width="90"><template #default="{row}">{{row.status==='ACTIVE'?'启用':'停用'}}</template></el-table-column><el-table-column label="操作" width="160"><template #default="{row}"><el-button text type="primary" @click="editCategory(row)">编辑</el-button><el-button text type="danger" @click="removeCategory(row)">删除</el-button></template></el-table-column></el-table>
    </el-tab-pane>
  </el-tabs>

  <el-dialog v-model="packageDialog" :title="packageForm.id?'编辑套餐':'新增套餐'" width="760px"><el-form label-width="95px"><div class="form-grid"><el-form-item label="套餐名称" required><el-input v-model="packageForm.title" /></el-form-item><el-form-item label="分类" required><el-select v-model="packageForm.categoryId" style="width:100%"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="原价" required><el-input-number v-model="packageForm.originalPrice" :min="0" :precision="2" /></el-form-item><el-form-item label="申请价" required><el-input-number v-model="packageForm.salePrice" :min="0" :precision="2" /></el-form-item><el-form-item label="申请人数"><el-input-number v-model="packageForm.salesCount" :min="0" /></el-form-item><el-form-item label="排序"><el-input-number v-model="packageForm.sort" /></el-form-item></div><el-form-item label="封面" required><div class="upload-row"><el-input v-model="packageForm.cover" /><el-upload :show-file-list="false" :http-request="uploadCover" accept="image/*"><el-button>上传封面</el-button></el-upload></div></el-form-item><el-form-item label="文字详情" required><el-input v-model="packageForm.description" type="textarea" :rows="8" /></el-form-item><el-form-item label="状态"><el-switch v-model="packageForm.active" active-text="启用" /></el-form-item></el-form><template #footer><el-button @click="packageDialog=false">取消</el-button><el-button type="primary" @click="savePackage">保存</el-button></template></el-dialog>

  <el-dialog v-model="categoryDialog" :title="categoryForm.id?'编辑分类':'新增分类'" width="520px"><el-form label-width="90px"><el-form-item label="名称" required><el-input v-model="categoryForm.name" /></el-form-item><el-form-item label="图标"><el-input v-model="categoryForm.icon" /></el-form-item><el-form-item label="排序"><el-input-number v-model="categoryForm.sort" /></el-form-item><el-form-item label="状态"><el-switch v-model="categoryForm.active" /></el-form-item></el-form><template #footer><el-button @click="categoryDialog=false">取消</el-button><el-button type="primary" @click="saveCategory">保存</el-button></template></el-dialog>

  <el-drawer v-model="imagesDrawer" :title="`${currentPackage?.title||''} · 详情图片`" size="680px">
    <el-alert title="拖动不稳定时可直接修改排序值；保存后按排序升序展示。" type="info" :closable="false" />
    <el-upload :show-file-list="false" :http-request="uploadDetailImage" accept="image/*" style="margin:16px 0"><el-button type="primary">上传详情图</el-button></el-upload>
    <div v-for="(item,index) in detailImages" :key="item.key" class="image-row"><el-image :src="item.imageUrl" fit="cover" /><el-input v-model="item.imageUrl" /><el-input-number v-model="item.sort" /><el-button type="danger" text @click="detailImages.splice(index,1)">删除</el-button></div>
    <el-button type="primary" @click="saveImages">保存图片与排序</el-button>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed,onMounted,reactive,ref } from 'vue';import { ElMessage,ElMessageBox } from 'element-plus';
import { DentalCategoryItem,PackageItem,createPackageAdmin,createPackageCategory,deletePackageAdmin,deletePackageCategory,getPackageCategories,getPackagesAdmin,replacePackageImages,updatePackageAdmin,updatePackageCategory,uploadEnterpriseAsset } from '../api/admin';

// 套餐仅保存咨询申请所需展示数据，不创建支付订单或支付状态。
const tab=ref('packages'),categories=ref<DentalCategoryItem[]>([]),packages=ref<PackageItem[]>([]),categoryFilter=ref('');
const filteredPackages=computed(()=>categoryFilter.value?packages.value.filter(item=>item.categoryId===categoryFilter.value):packages.value);
const packageDialog=ref(false),categoryDialog=ref(false),imagesDrawer=ref(false),currentPackage=ref<PackageItem|null>(null);
const packageForm=reactive({id:'',categoryId:'',title:'',cover:'',originalPrice:0,salePrice:0,salesCount:0,description:'',sort:0,active:true});const categoryForm=reactive({id:'',name:'',icon:'',sort:0,active:true});
const detailImages=ref<Array<{key:string,id?:string,imageUrl:string,sort:number}>>([]);
async function load(){[categories.value,packages.value]=await Promise.all([getPackageCategories(),getPackagesAdmin()]);}
function editPackage(row?:PackageItem){Object.assign(packageForm,{id:row?.id||'',categoryId:row?.categoryId||categories.value[0]?.id||'',title:row?.title||'',cover:row?.cover||'',originalPrice:Number(row?.originalPrice||0),salePrice:Number(row?.salePrice||0),salesCount:row?.salesCount||0,description:row?.description||'',sort:row?.sort||0,active:row?.status!=='DISABLED'});packageDialog.value=true;}
async function uploadCover(options:any){packageForm.cover=(await uploadEnterpriseAsset(options.file)).url;}
async function savePackage(){if(!packageForm.categoryId||!packageForm.title||!packageForm.cover||!packageForm.description)return ElMessage.warning('请完整填写套餐必填信息');const data={...packageForm,status:packageForm.active?'ACTIVE':'DISABLED'} as any;packageForm.id?await updatePackageAdmin(packageForm.id,data):await createPackageAdmin(data);packageDialog.value=false;await load();}
async function removePackage(row:PackageItem){await ElMessageBox.confirm('已有申请引用时将自动停用。','删除确认',{type:'warning'});await deletePackageAdmin(row.id);await load();}
function editCategory(row?:DentalCategoryItem){Object.assign(categoryForm,{id:row?.id||'',name:row?.name||'',icon:row?.icon||'',sort:row?.sort||0,active:row?.status!=='DISABLED'});categoryDialog.value=true;}
async function saveCategory(){if(!categoryForm.name)return ElMessage.warning('请输入分类名称');const data={...categoryForm,status:categoryForm.active?'ACTIVE':'DISABLED'} as any;categoryForm.id?await updatePackageCategory(categoryForm.id,data):await createPackageCategory(data);categoryDialog.value=false;await load();}
async function removeCategory(row:DentalCategoryItem){await ElMessageBox.confirm('已有套餐时将自动停用分类。','删除确认',{type:'warning'});await deletePackageCategory(row.id);await load();}
function editImages(row:PackageItem){currentPackage.value=row;detailImages.value=(row.images||[]).map((item,index)=>({key:item.id||String(index),...item}));imagesDrawer.value=true;}
async function uploadDetailImage(options:any){const result=await uploadEnterpriseAsset(options.file);detailImages.value.push({key:`new-${Date.now()}`,imageUrl:result.url,sort:detailImages.value.length});}
async function saveImages(){if(!currentPackage.value)return;await replacePackageImages(currentPackage.value.id,detailImages.value.map(({id,imageUrl,sort})=>({id,imageUrl,sort})));ElMessage.success('详情图片已保存');await load();}
onMounted(load);
</script>
<style scoped>.page-heading p{margin:0 0 18px;color:var(--admin-text-secondary)}.cover{width:70px;height:54px;border-radius:6px}.price{margin-right:8px;color:#e14f3b}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.upload-row,.image-row{display:flex;align-items:center;width:100%;gap:10px}.upload-row .el-input,.image-row .el-input{flex:1}.image-row{margin:14px 0}.image-row .el-image{width:90px;height:64px;border-radius:6px}@media(max-width:700px){.form-grid{grid-template-columns:1fr}}</style>
