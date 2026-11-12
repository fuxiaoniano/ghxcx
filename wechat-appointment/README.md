# 傅小念的运营工作台

面向挂号留资、网咨跟进、推广数据和腾讯广告运营的一体化业务后台。项目由管理后台、NestJS 服务端、公开网站和原生微信小程序组成，并以统一的成员权限、账户数据范围、审计日志和持久化任务保障业务隔离与可追踪性。

> 本仓库不保存生产密码、Token、Secret、完整鉴权头、真实患者数据或生产基础设施地址。所有示例域名和账号均为占位值。

## 功能范围

- **运营工作台**：待办事项、今日需回访、表单摘要和可配置业务模块。
- **线索管理**：挂号、网咨表单、跟进记录、转交与轮流分配、导入导出、回访、团队排班及通知。
- **网咨报表**：渠道报表、团队/成员报表、自定义有效与无效标签规则。
- **推广数据**：日/周/月统计、数据筛选、自定义字段、日报、患者收费和腾讯数据同步。
- **推广运营**：推广账户、账户授权、素材分析、新建创意、多账户批量新建、默认组件和智能监控。
- **内容与小程序**：留资页、首页、医生、科室/项目、套餐、网站资讯、公众号菜单与自动回复。
- **系统管理**：成员、团队、角色权限、账户数据范围、公众号绑定、密码修改和审计日志。

## 技术栈

| 子项目 | 技术 |
| --- | --- |
| `server/` | NestJS 11、Prisma、MySQL、Redis、Jest |
| `admin/` | Vue 3、Element Plus、Pinia、Vue Router、Vite |
| `website/` | Vue 3、Vue Router、Vite |
| `miniprogram/` | 原生微信小程序、TypeScript |
| 部署 | Docker Compose、Nginx、HTTPS |

## 目录结构

```text
wechat-appointment/
├─ server/       # API、Prisma、任务与外部平台集成
├─ admin/        # 管理后台
├─ website/      # 公开资讯与留资网站
├─ miniprogram/  # 原生微信小程序
├─ docs/         # 当前说明索引与历史专项记录
├─ scripts/      # 校验、运维和受控部署脚本
├─ DEPLOYMENT.md # 通用生产部署说明
└─ CHECKLIST.md  # 当前上线检查清单
```

## 本地运行

前置条件：Node.js 22、pnpm 10、MySQL 8、Redis 7。

```bash
pnpm install --frozen-lockfile
cp .env.example .env

pnpm --dir server prisma:generate
pnpm --dir server prisma:deploy
pnpm --dir server start:dev
pnpm --dir admin dev
pnpm --dir website dev
```

请在本地 `.env` 中配置数据库、Redis、JWT、手机号加密和需要联调的微信/腾讯能力。不要提交 `.env`。初始化管理员仅用于空数据库首次部署；已有生产库不得重复执行 seed 或重置迁移。

## 质量检查

```bash
pnpm --dir server lint
pnpm --dir server typecheck
pnpm --dir server test
pnpm --dir server build
pnpm --dir admin typecheck
pnpm --dir admin build
pnpm --dir website typecheck
pnpm --dir website build
pnpm --dir miniprogram typecheck
```

腾讯广告、公众号通知和小程序能力需要真实授权环境才能完成最终联调。接口存在、项目已实现和目标账户已验证是三个不同状态；自动化测试或 HTTP 200 不能代替第三方业务结果及平台回读。

## 权限与安全边界

- 服务端强制校验角色权限、成员数据范围、推广账户范围和营销单元范围，前端隐藏按钮不是安全措施。
- 腾讯 API 统一复用现有 Client、Token/User Token、账户授权、限流、重试和脱敏日志，不允许浏览器传递 Token。
- 完整手机号按独立权限控制；查看、导出、分配和高风险操作记录审计。
- 创意创建在腾讯返回创意 ID 后仍需回读核验；结果不明时禁止盲目重复创建。
- 持久化任务使用幂等键、领取租约和结果不明保护，避免服务重启后静默漏单或重复执行。
- 生产配置通过环境变量或秘密管理器注入，不写入代码、README、部署包或普通日志。

## 部署

生产部署、迁移、健康检查和回滚流程见 [DEPLOYMENT.md](DEPLOYMENT.md)。部署前必须完成 [CHECKLIST.md](CHECKLIST.md)，并遵守以下原则：

1. 先备份数据库、上传文件和当前配置，再执行向前兼容迁移。
2. 管理后台与 website 使用原子目录切换；服务端使用带版本标签的镜像切换。
3. 轻量服务器构建时限制 CPU/内存，避免与在线 MySQL、Redis 争抢资源。
4. 上线后核对迁移状态、容器健康、Nginx、公开入口、未登录 401 和错误日志。
5. 真实腾讯写操作、真实通知和生产数据删除必须单独授权，不作为常规部署探针。

## 文档

- [文档索引与状态说明](docs/README.md)
- [服务器部署步骤](DEPLOYMENT.md)
- [上线检查清单](CHECKLIST.md)
- [代码与上线审查摘要](CODE_CHECK_REPORT.md)
- [项目协作和变更日志](AGENTS.md)

## 许可证与使用

当前仓库未声明开源许可证。未经项目所有者书面许可，不得将代码、生产配置或业务数据用于其他系统。
