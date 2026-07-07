# GYM

تطبيق ويب عربي للرجال فقط لإدارة التمرين والتعافي والتغذية والتقدم.

## التشغيل محليًا

```bash
npm install
npm run dev
```

## البناء

```bash
npm run build
```

## النشر

ارفع المشروع إلى GitHub ثم اربطه بـ Cloudflare Pages.

- Build command: `npm run build`
- Output directory: `dist`

البيانات محلية داخل IndexedDB، والتطبيق يعمل كـ PWA، ولا يوجد Backend أو تسجيل دخول في هذه النسخة.
