# Personal Study Dashboard

一个简约的个人 dashboard，用于记录作业完成情况、备忘录和便签。

## Cloudflare Pages

在 Cloudflare Pages 里选择从 GitHub 导入仓库，并使用：

- Framework preset: `Vite`
- Build command: `pnpm run build`
- Build output directory: `dist`
- Root directory: `/`

## Local Development

```bash
pnpm install
pnpm run dev
```

## Production Build

```bash
pnpm run build
```

数据默认保存在浏览器本地。普通访问是只读视图；用 `#edit` 打开一次后，本机进入编辑模式。
