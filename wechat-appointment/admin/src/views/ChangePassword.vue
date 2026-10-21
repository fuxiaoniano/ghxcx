<template>
  <section class="password-page">
    <div class="page-heading"><div><h1 class="page-title">修改密码</h1><p>修改当前登录账号的密码。保存后请使用新密码重新登录。</p></div></div>
    <div class="content-panel password-panel">
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="当前密码" required><el-input v-model="form.currentPassword" type="password" show-password autocomplete="current-password" maxlength="128" /></el-form-item>
        <el-form-item label="新密码" required><el-input v-model="form.newPassword" type="password" show-password autocomplete="new-password" maxlength="128" placeholder="至少 8 位" /></el-form-item>
        <el-form-item label="确认新密码" required><el-input v-model="form.confirmPassword" type="password" show-password autocomplete="new-password" maxlength="128" /></el-form-item>
        <el-button type="primary" native-type="submit" :loading="saving">保存新密码</el-button>
      </el-form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { changeOwnPassword } from '../api/admin';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const saving = ref(false);
const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
async function submit() {
  if (!form.currentPassword || form.newPassword.length < 8 || form.newPassword.length > 128) return ElMessage.warning('请填写当前密码和 8 至 128 位新密码');
  if (form.newPassword !== form.confirmPassword) return ElMessage.warning('两次输入的新密码不一致');
  if (form.currentPassword === form.newPassword) return ElMessage.warning('新密码不能与当前密码相同');
  saving.value = true;
  try {
    await changeOwnPassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
    ElMessage.success('密码已修改，请使用新密码重新登录');
    auth.logout();
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.password-panel{max-width:560px}.password-panel :deep(.el-input){width:100%}
@media(max-width:600px){.password-panel{max-width:none}}
</style>
