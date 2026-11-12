# Workspace Atlas

**把项目放进星海，让每一次探索都有目的地。**

一个由 Three.js 驱动的三维工作空间导航：每个项目都是外观独特的星球，点击后平滑飞近，自动巡航依次掠过各个项目。程序化生成的星云、吸积盘、星环和卫星组成整个场景，无需下载外部贴图。

[在线演示](https://cgbpnw5bw4-create.github.io/workspace-atlas/) · [English](README.en.md) · [MIT License](LICENSE)

![Workspace Atlas 星海总览](docs/images/atlas-overview.jpg)

## 体验

- **48 个虚构项目、4 个星域**：Engineering、Design、Research、Archive，打开即可探索。
- **从总览抵达项目**：点击星球、浮动标签或目录卡片，镜头飞近后展开项目面板。
- **自动巡航**：按当前筛选依次参观，拖动、滚轮或“接管镜头”随时接管。
- **项目目录**：搜索、分组、排序、网格与列表切换；收藏保存在当前浏览器。
- **文件与服务面板**：演示版使用模拟目录和模拟状态；可选择连接自己的本地工作目录。

![项目抵达与目录面板](docs/images/atlas-project.jpg)

## 快速启动

需要 **Node.js 24** 和支持 **WebGL 2** 的现代浏览器。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。默认运行静态演示，不扫描电脑，也不需要账号、API Key 或业务后台。

构建并预览：

```sh
npm run build
npm run preview
```

`dist/` 可以部署为静态网站，包括 GitHub Pages。

## 操作

| 操作 | 效果 |
| --- | --- |
| 拖动 / 滚轮 | 环绕 / 缩放，巡航时立即接管 |
| 点击星球、标签或目录项目 | 飞近并打开项目 |
| `Ctrl+K` / `⌘K` | 聚焦项目搜索；文件面板打开时聚焦文件筛选 |
| `Esc` | 停止巡航、取消飞行，或关闭当前面板 |
| 自动巡航 | 依次参观当前筛选下的项目 |
| 暂停 / 返回总览 | 控制环境动画 / 返回星海 |

## 连接本地工作目录

此功能按 `工作目录 / 分组 / 项目` 两级目录组织项目，例如：

```text
YourWorkspace/
├── Engineering/
│   ├── Orbital CAD/
│   └── Plasma Lab/
└── Design/
    └── Prism Studio/
```

在 PowerShell 中显式指定自己的根目录，再启动：

```powershell
npm run build
$env:ATLAS_ROOT = 'D:\YourWorkspace'
npm start
```

访问 `http://127.0.0.1:4317`，服务会进入本地模式。端口冲突时可先设置 `$env:ATLAS_PORT = '4318'`。Linux/macOS 可用 `ATLAS_ROOT=/path/to/YourWorkspace npm start`；目录浏览可跨平台使用，默认程序打开和资源管理器定位需要 Windows，其他平台会返回不支持的说明。

本地模式扫描项目目录、浏览文件，并在 Windows 中打开文件或定位目录。通用开源版未接入业务后台启动命令，本地服务列表为空。只有显式配置 `ATLAS_ROOT` 才会扫描本地目录；未设置时 `npm start` 仍提供演示版。恢复默认演示可清除环境变量：`Remove-Item Env:ATLAS_ROOT`。

**本地 API 仅监听 `127.0.0.1`，请勿转发到公网。** GitHub Pages 只发布静态演示，不部署本地 API，也不包含你的文件。

## 源码结构

| 文件 | 职责 |
| --- | --- |
| `src/main.js` | 目录、搜索、收藏、文件面板与场景交互 |
| `src/scene.js` | 星海、镜头飞行、巡航与项目选择 |
| `src/planets.js` | 可复现的程序化星球、星环与卫星 |
| `src/nebula.js` | 程序化星云背景 |
| `server.mjs` | 可选的本地目录 API 与静态文件服务 |
| `tests/` | 本地 API 信任边界测试 |
| `.github/workflows/` | 构建检查与手动 Pages 发布 |

## 局限

这是用于工作空间导航和视觉展示的艺术场景，不是天文模拟。演示项目、文件和服务状态均为虚构，刷新不会连接真实业务服务。WebGL 场景在低性能设备上可能较慢；无法启用 3D 加速时仍可使用项目目录。当前构建可能提示场景分块超过 500 kB，该提示不影响构建完成。

## 许可证

项目使用 [MIT License](LICENSE)。Three.js 等依赖的归属和许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
