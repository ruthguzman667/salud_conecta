# Salud Conecta – MVP

Aplicación web de recordatorios de medicamentos y controles, con aviso a un cuidador.
Es un proyecto estático: HTML, CSS y JavaScript, sin servidor. Los datos se guardan en el navegador (localStorage).

## Archivos
- `index.html`  → estructura de la aplicación
- `app.js`      → funcionamiento (recordatorios, datos, avisos)
- `styles.css`  → estilos (colores, tamaños, modo oscuro)
- `manifest.webmanifest` e `icons/` → permiten instalarla en el celular
- `sw.js` → permite abrirla sin conexión
- `vercel.json` → configuración de Vercel

## Probar en el computador
1. Abrir la carpeta en Visual Studio Code.
2. Instalar la extensión "Live Server" y hacer clic en "Go Live" (o ejecutar `npx serve .` en la terminal).

## Publicar en Vercel
Ver los pasos en la conversación: subir a GitHub e importar el repositorio en vercel.com (sin comandos de compilación).
