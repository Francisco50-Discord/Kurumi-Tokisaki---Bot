# Despliegue portable de Kurumi Tokisaki Bot

El proyecto usa el comando estándar `npm start`, un servidor HTTP que atiende el puerto entregado en `PORT` y rutas configurables para sesión y base de datos. Por ello puede ejecutarse en **Heroku**, **Replit**, **Boxmine/Pterodactyl**, Render, Koyeb, Railway u otro proveedor compatible con **Node.js 20+**.

> La compatibilidad de arranque no equivale a persistencia garantizada. Para conservar la vinculación de WhatsApp después de un reinicio, el proveedor debe ofrecer un disco o volumen persistente.

## Requisitos comunes

| Requisito | Valor recomendado | Motivo |
|---|---:|---|
| Runtime | Node.js 20 o superior | La versión actual de Baileys requiere Node.js 20+. |
| Comando de inicio | `npm start` | Usa `entry.js`, prepara compatibilidad Web API y arranca el bot. |
| Puerto | `PORT` entregado por el host | El panel responde en `0.0.0.0:$PORT`; no fijar un puerto distinto. |
| Memoria | 512 MB como mínimo | El arranque limita el heap de Node a 320 MB para dejar margen al sistema. |
| Almacenamiento persistente | Recomendado | Evita perder `kurumi_session/` y `data/database.json`. |

## Variables de entorno

Copia `.env.example` como referencia. No subas un archivo `.env` real ni la carpeta de sesión al repositorio.

| Variable | Uso | Ejemplo |
|---|---|---|
| `PORT` | Puerto asignado por el proveedor. Normalmente se entrega automáticamente. | `3000` |
| `BOT_NUMBER` | Número de WhatsApp para solicitar la vinculación, solo dígitos. | `529852277382` |
| `BOT_DATA_DIR` | Directorio raíz de un volumen persistente. Guarda sesión y base de datos en un mismo lugar. | `/data` |
| `SESSION_PATH` | Alternativa si la carpeta de sesión necesita una ruta concreta. | `/data/kurumi_session` |
| `DB_PATH` | Alternativa si la base de datos necesita una ruta concreta. | `/data/data/database.json` |
| `HOT_RELOAD` | Debe permanecer en `false` en producción. | `false` |

## Heroku

Heroku reconoce el archivo `Procfile` y ejecutará `web: npm start`. Define `BOT_NUMBER` en Config Vars. Su sistema de archivos estándar es efímero: para no perder la sesión al reiniciar, configura un almacenamiento externo o un disco persistente compatible y apunta `BOT_DATA_DIR` a él.

## Replit

El archivo `.replit` usa el mismo comando `npm start`. Define las variables en **Secrets**. Si el proyecto dispone de almacenamiento persistente, usa su ruta como `BOT_DATA_DIR`; si no, guarda una copia privada de la sesión antes de reiniciar el Repl.

## Boxmine o paneles Pterodactyl

Selecciona una plantilla de **Node.js 20**. Establece el comando de inicio como `npm start`, instala dependencias con `npm install` y define `BOT_NUMBER` en las variables del panel. Estos paneles conservan archivos normalmente, pero verifica que no tengas habilitada una opción de reinstalación o limpieza al reiniciar.

## Otros proveedores

Para Render, Railway, Koyeb o servicios similares, utiliza Node.js 20+, el comando de compilación `npm install` y el comando de inicio `npm start`. El bot utiliza `process.env.PORT`, por lo que no hay que codificar un puerto en el panel. Si el proveedor ofrece un volumen, monta el volumen y usa su ruta en `BOT_DATA_DIR`.

## Primera vinculación y copias de seguridad

Al abrir la URL pública del servicio, el panel muestra el estado y permite solicitar el código de vinculación. Después de vincular, conserva de forma privada una copia de la carpeta definida por `SESSION_PATH` o de `BOT_DATA_DIR/kurumi_session`. No la compartas: contiene credenciales de acceso de WhatsApp.

Para reiniciar sin perder la sesión, usa la opción de reconexión normal del panel. La opción de limpiar sesión borra las credenciales intencionalmente y requiere una nueva vinculación.

## Limitaciones de los servicios gratuitos

Algunos planes gratuitos suspenden procesos, limitan RAM/CPU o eliminan el disco al redesplegar. El código ya reduce trabajo innecesario y elimina el bucle de mensajes propios, pero ningún cambio de código puede convertir un disco efímero en persistente. Si el host borra archivos, restaura una copia privada de sesión o usa un volumen compatible.
