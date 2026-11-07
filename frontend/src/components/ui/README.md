# Z30 组件层

项目保留 Vue 3 + Tailwind 3。组件按 [shadcn/ui](https://github.com/shadcn-ui/ui) 的源码分发方式集成，采用 [shadcn-vue 的 Tailwind 3 注册表](https://v3.shadcn-vue.com/) 的 New York 样式，不引入第二套 React 运行时。原始组件的 MIT 许可见同目录 LICENSE。

- **Button**：用 `variant` 表达操作层级，用 `as-child` 给链接套用按钮样式，不嵌套交互元素。表单提交显式标为 `type="submit"`。
- **Input、Switch**：面向新视图。既有表单可继续用 `common/Input.vue` 与 `common/Toggle.vue`；这些适配器保留原有事件、插槽与调用约定。
- **Card**：用于认证表单、指标卡、数据表等可组合面板。

视觉令牌位于 `src/styles/tokens.css`，通过 `tailwind.config.js` 生成 `bg-card`、`text-muted-foreground`、`ring-ring` 等语义工具类。`src/style.css` 的 Geist 别名把老页面接入同一主题。在新增样式中，优先使用语义令牌，而不是查找替换全项目的灰阶类。矿物绿用于焦点和导航标记，错误、告警、支付渠道颜色保留各自含义。

组件来源：`https://v3.shadcn-vue.com/r/styles/new-york/{button,input,switch,card}.json`。升级组件时保留项目适配（如 Input 的 focus/select）并运行以下兼容性测试：

```sh
pnpm exec vitest run src/components/common/__tests__/designSystem.spec.ts src/components/common/__tests__/SearchInput.spec.ts
```

## 分组管理

`/admin/groups` 使用同一 New York / Tailwind 3 注册表的 Table、Badge、Select、Popover、Command、Dropdown Menu、Dialog 和 Textarea 源码。该页的行模型由 TanStack Table v8 管理；过滤、排序、分页仍交给现有分组 API。长列表使用虚拟滚动，小屏显示可操作的分组摘要。编辑器保留平台特有的字段、原有校验和提交协议。Dialog 固定操作区，Popover + Command 保留较长选项列表的搜索。

参考：[Data Table](https://www.shadcn-vue.com/docs/components/data-table)、[Dialog](https://www.shadcn-vue.com/docs/components/dialog)。此迁移针对实际分组管理路由，不是对所有其他管理页的迁移。
