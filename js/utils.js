// js/utils.js

/**
 * Debounce function to limit how often a function can fire.
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

/**
 * Formats a date string (YYYY-MM-DD) into a human-readable format.
 */
export function formatDate(dateString, locale = 'en-US') {
    if (!dateString) return '';
    let date = dateString instanceof Date ? dateString : new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return 'Invalid Date';

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const tTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const yTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime();

    if (dTime === tTime) return 'Today';
    if (dTime === yTime) return 'Yesterday';

    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((tTime - dTime) / msPerDay);

    if (diffDays > 1 && diffDays <= 7) {
        return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    }

    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Formats a number as currency (without the symbol).
 */
export function formatMoney(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    const isNegative = amount < 0;
    const absoluteAmount = Math.abs(amount);
    const roundedStr = (Math.round(absoluteAmount * 100) / 100).toFixed(2);
    const parts = roundedStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${isNegative ? '-' : ''}${parts.join('.')}`;
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 */
export function esc(str) {
    if (typeof str !== 'string') return '';
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#x27;', '/': '&#x2F;', '`': '&#96;', '=': '&#61;'
    };
    return str.replace(/[&<>"'`=\/]/g, ch => map[ch]);
}

/**
 * Validates date string YYYY-MM-DD.
 */
export function isValidDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString) && !isNaN(new Date(dateString + 'T00:00:00').getTime());
}

/**
 * Unique ID generator.
 */
export function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

/**
 * Deep clones an object.
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Calculates date difference in days.
 */
export function dateDiffInDays(date1, date2) {
    const d1 = date1 instanceof Date ? date1 : new Date(date1 + 'T00:00:00');
    const d2 = date2 instanceof Date ? date2 : new Date(date2 + 'T00:00:00');
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Safe JSON parsing for localStorage.
 */
export function safeParseJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);

        if (key === 'bb_transactions') {
            if (!Array.isArray(parsed)) return fallback;
            return parsed.filter(t => t && typeof t.id === 'number' && (t.type === 'income' || t.type === 'expense') && typeof t.amount === 'number' && t.amount > 0 && typeof t.description === 'string' && typeof t.category === 'string' && typeof t.date === 'string');
        }

        if (key === 'bb_custom_categories') {
            if (!Array.isArray(parsed)) return fallback;
            return parsed.filter(c => c && typeof c.id === 'number' && typeof c.name === 'string' && c.name.length > 0 && c.name.length <= 30);
        }

        return parsed;
    } catch (e) {
        console.warn('Corrupt localStorage key:', key, e);
        localStorage.removeItem(key);
        return fallback;
    }
}

/**
 * Validates category name against strict regex
 */
export function validateCategoryName(name) {
    if (typeof name !== 'string') return false;
    const pattern = /^[a-zA-Z0-9\s\-_\'()]{1,24}$/;
    return pattern.test(name);
}

// ==========================================
// 🎨 ICON SYSTEM: Keyword Mapping (Combined & Optimized)
// ==========================================

export const KEYWORD_ICON_MAP = {
    // Food & Dining
    "starbucks": "☕", "coffee": "☕", "chipotle": "🌮", "mcdonalds": "🍟",
    "subway": "🥖", "pizza": "🍕", "dining": "🍽️", "restaurant": "🍽️", "food": "🍔",
    "grocery": "🛒", "supermarket": "🛒",
    // Shopping
    "target": "🎯", "walmart": "🛒", "amazon": "📦", "costco": "🏪",
    "clothing": "👕", "shopping": "🛍️",
    // Housing & Utilities
    "rent": "🏠", "mortgage": "🏠", "home": "🏡", "utilities": "⚡", "electric": "⚡",
    "water": "💧", "internet": "🌐", "wifi": "📶", "insurance": "🛡️",
    // Transport
    "gas": "⛽", "fuel": "⛽", "uber": "🚗", "lyft": "🚗", "parking": "🅿️",
    "car": "🚗", "auto": "🚗", "travel": "✈️", "vacation": "🏖️",
    // Finance
    "chase": "🏦", "visa": "💳", "mastercard": "💳", "amex": "💳",
    "bank": "🏦", "transfer": "🔄", "interest": "📈", "savings": "💰",
    "salary": "💵", "freelance": "💻", "income": "💸", "debt": "💳", "loan": "📉",
    // Entertainment & Tech
    "netflix": "🎬", "spotify": "🎵", "hulu": "📺", "gym": "🏋️",
    "disney": "🏰", "apple": "🍎", "google": "🔍", "entertainment": "🎬",
    "movie": "🎬", "tech": "💻", "phone": "📱",
    // Health
    "pharmacy": "💊", "doctor": "🏥", "hospital": "🏥", "dental": "🦷",
    "medical": "🏥", "health": "💊",
    // Education & Misc
    "tuition": "🎓", "books": "📚", "school": "🎓", "education": "🎓", "gift": "🎁"
};

export function getIconFromName(name) {
    if (!name) return "📁";

    const lower = name.toLowerCase().trim();

    for (const [keyword, icon] of Object.entries(KEYWORD_ICON_MAP)) {
        if (lower.includes(keyword)) return icon;
    }

    return "📁";
}

// Ensure global access for inline HTML handlers if needed
if (typeof window !== 'undefined') {
    window.getIconFromName = getIconFromName;
}
