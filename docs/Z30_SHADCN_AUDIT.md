# shadcn/ui 使用核查

**此前的核查：已采用 shadcn-vue 做部分组件重构，没有把整个项目迁成 shadcn。** 项目是 Vue 3；不是把 React 版直接引入，也不是仅安装了一组同名 CSS。shadcn 以可修改的源码分发，不能用有没有名叫 shadcn 的运行时依赖作判断。对照：[shadcn/ui 官方仓库](https://github.com/shadcn-ui/ui)、[shadcn-vue 的分发方式](https://www.shadcn-vue.com/docs/introduction)。

## 更新：真实管理后台

24 个 `requiresAdmin` 业务页面和三个重定向入口统一使用 New York 风格。管理区主题附着于当前路由，传送到 body 的弹窗和下拉菜单同步切换；离开管理区后取消该主题。没有新增平行的管理页面，也没有放开原来的鉴权、功能开关或 API。

- 分组：真实路由使用 TanStack Table、Table 系列、Badge、Input、Select、可搜索的 Command/Popover、DropdownMenu、Dialog 和分页控件。新增、编辑、筛选、列偏好、排序与模型定价等走原有接口。
- 全后台：视图及功能组件中的通用按钮、卡片、输入框、表头/单元格使用仓库里的 shadcn-vue 源码。公共 DataTable 保留虚拟滚动、固定列、选择状态和移动行布局；公共弹窗复用 DialogHeader/Footer 与 Button，保留已有堆叠、关闭、焦点恢复协议。远程搜索/可创建选择器、图表、拖拽、日志和沙箱插件保留专用行为；插件自身提供的 iframe 内容不被主站注入样式。
- 范围：仪表盘、运维、审计日志、用户、分组、渠道定价、渠道监控、订阅、账号、插件、公告、代理、兑换码、优惠码、系统设置、风控、提示词审计、用量、推广邀请/返利/提现、支付仪表盘/订单/套餐。关闭的功能继续遵守原路由开关。
- 样式与组件参考：[官方文档](https://ui.shadcn.com/docs)、[Vue Data Table](https://www.shadcn-vue.com/docs/components/data-table)、[Vue Dialog](https://www.shadcn-vue.com/docs/components/dialog)。仓库使用适配 Tailwind 3 的 Vue New York 注册表。

## 历史：本次后台迁移之前的核查

- 前端的 `components.json` 使用 shadcn-vue schema、new-york、CSS variables，以及组件 / utils / ui aliases。`src/main.ts` 加载 `src/style.css`，其中引入 `src/styles/tokens.css`。Tailwind 将 background、foreground、card、input、ring 等语义色映射到实际 CSS 变量。
- `frontend/src/components/ui/` 纳入了 **Button、Card、Input、Switch** 四组本地源码，带 MIT / unovue 声明。Button 使用 Reka UI 的 Primitive 与 CVA 变体；Switch 使用 Reka 的 SwitchRoot/SwitchThumb；Input 接入 Vue 模型绑定。修改最初见提交 `1821fd599`。
- 核查本次前端源码（2026-11-08）：扫描 `frontend/src` 下非测试 Vue 文件，匹配从 `@/components/ui/<组>` 的具名导入，确认对应别名还出现在模板标签中，再按文件去重。**17 个文件直接渲染**：Button 11、Card 3、Input 3、Switch 1，有重叠；其中 6 个是 views 下的页面。直接导入不是迁移百分比，也不包含经过包装器获得的应用范围。
- 登录页直接渲染 Button；AuthLayout 使用 Card。首页 SignalHero 的登录入口、JourneyChapters 的入口动作和 PlazaNavBar 使用 Button。KeyUsageView 使用本地 Button / Input。
- 有间接采用：GroupsView → TablePageLayout → Card；SearchInput → Input；Toggle → Switch。ConfirmDialog 的操作按钮是 Button，但对话框本身仍是 BaseDialog。不能把整个调用方算作已经全量迁移。
- 未全量迁移的证据：GroupsView 仍用自有 DataTable 与 `btn btn-primary`；SettingsView 仍有 `class="card"` 与旧按钮样式。通用对话框和选择控件也保留原实现。首页实时晶体、光束、相机、光阑由 Three.js 与自定义着色器负责，不属于 shadcn 的职责。

本轮只修改后两幕的镜头、光束以及相关导航/后备画面，没有为了提高组件数量重写登录、后台表格或前两幕。
