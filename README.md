# MercyShop · Ruleta en línea

Angular 19 + Tailwind CSS 3 + Vercel Functions + Upstash Redis.

## Estructura
```
api/room.ts                  Función serverless (estado de la sala, giro con RNG criptográfico)
public/logo.jpg              Logo de MercyShop
src/app/core/                Modelos, RoomService (API + polling), StorageService (localStorage)
src/app/shared/              WheelComponent (SVG animado), WinnerDialog
src/app/features/moderator/  Panel de moderación (ruta /)
src/app/features/viewer/     Vista pública solo lectura (ruta /v/:id, la del QR)
```

## Local
```bash
npm install
npm start    # front (:4200) + API local (:8787) con proxy /api → así ya no hay 404 en /api/room
```
Sin `.env.local` la API guarda en memoria (solo para desarrollo local); con credenciales usa Upstash Redis igual que en producción.

```bash
npm i -g vercel && vercel link && vercel env pull .env.local   # trae las credenciales de Redis
npm run dev:full                                               # vercel dev: front + /api juntos (opcional)
```
(`npm run dev:front` = solo el front, `npm run dev:api` = solo la API en :8787.)

## Despliegue en Vercel
1. Sube el repo a GitHub e impórtalo en Vercel (usa `vercel.json`).
2. En *Storage* / *Marketplace* agrega **Upstash Redis** y conéctalo al proyecto
   (inyecta `KV_REST_API_URL` y `KV_REST_API_TOKEN`).
3. Deploy.
