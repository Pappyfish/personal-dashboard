# Personal Study Dashboard

一个简约的个人 dashboard，用于记录作业完成情况、备忘录和便签。

## Cloudflare Pages

在 Cloudflare Pages 里选择从 GitHub 导入仓库，并使用：

- Framework preset: `Vite`
- Build command: `pnpm run build`
- Build output directory: `dist`
- Root directory: `/`
- Environment variable: `NODE_VERSION=22`
- Environment variable: `EDIT_PASSWORD=echoyang0577`
- Environment variable: `AUTH_SECRET=<任意长随机字符串>`
- R2 binding: `DASHBOARD_BUCKET`

所有访客会读取同一个 Cloudflare R2 数据文件。只有通过密码验证后，浏览器拿到短期编辑 token，才可以调用写入接口。

## Local Development

```bash
pnpm install
pnpm run dev
```

## Production Build

```bash
pnpm run build
```

数据保存在 Cloudflare R2。普通访问只能查看；点击编辑按钮并输入密码后才可以修改。
