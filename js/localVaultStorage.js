const LOCAL_VAULT_IV_BYTES = 12;
const LOCAL_VAULT_RAW_KEY_BYTES = 32;

export const LOCAL_VAULT_STORAGE_KEY = 'bb_data';
export const LOCAL_VAULT_ENVELOPE_KIND = 'zam_local_budget_vault';
export const LOCAL_VAULT_ENVELOPE_VERSION = 1;
export const LOCAL_VAULT_ALGORITHM = 'AES-GCM';

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
        throw new Error('WebCrypto is required for local vault storage.');
    }

    return { cryptoApi, subtle };
}

export function isLocalVaultCryptoKey(key) {
    return Boolean(
        key
        && typeof key === 'object'
        && key.type === 'secret'
        && key.algorithm?.name === LOCAL_VAULT_ALGORITHM
        && Array.isArray(key.usages)
        && key.usages.includes('encrypt')
        && key.usages.includes('decrypt')
    );
}

function assertLocalVaultKey(key) {
    if (!isLocalVaultCryptoKey(key)) {
        throw new TypeError('Local vault key must be a non-token AES-GCM CryptoKey with encrypt and decrypt usage.');
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

function validateLocalVaultEnvelope(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
        throw new TypeError('Local vault envelope must be an object.');
    }

    if (envelope.kind !== LOCAL_VAULT_ENVELOPE_KIND) {
        throw new TypeError('Local vault envelope kind is not recognized.');
    }

    if (envelope.version !== LOCAL_VAULT_ENVELOPE_VERSION) {
        throw new TypeError('Local vault envelope version is not supported.');
    }

    if (envelope.algorithm !== LOCAL_VAULT_ALGORITHM) {
        throw new TypeError('Local vault envelope algorithm is not supported.');
    }

    if (typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') {
        throw new TypeError('Local vault envelope is missing encrypted fields.');
    }

    return envelope;
}

export function isCryptoAvailable() {
    return Boolean(getWebCrypto()?.getRandomValues && getSubtleCrypto());
}

export async function generateLocalVaultKey() {
    const { subtle } = requireWebCrypto();
    return subtle.generateKey(
        { name: LOCAL_VAULT_ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function importLocalVaultRawKey(rawKeyBytes) {
    const { subtle } = requireWebCrypto();
    const bytes = rawKeyBytes instanceof Uint8Array ? rawKeyBytes : new Uint8Array(rawKeyBytes);

    if (bytes.byteLength !== LOCAL_VAULT_RAW_KEY_BYTES) {
        throw new TypeError('Local vault raw key must be 32 bytes.');
    }

    return subtle.importKey(
        'raw',
        bytes,
        { name: LOCAL_VAULT_ALGORITHM },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptLocalVaultPayload(payload, key, options = {}) {
    if (payload === undefined) {
        throw new TypeError('Local vault payload is required.');
    }

    const { cryptoApi, subtle } = requireWebCrypto();
    assertLocalVaultKey(key);

    const iv = new Uint8Array(LOCAL_VAULT_IV_BYTES);
    cryptoApi.getRandomValues(iv);

    const now = options.updatedAt || new Date().toISOString();
    const plaintext = {
        schema: LOCAL_VAULT_ENVELOPE_KIND,
        schemaVersion: LOCAL_VAULT_ENVELOPE_VERSION,
        payload
    };
    const ciphertext = await subtle.encrypt(
        { name: LOCAL_VAULT_ALGORITHM, iv },
        key,
        encodeJson(plaintext)
    );

    return {
        kind: LOCAL_VAULT_ENVELOPE_KIND,
        version: LOCAL_VAULT_ENVELOPE_VERSION,
        algorithm: LOCAL_VAULT_ALGORITHM,
        createdAt: options.createdAt || now,
        updatedAt: now,
        iv: encodeBase64Url(iv),
        ciphertext: encodeBase64Url(new Uint8Array(ciphertext))
    };
}

export function parseLocalVaultEnvelope(value) {
    const parsed = parseJson(value);
    return validateLocalVaultEnvelope(parsed);
}

export function serializeLocalVaultEnvelope(envelope) {
    return JSON.stringify(validateLocalVaultEnvelope(envelope));
}

export function isLocalVaultEnvelope(value) {
    try {
        parseLocalVaultEnvelope(value);
        return true;
    } catch {
        return false;
    }
}

export async function decryptLocalVaultEnvelope(envelopeOrString, key) {
    const { subtle } = requireWebCrypto();
    assertLocalVaultKey(key);

    const envelope = parseLocalVaultEnvelope(envelopeOrString);
    const iv = decodeBase64Url(envelope.iv);
    const ciphertext = decodeBase64Url(envelope.ciphertext);

    const plaintext = await subtle.decrypt(
        { name: LOCAL_VAULT_ALGORITHM, iv },
        key,
        ciphertext
    );
    const decoded = decodeJson(new Uint8Array(plaintext));

    if (!decoded || decoded.schema !== LOCAL_VAULT_ENVELOPE_KIND || decoded.schemaVersion !== LOCAL_VAULT_ENVELOPE_VERSION) {
        throw new TypeError('Local vault plaintext schema is not recognized.');
    }

    return decoded.payload;
}

export function classifyLocalBudgetRecord(rawValue) {
    if (rawValue == null || rawValue === '') {
        return { kind: 'empty' };
    }

    let parsed;
    try {
        parsed = parseJson(rawValue);
    } catch {
        return { kind: 'invalid' };
    }

    if (isLocalVaultEnvelope(parsed)) {
        return { kind: 'encrypted', envelope: parsed };
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
            kind: 'plaintext',
            payloadShape: {
                hasTransactions: Array.isArray(parsed.transactions),
                hasCategories: Array.isArray(parsed.categories),
                hasSettings: Boolean(parsed.settings && typeof parsed.settings === 'object')
            }
        };
    }

    return { kind: 'invalid' };
}

export async function writeEncryptedLocalVaultRecord(storage, payload, key, options = {}) {
    if (!storage?.setItem) {
        throw new TypeError('A storage-like object with setItem is required.');
    }

    const storageKey = options.storageKey || LOCAL_VAULT_STORAGE_KEY;
    const envelope = await encryptLocalVaultPayload(payload, key, options);
    storage.setItem(storageKey, serializeLocalVaultEnvelope(envelope));
    return envelope;
}

export async function readEncryptedLocalVaultRecord(storage, key, options = {}) {
    if (!storage?.getItem) {
        throw new TypeError('A storage-like object with getItem is required.');
    }

    const storageKey = options.storageKey || LOCAL_VAULT_STORAGE_KEY;
    const rawValue = storage.getItem(storageKey);
    const classification = classifyLocalBudgetRecord(rawValue);

    if (classification.kind === 'empty') {
        return null;
    }

    if (classification.kind !== 'encrypted') {
        throw new TypeError(`Local vault record is ${classification.kind}, not encrypted.`);
    }

    return decryptLocalVaultEnvelope(rawValue, key);
}
