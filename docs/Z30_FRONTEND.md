# Z30 前端与升级说明

## 版本基线

本次基于 [Wei-Shaw/sub2api v0.2.20](https://github.com/Wei-Shaw/sub2api/releases/tag/v0.2.20) 做了真正的 Git 合并，而不是只改版本字符串。合并的两个父提交为二开版本 `fe25ea33d` 和官方发布提交 `dab829a4e`。官方的模型及 OAuth 更新与二开的模型条目、验证码和网关逻辑共存；新版本的邮箱注册黑名单设置与本地 Grok 计费设置都保留了。

## 图形与界面

- **标准标**：`frontend/public/z30-emblem.svg`。Z、3、0 是独立绘制的玻璃字形。画板 224 × 92，没有色底、外圈或底板。SVG 内部以低透明度字面和前后切边表现玻璃厚度，字间与 0 的内孔完全透明。
- **小标**：`frontend/public/logo.svg`。简化装饰和渐变，供 favicon 和界面默认品牌图使用。运营方配置的站点名称和 logo 仍优先用于站点导航。
- **单色标**：`frontend/public/z30-mono.svg`。与主标共用字形，作为 3D 网格的轮廓源，也适合单色印刷；内联 SVG 时可通过 CSS `color` 上色。
- 首页只有默认模式显示全屏 Z30 场景。后台已配置的自定义首页（HTML 或 URL）和精简首页继续走自己的分支；模型广场、登录和控制台入口仍受原有配置与登录状态控制。
- 控制台沿用 Vue 3、Tailwind 3 与原有路由。以 [shadcn/ui](https://github.com/shadcn-ui/ui) 的 [Vue 移植版](https://www.shadcn-vue.com/) 为组件来源，直接维护注册表源码。组件目录为 `frontend/src/components/ui`，语义颜色与圆角为 `frontend/src/styles/tokens.css`。新组件使用 `bg-background`、`text-foreground`、`border-border` 等语义类，不单独假设浅色或深色背景。
- 首页场景借鉴 [Active Theory](https://activetheory.net/) 的留白和中央构图。首页按需加载 Three.js，用同一 SVG 字形生成有厚度、倒角和真实内孔的网格。WebGL2 分两遍渲染：先记录背面的深度与法线，再按波长折射背景、计算边缘反射。独立的粒子层按景深和指针位置变化。原生滚动让标志从正面转向侧面；“探索网关”仍可直接进入功能区。暂停、后台标签页和离开视口后停止连续渲染；WebGL 初始化失败或上下文丢失时显示透明 SVG。主标和粒子底图是仓库自有资产，页面不加载参考站的脚本或素材。

## 在本地复验

在 `frontend` 目录执行 `pnpm install --frozen-lockfile`、`pnpm build`；生产构建输出到后端嵌入目录。通过 `pnpm test:run` 检查前端回归。启动项目后分别访问 `/home`、`/login`、`/key-usage` 和启用后的 `/model-plaza`，检查窄屏导航、键盘焦点、减少动态效果偏好与中英文切换。确认“自定义首页”和“精简首页”均关闭后，再验收 Z30 默认场景。

本次变更作用于本地源码，没有部署到线上。发布前请备份数据库，并用当前生产配置在预发布环境演练新增迁移；源码回滚不等于数据库回滚。
