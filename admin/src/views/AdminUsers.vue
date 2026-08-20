<template>
  <div class="page-heading">
    <div>
      <h1 class="page-title">æˆå‘˜ä¸Žé€šçŸ¥</h1>
      <p>æˆå‘˜ç»‘å®šå¾®ä¿¡åŽå³å¯æ‰«ç ç™»å½•ï¼Œå¹¶å¯æŒ‰æƒé™æŽ¥æ”¶æ–°çš„é¢„çº¦é€šçŸ¥ã€‚</p>
    </div>
    <el-button type="primary" @click="openCreateDialog">
      <el-icon><Plus /></el-icon>æ·»åŠ æˆå‘˜
    </el-button>
  </div>

  <section class="content-panel notify-panel">
    <div class="section-heading">
      <div>
        <h2>é¢„çº¦é€šçŸ¥</h2>
        <p>æ€»å¼€å…³å…³é—­åŽï¼Œæ‰€æœ‰æˆå‘˜éƒ½ä¸ä¼šæ”¶åˆ°æ–°é¢„çº¦é€šçŸ¥ã€‚</p>
      </div>
      <el-switch v-model="notifyForm.enabled" inline-prompt active-text="å·²å¯ç”¨" inactive-text="å·²å…³é—­" />
    </div>
    <el-form class="notify-form" label-position="top">
      <el-form-item label="å…¬ä¼—å·æ¶ˆæ¯æ¨¡æ¿ ID">
        <el-input v-model="notifyForm.templateId" placeholder="è¯·è¾“å…¥ç”¨äºŽå·¥ä½œäººå‘˜é¢„çº¦æé†’çš„æ¨¡æ¿ ID" />
      </el-form-item>
      <el-button type="primary" :loading="savingNotify" @click="saveNotifyConfig">ä¿å­˜é€šçŸ¥è®¾ç½®</el-button>
    </el-form>
  </section>

  <section class="content-panel">
    <div class="section-heading members-heading">
      <div>
        <h2>åŽå°æˆå‘˜</h2>
        <p>â€œæŽ¥æ”¶é€šçŸ¥â€åªå¯¹å·²ç»‘å®šå…¬ä¼—å·å¾®ä¿¡ä¸”è´¦å·å·²å¯ç”¨çš„æˆå‘˜ç”Ÿæ•ˆã€‚</p>
      </div>
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="æœç´¢æ˜µç§°" clearable @keyup.enter="loadMembers">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button @click="loadMembers">æŸ¥è¯¢</el-button>
      </div>
    </div>

    <el-table :data="rows" v-loading="loading" row-key="id">
      <el-table-column label="æˆå‘˜" min-width="160">
        <template #default="{ row }">
          <div class="member-cell">
            <span class="member-avatar">{{ row.nickname.slice(0, 1) }}</span>
            <div><strong>{{ row.nickname }}</strong><small>{{ roleLabel(row.role) }}</small></div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="å¾®ä¿¡çŠ¶æ€" min-width="175">
        <template #default="{ row }">
          <div class="status-stack">
            <el-tag :type="row.wechatBound ? 'success' : 'warning'" size="small">
              {{ row.wechatBound ? 'å·²ç»‘å®šå¾®ä¿¡' : 'æœªç»‘å®šå¾®ä¿¡' }}
            </el-tag>
            <small v-if="row.oaOpenIdMasked">{{ row.oaOpenIdMasked }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="æŽ¥æ”¶é¢„çº¦é€šçŸ¥" width="145" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.notifyEnabled"
            :disabled="!row.wechatBound || row.status !== 'ACTIVE'"
            @change="toggleNotify(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="è´¦å·çŠ¶æ€" width="105">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
            {{ row.status === 'ACTIVE' ? 'å¯ç”¨' : 'åœç”¨' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="æƒé™" min-width="220">
        <template #default="{ row }">
          <span v-if="row.role === 'SUPER_ADMIN'" class="all-permissions">å…¨éƒ¨æƒé™</span>
          <template v-else>
            <el-tag v-for="permission in row.permissions" :key="permission" size="small" effect="plain" class="permission-tag">
              {{ permissionLabel(permission) }}
            </el-tag>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="æœ€è¿‘ç™»å½•" width="170">
        <template #default="{ row }">{{ formatDate(row.lastLoginAt) }}</template>
      </el-table-column>
      <el-table-column label="æ“ä½œ" width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!row.wechatBound" text type="primary" @click="reissueWechatInvite(row)">ç»‘å®šå¾®ä¿¡</el-button>
          <el-button text type="primary" @click="openEditDialog(row)">ç¼–è¾‘</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="pagination"
      layout="prev, pager, next, total"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="changePage"
    />
  </section>

  <section v-if="invitations.length" class="content-panel pending-panel">
    <div class="section-heading">
      <div><h2>å¾…ç»‘å®šæˆå‘˜</h2><p>é‚€è¯·é“¾æŽ¥ä¸ƒå¤©å†…æœ‰æ•ˆï¼›é“¾æŽ¥ä¸¢å¤±åŽè¯·å–æ¶ˆå¹¶é‡æ–°ç”Ÿæˆã€‚</p></div>
    </div>
    <div class="invite-list">
      <div v-for="invite in invitations" :key="invite.id" class="invite-row">
        <div><strong>{{ invite.nickname }}</strong><span>{{ roleLabel(invite.role) }} Â· {{ formatDate(invite.expiresAt) }} åˆ°æœŸ</span></div>
        <el-button text type="danger" @click="cancelInvite(invite.id)">å–æ¶ˆé‚€è¯·</el-button>
      </div>
    </div>
  </section>

  <el-dialog v-model="memberDialogVisible" :title="memberForm.id ? 'ç¼–è¾‘æˆå‘˜' : 'æ·»åŠ æˆå‘˜'" width="620px" destroy-on-close>
    <el-alert v-if="!memberForm.id" title="å¡«å†™èµ„æ–™åŽä¼šç”Ÿæˆå¾®ä¿¡ç»‘å®šäºŒç»´ç ã€‚å¯¹æ–¹å®Œæˆç»‘å®šåŽï¼Œæˆå‘˜è´¦å·æ‰ä¼šæ­£å¼åˆ›å»ºã€‚" type="info" :closable="false" show-icon />
    <el-form class="member-form" label-position="top">
      <el-form-item label="æˆå‘˜æ˜µç§°" required><el-input v-model="memberForm.nickname" maxlength="32" show-word-limit placeholder="ä¾‹å¦‚ï¼šå‰å°å°å‘¨" /></el-form-item>
      <div class="form-grid">
        <el-form-item label="è§’è‰²">
          <el-select v-model="memberForm.role" style="width: 100%">
            <el-option label="å‘˜å·¥" value="STAFF" />
            <el-option label="ç»ç†" value="MANAGER" />
            <el-option label="è¶…çº§ç®¡ç†å‘˜" value="SUPER_ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="memberForm.id" label="è´¦å·çŠ¶æ€">
          <el-select v-model="memberForm.status" style="width: 100%">
            <el-option label="å¯ç”¨" value="ACTIVE" />
            <el-option label="åœç”¨" value="DISABLED" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="æƒé™">
        <el-checkbox-group v-model="memberForm.permissions">
          <el-checkbox v-for="item in permissionOptions" :key="item.value" :value="item.value">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item>
        <div class="notify-choice">
          <div><strong>æŽ¥æ”¶æ–°é¢„çº¦é€šçŸ¥</strong><span>æœ‰æ–°æŒ‚å·æ—¶é€šè¿‡å…¬ä¼—å·æ¶ˆæ¯æé†’æ­¤æˆå‘˜</span></div>
          <el-switch v-model="memberForm.notifyEnabled" />
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="memberDialogVisible = false">å–æ¶ˆ</el-button>
      <el-button type="primary" :loading="savingMember" @click="saveMember">{{ memberForm.id ? 'ä¿å­˜ä¿®æ”¹' : 'ç”Ÿæˆå¾®ä¿¡ç»‘å®šäºŒç»´ç ' }}</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="bindDialogVisible" title="é‚€è¯·å¾®ä¿¡ç»‘å®š" width="480px" :close-on-click-modal="false">
    <div v-if="createdInvite?.bindUrl" class="bind-content">
      <div class="qr-frame"><QrcodeVue :value="createdInvite.bindUrl" :size="210" level="M" /></div>
      <h3>{{ createdInvite.nickname }}</h3>
      <p>è¯·è®©è¯¥æˆå‘˜ä½¿ç”¨å¾®ä¿¡æ‰«ç ï¼Œå¹¶ç¡®è®¤ç»‘å®šåŽå°è´¦å·ã€‚</p>
      <div class="bind-actions">
        <el-button @click="copyBindUrl"><el-icon><CopyDocument /></el-icon>å¤åˆ¶ç»‘å®šé“¾æŽ¥</el-button>
        <el-button type="primary" tag="a" :href="createdInvite.bindUrl" target="_blank">åœ¨å¾®ä¿¡çŽ¯å¢ƒæ‰“å¼€</el-button>
      </div>
      <el-alert title="äºŒç»´ç å…³é—­åŽä¸ä¼šå†æ¬¡æ˜¾ç¤ºï¼›è‹¥å°šæœªç»‘å®šï¼Œå¯å–æ¶ˆè¯¥é‚€è¯·åŽé‡æ–°ç”Ÿæˆã€‚" type="warning" :closable="false" show-icon />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CopyDocument, Plus, Search } fro}5ß«h‘éì¶»§q«^u‰•°µÝ¥‘Ñ ôˆÄÀÁÁàˆø(€€€€€€€€€€ñ•°µ™½É´µ¥Ñ•´±…‰•°ô‹–B7žžÀˆøñ•°µ¥¹ÁÕÐØµµ½‘•°ô‰¡¥±¹¹…µ”ˆµ…á±•¹Ñ ôˆÄØˆ€¼øð½•°µ™½É´µ¥Ñ•´ø(€€€€€€€€€€ñ•°µ™½É´µ¥Ñ•´±…‰•°ô‹žÆï–z,ˆø(€€€€€€€€€€€€ñ•°µÍ•±•ÐØµµ½‘•°ô‰¡¥±¹ÑåÁ”ˆÍÑå±”ô‰Ý¥‘Ñ è€ÄàÁÁàˆø(€€€€€€€€€€€€€€ñ•°µ½ÁÑ¥½¸±…‰•°ô‹žöG¦†×¢ÞÏ¢ö°ˆÙ…±Õ”ô‰Ù¥•Üˆ€¼ø(€€€€€€€€€€€€€€ñ•°µ½ÁÑ¥½¸±…‰•°ô‹ž
ç–ï’ê/’îØˆÙ…±Õ”ô‰±¥¬ˆ€¼ø(€€€€€€€€€€€€€€ñ•°µ½ÁÑ¥½¸±…‰•°ô‹–Â?ž¢/–ê<ˆÙ…±Õ”ô‰µ¥¹¥ÁÉ½É…´ˆ€¼ø(€€€€€€€€€€€€ð½•°µÍ•±•Ðø(€€€€€€€€€€ð½•°µ™½É´µ¥Ñ•´ø(€€€€€€€€€€ñ•°µ™½É´µ¥Ñ•´Øµ¥˜ô‰¡¥±¹ÑåÁ”€ôôô€Ù¥•Üœñð¡¥±¹ÑåÁ”€ôôô€µ¥¹¥ÁÉ½É…´œˆ±…‰•°ô‰UI0ˆø(€€€€€€€€€€€€ñ•°µ¥¹ÁÕÐØµµ½‘•°ô‰¡¥±¹ÕÉ°ˆ€¼ø(€€€€€€€€€€ð½•°µ™½É´µ¥Ñ•´ø(€€€€€€€€€€ñ•°µ™½É´µ¥Ñ•´Øµ¥˜ô‰¡¥±¹ÑåÁ”€ôôô€±¥¬œˆ±…‰•°ô‰-•äˆø(€€€€€€€€€€€€ñ•°µ¥¹ÁÕÐØµµ½‘•°ô‰¡¥±¹­•äˆ€¼ø(€€€€€€€€€€ð½•°µ™½É´µ¥Ñ•´ø(€€€€€€€€€€ñÑ•µÁ±…Ñ”Øµ¥˜ô‰¡¥±¹ÑåÁ”€ôôô€µ¥¹¥ÁÉ½É…´œˆø(€€€€€€€€€€€€ñ•°µ™½É´µ¥Ñ•´±…‰•°ô‰ÁÁ%ˆøñ•°µ¥¹ÁÕÐØµµ½‘•°ô‰¡¥±¹…ÁÁ¥ˆ€¼øð½•°µ™½É´µ¥Ñ•´ø(€€€€€€€€€€€€ñ•°µ™½É´µ¥Ñ•´±…‰•°ô‹¦†×¦v‹¢Þ¿–úˆøñ•°µ¥¹ÁÕÐØµµ½‘•°ô‰¡¥±¹Á…•Á…Ñ ˆ€¼øð½•°µ™½É´µ¥Ñ•´ø(€€€€€€€€€€ð½Ñ•µÁ±…Ñ”ø(€€€€€€€€ð½•°µ™½É´ø(€€€€€€ð½‘¥Øø(€€€€ð½‘¥Øø(€€ð½‘¥Øø(ð½Ñ•µÁ±…Ñ”ø((ñÍÉ¥ÁÐÍ•ÑÕÀ±…¹œô‰ÑÌˆø)¥µÁ½ÉÐì½µÁÕÑ•°½¹5½Õ¹Ñ•°É•…Ñ¥Ù”°É•˜ô™É½´€ÙÕ”œì)¥µÁ½ÉÐì±5•ÍÍ…”ô™É½´€•±•µ•¹ÐµÁ±ÕÌœì)¥µÁ½ÉÐì(€=™™¥¥…±½Õ¹Ñ5•¹Õ	ÕÑÑ½¸°(€=™™¥¥…±½Õ¹Ñ5•¹Õ½¹™¥œ°(€•Ñ=™™¥¥…±½Õ¹Ñ5•¹Ô°(€ÁÕ‰±¥Í¡=™™¥¥…±½Õ¹Ñ5•¹Ô°(€ÕÁ‘…Ñ•=™™¥¥…±½Õ¹Ñ5•¹Ô)ô™É½´€œ¸¸½…Á¤½…‘µ¥¸œì()½¹ÍÐµ•¹Ô€ôÉ•…Ñ¥Ù”ñ=™™¥¥…±½Õ¹Ñ5•¹Õ½¹™¥œø¡ì‰ÕÑÑ½¸èmtô¤ì)½¹ÍÐ•¹ÑÉåM½ÕÉ”€ôÉ•˜ µ•¹Õ}µ…¥¸œ¤ì)½¹ÍÐÁÕ‰±¥	…Í”€ôÝ¥¹‘½Ü¹±½…Ñ¥½¸¹½É¥¥¸¹¥¹±Õ‘•Ì ™á¹…‘µ¥¸¸œ¤(€€üÝ¥¹‘½Ü¹±½…Ñ¥½¸¹½É¥¥¸¹É•Á±…” ™á¹…‘µ¥¸¸œ°€é‰Í™á¸¸œ¤(€€è€¡ÑÑÁÌè¼½é‰Í™á¸¹Åé‰Í­Ä¹½´œì)½¹ÍÐµ¥¹¥ÁÁ%€ô¥µÁ½ÉÐ¹µ•Ñ„¹•¹Ø¹Y%Q}5%9%}AA}%ñð€ÝàäåˆÔäàÌÄÑ˜ÔÙŒÉ˜Äœì()½¹ÍÐÍ…™•¹ÑÉåM½ÕÉ”€ô½µÁÕÑ•  ¤€ôø(€•¹ÑÉåM½ÕÉ”¹Ù…±Õ”(€€€€¹ÑÉ¥´ ¤(€€€€¹É•Á±…” ½my„µéµhÀ´å|µt½œ°€|œ¤(€€€€¹Í±¥” À°€ØÀ¤ñð€µ•¹Õ}µ…¥¸œ(¤ì)½¹ÍÐ±…¹‘¥¹=…ÕÑ¡1¥¹¬€ô½µÁÕÑ•  ¤€ôø€‘íÁÕ‰±¥	…Í•ô½Ý•¡…Ð½½„½½…ÕÑ ýÍÑ…Ñ”õ±…¹‘¥¹œ™Í½ÕÉ”ô‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í…™•¹ÑÉåM½ÕÉ”¹Ù…±Õ”¥õ€¤ì)½¹ÍÐµå=…ÕÑ¡1¥¹¬€ô½µÁÕÑ•  ¤€ôø€‘íÁÕ‰±¥	…Í•ô½Ý•¡…Ð½½„½½…ÕÑ ýÍÑ…Ñ”õµä™Í½ÕÉ”ô‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í…™•¹ÑÉåM½ÕÉ”¹Ù…±Õ”¥õ€¤ì)½¹ÍÐ±…¹‘¥¹¥É•Ñ1¥¹¬€ô½µÁÕÑ•  ¤€ôø€‘íÁÕ‰±¥	…Í•ô¼ýÍ½ÕÉ”ô‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í…™•¹ÑÉåM½ÕÉ”¹Ù…±Õ”¥õ€¤ì()™Õ¹Ñ¥½¸‰±…¹­	ÕÑÑ½¸ ¤è=™™¥¥…±½Õ¹Ñ5•¹Õ	ÕÑÑ½¸ì(€É•ÑÕÉ¸ì¹…µ”è€œœ°ÑåÁ”è€Ù¥•Üœ°ÕÉ°è€œœôì)ô()…Íå¹Œ™Õ¹Ñ¥½¸±½… ¤ì(€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥Ð•Ñ=™™¥¥…±½Õ¹Ñ5•¹Ô ¤ì(€µ•¹Ô¹‰ÕÑÑ½¸€ôÉ•ÍÕ±Ð¹‰ÕÑÑ½¸ñðmtì)ô()™Õ¹Ñ¥½¸…‘‘Q½Á	ÕÑÑ½¸ ¤ì(€¥˜€¡µ•¹Ô¹‰ÕÑÑ½¸¹±•¹Ñ €ð€Ì¤ì(€€€µ•¹Ô¹‰ÕÑÑ½¸¹ÁÕÍ ¡‰±…¹­	ÕÑÑ½¸ ¤¤ì(€ô)ô()™Õ¹Ñ¥½¸É•µ½Ù•Q½Á	ÕÑÑ½¸¡¥¹‘•àè¹Õµ‰•È¤ì(€µ•¹Ô¹‰ÕÑÑ½¸¹ÍÁ±¥”¡¥¹‘•à°€Ä¤ì)ô()™Õ¹Ñ¥½¸…‘‘MÕ‰	ÕÑÑ½¸¡‰ÕÑÑ½¸è=™™¥¥…±½Õ¹Ñ5•¹Õ	ÕÑÑ½¸¤ì(€‰ÕÑÑ½¸¹ÍÕ‰}‰ÕÑÑ½¸€ô‰ÕÑÑ½¸¹ÍÕ‰}‰ÕÑÑ½¸ñðmtì(€¥˜€¡‰ÕÑÑ½¸¹ÍÕ‰}‰ÕÑÑ½¸¹±•¹Ñ €ð€Ô¤ì(€€€‰ÕÑÑ½¸¹ÍÕ‰}‰ÕÑÑ½¸¹ÁÕÍ ¡‰±…¹­	ÕÑÑ½¸ ¤¤ì(€ô)ô()™Õ¹Ñ¥½¸É•µ½Ù•MÕ‰	ÕÑÑ½¸¡‰ÕÑÑ½¸è=™™¥¥…±½Õ¹Ñ5•¹Õ	ÕÑÑ½¸°¥¹‘•àè¹Õµ‰•È¤ì(€‰ÕÑÑ½¸¹ÍÕ‰}‰ÕÑÑ½¸ü¹ÍÁ±¥”¡¥¹‘•à°€Ä¤ì)ô()™Õ¹Ñ¥½¸ÕÍ•MÑ…¹‘…É‘5•¹Ô ¤ì(€µ•¹Ô¹‰ÕÑÑ½¸€ôl(€€€ì(€€€€€¹…µ”è€Ÿž®/–6Ïš2–>Üœ°(€€€€€ÑåÁ”è€µ¥¹¥ÁÉ½É…´œ°(€€€€€…ÁÁ¥èµ¥¹¥ÁÁ%°(€€€€€Á…•Á…Ñ è€Á…•Ì½±…¹‘¥¹œ½±…¹‘¥¹œýÍ½ÕÉ”õ½™™¥¥…±}µ•¹Ôœ°(€€€€€ÕÉ°è±…¹‘¥¹=…ÕÑ¡1¥¹¬¹Ù…±Õ”(€€€ô°(€€€ì(€€€€€¹…µ”è€Ÿš"Gžjš2–>Üœ°(€€€€€ÑåÁ”è€µ¥¹¥ÁÉ½É…´œ°(€€€€€…ÁÁ¥èµ¥¹¥ÁÁ%°(€€€€€Á…•Á…Ñ è€Á…•Ì½…ÁÁ½¥¹Ñµ•¹ÑÌ½…ÁÁ½¥¹Ñµ•¹ÑÌýÍ½ÕÉ”õ½™™¥¥…±}µ•¹Ôœ°(€€€€€ÕÉ°èµå=…ÕÑ¡1¥¹¬¹Ù…±Õ”(€€€ô°(€€€ì¹…µ”è€Ÿ¢SžÎï–º‹šr4œ°ÑåÁ”è€±¥¬œ°­•äè€=9QQ}MQœô(€tì)ô()…Íå¹Œ™Õ¹Ñ¥½¸½Áå1¥¹¬¡±¥¹¬èÍÑÉ¥¹œ¤ì(€ÑÉäì(€€€…Ý…¥Ð¹…Ù¥…Ñ½È¹±¥Á‰½…É¹ÝÉ¥Ñ•Q•áÐ¡±¥¹¬¤ì(€ô…Ñ ì(€€€½¹ÍÐ¥¹ÁÕÐ€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð Ñ•áÑ…É•„œ¤ì(€€€¥¹ÁÕÐ¹Ù…±Õ”€ô±¥¹¬ì(€€€‘½Õµ•¹Ð¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡¥¹ÁÕÐ¤ì(€€€¥¹ÁÕÐ¹Í•±•Ð ¤ì(€€€‘½Õµ•¹Ð¹•á•½µµ…¹ ½Áäœ¤ì(€€€¥¹ÁÕÐ¹É•µ½Ù” ¤ì(€ô(€±5•ÍÍ…”¹ÍÕ•ÍÌ Ÿ¦Nûš:—–ÞË–’7–"Øœ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸Í…Ù•5•¹Ô ¤ì(€½¹ÍÐÁ…å±½…€ô¹½Éµ…±¥é•5•¹Ô ¤ì(€½¹ÍÐÍ…Ù•€ô…Ý…¥ÐÕÁ‘…Ñ•=™™¥¥…±½Õ¹Ñ5•¹Ô¡Á…å±½…¤ì(€µ•¹Ô¹‰ÕÑÑ½¸€ôÍ…Ù•¹‰ÕÑÑ½¸ñðÁ…å±½…¹‰ÕÑÑ½¸ì(€±5•ÍÍ…”¹ÍÕ•ÍÌ Ÿ–³’ò_–>ß¢>s–6W¦7žö»–ÞË’þw–¶`œ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸ÁÕ‰±¥Í¡5•¹Ô ¤ì(€…Ý…¥ÐÍ…Ù•5•¹Ô ¤ì(€…Ý…¥ÐÁÕ‰±¥Í¡=™™¥¥…±½Õ¹Ñ5•¹Ô ¤ì(€±5•ÍÍ…”¹ÍÕ•ÍÌ Ÿ–³’ò_–>ß¢>s–6W–ÞË–>G–âœ¤ì)ô()™Õ¹Ñ¥½¸¹½Éµ…±¥é•5•¹Ô ¤è=™™¥¥…±½Õ¹Ñ5•¹Õ½¹™¥œì(€É•ÑÕÉ¸ì(€€€‰ÕÑÑ½¸èµ•¹Ô¹‰ÕÑÑ½¸¹µ…À ¡¥Ñ•´¤€ôø¹½Éµ…±¥é•	ÕÑÑ½¸¡¥Ñ•´¤¤(€ôì)ô()™Õ¹Ñ¥½¸¹½Éµ…±¥é•	ÕÑÑ½¸¡‰ÕÑÑ½¸è=™™¥¥…±½Õ¹Ñ5•¹Õ	ÕÑÑ½¸¤è=™™¥¥…±½Õ¹Ñ5•¹Õ	ÕÑÑ½¸ì(€½¹ÍÐ¡¥±‘É•¸€ô‰ÕÑÑ½¸¹ÍÕ‰}‰ÕÑÑ½¸ü¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹¹…µ”ü¹ÑÉ¥´ ¤¤¹µ…À ¡¥Ñ•´¤€ôø¹½Éµ…±¥é•	ÕÑÑ½¸¡¥Ñ•´¤¤ì(€¥˜€¡¡¥±‘É•¸ü¹±•¹Ñ ¤ì(€€€É•ÑÕÉ¸ì¹…µ”è‰ÕÑÑ½¸¹¹…µ”¹ÑÉ¥´ ¤°ÍÕ‰}‰ÕÑÑ½¸è¡¥±‘É•¸ôì(€ô(€½¹ÍÐÉ•ÍÕ±Ðè=™™¥¥…±½Õ¹Ñ5•¹Õ	ÕÑÑ½¸€ôì¹…µ”è‰ÕÑÑ½¸¹¹…µ”¹ÑÉ¥´ ¤°ÑåÁ”è‰ÕÑÑ½¸¹ÑåÁ”ñð€Ù¥•Üœôì(€¥˜€¡É•ÍÕ±Ð¹ÑåÁ”€ôôô€Ù¥•Üœ¤ì(€€€É•ÍÕ±Ð¹ÕÉ°€ô‰ÕÑÑ½¸¹ÕÉ°ü¹ÑÉ¥´ ¤ì(€ô(€¥˜€¡É•ÍÕ±Ð¹ÑåÁ”€ôôô€±¥¬œ¤ì(€€€É•ÍÕ±Ð¹­•ä€ô‰ÕÑÑ½¸¹­•äü¹ÑÉ¥´ ¤ì(€ô(€¥˜€¡É•ÍÕ±Ð¹ÑåÁ”€ôôô€µ¥¹¥ÁÉ½É…´œ¤ì(€€€É•ÍÕ±Ð¹ÕÉ°€ô‰ÕÑÑ½¸¹ÕÉ°ü¹ÑÉ¥´ ¤ì(€€€É•ÍÕ±Ð¹…ÁÁ¥€ô‰ÕÑÑ½¸¹…ÁÁ¥ü¹ÑÉ¥´ ¤ì(€€€É•ÍÕ±Ð¹Á…•Á…Ñ €ô‰ÕÑÑ½¸¹Á…•Á…Ñ ü¹ÑÉ¥´ ¤ì(€ô(€É•ÑÕÉ¸É•ÍÕ±Ðì)ô()½¹5½Õ¹Ñ•¡±½…¤ì(ð½ÍÉ¥ÁÐø((ñÍÑå±”Í½Á•ø(¹Á…”µ¡•…‘¥¹œìµ…É¥¸µ‰½ÑÑ½´è€ÄáÁàìô(¹Á…”µ¡•…‘¥¹œ€¹Á…”µÑ¥Ñ±”ìµ…É¥¸µ‰½ÑÑ½´è€ÉÁàìô(¹Á…”µ¡•…‘¥¹œÀ°€¹Í•Ñ¥½¸µ¡•…‘¥¹œÀìµ…É¥¸è€Àì½±½ÈèÙ…È ´µ…‘µ¥¸µÑ•áÐµµÕÑ•¤ì™½¹ÐµÍ¥é”è€ÄÍÁàìô((¹µ•¹ÔµÑ¥Àì(€µ…É¥¸µ‰½ÑÑ½´è€ÄÙÁàì)ô((¹Í•Ñ¥½¸µ¡•…‘¥¹œì(€µ…É¥¸è€ÈÑÁà€À€ÄÙÁàì(€Á…‘‘¥¹œµ‰½ÑÑ½´è€ÄÉÁàì(€‰½É‘•Èµ‰½ÑÑ½´è€ÅÁàÍ½±¥Ù…È ´µ…‘µ¥¸µ‰½É‘•È¤ì)ô((¹Í•Ñ¥½¸µ¡•…‘¥¹œ Ììµ…É¥¸è€À€À€ÍÁàì™½¹ÐµÍ¥é”è€ÄÙÁàìô(¹µ•¹ÔµÍ•Ñ¥½¸µ¡•…‘¥¹œìµ…É¥¸µÑ½Àè€ÌÁÁàìô((¹±¥¹¬µ™½É´ìµ…àµÝ¥‘Ñ è€äÀÁÁàìô((¹±¥¹¬µÉ½Üì(€‘¥ÍÁ±…äè™±•àì(€…Àè€ÄÁÁàì(€Ý¥‘Ñ è€ÄÀÀ”ì)ô((¹µ•¹Ôµ‰±½¬ì(€µ…É¥¸µÑ½Àè€ÄÉÁàì(€Á…‘‘¥¹œè€ÄáÁàì(€‰…­É½Õ¹è€™‰™™Œì(€‰½É‘•Èè€ÅÁàÍ½±¥Ù…È ´µ…‘µ¥¸µ‰½É‘•È¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌè€ÙÁàì)ô((¹ÍÕ‰µ•¹Ôµ‰±½¬ì(€µ…É¥¸è€ÄÁÁà€À€ÄÉÁà€ÌÙÁàì(€Á…‘‘¥¹œè€ÄÑÁàì(€‰½É‘•Èè€ÅÁàÍ½±¥Ù…È ´µ…‘µ¥¸µ‰½É‘•È¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌè€ÙÁàì(€‰…­É½Õ¹è€™™™™™˜ì)ô((¹µ•¹Ôµ¡•…‘¥¹œì(€‘¥ÍÁ±…äè™±•àì(€…±¥¸µ¥Ñ•µÌè•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ÐèÍÁ…”µ‰•ÑÝ••¸ì(€µ…É¥¸µ‰½ÑÑ½´è€ÄÉÁàì(€™½¹ÐµÝ•¥¡Ðè€ÜÀÀì)ô((¹µ•¹Ôµ¡•…‘¥¹œ¤ì(€‘¥ÍÁ±…äè¥¹±¥¹”µÉ¥ì(€Ý¥‘Ñ è€ÈÑÁàì(€¡•¥¡Ðè€ÈÑÁàì(€µ…É¥¸µÉ¥¡Ðè€ÝÁàì(€Á±…”µ¥Ñ•µÌè•¹Ñ•Èì(€½±½ÈèÙ…È ´µ…‘µ¥¸µÁÉ¥µ…Éä¤ì(€‰…­É½Õ¹èÙ…È ´µ…‘µ¥¸µÁÉ¥µ…ÉäµÍ½™Ð¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌè€ÑÁàì(€™½¹ÐµÍÑå±”è¹½Éµ…°ì(€™½¹ÐµÍ¥é”è€ÄÉÁàì)ô()µ•‘¥„€¡µ…àµÝ¥‘Ñ è€ØÐÁÁà¤ì(€€¹±¥¹¬µÉ½Üì…±¥¸µ¥Ñ•µÌèÍÑÉ•Ñ ì™±•àµ‘¥É•Ñ¥½¸è½±Õµ¸ìô(€€¹ÍÕ‰µ•¹Ôµ‰±½¬ìµ…É¥¸µ±•™Ðè€Àìô(€€¹±¥¹¬µ™½É´€é‘••À ¹•°µ™½É´µ¥Ñ•´¤ì‘¥ÍÁ±…äè‰±½¬ìô(€€¹±¥¹¬µ™½É´€é‘••À ¹•°µ™½É´µ¥Ñ•µ}}±…‰•°¤ì‘¥ÍÁ±…äè‰±½¬ìÝ¥‘Ñ è…ÕÑ¼€…¥µÁ½ÉÑ…¹Ðìµ…É¥¸µ‰½ÑÑ½´è€ÙÁàìÑ•áÐµ…±¥¸è±•™Ðìô)ô(ð½ÍÑå±”ø(