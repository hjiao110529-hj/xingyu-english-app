# 星语英语屋 v0.4（iPhone PWA 测试版）

这是一个可以发布到 HTTPS 网站、再添加到 iPhone 主屏幕的网页应用。它不是已经上架 App Store 的原生 iOS 应用。

## 包含文件
- `index.html`：应用页面与互动逻辑
- `manifest.json`：网页应用名称、图标和启动方式
- `service-worker.js`：基础离线缓存
- `icon-192.png` / `icon-512.png`：PWA 图标
- `apple-touch-icon.png`：iPhone 主屏幕图标

## 推荐发布方式：GitHub Pages

> 注意：GitHub Pages 的公开仓库和发布网页可被任何人访问。当前原型没有账号系统，所有代码均公开，不要在仓库里上传私人数据或密码。

1. 登录 https://github.com/ 。
2. 点右上角 `+`，选 `New repository`。
3. 仓库名称填 `xingyu-english-app`，选择 `Public`，创建仓库。
4. 点 `Add file` → `Upload files`。
5. 把本文件夹里的 6 个应用文件上传到仓库最外层：`index.html`、`manifest.json`、`service-worker.js`、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png`。上传后应直接在仓库首页看到 `index.html`。
6. 点 `Settings` → `Pages`。
7. 在 `Build and deployment` 里选择 `Deploy from a branch`；Branch 选 `main`，Folder 选 `/(root)`；点 `Save`。
8. 等 Pages 页面显示发布网址。第一次发布可能需要几分钟；打开网址并确认页面能正常运行。

官方指南：https://docs.github.com/en/pages/quickstart

## 安装到 iPhone

1. 在 iPhone 上打开 **Safari**（不要使用微信内置浏览器）。
2. 在地址栏打开你的 GitHub Pages 网址。
3. 点击 Safari 的“分享”按钮。
4. 在分享菜单里找到“添加到主屏幕”。如果没有，向下滚动到编辑操作。
5. 如果显示“作为网页应用打开”，建议开启。
6. 点击“添加”。回到主屏幕，点“星语英语”图标即可启动。

Apple 官方说明：https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iph42ab2f3a7/ios

## 使用顺序
1. 首页点“开始分级测评”，独立完成题目。
2. 查看初步结果和分项正确率。
3. 进入“计划”，设置学习目标、每日时间和内容偏好。
4. 在每日计划中勾选完成的任务。
5. 在“单词”页面练拼写；“听力”“阅读”“写作”入口提供额外练习；“档案”查看本机累计记录。

## 重要限制
- 这是功能原型。测评是初步诊断，不是官方 CEFR、雅思或托福评级。
- 语音依赖浏览器/系统的语音合成功能，读音可能因设备而异。
- 学习记录使用当前浏览器本地存储，不同设备之间不会同步；清除浏览器网站数据可能会删除记录。
- service worker 提供基础缓存，但首次打开仍需联网；网页更新后可能需要刷新或重新打开。
- 没有账号、云端同步、服务端、AI 写作评分、推送提醒或支付功能。
