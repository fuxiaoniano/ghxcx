// Read-only structural audit plus isolated Vue setup state regression tests.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'admin/node_modules/typescript'));
const vue = require(path.join(root, 'admin/node_modules/vue'));
const { parse, compileTemplate } = require(path.join(root, 'admin/node_modules/vue/compiler-sfc'));
const views = path.join(root, 'admin/src/views');
const files = fs.readdirSync(views).filter(f => f.endsWith('.vue'));
for (const file of files) {
  const source = fs.readFileSync(path.join(views, file), 'utf8');
  const parsed = parse(source, { filename: file });
  assert.equal(parsed.errors.length, 0, file + ': SFC parse');
  if (parsed.descriptor.template) {
    const result = compileTemplate({ source: parsed.descriptor.template.content, filename: file, id: file });
    assert.equal(result.errors.length, 0, file + ': template compile');
  }
}
function setup(file, names, api, allowed = true) {
  const source = parse(fs.readFileSync(path.join(views, file), 'utf8')).descriptor.scriptSetup.content;
  const js = ts.transpileModule(source + '\nexports.test = {' + names.join(',') + '};', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, console, require: name => {
    if (name === 'vue') return { ...vue, onMounted: () => {} };
    if (name === 'element-plus') return { ElMessage: { info() {}, error() {}, warning() {}, success() {} }, ElMessageBox: { confirm: async () => {} } };
    if (name === '../stores/auth') return { useAuthStore: () => ({ hasPermission: () => allowed }) };
    if (name === 'vue-router') return { useRoute: () => ({ query:{} }), useRouter: () => ({ push: async () => {} }) };
    if (name === '../api/admin') return api;
    throw Error('Unexpected import ' + name);
  } };
  vm.runInNewContext(js, context);
  return context.exports.test;
}
(async () => {
  const fields = ['startNextTask','step','activeView','selectedAssets','selectedTargets','preflight','form','detailOpen'];
  const state = setup('MultiAccountCreativeBatch.vue', fields, {});
  state.step.value = 3; state.activeView.value = 'records'; state.detailOpen.value = true;
  state.selectedAssets.value = [{ id: 'old' }]; state.selectedTargets.value = [{ accountId: 'old' }];
  state.preflight.value = { estimatedCreativeCount: 10 }; state.form.rules.titleCount = 3;
  await state.startNextTask();
  assert.equal(state.step.value, 0); assert.equal(state.activeView.value, 'create');
  assert.equal(state.selectedAssets.value.length, 0); assert.equal(state.selectedTargets.value.length, 0);
  assert.equal(state.preflight.value, null); assert.equal(state.detailOpen.value, false);
  assert.equal(state.form.rules.titleCount, 1);
  const multi = setup('MultiAccountCreativeBatch.vue', ['defaultComponentMap','defaultChoices','activeDefaultId','toggleDefault','templateFields','assets','assetPage','selectedAssets','toggleAssetPage','allUsablePageSelected','payload'], {});
  const target = { accountId:'a', adgroup:{id:'g',marketingGoal:'LEADS'}, templateId:'721' };
  const preferred = {id:'preferred',componentType:'brand',componentName:'视频号一',platformComponentId:'11',priority:1,templateId:'721'};
  const alternate = {id:'alternate',componentType:'brand',componentName:'视频号二',platformComponentId:'22',priority:999};
  multi.defaultComponentMap.a = [alternate,preferred]; multi.templateFields['a:g'] = ['brand'];
  assert.equal(multi.defaultChoices(target).length, 2);
  assert.equal(multi.activeDefaultId(target,'brand'), 'preferred');
  multi.toggleDefault(target,alternate,true);
  assert.equal(multi.activeDefaultId(target,'brand'), 'alternate');
  assert.equal(target.componentOverrides.length, 1);
  assert.match(target.overrideReason, /视频号二/);
  multi.toggleDefault(target,alternate,false);
  assert.equal(multi.activeDefaultId(target,'brand'), null);
  assert.equal(target.componentOverrides.length, 0);
  multi.assets.value = [{id:'1',usable:true,type:'VIDEO'}, {id:'2',usable:false,type:'VIDEO'}, {id:'3',usable:true,type:'TITLE'}];
  multi.assetPage.value = 1; multi.toggleAssetPage();
  assert.equal(multi.selectedAssets.value.map(item=>item.id).join(','), '1,3');
  multi.assets.value = [{id:'4',usable:true,type:'IMAGE'}]; multi.assetPage.value = 2; multi.toggleAssetPage();
  assert.equal(multi.selectedAssets.value.map(item=>item.id).join(','), '1,3,4');
  multi.assets.value = [{id:'1',usable:true,type:'VIDEO'}, {id:'2',usable:false,type:'VIDEO'}, {id:'3',usable:true,type:'TITLE'}];
  assert.equal(multi.allUsablePageSelected.value, true);multi.toggleAssetPage();
  assert.equal(multi.selectedAssets.value.map(item=>item.id).join(','), '4');
  const single = setup('PromotionCreativeBatch.vue', ['assets','assetPage','selectedAssets','toggleAssetPage','allUsablePageSelected'], {});
  single.assets.value = [{id:'bundle',usable:true,type:'IMAGE',componentField:'image_list',bundleItemCount:9},{id:'single',usable:true,type:'IMAGE',componentField:'image'}, {id:'bad',usable:false,type:'IMAGE'}];
  single.toggleAssetPage();
  assert.equal(single.selectedAssets.value.map(item=>item.id).join(','), 'bundle');
  const denied = setup('MultiAccountCreativeBatch.vue', fields, {}, false);
  denied.activeView.value = 'records'; await denied.startNextTask();
  assert.equal(denied.activeView.value, 'records');
  let resolveFirst; let calls = 0;
  const defaults = setup('CreativeDefaultComponents.vue', ['loadAssets','accountId','assetType','assets','selectedId'], {
    getMultiAccountCreativeAssets: () => ++calls === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve({list:[{id:'new'}],pageInfo:{totalPage:1}})
  });
  defaults.accountId.value = 'a'; defaults.selectedId.value = 'stale';
  const old = defaults.loadAssets(); assert.equal(defaults.selectedId.value, '');
  defaults.accountId.value = 'b'; await defaults.loadAssets();
  resolveFirst({list:[{id:'old'}],pageInfo:{totalPage:2}}); await old;
  assert.equal(calls, 2); assert.equal(defaults.assets.value[0].id, 'new');
  let resolveMonitor;
  const monitor = setup('SmartMonitor.vue', ['loadDashboard','selectedAccountId','dashboard','actions','hourLabel','actionStatusLabel','platformStatusLabel'], {
    getSmartMonitorDashboard: accountId => accountId === 'a' ? new Promise(resolve => { resolveMonitor = resolve; }) : Promise.resolve({account:{id:accountId},policy:{enabled:false}}),
    getSmartMonitorActions: async accountId => [{id:accountId}]
  });
  monitor.selectedAccountId.value = 'a'; const firstMonitor = monitor.loadDashboard();
  monitor.selectedAccountId.value = 'b'; await monitor.loadDashboard();
  resolveMonitor({account:{id:'a'},policy:{enabled:true}}); await firstMonitor;
  assert.equal(monitor.dashboard.value.account.id, 'b'); assert.equal(monitor.actions.value[0].id, 'b');
  assert.match(monitor.hourLabel('2026-10-26T01:00:00Z'), /09/);
  assert.equal(monitor.actionStatusLabel('CANCELLED'), '已取消');
  assert.equal(monitor.platformStatusLabel('ADGROUP_STATUS_NORMAL'), '投放中');
  assert.equal(monitor.platformStatusLabel(null), '腾讯未返回状态');
  assert.match(monitor.platformStatusLabel('UNRECOGNIZED'), /UNRECOGNIZED/);
  const monitorTemplate = parse(fs.readFileSync(path.join(views, 'SmartMonitor.vue'), 'utf8')).descriptor.template.content;
  assert.match(monitorTemplate, /<details class="content-panel data-panel capability-details">/);
  assert.doesNotMatch(monitorTemplate, /<details[^>]*\bopen(?:\s|=|>)/);
  const paginated = setup('SmartMonitor.vue', ['dashboard','pagedAdgroups','adgroupPage','keyword','sortMode'], {});
  paginated.dashboard.value = { adgroups: Array.from({length:45}, (_, index) => ({ id:String(index), name:`单元${index}`, spend:index, actualCpa:index, assessment:{state:index === 44 ? 'WARNING' : 'NORMAL'} })), creatives:[] };
  await vue.nextTick();
  assert.equal(paginated.pagedAdgroups.value.length, 20);
  assert.equal(paginated.pagedAdgroups.value[0].id, '44');
  paginated.adgroupPage.value = 3; assert.equal(paginated.pagedAdgroups.value.length, 5);
  paginated.keyword.value = '单元44'; await vue.nextTick();
  assert.equal(paginated.adgroupPage.value, 1); assert.equal(paginated.pagedAdgroups.value.length, 1);
  console.log(`PASS: ${files.length} admin page templates; new-task reset; create permission; component/monitor request races; Shanghai hour; Chinese status.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
