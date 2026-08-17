# Comandos NSFW: funcionamiento automático

Los comandos de la categoría NSFW funcionan con **fuentes públicas gratuitas**. No requieren claves, registros ni variables nuevas. El selector centralizado en `lib/nsfwFetcher.js` prueba primero proveedores de categoría, valida el resultado y conserva los boorus solo como última alternativa cuando una fuente pública no responde.

> Para usarlos debe mantenerse `NSFW_ENABLED=true`. En un grupo, un administrador activa la categoría con `!nsfw on`; en privado, cada usuario puede habilitarla con el mismo comando.

## Selección y filtros

| Orden | Fuente | Uso |
|---|---|---|
| 1 | Purrbot, Nekobot y Nekos.life | Respuestas públicas por categoría para `anal`, `bj`, `blowjob`, `cum`, `gasm`, `hentai`, `pussy`, `yuri` y categorías generales. |
| 2 | waifu.im | Respaldo con etiqueta NSFW y dimensiones para las categorías compatibles. |
| 3 | Danbooru y boorus compatibles | Última alternativa con búsqueda prioritaria de arte original y exclusiones por etiquetas. |

Todas las rutas usan HTTPS, evitan repeticiones recientes por chat y siguen aplicando límites de tamaño. El filtro descarta etiquetas de animales, cruces humano-animal, bestialidad, cómics, viñetas, globos de diálogo, animación occidental, tentáculos, baja calidad, franquicias conocidas y personajes no solicitados. Si una búsqueda preferida de arte original no devuelve opciones, el bot amplía la consulta **sin retirar esas exclusiones**.

## Mapa de categorías

| Comando o alias | Fuente inicial | Respaldo |
|---|---|---|
| `anal` | Purrbot `anal` | waifu.im y boorus filtrados |
| `ass`, `boobs`, `ecchi`, `lewd`, `nsfwwaifu`, `paizuri` | Purrbot `solo` o waifu.im según la etiqueta | Boorus filtrados |
| `bj`, `blowjob` | Purrbot `blowjob` | waifu.im `oral` y boorus filtrados |
| `cum` | Purrbot `cum` | Boorus filtrados |
| `gasm` | Nekos.life `gasm` | Purrbot `solo` y boorus filtrados |
| `hentai`, `ahegao` | Nekobot o Purrbot `solo` | waifu.im y boorus filtrados |
| `pussy` | Purrbot `pussylick` | Boorus filtrados |
| `lesbian`, `yuri` | Purrbot `yuri` | Boorus filtrados |
| Categorías restantes | waifu.im cuando existe etiqueta | Boorus filtrados |
| `hentaigif` | Consulta automática de medios animados | Nueva búsqueda si falla el primer medio |

## Calidad automática de `ytmp4`

El comando `ytmp4` utiliza exclusivamente la API pública de **Loader.to**. No usa BTCH, Siputzx, Agatz, motores locales, binarios, conversión local ni recodificación.

La interfaz pública de Loader.to declara las opciones MP4 `144p`, `240p`, `360p`, `480p`, `720p`, `1080p` y `1440p`. El modo automático solicita **720p → 480p → 360p → 240p → 144p**. También acepta una calidad manual con la sintaxis `ytmp4 720p <url>`; en ese modo intenta únicamente la calidad elegida. Para cada calidad, el bot inicia el trabajo, consulta la `progress_url` proporcionada por la API y espera el `download_url` final. Un trabajo que aún está preparando el archivo no se interpreta como fallo; el bot solo baja de calidad ante un rechazo explícito o tras agotar el tiempo de espera de esa calidad. El MP4 se descarga directamente desde el enlace final de Loader.to y se envía sin modificarlo.

## Configuración mínima

```dotenv
NSFW_ENABLED=true
NSFW_PRIVATE_ENABLED=true
```

No se debe añadir ninguna clave de API para estos flujos.

## Referencias

[1] [Purrbot API v2](https://docs.purrbot.site/api/)
[2] [waifu.im — Getting Started](https://docs.waifu.im/docs/getting-started/)
[3] [Nekos.life endpoint reference](https://unpkg.com/nekos.life@2.0.7/README.md)
[4] [Loader.to — API flow](https://video-download-api.com/youtube-download-api)
