# 上传与发布

此目录已准备为独立公开项目。以下命令供你决定发布时使用；整理文件本身不会创建 GitHub 仓库或自动上传。

## 1. 确认上传范围

只在 **开源副本的根目录** 操作，根目录应包含 `README.md`、`src/`、`package.json` 和 `LICENSE`。不要从它的父目录执行 `git add`。

原项目的完整私有备份、真实项目清单、历史截图、运行日志和个人路径不属于公开项目。**私有备份 ZIP 绝不可上传到公开仓库。** `node_modules/`、`dist/` 和运行数据由 `.gitignore` 排除；保留 `package-lock.json` 供别人复现安装。

本地先运行：

```sh
npm ci
npm test
npm run build
npm run preview
```

确认默认页面显示虚构演示项目，README 图片能够打开。

## 2. 上传 GitHub 仓库

在开源副本根目录打开终端。若还没有 Git 仓库，初始化并提交：

```sh
git init -b main
git add .
git status --short
git commit -m "Prepare Workspace Atlas open-source demo"
```

提交前检查 `git status`，上传清单中不应出现私有备份或本机资料。

下面的 `OWNER` 和 `REPO` 都是占位符，**必须替换为你的 GitHub 用户或组织名和仓库名**。已安装并登录 GitHub CLI 时可运行：

```sh
gh repo create OWNER/REPO --public --source=. --remote=origin --push
```

这条命令会创建公开仓库并推送。也可以在 GitHub 网页创建一个不带 README、许可证或 `.gitignore` 的空仓库，然后执行：

```sh
git remote add origin https://github.com/OWNER/REPO.git
git push -u origin main
```

GitHub 官方说明：[将本地代码添加到 GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。

## 3. 手动发布 GitHub Pages 演示

1. 打开仓库的 **Settings → Pages**。
2. 将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 在 **Actions** 中找到仓库自带的 Pages 发布工作流，选择 **Run workflow**，使用 `main` 分支。
4. 等待构建和部署完成，从工作流或 Pages 设置页面打开实际生成的网站地址。

工作流只上传构建后的 `dist/`，页面默认运行静态演示。不上传源目录之外的文件，也不部署 `server.mjs` 或本地 API。再次发布时手动运行相同工作流。

GitHub 官方说明：[使用自定义工作流发布 Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 4. 仓库展示

建议仓库名称：`workspace-atlas`。

可直接使用的简介：

> A cinematic Three.js workspace navigator with procedural planets, smooth flights and automatic cruise.

建议 Topics：`threejs`、`webgl`、`workspace`、`visualization`、`javascript`、`vite`。

Pages 部署成功后，再把实际网站地址填入仓库 About 的 Website。README 截图来自虚构演示，后续换图时也应使用演示模式。

## 本地模式的发布边界

`ATLAS_ROOT` 仅用于自己的本机工作目录，目录结构为 `root/group/project`。不要把本地 API 转发至公网，不要把真实目录或业务后台配置提交到演示仓库。公开演示不需要设置 `ATLAS_ROOT`。
