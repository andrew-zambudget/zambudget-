import { isLocalVaultCryptoKey } from './localVaultStorage.js';

const LOCAL_METADATA_IV_BYTES = 12;

export const LOCAL_METADATA_VAULT_ENVELOPE_KIND = 'zam_local_metadata_vault';
export const LOCAL_METADATA_VAULT_ENVELOPE_VERSION = 1;
export const LOCAL_METADATA_VAULT_ALGORITHM = 'AES-GCM';

function getWebCrypto() {
    return globalThis.crypto || null;
}

function getSubtleCrypto() {
    return getWebCrypto()?.subtle || null;
}

function requireWebCrypto() {
    const cryptoApi = getWebCrypto();
    const subtle = getSubtleCrypto();

    if (!cryptoApi?.getRandomValues || !subtle) {
        throw new Error('WebCrypto is required for local metadata vault storage.');
    }

    return { cryptoApi, subtle };
}

function assertLocalMetadataKey(key) {
    if (!isLocalVaultCryptoKey(key)) {
        throw new TypeError('Local metadata vault key must be a non-token AES-GCM CryptoKey.');
    }
}

function encodeBase64Url(bytes) {
    const chunkSize = 0x8000;
    let binary = '';

    for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
    if (typeof value !== 'string' || !value) {
        throw new TypeError('Base64url value is required.');
    }

    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function encodeJson(value) {
    return new TextEncoder().encode(JSON.stringify(value));
}

function decodeJson(bytes) {
    return JSON.parse(new TextDecoder().decode(bytes));
}

function parseJson(value) {
    if (typeof value !== 'string') return value;
    return JSON.parse(value);
}

function validateLocalMetadataEnvelope(envelope, expectedName = '') {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
        throw new TypeError('Local metadata vault envelope must be an object.');
    }

    if (envelope.kind !== LOCAL_METADATA_VAULT_ENVELOPE_KIND) {
        throw new TypeError('Local metadata vault envelope kind is not recognized.');
    }

    if (envelope.version !== LOCAL_METADATA_VAULT_ENVELOPE_VERSION) {
        throw new TypeError('Local metadata vault envelope version is not supported.');
    }

    if (envelope.algorithm !== LOCAL_METADATA_VAULT_ALGORITHM) {
        throw new TypeError('Local metadata vault envelope algorithm is not supported.');
    }

    if (expectedName && envelope.name !== expectedName) {
        throw new TypeError('Local metadata vault envelope name is not recognized.');
    }

    if (typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') {
        throw new TypeError('Local metadata vault envelope is missing encrypted fields.');
    }

    return envelope;
}

export async function encryptLocalMetadataPayload(payload, key, options = {}) {
    if (payload === undefined) {
        throw new TypeError('Local metadata payload is required.');
    }

    const { cryptoApi, subtle } = requireWebCrypto();
    assertLocalMetadataKey(key);

    const iv = new Uint8Array(LOCAL_METADATA_IV_BYTES);
    cryptoApi.getRandomValues(iv);

    const now = options.updatedAt || new Date().toISOString();
    const name = String(options.name || 'local_metadata').trim() || 'local_metadata';
    const plaintext = {
        schema: LOCAL_METADATA_VAULT_ENVELOPE_KIND,
        schemaVersion: LOCAL_METADATA_VAULT_ENVELOPE_VERSION,
        name,
        payload
    };
    const ciphertext = await subtle.encrypt(
        { name: LOCAL_METADATA_VAULT_ALGORITHM, iv },
        key,
        encodeJson(plaintext)
    );

    return {
        kind: LOCAL_METADATA_VAULT_ENVELOPE_KIND,
        version: LOCAL_METADATA_VAULT_ENVELOPE_VERSION,
        algorithm: LOCAL_METADATA_VAULT_ALGORITHM,
        name,
        createdAt: options.createdAt || now,
        updatedAt: now,
        iv: encodeBase64Url(iv),
        ciphertext: encodeBase64Url(new Uint8Array(ciphertext))
    };
}

export function parseLocalMetadataEnvelope(value, options = {}) {
    const parsed = parseJson(value);
    return validateLocalMetadataEnvelope(parsed, options.name || '');
}

export function serializeLocalMetadataEnvelope(envelope, options = {}) {
    return JSON.stringify(validateLocalMetadataEnvelope(envelope, options.name || ''));
}

export async function decryptLocalMetadataEnvelope(envelopeOrString, key, options = {}) {
    const { subtle } = requireWebCrypto();
    assertLocalMetadataKey(key);

    const expectedName = options.name || '';
    const envelope = parseLocalMetadataEnvelope(envelopeOrString, { name: expectedName });
    const iv = decodeBase64Url(envelope.iv);
    const ciphertext = decodeBase64Url(envelope.ciphertext);

    const plaintext = await subtle.decrypt(
        { name: LOCAL_METADATA_VAULT_ALGORITHM, iv },
        key,
        ciphertext
    );
    const decoded = decodeJson(new Uint8Array(plaintext));

    if (
        !decoded
        || decoded.schema !== LOCAL_METADATA_VAULT_ENVELOPE_KIND
        || decoded.schemaVersion !== LOCAL_METADATA_VAULT_ENVELOPE_VERSION
        || (expectedName && decoded.name !== expectedName)
    ) {
        throw new TypeError('Local metadata vault plaintext schema is not recognized.');
    }

    return decoded.payload;
}

export function classifyLocalMetadataRecord(rawValue, options = {}) {
    if (rawValue == null || rawValue === '') {
        return { kind: 'empty' };
    }

    let parsed;
    try {
        parsed = parseJson(rawValue);
    } catch {
        return { kind: 'invalid' };
    }

    try {
        const envelope = validateLocalMetadataEnvelope(parsed, options.name || '');
        return { kind: 'encrypted', envelope };
    } catch {
        if (parsed && typeof parsed === 'object') {
            return { kind: 'plaintext' };
        }
        return { kind: 'invalid' };
    }
}

export async function writeEncryptedLocalMetadataRecord(storage, storageKey, payload, key, options = {}) {
    if (!storage?.setItem) {
        throw new TypeError('A storage-like object with setItem is required.');
    }

    const envelope = await encryptLocalMetadataPayload(payload, key, options);
    storage.setItem(storageKey, serializeLocalMetadataEnvelope(envelope, { name: options.name || '' }));
    return envelope;
}

export async function readEncryptedLocalMetadataRecord(storage, storageKey, key, options = {}) {
    if (!storage?.getItem) {
        throw new TypeError('A storage-like object with getItem is required.');
    }

    const rawValue = storage.getItem(storageKey);
    const classification = classifyLocalMetadataRecord(rawValue, { name: options.name || '' });

    if (classification.kind === 'empty') {
        return null;
    }

    if (classification.kind !== 'encrypted') {
        throw new TypeError(`Local metadata vault record is ${classification.kind}, not encrypted.`);
    }

    return decryptLocalMetadataEnvelope(rawValue, key, { name: options.name || '' });
}
