# Interface writing

Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.

避免不必要的次要标签和描述，让布局本身来传达信息。

# 项目说明

`wechat-appointment` 是“傅小念的运营工作台”项目，主要包含：

- `server/`：NestJS、Prisma、MySQL、Redis 后端，负责挂号留资、成员与权限、网咨数据、通知、推广数据、腾讯广告账户/素材/创意及异步任务。
- `admin/`：Vue 3 + Element Plus 管理后台。
- `website/`：公开网站和留资页面。
- `miniprogram/`：原生微信小程序。
- 根目录部署文件：Docker Compose、部署说明、上线检查及跨项目脚本。

修改时必须保持现有业务流程、接口契约、数据含义、权限边界和历史数据兼容。腾讯广告 API 必须复用现有 Client、Token/User Token 和账户授权机制；不得在前端传递凭证。涉及通知、腾讯广告写操作、生产数据删除及破坏性迁移时，必须取得明确授权并保留审计证据。

# 更新与修复日志要求

从 2026-11-06 起，每一次代码、配置、数据库、部署或文档更新都必须在本文件的“更新与修复日志”中追加记录，不得只写提交信息或聊天说明。记录应在完成本次修改时同步更新，并至少包含：

- 日期和变更主题；
- 修改模块及关键文件；
- 问题原因和处理方式；
- 数据库/接口/权限兼容性影响；
- 实际执行的测试及结果；
- 部署状态、生产镜像或版本（如适用）；
- 未验证的外部依赖和残余风险。

不得记录 Token、Secret、完整鉴权头、用户隐私、生产数据库内容或未经脱敏的第三方响应。日志只记录可核验事实；尚未完成或未实测的项目必须明确标注，不得写成已完成。

# 更新与修复日志

## 2026-11-05｜网咨数据、仪表盘与管理后台展示更新

- 网咨批量导入：标准模板新增“最新跟进记录”列并保留“首次跟进记录”；校验预览同步显示最新跟进内容。服务端解析、DTO、管理后台 API 和导入弹窗同步调整，避免模板字段与预览字段不一致。
- 网咨批量分配：支持同时选择多条表单和多名网咨人员，按所选人员顺序轮流分配；服务端逐条校验数据范围和表单有效性，返回成功、失败及各成员分配数量，并分别通知新的跟进人。新增分配预览，执行前可查看可分配数量和轮流分配结果。
- 移动端网咨列表：全部表单和今日需回访改为卡片式展示；筛选区在窄屏默认折叠；增加移动端刷新、全选本页、详情、跟进、转交和更多操作入口。按钮使用不换行和最小点击区域，标签、长名称、手机号、时间及自定义字段避免相互挤压。
- 网咨报表：日期筛选、查询、展开全部和收起全部调整为同一操作区；表格层级仍沿用原有统计口径和权限，不修改报表数据语义。
- 仪表盘：默认模块改为“今日需回访”和“全部表单”，嵌入页面仅展示核心列表内容；今日和逾期回访按表单 ID 去重，避免同一记录重复出现。管理后台仍允许按登录账号自定义模块，移动端同步适配。
- 创意页面展示：单账户新建创意的“刷新平台素材”移动到素材列表标题同行；本页全选入口与多账户批量新建保持同一位置和交互，不修改创意创建、预检或提交逻辑。
- 品牌清理：登录页、浏览器标题和管理后台入口统一使用“傅小念的运营工作台”，移除旧品牌可见元素；新增 `admin/public/admin-favicon.png` 并在 `admin/index.html` 引用。
- 关键文件：`server/src/modules/consultation/consultation.service.ts`、`server/src/modules/consultation/dto.ts`、`admin/src/api/admin.ts`、`admin/src/views/ConsultationForms.vue`、`admin/src/views/ConsultationCallbacks.vue`、`admin/src/views/ConsultationReport.vue`、`server/src/modules/admin/dashboard-workspace.service.ts`、`admin/src/views/Dashboard.vue`、`admin/src/components/DashboardPagePreview.vue`、`admin/src/views/PromotionCreativeBatch.vue`、`admin/src/views/MultiAccountCreativeBatch.vue`、`admin/src/views/Login.vue`、`admin/index.html`。
- 测试与兼容性：新增网咨导入字段、多人轮流分配和仪表盘默认模块/账号隔离测试；原有表单数据、权限边界、单人转交、创意创建接口和任务语义保持不变。管理后台构建通过。

## 2026-11-05｜上线前安全、通知与腾讯创意可靠性审查

- 目标成本语义：素材列表旧 `TARGET_CONVERSION_COST` 排序错误地使用实际转化成本；服务端改为拒绝该错误语义并保留 `ACTUAL_CPA`（实际转化成本）排序，避免把报表计算值解释成营销单元目标成本。
- CORS：生产环境不再在白名单为空时允许任意来源携带凭据；保留服务端和同源场景需要的无 `Origin` 请求，并新增来源匹配测试。部署前只读检查确认生产后台域名已配置。
- 定时同步：推广数据定时同步增加 Redis 租约、租约续期、完成标记和短期重试窗口，降低多实例重复同步风险；明确区分轮询频率与腾讯报表粒度，未修改报表累计值语义。
- 限流：Redis `INCR` 与过期设置改为 Lua 原子操作，并处理无 TTL 的历史限流键，避免进程中断留下永久限流。
- 官网安全：生产环境不再允许通过 URL `demo=1` 开启持久演示数据；演示模式仅限开发环境。
- 通知重试：拒绝重试已成功记录；工作人员失败记录仅重试原接收人，不再遍历全部人员；按挂号和接收人使用 Redis 互斥，并以数据库条件更新领取记录。公众号请求超时或业务响应不明确时不自动切换备用渠道，避免结果不明时重复通知。
- 依赖安全：修复 body-parser、multer、follow-redirects 的高危生产依赖公告，升级 `sanitize-html` 至 2.18.1 并调整 Jest ESM 转换；当天生产依赖高危审计未再报告高危项。当时仍有 file-type、NestJS core、fast-xml-parser、uuid 的中危公告，后续于 2026-11-06 完成兼容升级和复核。
- 腾讯创意核验：单账户批量创意获得腾讯创意 ID 后必须按 ID 回读并核对账户/营销单元、规格、类型和关键组件；查不到或字段不一致保持结果不明，不得标记最终成功。带 ID 查询不再用同名其他创意代替；无 ID 且结果不确定时禁止因超时或暂时查不到而自动重建。
- 关键文件：`server/src/common/utils/cors-origin.ts`、`server/src/main.ts`、`server/src/common/guards/rate-limit.guard.ts`、`server/src/modules/operations/promotion-data-sync.service.ts`、`server/src/modules/operations/promotion-creative-batch.service.ts`、`server/src/modules/notifications/notifications.service.ts`、`website/src/api.ts`、`server/jest.config.js`、依赖清单及相关测试。
- 验证结果：阶段性完整后端测试从 59 套/355 项扩展到 60 套/368 项并通过；服务端 Lint、类型检查和构建通过；管理后台、website 构建及小程序类型检查通过；Prisma schema 使用占位 MySQL URL 校验通过。未在当天执行破坏性迁移、真实腾讯广告写操作或真实微信通知发送。
- 当日部署：创意回读核验版本以轻量镜像 `wechat-appointment-server:creative-verify-20261105` 部署；上传文件哈希、模块加载、公开接口、未登录接口 401 和管理后台入口检查通过，保留部署前 Compose 备份。
- 当时残余风险：生产 Redis 网络分区/多实例故障、真实公众号通知、真实腾讯账户回读、全视口视觉验收和小程序真机未联调；创意工作器中间态恢复与挂号后通知持久化在当日尚未完成，后续修复记录见 2026-11-06 条目。

## 2026-11-06｜上线前可靠性与依赖安全修复

- 修改模块：单账户批量创意、多账户批量创意、挂号创建后通知任务、通知幂等、Prisma 模型及服务端依赖。
- 关键文件：`server/src/modules/operations/promotion-creative-batch.service.ts`、`server/src/modules/operations/multi-account-creative-batch.service.ts`、`server/src/modules/appointments/appointments.service.ts`、`server/src/modules/notifications/notifications.service.ts`、`server/prisma/schema.prisma`、`server/prisma/migrations/20261106000100_appointment_post_create_jobs/migration.sql`、相关测试及依赖清单。
- 原因与处理：腾讯创建请求仅受理或结果不明时不得伪装成功、不得盲目重提；改为平台回读确认、稳定状态机、条件更新和异常任务恢复。挂号创建后的公众号/回访通知不再仅依赖进程内异步任务，新增持久化 `AppointmentPostCreateJob`、领取租约、未知状态保护及通知幂等检查。
- 兼容性：新增表和索引，不删除或重写历史数据；原公众号、小程序、腾讯 Token/User Token 与旧创意任务模型保持兼容。迁移不回补历史挂号，避免历史通知被重新发送。
- 依赖安全：升级 NestJS 11 兼容版本及存在生产安全公告的依赖；生产依赖审计结果为无已知漏洞。
- 验证结果：服务端 60 个测试套件、383 项测试通过；服务端类型检查、Lint、构建通过；管理后台和 website 构建通过；小程序类型检查通过；Prisma generate 与 schema validate 通过。
- 部署状态：已通过轻量方式部署到生产服务器，当前镜像为 `wechat-appointment-server:prelaunch-complete-20261106`。构建限制为 384 MB 内存、0.5 CPU；切换前备份数据库（74 MB，包含完成标记）和 Compose 配置。Prisma 共识别 34 个迁移且状态为最新；新增迁移记录存在。内部公开接口返回 200、未登录管理接口返回 401、管理后台公网首页返回 200，容器启动日志未发现真实运行错误。
- 部署复核：服务容器状态为 `running`，复核时后端内存约 112 MiB、CPU 约 0%；管理后台与 website 的本地构建产物和生产 `index.html` SHA-256 一致，因此未重复发布静态文件。
- 项目治理：扩充本文件的项目说明、关键安全边界和更新日志规范，并依据代码、测试及审查记录补录 2026-11-05 的功能更新与上线审查；以后每次代码、配置、迁移、部署或文档变更必须同步追加详细记录。
- 未验证项：未对真实腾讯账户执行创建/暂停/删除等写操作，未发送真实微信通知；当前自动化环境未完成全视口浏览器视觉验收。

## 2026-11-06｜上线前审查收口：凭证、通知持久化与生产构建

- 腾讯 User Token：授权发起和回调改为后端一次性 Redis state；浏览器不再接收、保存或提交 User Token，回调后的前端 URL 只保留成功/取消/失败状态。Token 仍使用原加密表、原账户授权和刷新流程，不新增第二套凭证系统。生产网关对该精确回调关闭访问日志，避免查询串进入普通访问日志。
- 网咨分配通知：单条转交和批量轮流分配在负责人更新的同一事务内写入 `ConsultationAssignmentNoticeJob`；工作器条件领取并记录 SENT、FAILED、SKIPPED 或 UNKNOWN。进程在发送中中断时转为 UNKNOWN，不盲目重发。新增迁移 `20261106000200_consultation_assignment_notice_jobs`，只新增表、外键和索引，不改写历史表单。
- 企业挂号：医生挂号和套餐申请改为与挂号记录同事务创建既有 `AppointmentPostCreateJob`，继续由原通知、回访服务执行，避免企业入口仍依赖进程内 fire-and-forget。
- 生产构建安全与性能：website 关闭生产 source map；管理后台 vendor 包拆分为 Vue 核心、Element Plus 和通用依赖缓存块，路由和页面仍保持原懒加载，不改变页面或接口行为。
- 权限与数据语义复核：腾讯线索详情、完整手机号、更新接口均执行成员数据范围校验；推广日报按 ID 更新/删除/归档均二次校验账户范围；多账户任务和默认组件按目标账户范围校验。智能监控的 `actualCpa` 与 `targetCpa` 独立，推广累计报表按唯一时段 upsert，不重复累加同一小时快照。
- 验证：服务端 Lint、类型检查和构建通过；60 套、385 项测试通过；管理后台与 website 生产构建、小程序类型检查、52 个后台页面结构回归、Prisma generate/validate 通过；生产依赖审计未发现已知漏洞。真实腾讯写操作、真实公众号发送、小程序真机及破坏性备份恢复仍未执行，不能以模拟结果代替。
- 部署状态：已轻量部署镜像 `wechat-appointment-server:prelaunch-final2-20261106`。首次增量镜像虽包含新 schema，但沿用了旧 Prisma Client，启动日志发现新任务模型不可用；未将该状态视为完成，随即在镜像构建中执行 `prisma generate` 并重新发布。最终 35 个迁移全部最新，容器运行约 109 MiB，Nginx 校验、公开入口 200、未登录管理接口 401 和启动错误日志检查通过。
- 部署一致性：管理后台 `index.html` SHA-256 为 `4bd5c084...6fc46`，website 为 `9384b3bf...44c9e`，与本地构建一致；后端运行最终镜像，两套静态资源、Prisma schema/迁移、网关回调规则、审查文档和部署脚本均已同步。临时发布包已删除，保留本次数据库及配置备份和一份静态回滚目录。

## 2026-11-06｜最新版仓库同步

- 将本次已部署的管理后台、后端、website、Prisma 迁移、自动化测试、审查报告和正式轻量部署/验证脚本整理为一次版本提交，目标分支为现有 `origin/master`；实际远程推送状态以 Git 提交和远程分支核验结果为准。
- 仓库同步排除本地依赖缓存、数据库/服务器备份、临时部署目录、构建缓存、外部 SDK 副本以及历史诊断/一次性生产探测脚本，避免泄漏环境数据或把无关大文件纳入版本库。
- 同步前依据最终生产版本完成 60 套/385 项后端测试、三端构建/类型检查、Prisma 校验、依赖安全审计与生产摘要一致性核对；同步动作不改变已部署业务行为或数据库数据。
