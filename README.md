# Альфа-Капитал · учебное демо (Команда 44)
Next.js 14 + TypeScript. Данные вымышлены, оценки `source: mock`, реальной интеграции с банком нет.
Запуск: `npm install && npm run dev` · тесты: `npm test` · сборка: `npm run build`.
Деплой: импорт GitHub-репозитория в Vercel (Framework: Next.js, ключей не нужно) или `npx vercel --prod`.
Состояние (черновики, запросы, передачи) хранится в localStorage браузера; API stateless.
Пороги и ставки — `lib/config.ts` (демо-допущения). Логика — `lib/decision.ts`.
