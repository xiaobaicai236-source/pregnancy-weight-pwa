# Pregnancy Weight PWA v1.2.0

一个为 iPhone 设计的极简孕期体重记录 PWA。纯静态 HTML/CSS/JavaScript，无第三方依赖。

## v1.2.0 第三阶段更新

- 历史记录升级为完整可管理列表
- 点击任意历史记录可修改体重或删除单条记录
- 新增“较上次”增重摘要
- 新增“近4周趋势”，自动换算为 kg/周
- 历史记录显示每次相对上一条的变化
- 超过 6 条记录时支持“查看全部 / 收起”
- 曲线与编辑后的历史数据实时联动
- 保持全部数据仅存于本机浏览器

## v1.1.0 第二阶段更新

- iOS 26 / Liquid Glass 风格视觉升级
- 更细腻的毛玻璃、层级、圆角与环境光背景
- 卡片与底部 Sheet 的进入动画和触控反馈
- 深色模式重新调校，跟随 iPhone 系统
- 体重曲线增加渐变参考区与触摸查看记录
- 最近记录列表重新设计
- 保持纯原生 HTML/CSS/JavaScript，无第三方依赖

## 已完成功能

- 输入孕周（周 + 天）与当前体重
- 默认孕前体重 51.5 kg，可在右上角修改
- 自动计算推荐体重与参考范围
- Apple Health 风格动态曲线（纯 Canvas，无联网依赖）
- 当前体重自动保存；同一孕周天数再次输入会覆盖当日记录
- 最近记录列表
- 深色模式随 iPhone 系统自动切换
- PWA / Service Worker 离线缓存
- iPhone 主屏幕图标与 standalone 全屏模式

## 参考曲线

当前版本默认采用“单胎 + 孕前 BMI 正常范围”的常用增重参考模型：

- 4–13 周：总增重逐步到约 0.5–2.0 kg，目标中值约 1.25 kg
- 13 周后：约 0.35–0.50 kg/周，目标中值约 0.425 kg/周

这只是日常记录参考，不替代医生给出的个体化建议。如果你有医生制定的目标曲线，可直接修改 `data.js` 中的参数。

## GitHub Pages 部署

1. 新建一个 GitHub 仓库，例如 `pregnancy-weight-pwa`。
2. 把本目录全部文件上传到仓库根目录。
3. GitHub → Settings → Pages。
4. Build and deployment 选择 **Deploy from a branch**。
5. Branch 选择 `main`，目录选择 `/ (root)`，保存。
6. 等页面发布后，用 iPhone Safari 打开 GitHub Pages 地址。
7. Safari → 分享 → **添加到主屏幕**。

> Service Worker 需要 HTTPS；GitHub Pages 默认就是 HTTPS。

## 本地预览

不能直接双击 `index.html` 测试完整 PWA 缓存功能。建议在目录中启动简单静态服务器：

```bash
python3 -m http.server 8080
```

然后打开 `http://localhost:8080`。

## 数据隐私

体重记录保存在浏览器 `localStorage` 中，不上传服务器。清除 Safari 网站数据或删除网站数据后，本地记录也会被清除。

## 文件结构

```text
pregnancy-weight-pwa/
├── index.html
├── style.css
├── app.js
├── chart.js
├── data.js
├── calculator.js
├── storage.js
├── manifest.json
├── service-worker.js
├── README.md
├── LICENSE
├── .nojekyll
└── assets/
    ├── icon-192.png
    ├── icon-512.png
    └── apple-touch-icon.png
```

## v1.3.0

- 新增孕期累计增重
- 新增当前体重相对推荐线的位置
- 新增近期增重速度判断（参考范围内 / 偏快 / 偏慢）
- 近期增速基于最近最多 4 周的本地记录自动计算
- 完全兼容 v1.0–v1.2 的 LocalStorage 数据，无需重新录入
- Service Worker 缓存升级至 v1.3.0

> 所有趋势均用于日常记录与观察，不用于诊断；个体化目标以产检和医生建议为准。

## v1.4.0

- 曲线升级为 Apple Health 风格
- 同图显示：我的体重、推荐线、正常参考区间带
- 新增当前孕周垂直标记
- 新增曲线图例
- 轻触实际体重记录点可查看孕周、体重与相对推荐线差值
- 保持 v1.0–v1.3 历史记录完全兼容
- Service Worker 缓存升级至 v1.4.0


## v1.5.0 正式版

- 优化 iPhone 主屏幕安装体验
- 增加 iOS Web App 元信息与全屏启动支持
- 增加安全区适配与主屏幕安装提示
- 优化数字输入、键盘与 Enter/完成行为
- 增加减少动画（Reduce Motion）支持
- 强化 Service Worker 离线缓存与旧缓存自动清理
- 完全兼容 v1.0–v1.4 的本地历史记录

### iPhone 使用方法

1. 将整个项目上传到 GitHub 仓库。
2. 在仓库 Settings → Pages 中开启 GitHub Pages。
3. 用 iPhone Safari 打开 GitHub Pages 地址。
4. 点 Safari 底部“分享”。
5. 选择“添加到主屏幕”。
6. 以后直接点“孕期体重”图标使用。

数据保存在浏览器本地存储中。清除 Safari 网站数据或更换设备时，本地记录可能丢失，请注意备份。

## v1.6.0 数据备份版

- 一键导出 JSON 备份文件
- 一键从 JSON 备份恢复
- 备份包含：孕前体重、当前孕周、历史体重记录
- 导入前自动校验文件格式
- 导入时按孕周自动合并记录，避免简单重复
- 导入失败时给出明确提示
- 完全兼容 v1.0–v1.5 的本地记录结构

### 推荐使用方式

每隔一段时间点一次“导出备份”，将 JSON 文件保存到 iCloud Drive、文件 App 或其他安全位置。
如果换手机、清除 Safari 数据或重新部署网站，可以通过“导入备份”恢复记录。


## v1.6.1 修复版

本版本修复 v1.6.0 在浏览器中出现“页面能显示但输入/按钮没有反应”的问题。

修复内容：
- 修复 app.js 与 chart.js 接口不兼容导致的 JavaScript 初始化中断
- 恢复图表旧接口兼容层，同时保留 v1.4 的增强曲线
- 修复安装说明、输入优化、备份功能未初始化的问题
- 修复备份导入没有写回主 LocalStorage 数据的问题
- 所有核心脚本加入 v1.6.1 cache-busting 参数
- Service Worker 改为网络优先并自动清理旧缓存
- 更新 PWA manifest、start_url、scope 与图标声明

### 从 v1.6.0 升级

把本 ZIP 内的文件完整覆盖到 GitHub 仓库根目录，并保留 `assets/` 目录。
GitHub Pages 地址无需改变。

升级后建议在 iPhone Safari 中：
1. 重新打开网站并刷新一次；
2. 如果仍是旧页面，关闭该标签页再重新打开；
3. 极端情况下到“设置 → Safari → 高级 → 网站数据”删除该站点缓存，再重新打开。
