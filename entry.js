import "dotenv/config";
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
} else if (!globalThis.crypto.subtle) {
    Object.defineProperty(globalThis.crypto, 'subtle', {
        value: webcrypto.subtle,
        writable: false,
        configurable: true
    });
}

if (typeof globalThis.File === 'undefined') {
    globalThis.File = class File extends Blob {
        constructor(parts, filename, options = {}) {
            super(parts, options);
            this.name = filename;
            this.lastModified = options.lastModified || Date.now();
        }
    };
}

if (typeof globalThis.FormData === 'undefined') {
    const { FormData } = await import('formdata-node');
    globalThis.FormData = FormData;
}

console.log('✅ Entorno preparado (Node 20)');

import('./index.js').catch(err => {
    console.error('❌ Error al iniciar:', err);
    process.exit(1);
});
