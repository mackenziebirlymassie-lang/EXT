(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function utf8Encode(str) {
        if (typeof global.TextEncoder === 'function') {
            return new global.TextEncoder().encode(str);
        }
        const escaped = unescape(encodeURIComponent(str));
        const arr = new Uint8Array(escaped.length);
        for (let i = 0; i < escaped.length; i++) {
            arr[i] = escaped.charCodeAt(i);
        }
        return arr;
    }

    function utf8Decode(bytes) {
        if (typeof global.TextDecoder === 'function') {
            return new global.TextDecoder().decode(bytes);
        }
        let s = '';
        for (let i = 0; i < bytes.length; i++) {
            s += String.fromCharCode(bytes[i]);
        }
        return decodeURIComponent(escape(s));
    }

    function bytesToBase64(bytes) {
        let bin = '';
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
            const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
            bin += String.fromCharCode.apply(null, slice);
        }
        return global.btoa(bin);
    }

    function base64ToBytes(b64) {
        const bin = global.atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
    }

    // Pure-JS FNV/SHA-like 64-bit fallback when crypto.subtle is unavailable (e.g. non-secure http:// origins)
    function fallbackDigest(str) {
        const bytes = utf8Encode('ext-v1:' + str);
        let h1 = 0x811c9dc5;
        let h2 = 0x9e3779b9;
        for (let i = 0; i < bytes.length; i++) {
            h1 ^= bytes[i];
            h1 = Math.imul(h1, 0x01000193) >>> 0;
            h2 ^= (bytes[i] + i) & 0xff;
            h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
        }
        return 'fb:' + (h1 >>> 0).toString(16) + ':' + (h2 >>> 0).toString(16);
    }

    function hashPin(pin) {
        const normalized = 'ext-pin-v1:' + String(pin || '');
        if (global.crypto && global.crypto.subtle && typeof global.crypto.subtle.digest === 'function') {
            return global.crypto.subtle.digest('SHA-256', utf8Encode(normalized)).then(buf => {
                const view = new Uint8Array(buf);
                let hex = 'sha256:';
                for (let i = 0; i < view.length; i++) {
                    hex += PFCC.compat.pad2(view[i].toString(16));
                }
                return hex;
            }).catch(() => fallbackDigest(normalized));
        }
        return Promise.resolve(fallbackDigest(normalized));
    }

    function deriveAesKey(passphrase, salt, usage) {
        const subtle = global.crypto && global.crypto.subtle;
        if (!subtle) return Promise.reject(new Error('Web Crypto API is unavailable in this context.'));
        return subtle.importKey(
            'raw',
            utf8Encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        ).then(baseKey => {
            return subtle.deriveKey(
                { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
                baseKey,
                { name: 'AES-GCM', length: 256 },
                false,
                [usage]
            );
        });
    }

    function encryptBackupJson(jsonText, passphrase) {
        const subtle = global.crypto && global.crypto.subtle;
        if (!subtle || typeof global.crypto.getRandomValues !== 'function') {
            return Promise.reject(new Error('Encrypted backups require HTTPS or WebView secure context.'));
        }
        const salt = new Uint8Array(16);
        const iv = new Uint8Array(12);
        global.crypto.getRandomValues(salt);
        global.crypto.getRandomValues(iv);

        return deriveAesKey(passphrase, salt, 'encrypt').then(key => {
            return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, utf8Encode(jsonText));
        }).then(cipherBuf => {
            return JSON.stringify({
                app: 'EXT',
                encrypted: true,
                alg: 'PBKDF2-AES-256-GCM',
                salt: bytesToBase64(salt),
                iv: bytesToBase64(iv),
                ciphertext: bytesToBase64(new Uint8Array(cipherBuf))
            }, null, 2);
        });
    }

    function decryptBackupPayload(envelope, passphrase) {
        const subtle = global.crypto && global.crypto.subtle;
        if (!subtle) {
            return Promise.reject(new Error('Web Crypto API is unavailable to decrypt this backup.'));
        }
        const salt = base64ToBytes(envelope.salt || '');
        const iv = base64ToBytes(envelope.iv || '');
        const cipher = base64ToBytes(envelope.ciphertext || '');

        return deriveAesKey(passphrase, salt, 'decrypt').then(key => {
            return subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipher);
        }).then(plainBuf => {
            return JSON.parse(utf8Decode(new Uint8Array(plainBuf)));
        });
    }

    function getStorageStats() {
        const keys = [
            'appTransactions', 'appSubscriptions', 'appIous', 'appHoldings',
            'appCachedPrices', 'appSavingsVaults', 'appDebts', 'appAutoRules',
            'appSettings', 'appCategories', 'appQuickPresets', 'appSoundEnabled',
            'appLiveMarketsEnabled', 'appActiveView', 'appLockHash', 'appLastBackupAt'
        ];
        let totalChars = 0;
        let receiptChars = 0;
        if (global.localStorage) {
            keys.forEach(k => {
                try {
                    const val = global.localStorage.getItem(k);
                    if (val) totalChars += k.length + val.length;
                } catch (err) {
                    // Ignore storage read errors
                }
            });
        }
        if (PFCC.state && Array.isArray(PFCC.state.transactions)) {
            PFCC.state.transactions.forEach(t => {
                if (t && typeof t.receipt === 'string') receiptChars += t.receipt.length;
            });
        }
        const totalKB = Math.round((totalChars * 2) / 1024);
        const receiptKB = Math.round((receiptChars * 2) / 1024);
        const quotaKB = 5120;
        const pct = Math.min(100, (totalKB / quotaKB) * 100);
        return { totalKB, receiptKB, quotaKB, pct };
    }

    PFCC.security = {
        hashPin,
        encryptBackupJson,
        decryptBackupPayload,
        getStorageStats
    };
})(window);
