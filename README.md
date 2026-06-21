# 🎓 MeDebe — Sistema de Recompensas Académicas + Perfiles

App para llevar el control de una recompensa económica otorgada según
las calificaciones académicas, y de deudas con otras personas mediante
**Perfiles**. Corre **100% en Cloudflare**, sin necesidad de habilitar
facturación ni tarjeta de crédito:

- **Cloudflare Pages** → sirve el frontend (HTML, CSS, JS)
- **Cloudflare D1** → base de datos (saldo, movimientos, perfiles e imágenes en base64)
- **Pages Functions** → backend (las rutas `/api/...`)

---

## Estructura del proyecto

```
MeDebe/
├── index.html                 ← Redirección a public/index.html (para preview de GitHub)
├── wrangler.toml               ← Configuración (binding de D1)
├── package.json
├── db/
│   └── schema.sql              ← Estructura de la base de datos (incluye Perfiles)
├── functions/
│   └── api/
│       ├── saldo.js                                  ← GET  /api/saldo
│       ├── ingreso.js                                ← POST /api/ingreso
│       ├── retiro.js                                 ← POST /api/retiro
│       ├── historial.js                              ← GET  /api/historial
│       └── perfiles/
│           ├── index.js                              ← GET/POST /api/perfiles
│           ├── [id].js                                ← GET/DELETE /api/perfiles/:id
│           └── [perfilId]/
│               ├── movimientos.js                     ← GET/POST /api/perfiles/:id/movimientos
│               └── movimientos/
│                   └── [movId].js                     ← DELETE /api/perfiles/:id/movimientos/:movId
└── public/                     ← Todo lo que ve el navegador
    ├── index.html
    ├── ingreso.html
    ├── retiro.html
    ├── historial.html
    ├── perfiles.html            ← Listado de perfiles (buscador + filtros)
    ├── perfil.html               ← Detalle de un perfil (saldo + estadísticas)
    ├── perfil-ingreso.html       ← Añadir deuda (cargo) a un perfil
    ├── perfil-retiro.html        ← Registrar pago en un perfil
    ├── perfil-historial.html     ← Historial de movimientos de un perfil
    ├── img/
    │   └── logo.png            ← Logo de la app (64x64)
    ├── css/styles.css
    └── js/
        ├── main.js
        ├── ingreso.js
        ├── retiro.js
        ├── historial.js
        ├── perfiles.js
        ├── perfil-detalle.js
        ├── perfil-ingreso.js
        ├── perfil-retiro.js
        └── perfil-historial.js
```

---

## Funcionalidad de Perfiles

Los Perfiles permiten registrar deudas con personas (no académicas).
Se accede mediante el botón alargado "Perfiles" debajo del header,
arriba de la tarjeta de saldo, en la pantalla principal.

**Estados de un perfil** (según su saldo):
- 🟢 **MeDebe** — saldo > 0, el perfil te debe dinero.
- 🔴 **LeDebo** — saldo < 0, le debes dinero al perfil.
- ⚪ **Neutro** — saldo = 0.

**Dentro de cada perfil:**
- "Añadir deuda" registra un cargo (asunto, monto vía teclado numérico,
  descripción opcional, imagen opcional) y suma al saldo.
- "Registrar pago" resta del saldo. A diferencia del retiro de Control
  Académico, **no muestra advertencia** al dejar el saldo negativo —
  se procesa directamente.
- El historial del perfil funciona igual que el historial general,
  pero muestra el "Asunto" en vez de la "Nota", y al tocar un
  movimiento se abre una ventana con el detalle completo (asunto,
  balance antes/después, fecha, descripción y foto si existen).
- Manteniendo presionado un perfil o un movimiento aparece la opción
  de eliminarlo. Al eliminar un movimiento, su efecto se revierte
  automáticamente del saldo del perfil (no afecta los totales del
  Control Académico).

---

## Por qué esta arquitectura

Cloudflare Pages solo sirve archivos estáticos: **no puede ejecutar
`server.js` ni Express**. Por eso el backend se reescribió como
**Pages Functions**: cada archivo dentro de `functions/api/` se
convierte automáticamente en un endpoint, sin configuración extra.
Las rutas con corchetes (`[id].js`, `[perfilId]/movimientos.js`) son
rutas dinámicas: Cloudflare las mapea automáticamente a parámetros de
URL (`context.params.id`, `context.params.perfilId`, etc.).

Las imágenes adjuntas se guardan **directamente en D1** como texto en
formato base64 (dentro de la columna `imagen`). Esto evita depender de
Cloudflare R2, que requiere habilitar un plan con facturación. D1 tiene
un límite de ~1MB por valor, por lo que el frontend valida que las
imágenes pesen menos de 700KB antes de subirlas (suficiente para una
foto de boletín o evaluación).

---

## Instalación y deploy paso a paso

### 1. Instalar Node.js (si no lo tenés)
Descargá la versión LTS desde https://nodejs.org e instalala.
Reiniciá la terminal después de instalar.

### 2. Instalar Wrangler (CLI de Cloudflare)
```bash
npm install -g wrangler
```

### 3. Iniciar sesión en Cloudflare
```bash
wrangler login
```
Se abrirá el navegador para que autorices el acceso.

### 4. Crear la base de datos D1
```bash
wrangler d1 create medebe-db
```
Esto te devuelve algo así:
```toml
[[d1_databases]]
binding = "medebe_db"
database_name = "medebe-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Copiá el `database_id` y reemplazalo en `wrangler.toml` (ya tiene un
valor de ejemplo en el lugar correcto).

### 5. Crear las tablas en D1
```bash
wrangler d1 execute medebe-db --remote --file=db/schema.sql
```
**Si ya tenías la base de datos de una versión anterior**, este mismo
comando agrega las tablas nuevas de Perfiles (`perfiles` y
`movimientos_perfil`) sin tocar tus datos existentes, gracias a
`CREATE TABLE IF NOT EXISTS`.

### 6. Probar localmente (opcional)
```bash
npm run dev
```
Abrí `http://localhost:8788` en el navegador.

### 7. Deploy a producción
```bash
npm run deploy
```
Wrangler te va a pedir crear el proyecto de Pages la primera vez
(aceptá los valores por defecto). Al finalizar te da la URL pública,
algo como `https://medebe.pages.dev`.

---

## Uso desde el Motorola G72

Una vez deployado, simplemente abrí la URL `https://medebe.pages.dev`
desde el navegador del celular. Funciona igual que cualquier sitio web,
no requiere instalación.

---

## Escala de recompensas

| Nota | Monto       |
|------|-------------|
| 8    | $2.500 ARS  |
| 9    | $2.500 ARS  |
| 10   | $10.000 ARS |

---

## Reemplazar el logo

El logo de la app está en `public/img/logo.png` (64x64 px). Para
cambiarlo, simplemente reemplazá ese archivo por tu propia imagen
manteniendo el mismo nombre y tamaño recomendado (64x64 px, fondo
transparente preferentemente).

---

## Notas sobre actualizaciones futuras

- Si cambiás algo en `db/schema.sql`, acordate de volver a ejecutarlo
  con `wrangler d1 execute medebe-db --remote --file=db/schema.sql`
  (D1 ignora las tablas que ya existen gracias a `IF NOT EXISTS`).
- Cada deploy con `npm run deploy` sube automáticamente tanto el
  frontend (`public/`) como el backend (`functions/`).
- Si en algún momento subís fotos muy pesadas y D1 empieza a crecer
  mucho de tamaño, se puede migrar a Cloudflare R2 (requiere habilitar
  el plan con facturación, aunque el uso siga siendo gratuito dentro
  del free tier).

