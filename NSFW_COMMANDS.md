# Comandos NSFW: funcionamiento automático

Los comandos de la categoría NSFW funcionan con **fuentes públicas gratuitas**. No requieren claves, registros ni variables nuevas. El selector centralizado en `lib/nsfwFetcher.js` prueba primero proveedores de categoría, valida el resultado y conserva los boorus solo como última alternativa cuando una fuente pública no responde.

> Para usarlos debe mantenerse `NSFW_ENABLED=true`. En un grupo, un administrador activa la categoría con `!nsfw on`; en privado, cada usuario puede habilitarla con el mismo comando.

## Selección y filtros

El selector usa varias fuentes, pero nunca intercambia una categoría por otra. Una fuente solo se acepta cuando su endpoint o sus etiquetas representan la categoría solicitada.

| Orden | Fuente | Uso |
|---|---|---|
| 1 | PurrBot, Nekobot y Nekos.life | Solo endpoints públicos dedicados: `anal`, `blowjob`, `cum`, `gasm`, `hentai` y `yuri`, entre los que están documentados y disponibles. |
| 2 | waifu.im | Solo cuando existe un tag equivalente al comando, como `ass`, `boobs`, `ecchi`, `hentai` o `paizuri`; no se usa como sustituto genérico. |
| 3 | Danbooru, Xbooru, Yande.re y Konachan | Consultas explícitas por tags de la categoría solicitada, con exclusiones locales, límites de tamaño y control de calidad. |

Todas las rutas usan HTTPS, evitan repeticiones recientes por chat y aplican límites de tamaño. Se descartan animales, contenido furry/anthro/feral, escenas sexuales entre animales, cruces humano-animal, bestialidad, cómics, viñetas, globos de diálogo, animación occidental, variantes `toons`/`famous_toons`, contenido sexual no consentido o de cautiverio, tortura, baja calidad, arte de IA, marcas de agua, logos, texto promocional y etiquetas de identidad no solicitadas. Si la consulta preferida no devuelve opciones, solo se amplía dentro de la **misma categoría** y sin retirar exclusiones.

Como regla adicional, se excluyen las escenas de sexo grupal o con múltiples participantes mediante `group_sex`, `gangbang`, `threesome`, `foursome`, `multiple_partners`, `multiple_male` y `polyamory`. **`orgy`, `orgia` y `harem` quedan permitidos** y no se filtran por sí solos. También se excluyen `futanari`/`futa`, `intersex`, `newhalf`, `otoko_no_ko`, `transgender` y variantes de anatomía masculina incompatible en personajes femeninos, incluidos `dickgirl`, `dick_girl`, `shemale`, `penis_on_female`, `female_with_penis` y `female_penile`. También se excluyen `yaoi`, `bl`, `boys_love`, `gay`, `male_on_male`, `male_male`, `boy_on_boy` y `bara`. Se bloquean además `furry`, `anthro`, `feral`, `animal_on_animal`, `animal_sex`, `animal_mating` y etiquetas equivalentes de bestialidad. El filtro rechaza asimismo `rape`, `nonconsensual`, `forced`, `coercion`, `captive`, `captivity`, `prisoner`, `cage`, `torture`, `let_me_go`, `no_means_no` y etiquetas equivalentes. Se excluyen también las variantes `cartoon_character`, `toons`, `famous_toons`, `famous_toons_facial`, `watermark` y material promocional. Asimismo, se excluyen los fetiches `hyper`, `breast_expansion`, `breast_expansion_animation`, `breast_expansion_fetish`, `breast_growth`, `dick_nipples`, `dicknipples`, `phallic_nipples` y `phallic_nipple`. **No se excluyen** `hetero`, `straight`, `male`, `1boy`, `male_on_female`, `breasts`, `large_breasts` ni `huge_breasts` por sí solas, ni la participación de un hombre con una mujer adulta. `bondage`/`shibari` de `/keta` tampoco se bloquea por sí solo cuando no está acompañado de señales de coerción o cautiverio. Una escena heterosexual de una sola pareja adulta sigue permitida; el bloqueo adicional se refiere a múltiples participantes, no a la presencia masculina permitida en una relación hombre-mujer.

Los endpoints que devuelven GIF o vídeo se marcan como animados. Los comandos NSFW de imagen no envían esos resultados como JPG; `/cum` y `/hentaigif` son los flujos que solicitan medios animados explícitamente.

## Mapa de categorías

| Comando o alias | Categoría interna | Consulta o fuente permitida |
|---|---|---|
| `anal` | `anal` | Endpoint `anal` y tags `anal`. |
| `pussy` | `pussy` | Tags `pussy`/`vagina`; no se sustituye por `pussylick`. |
| `ass` | `ass` | Tags `ass`/`butt`/`buttocks` y tag equivalente de waifu.im cuando aplica. |
| `boobs` | `boobs` | Tags `breasts`/`cleavage`/`nipples` y tag equivalente de waifu.im. |
| `feet` | `feet` | Tags `feet`/`soles`. |
| `bj`, `blowjob` | `blowjob` | Endpoint `blowjob` y tags `blowjob`/`fellatio`. |
| `cumshot` | `cum` | Endpoint `cum` y tags `cum`; el comando continúa separado de `/cum`. |
| `gasm` | `gasm` | Endpoint `gasm` y tags `orgasm`/`female_orgasm`, sin sustituir por `ahegao`. |
| `hentai`, `ahegao` | Su categoría propia | Endpoints o tags respectivos; no caen automáticamente en hentai desde otra categoría. |
| `lesbian`, `yuri` | `lesbian`/`yuri` | Endpoint `yuri` o tags `female_on_female`/`yuri`. |
| `kuni` | `kuni` | Tags `cunnilingus`. |
| `keta` | `keta` | Tags `bondage`/`shibari`. |
| `erok` | `erok` | Tags `kitsune`. |
| `holoero` | `holoero` | Tags `hololive`, como excepción de obra solicitada. |
| `lewd` | `lewd` | Tags `panties`. |
| `paizuri` | `paizuri` | Tags `paizuri`/`breast_hold` y tag equivalente de waifu.im. |
| `ecchi` | `ecchi` | Tags `bikini` con filtros de categoría. |
| `nsfwneko`, `neko` | Su categoría propia | Tags `catgirl`/`nekomimi`; no se sustituye por waifu genérico. |
| `succubus`, `thighs` | Su categoría propia | Tags `succubus` o `thighhighs`. |
| `cum` | No es un alias público NSFW | Reservado internamente para `/cumshot`; `/cum` usa la categoría Anime `facial`. |
| `hentaigif` | `hentaigif` | Consulta de medios animados etiquetados como `animated`; se convierte y valida antes del envío. |

El comando Anime `/cum` mantiene además sus cuatro imágenes locales aprobadas como último respaldo cuando ningún GIF remoto supera la validación.

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
