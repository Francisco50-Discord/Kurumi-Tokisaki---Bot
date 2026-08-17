// ============================================================
//   Kurumi Tokisaki - Auto-Instalación de Dependencias v6.0
//   ──────────────────────────────────
//   • ffmpeg/ffprobe son necesarios para stickers,
//     conversión webp/png, extracción de audio (Shazam).
//   • Se descargan builds estáticos SIN sudo para que funcione
//     en hosting compartido (Pterodactyl, Termux, BoxMine, etc.).
// ============================================================

import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const binDir = path.join(rootDir, 'bin');

// Tamaño mínimo razonable para considerar el binario como válido
const MIN_FFMPEG_SIZE = 30_000_000;     // 30MB (ffmpeg estático pesa 70-80MB)

// URL de descargas (builds estáticos oficiales)
// BtbN/FFmpeg-Builds: builds estáticos GPL en GitHub releases (más confiables que johnvansickle.com)
// Estructura del tar: ffmpeg-master-latest-linux64-gpl/bin/ffmpeg, ffprobe
const FFMPEG_URLS = {
  x64:   'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz',
  arm64: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-gpl.tar.xz',
  // Fallback a johnvansickle para arquitecturas raras (armhf, i686)
  arm:   'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armhf-static.tar.xz',
  ia32:  'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-i686-static.tar.xz',
};

// ============================================================
// Helper: detectar si un binario está disponible en PATH
// ============================================================
function isBinaryAvailable(name) {
  try {
    execSync(`command -v ${name} 2>/dev/null`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================
// Helper: descargar archivo con curl o wget (sin importar cuál haya)
// ============================================================
function downloadFile(url, destPath, timeoutMs = 180000) {
  const cmds = [
    `curl -fsSL --connect-timeout 30 --max-time ${Math.floor(timeoutMs / 1000)} -o "${destPath}" "${url}"`,
    `wget -q --timeout=30 -O "${destPath}" "${url}"`,
  ];
  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: 'ignore', timeout: timeoutMs });
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
        return true;
      }
    } catch (e) {
      // intentar siguiente comando
    }
  }
  return false;
}

// ============================================================
// Helper: extraer ffmpeg y ffprobe de un tar.xz estático
// ============================================================
function extractFfmpegStatic(tarPath, outDir) {
  // El tar.xz de johnvansickle tiene estructura: ffmpeg-VERSION-ARCH-static/ffmpeg, ffprobe, qt-faststart, etc.
  // Necesitamos extraer solo ffmpeg y ffprobe al bin/ local.
  try {
    // Listar contenido para encontrar rutas exactas
    const listing = execSync(`tar -tJf "${tarPath}"`, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    }).toString();

    const ffmpegMember = listing.split('\n').find(p => p.endsWith('/ffmpeg') && !p.includes('qt-faststart'));
    const ffprobeMember = listing.split('\n').find(p => p.endsWith('/ffprobe'));

    if (!ffmpegMember || !ffprobeMember) {
      console.log(chalk.yellow('    ⚠ No se encontraron binarios ffmpeg/ffprobe dentro del tar.'));
      return false;
    }

    // Extraer solo esos dos miembros
    execSync(`tar -xJf "${tarPath}" -C "${outDir}" "${ffmpegMember}" "${ffprobeMember}"`, {
      stdio: 'ignore',
      timeout: 120000,
    });

    // Mover a bin/ffmpeg y bin/ffprobe
    const extractedFfmpeg = path.join(outDir, ffmpegMember);
    const extractedFfprobe = path.join(outDir, ffprobeMember);
    const finalFfmpeg = path.join(outDir, 'ffmpeg');
    const finalFfprobe = path.join(outDir, 'ffprobe');

    if (fs.existsSync(finalFfmpeg)) fs.unlinkSync(finalFfmpeg);
    if (fs.existsSync(finalFfprobe)) fs.unlinkSync(finalFfprobe);

    fs.renameSync(extractedFfmpeg, finalFfmpeg);
    fs.renameSync(extractedFfprobe, finalFfprobe);

    // Limpiar carpeta vacía que quedó de la extracción
    const extractedDir = path.dirname(extractedFfmpeg);
    try { fs.rmdirSync(extractedDir); } catch (e) {}

    // Hacer ejecutables
    fs.chmodSync(finalFfmpeg, 0o755);
    fs.chmodSync(finalFfprobe, 0o755);

    return fs.existsSync(finalFfmpeg) && fs.existsSync(finalFfprobe);
  } catch (e) {
    console.log(chalk.yellow(`    ⚠ Falló extracción de ffmpeg: ${e.message}`));
    return false;
  }
}

// ============================================================
// Helper: detectar arquitectura del sistema
// ============================================================
function detectArch() {
  const arch = process.arch; // 'x64', 'arm64', 'arm', 'ia32'
  if (FFMPEG_URLS[arch]) return arch;
  // Fallback: usar uname -m
  try {
    const uname = execSync('uname -m', { stdio: 'pipe' }).toString().trim();
    if (uname === 'x86_64' || uname === 'amd64') return 'x64';
    if (uname === 'aarch64' || uname === 'arm64') return 'arm64';
    if (uname.startsWith('armv')) return 'arm';
    if (uname === 'i686' || uname === 'i386') return 'ia32';
  } catch (e) {}
  return 'x64'; // default más común
}

// ============================================================
// Helper: añadir bin/ al PATH del proceso
// ============================================================
export function setupBinPath() {
  if (!fs.existsSync(binDir)) {
    try { fs.mkdirSync(binDir, { recursive: true }); } catch (e) {}
  }
  // Asegurar que bin/ esté primero en PATH para que nuestros binarios tengan prioridad
  const currentPath = process.env.PATH || '';
  if (!currentPath.split(':').includes(binDir)) {
    process.env.PATH = `${binDir}:${currentPath}`;
  }
}

// ============================================================
// Función principal: verificar e instalar todo lo necesario
// ============================================================
export async function checkDependencies() {
  console.log(chalk.cyan('🔍 Verificando entorno y dependencias...'));

  setupBinPath();

  // 1. Verificar node_modules y librerías críticas
  const criticalLibs = ['@whiskeysockets/baileys', '@hapi/boom', 'axios', 'chalk', 'pino', 'sharp', 'jimp', 'qrcode-terminal'];
  let needsInstall = !fs.existsSync(path.join(rootDir, 'node_modules'));

  if (!needsInstall) {
    for (const lib of criticalLibs) {
      if (!fs.existsSync(path.join(rootDir, 'node_modules', lib.split('/')[0]))) {
        needsInstall = true;
        break;
      }
    }
  }

  if (needsInstall) {
    console.log(chalk.yellow('📦 Faltan dependencias de Node. Instalando...'));
    try {
      execSync('npm install --legacy-peer-deps', { cwd: rootDir, stdio: 'inherit' });
      console.log(chalk.green('✅ Librerías de Node instaladas.'));
    } catch (error) {
      console.error(chalk.red('❌ Error en npm install:'), error.message);
    }
  }

  // 2. Asegurar que existe bin/
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  // ============================================================
  // 3. Instalar ffmpeg + ffprobe estáticos (bin/ffmpeg, bin/ffprobe)
  // ============================================================
  let ffmpegReady = false;
  let ffprobeReady = false;

  // Primero verificar en PATH del sistema
  if (isBinaryAvailable('ffmpeg')) {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      console.log(chalk.green('✅ ffmpeg del sistema detectado.'));
      ffmpegReady = true;
    } catch (e) {}
  }
  if (isBinaryAvailable('ffprobe')) {
    ffprobeReady = true;
  }

  // Si falta alguno, intentar con binarios locales
  const localFfmpeg = path.join(binDir, 'ffmpeg');
  const localFfprobe = path.join(binDir, 'ffprobe');

  if (!ffmpegReady && fs.existsSync(localFfmpeg) && fs.statSync(localFfmpeg).size > MIN_FFMPEG_SIZE) {
    try {
      fs.accessSync(localFfmpeg, fs.constants.X_OK);
      execSync(`"${localFfmpeg}" -version`, { stdio: 'ignore' });
      console.log(chalk.green('✅ ffmpeg local detectado en bin/ffmpeg.'));
      ffmpegReady = true;
    } catch (e) {}
  }

  if (!ffprobeReady && fs.existsSync(localFfprobe) && fs.statSync(localFfprobe).size > 1_000_000) {
    try {
      fs.accessSync(localFfprobe, fs.constants.X_OK);
      execSync(`"${localFfprobe}" -version`, { stdio: 'ignore' });
      ffprobeReady = true;
    } catch (e) {}
  }

  // Si ffmpeg sigue faltando, descargar build estático (sin sudo)
  if (!ffmpegReady || !ffprobeReady) {
    console.log(chalk.yellow('🎥 ffmpeg/ffprobe no encontrados. Descargando build estático...'));
    const arch = detectArch();
    const url = FFMPEG_URLS[arch];
    if (!url) {
      console.log(chalk.yellow(`⚠️ Arquitectura no soportada: ${arch}. ffmpeg no se instalará.`));
    } else {
      console.log(chalk.cyan(`    Arquitectura: ${arch}`));
      const tmpTar = path.join(binDir, 'ffmpeg-static.tar.xz');
      const ok = downloadFile(url, tmpTar, 300000); // 5 min timeout
      if (ok) {
        const extracted = extractFfmpegStatic(tmpTar, binDir);
        try { fs.unlinkSync(tmpTar); } catch (e) {}
        if (extracted) {
          console.log(chalk.green('✅ ffmpeg + ffprobe instalados en bin/ (build estático).'));
          ffmpegReady = true;
          ffprobeReady = true;
        } else {
          console.log(chalk.yellow('⚠️ La extracción de ffmpeg falló. Los stickers pueden no generarse correctamente.'));
        }
      } else {
        console.log(chalk.yellow('⚠️ No se pudo descargar ffmpeg (sin internet o firewall).'));
        console.log(chalk.yellow('    Descarga manual de https://johnvansickle.com/ffmpeg/ y pon los binarios en bin/'));
      }
    }
  }

  // ============================================================
  // 4. Reportar estado final
  // ============================================================
  console.log(chalk.cyan('\n📋 Estado de dependencias:'));
  console.log(`   • ffmpeg:    ${ffmpegReady ? '✅' : '❌'} ${ffmpegReady ? '(sistema o bin/ffmpeg)' : '(FALTANTE — stickers fallarán)'}`);
  console.log(`   • ffprobe:   ${ffprobeReady ? '✅' : '❌'} ${ffprobeReady ? '(sistema o bin/ffprobe)' : '(opcional)'}`);
  console.log('');

  // 5. Asegurar directorios del proyecto
  ['temp', 'session', 'database', 'assets', 'data'].forEach(dir => {
    const p = path.join(rootDir, dir);
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch (e) {}
    }
  });

  // Re-aplicar PATH por si acaso
  setupBinPath();

  return { ffmpegReady, ffprobeReady };
}

// ============================================================
// Helper exportado: obtener ruta de binarios verificados
// ============================================================
export function getBinaryPath(name) {
  // Primero buscar en bin/ local
  const local = path.join(binDir, name);
  if (fs.existsSync(local)) {
    try {
      fs.accessSync(local, fs.constants.X_OK);
      return local;
    } catch (e) {}
  }
  // Luego en PATH del sistema
  if (isBinaryAvailable(name)) {
    return name; // execFile lo encontrará vía PATH
  }
  return null;
}
