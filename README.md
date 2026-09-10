# Dinosaur.io — servidor online

Este servidor habilita salas WebSocket de hasta 15 jugadores. El cliente de GitHub Pages se conecta mediante `wss://` cuando está publicado con HTTPS.

## Probar en tu PC

```bash
npm install
npm start
```

El servidor queda en `ws://localhost:10000` y `http://localhost:10000/health`.

Para probar desde otros equipos de tu misma red, puedes usar `ws://IP-DE-TU-PC:10000` en el cliente.

## Publicarlo para amigos

La opción sencilla es Render: crea un **Web Service** conectado a este directorio/repositorio, usa `npm install` para Build Command y `npm start` para Start Command. Render soporta conexiones WebSocket entrantes en sus Web Services.

Al terminar tendrás una URL como:

`https://tu-servicio.onrender.com`

En el HTML del cliente cambia:

`const ONLINE_SERVER_URL = 'wss://TU-SERVICIO-EN-RENDER.onrender.com';`

por:

`const ONLINE_SERVER_URL = 'wss://tu-servicio.onrender.com';`

También puedes pasar el servidor temporalmente por URL sin editar el HTML:

`https://TU-USUARIO.github.io/TU-REPO/?server=wss%3A%2F%2Ftu-servicio.onrender.com`

El servidor incluye heartbeat y sincroniza el estado de las salas a 10 Hz.
