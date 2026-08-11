# 孕期体重监测 Design System

## 1. Atmosphere & Identity

分享卡片右上角使用项目本地的原创坐姿孕妈插画 `assets/share-mother.png`：粉色开衫、暖白孕妇裙与柔和手绘质感，仅作为标题区辅助装饰，不进入数据摘要或曲线区域。插画加载失败时回退到原有单线孕妈轮廓，PNG 生成与原页面功能不得被阻断。

网页继续保持克制、清晰的蓝绿色 Liquid Glass 健康记录体验。分享入口与导出卡片是独立的“温柔留存”层：暖米白纸张、珊瑚笔触、蜜桃数据块和低饱和绿色范围，让用户数据与曲线始终成为第一视觉重点。标志性细节是原创的单线孕妈轮廓与小面积手绘笔触，不复制宣传海报人物或版式。

## 2. Color

### 网页既有令牌

| 角色 | 令牌 | 用途 |
|---|---|---|
| 页面背景 | `--bg`, `--bg-deep` | 深浅模式页面 |
| 玻璃表面 | `--panel`, `--panel-strong`, `--panel-solid` | 卡片、弹层 |
| 文字 | `--text`, `--muted`, `--muted-2` | 主次信息 |
| 品牌蓝 | `--accent`, `--accent-soft` | 主要记录操作 |
| 推荐绿 | `--green` | 通用推荐语义 |

### 分享入口令牌

| 角色 | 令牌 | 浅色 | 深色 | 用途 |
|---|---|---:|---:|---|
| 珊瑚 | `--share-coral` | `#D96F63` | `#F09A8E` | 分享按钮与图标 |
| 深珊瑚 | `--share-coral-deep` | `#B6534C` | `#FFB0A6` | 按压、焦点与强调 |
| 蜜桃 | `--share-peach` | `#F7C9B8` | `#7A4D49` | 按钮渐变终点 |
| 柔光 | `--share-coral-soft` | `rgba(217,111,99,.14)` | `rgba(240,154,142,.18)` | 提示背景 |

### 导出卡片固定浅色令牌

`share-design.js` 是新增分享视觉的唯一原始令牌源。它集中定义网页入口的浅色/深色颜色、间距、字号、圆角、动效和阴影，并由运行时映射为 `--share-*` CSS 变量；同一文件同时定义导出 Canvas 的固定浅色颜色、排版、几何和图表度量。`share-card.css`、`share-card.js` 和 `chart.js` 只消费这些具名令牌，不各自维护另一套原始视觉常量。

| 角色 | Canvas token | 色值 |
|---|---|---:|
| 纸张背景 | `paper`, `paperWarm` | `#FBF4E9`, `#FFF9EF` |
| 主文字 | `ink` | `#4A302D` |
| 次文字 | `mutedWarm` | `#876F68` |
| 实际体重 | `coralDeep` | `#C75F56` |
| 推荐范围 | `sage`, `sageSoft` | `#7EAD88`, `rgba(126,173,136,.20)` |
| 医生目标 | `doctor`, `doctorSoft` | `#8B6AAE`, `rgba(139,106,174,.17)` |

颜色不使用医疗警报式高饱和红色；状态必须同时有文字说明，不能只靠颜色。

## 3. Typography

- 网页与卡片数据：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`。
- 分享标题：同一系统中文字体栈，使用 700–800 字重、轻微负字距与手绘下划线营造圆润手写感；不下载无授权字体。
- 数据使用等宽数字特性；坐标、说明和医学提示保持清晰的系统字体。
- 分享卡片层级：标题 52px，孕周 28px，数据 34–36px，区块标题 26–28px，正文 18–22px。

## 4. Spacing & Layout

- 基础单位：4px。
- 网页容器沿用现有 `app-shell`；分享主入口位于结果洞察区之后、趋势和完整曲线之前。
- 分享卡片固定 1080×1440，安全边距 72px。
- 卡片曲线承载区占总高度约 36%–40%，装饰插画不超过 20%，且不进入曲线绘图区。
- 主要间距：8、12、16、20、24、32、40、48、72px。

## 5. Components

### Share Primary Entry
- **Structure**：简短引导、唯一大型按钮、动态可用性说明。
- **States**：默认、hover、active、focus-visible、disabled、loading。
- **Accessibility**：按钮有明确文本与 `aria-describedby`；禁用状态同步 `aria-disabled`。
- **Layout**：结果区后的 stack；小屏保持整行 48px 以上点击高度。

### Share Auxiliary Entry
- **Structure**：自绘分享箭头图标加“分享”文字。
- **States**：默认、hover、active、focus-visible、disabled。
- **Accessibility**：不使用无文字图标；与主入口进入同一流程。

### Share Dialog
- **Structure**：隐私选项、生成按钮、3:4 预览、保存/分享/重新生成/关闭。
- **States**：设置、生成中、预览、失败；移动端底部弹层内部滚动。

### Export Card
- **Structure**：标题和孕周、自动重排数据摘要、占主导的曲线、状态条与品牌信息；产品网址和二维码属于受功能开关控制的可选尾部内容。
- **Variants**：通用范围、医生目标、并发症参考、无可用范围、单记录、隐私字段关闭。
- **Failure**：装饰绘制失败不得阻断数据、曲线和 PNG 生成。
- **Deferred public link**：产品网址与二维码实现继续保留，由 `share-design.js` 的 `features.shareCardPublicLink` 控制；当前版本默认 `false`，设置面板、网址和二维码均不显示，后续开启时无需恢复或迁移用户记录。

## 6. Motion & Interaction

- 微交互 120–180ms，仅使用 `transform`、`opacity` 与颜色变化。
- 加载期间两个分享入口同时禁用并显示明确状态；不产生重复生成。
- 尊重 `prefers-reduced-motion`，不添加装饰性循环动画。

## 7. Depth & Surface

- 网页沿用现有混合策略：Liquid Glass 的轻边缘、模糊与柔和阴影。
- 导出卡片采用纸张质感：多层暖色渐变、低对比颗粒/笔触、浅边框；不使用大面积阴影或冷灰底。
- 曲线区保持干净，仅使用极淡网格，纹理不得穿过关键读数。

## 8. Accessibility Constraints & Accepted Debt

- 目标：WCAG 2.2 AA；正文对比度至少 4.5:1，大号文字至少 3:1，所有按钮保留可见键盘焦点。
- CJK 文案避免孤字、被裁切基线和过窄换行。
- 不依靠颜色区分通用范围、医生目标和实际体重，图例必须含文字与线型。
- 既有 `style.css` 包含多个历史版本的原始像素与色值；本任务按用户“不重构既有功能”约束，仅把新增分享视觉收口到 `share-design.js`，由 `share-card.css`、`share-card.js` 和 `chart.js` 消费，不扩大既有页面重构范围。
