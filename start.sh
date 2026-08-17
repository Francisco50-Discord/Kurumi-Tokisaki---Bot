#!/bin/bash
# Script de inicio de Kurumi Tokisaki Bot

echo "🌸 Iniciando Kurumi Tokisaki Bot..."

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

# Iniciar el bot
echo "🚀 Iniciando bot..."
node index.js
