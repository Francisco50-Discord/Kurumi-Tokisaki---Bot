#!/bin/bash
# ============================================================
#   Kurumi Tokisaki Bot - Script de Instalación para Termux
#   Creado por: Francisco
#   Versión: 5.2.0 (Descargas multiplataforma + Shazam)
# ============================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # Sin color

# Banner
echo -e "${MAGENTA}"
echo "╔══════════════════════════════════════════╗"
echo "║     🌸  KURUMI TOKISAKI BOT  🌸          ║"
echo "║     Script de Instalación Automática     ║"
echo "║     Versión: 5.2.0                       ║"
echo "║     Creado por: Francisco                ║"
echo "║     Novedades: Descargas + Shazam + IA   ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Función de log
log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Verificar si estamos en Termux
if [ -d "/data/data/com.termux" ] || [ -n "$TERMUX_VERSION" ]; then
    IS_TERMUX=true
    log_info "Detectado: Termux"
else
    IS_TERMUX=false
    log_info "Detectado: Linux/Ubuntu"
fi

# ============================================================
# PASO 1: Actualizar paquetes
# ============================================================
log_info "Actualizando paquetes del sistema..."

if [ "$IS_TERMUX" = true ]; then
    pkg update -y && pkg upgrade -y
    log_success "Paquetes de Termux actualizados"
else
    sudo apt-get update -y && sudo apt-get upgrade -y
    log_success "Paquetes del sistema actualizados"
fi

# ============================================================
# PASO 2: Instalar dependencias del sistema
# ============================================================
log_info "Instalando dependencias del sistema..."

if [ "$IS_TERMUX" = true ]; then
    # Termux
    pkg install -y nodejs git ffmpeg python wget curl openssl
    pkg install -y libjpeg-turbo libpng libwebp
    # Python pip
    pkg install -y python-pip 2>/dev/null || pkg install -y python
    # Asegurar que ffmpeg esté en el PATH para los plugins de stickers
    export FFMPEG_PATH=$(which ffmpeg)
    log_success "Dependencias de Termux instaladas"
else
    # Ubuntu/Debian
    sudo apt-get update
    sudo apt-get install -y nodejs npm git ffmpeg python3 python3-pip wget curl \
        libjpeg-dev libpng-dev libwebp-dev build-essential \
        libcairo2-dev libpango1.0-dev libgif-dev \
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
        libcups2 libxkbcommon0 libxcomposite1 libxdamage1 \
        libxrandr2 libgbm1 libasound2
    log_success "Dependencias de Ubuntu instaladas"
fi

# ============================================================
# PASO 3: Verificar versión de Node.js
# ============================================================
log_info "Verificando Node.js..."

NODE_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)

if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    log_warning "Node.js no encontrado o versión antigua. Instalando Node.js 20..."

    if [ "$IS_TERMUX" = true ]; then
        pkg install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi

    log_success "Node.js instalado: $(node --version)"
else
    log_success "Node.js v$(node --version) detectado"
fi

# ============================================================
# PASO 4: Instalar dependencias de Node.js
# ============================================================
log_info "Instalando dependencias de Node.js..."

# Verificar si estamos en el directorio del bot
if [ ! -f "package.json" ]; then
    log_error "No se encontró package.json. Asegúrate de ejecutar este script desde el directorio del bot."
    exit 1
fi

# Instalar dependencias (incluye cheerio, fluent-ffmpeg, formdata-node nuevas)
npm install --legacy-peer-deps --no-audit

if [ $? -eq 0 ]; then
    log_success "Dependencias de Node.js instaladas"
else
    log_warning "Intentando una instalación limpia..."
    rm -rf node_modules package-lock.json
    npm install --legacy-peer-deps
    if [ $? -eq 0 ]; then
        log_success "Dependencias instaladas tras limpieza"
    else
        log_error "Error al instalar dependencias. Prueba: npm install --legacy-peer-deps"
    fi
fi

# ============================================================
# PASO 6: Crear directorios necesarios
# ============================================================
log_info "Creando estructura de directorios..."

mkdir -p data temp assets/stickers kurumi_session bin

log_success "Directorios creados (incluido bin/ para binarios)"

# ============================================================
# PASO 7: Configurar permisos
# ============================================================
log_info "Configurando permisos..."

chmod +x index.js 2>/dev/null || true
chmod +x start.sh 2>/dev/null || true
chmod +x bin/ffmpeg 2>/dev/null || true
chmod +x bin/ffprobe 2>/dev/null || true

log_success "Permisos configurados"

# ============================================================
# PASO 8: Verificar instalación de ffmpeg
# ============================================================
log_info "Verificando ffmpeg..."

if command -v ffmpeg &> /dev/null; then
    log_success "ffmpeg disponible: $(ffmpeg -version 2>&1 | head -1)"
else
    log_warning "ffmpeg no encontrado. Los stickers y descargas de audio pueden fallar."

    if [ "$IS_TERMUX" = true ]; then
        log_info "Instalando ffmpeg en Termux..."
        pkg install -y ffmpeg
    fi
fi

# ============================================================
# PASO 9: Crear archivo .env con configuración completa
# ============================================================
if [ ! -f ".env" ]; then
    log_info "Creando archivo .env..."
    cat > .env << 'EOF'
# ════════════════════════════════════════════════════════════
#   Kurumi Tokisaki Bot - Variables de entorno v5.2
#   ──────────────────────────────────────────────────────────
#   Todas las variables son OPCIONALES. El bot funciona sin
#   ninguna de ellas (usando APIs gratuitas públicas).
#   Pero configurarlas mejora la calidad de servicio.
# ════════════════════════════════════════════════════════════

# ─── IA (opcional, mejora respuestas) ───
# Sin esta key, usa Pollinations AI (gratuito, ilimitado)
# Obtener gratis en: https://aistudio.google.com/app/apikey
# GEMINI_API_KEY=tu_api_key_aqui

# ─── Reconocimiento de música (Shazam) ───
# Sin esta key, funciona con cuota gratuita muy limitada
# Obtener gratis en: https://dashboard.audd.io/
# AUDD_API_KEY=tu_api_key_aqui

# ─── Configuración de red (para hosting con proxy/firewall) ───
# Si tu hosting usa proxy HTTP, configúralo aquí:
# HTTP_PROXY=http://proxy:8080
# HTTPS_PROXY=http://proxy:8080
# NO_PROXY=localhost,127.0.0.1

# ─── Timeouts para hosting lento (BoxMine, Heroku free tier) ───
# Aumentar si la IA tarda mucho en responder
# AI_TIMEOUT_MS=15000
EOF
    log_success "Archivo .env creado con plantilla completa"
else
    log_info "Archivo .env ya existe — conservando configuración actual"
    # Asegurar que tenga las nuevas variables comentadas
    if ! grep -q "AUDD_API_KEY" .env; then
        echo "" >> .env
        echo "# ─── Reconocimiento de música (Shazam) ───" >> .env
        echo "# Obtener gratis en: https://dashboard.audd.io/" >> .env
        echo "# AUDD_API_KEY=tu_api_key_aqui" >> .env
    fi
    log_success "Plantilla .env actualizada (variables nuevas agregadas como comentarios)"
fi

# ============================================================
# PASO 10: Crear script de inicio
# ============================================================
log_info "Creando script de inicio..."

cat > start.sh << 'EOF'
#!/bin/bash
# Script de inicio de Kurumi Tokisaki Bot v5.2

echo "🌸 Iniciando Kurumi Tokisaki Bot v5.2..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no encontrado. Ejecuta install.sh primero."
    exit 1
fi

# Verificar dependencias
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install --legacy-peer-deps
fi

# Asegurar que bin/ esté en PATH (ffmpeg local)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/bin:$PATH"

# Iniciar el bot
echo "🚀 Iniciando bot..."
node index.js
EOF

chmod +x start.sh
log_success "Script de inicio creado"

# ============================================================
# PASO 11: Crear script de actualización
# ============================================================
cat > update.sh << 'EOF'
#!/bin/bash
echo "🔄 Actualizando Kurumi Tokisaki Bot v5.2..."

# Actualizar dependencias npm
echo "📦 Actualizando dependencias..."
npm install --legacy-peer-deps

echo "✅ Actualización completada"
EOF

chmod +x update.sh

# ============================================================
# PASO 12: Resumen final
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅  INSTALACIÓN COMPLETADA  ✅       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${WHITE}Para iniciar el bot:${NC}"
echo -e "  ${CYAN}node index.js${NC}  o  ${CYAN}bash start.sh${NC}"
echo ""
echo -e "${WHITE}Novedades v5.2:${NC}"
echo -e "  ${MAGENTA}🎵 Descargas${NC}: YouTube (MP3/MP4), Facebook, Twitter/X,"
echo -e "     Instagram, TikTok, Pornhub, rule34video, Manga"
echo -e "  ${MAGENTA}🎤 Shazam${NC}: Identifica canciones por audio/video"
echo -e "  ${MAGENTA}🤖 IA${NC}: Modelos Gemini correctos + fallbacks robustos"
echo -e "     para hosting (BoxMine, Heroku, Railway, etc.)"
echo ""
echo -e "${WHITE}Opciones de vinculación:${NC}"
echo -e "  ${YELLOW}QR:${NC} Escanea el código QR con WhatsApp"
echo -e "  ${YELLOW}Código:${NC} Edita config/settings.js y cambia usePairingCode a true"
echo ""
echo -e "${WHITE}Comandos útiles:${NC}"
echo -e "  ${CYAN}!menu${NC} - Ver todos los comandos"
echo -e "  ${CYAN}!ia <mensaje>${NC} - Chatear con la IA"
echo -e "  ${CYAN}!kurumi <mensaje>${NC} - Alias principal de Kurumi"
echo -e "  ${CYAN}!ia diagnose${NC} - Diagnosticar conectividad AI"
echo -e "  ${CYAN}!ytmp3 <url>${NC} - Descargar MP3 de YouTube"
echo -e "  ${CYAN}!ytmp4 <url>${NC} - Descargar MP4 de YouTube"
echo -e "  ${CYAN}!tiktok <url>${NC} - Descargar TikTok sin marca"
echo -e "  ${CYAN}!shazam${NC} - Responder a audio/video para identificar"
echo ""
echo -e "${WHITE}Para hosting (BoxMine, Heroku, Railway):${NC}"
echo -e "  ${YELLOW}1.${NC} Configura GEMINI_API_KEY en variables de entorno"
echo -e "  ${YELLOW}2.${NC} Si la IA no responde, ejecuta ${CYAN}!ia diagnose${NC}"
echo -e "  ${YELLOW}3.${NC} El bot usa Pollinations AI (gratuito) sin API key"
echo ""
echo -e "${MAGENTA}🌸 ¡Kurumi Tokisaki está lista para servirte! 🌸${NC}"
echo ""
