/**
 * Garagem - Configurações globais e utilitários compartilhados
 */

const CONFIG = {
    system: {
        name: 'Garagem',
        version: '2.0.0',
        author: 'Equipe Garagem'
    },

    api: {
        baseURL: 'https://webhook.garagem.dev.br/webhook',
        timeout: 300_000,
        defaultHeaders() {
            return {
                'Content-Type': 'application/json'
            };
        },
        endpoints: {
            auth: {
                login: 'login-usuario',
                register: 'cria-usuario',
                recover: 'recupera-senha'
            },
            dashboard: {
                overview: 'load-home'
            },
            instances: {
                create: 'nova-instancia',
                refreshStatus: 'button-refresh',
                toggleStatus: 'button-disconect',
                delete: 'button-delete'
            },
            whatsapp: {
                list: 'lista-instancias-whatsapp',
                create: 'cria-instancias-whatsapp',
                connect: 'conectar-instancia',
                connectQRCode: 'conectar-instancia-qrcode',
                heat: 'aquecimento-instancia'
            },
            projects: {
                list: 'load-home',
                create: 'cria-projeto',
                update: 'update-projeto',
                toggle: 'alterar-status-projeto',
                delete: 'delete-projeto',
                scheduleUpdate: 'agendar-update-projeto',
                getUpdates: 'get-updates-projeto',
                deleteUpdate: 'delete-update-projeto'
            },
            groups: {
                list: 'lista-grupos',
                create: 'cria-grupos',
                update: 'altera-grupos',
                patch: '00981dcf-d811-46d7-95f8-b12cd89a76ae',
            delete: 'delete-grupo',
            movements: 'lista-movimentacoes-grupo'
            },
            messages: {
                scheduled: 'listar-mensagem-programadas',
                dispatched: 'listar-mensagem-disparadas',
                createScheduled: 'criar-mensagem-programada',
                updateScheduled: 'update-mensagem-programada',
                deleteScheduled: 'deletar-mensagem-programada',
                delete: 'deletar-mensagem-enviada'
            },
            campaigns: {
                scheduled: 'projetos-programadas',
                dispatched: 'projetos-disparadas',
                create: 'cria-projeto',
                cancel: 'cancela-projeto'
            }
        }
    },

    development: {
        enableDebugLogs: true
    },

    ui: {
        animations: {
            duration: 300,
            enabled: true
        },
        toastDuration: 3000,
        modalAutoDismiss: false,
        itemsPerPage: 10,
        maxUploadSize: 50 * 1024 * 1024,
        imageFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        mask: {
            keepStart: 4,
            keepEnd: 3,
            placeholder: '...'
        }
    },

    validation: {
        email: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Email inválido'
        },
        phone: {
            pattern: /^[0-9]{12,13}$/,
            message: 'Telefone deve ter 12 ou 13 dígitos (55XXXXXXXXXXX)'
        },
        password: {
            minLength: 6,
            message: 'Senha deve ter no mínimo 6 caracteres'
        }
    },

    storage: {
        keys: {
            userData: 'userData',
            userToken: 'userToken',
            userPreferences: 'userPreferences'
        },
        sessionExpiry: 24 * 60 * 60 * 1000
    },

    status: {
        instances: {
            connected: { label: 'Conectado', color: 'green', icon: 'fa-check-circle' },
            disconnected: { label: 'Desconectado', color: 'red', icon: 'fa-times-circle' },
            connecting: { label: 'Conectando', color: 'yellow', icon: 'fa-spinner' },
            unknown: { label: 'Desconhecido', color: 'gray', icon: 'fa-circle-question' }
        },
        campaigns: {
            pending: { label: 'Pendente', color: 'blue', icon: 'fa-clock' },
            sent: { label: 'Enviada', color: 'green', icon: 'fa-check' },
            failed: { label: 'Falhou', color: 'red', icon: 'fa-exclamation-triangle' }
        },
        messages: {
            scheduled: { label: 'Agendada', color: 'blue', icon: 'fa-calendar-check' },
            dispatched: { label: 'Enviada', color: 'green', icon: 'fa-paper-plane' },
            failed: { label: 'Falhou', color: 'red', icon: 'fa-exclamation-triangle' }
        }
    },

    messages: {
        errors: {
            generic: 'Ocorreu um erro. Tente novamente.',
            network: 'Erro de conexão. Verifique sua internet.',
            unauthorized: 'Sessão expirada. Faça login novamente.',
            notFound: 'Recurso não encontrado.',
            validation: 'Verifique os dados informados.',
            timeout: 'A requisição demorou muito. Tente novamente.'
        },
        success: {
            generic: 'Operação realizada com sucesso!',
            saved: 'Dados salvos com sucesso!',
            deleted: 'Excluído com sucesso!',
            updated: 'Atualizado com sucesso!'
        },
        confirmations: {
            delete: 'Tem certeza que deseja excluir? Esta ação não pode ser desfeita.',
            logout: 'Deseja realmente sair?',
            cancel: 'Deseja cancelar? Alterações não salvas serão perdidas.'
        },
        emptyStates: {
            generic: 'Nenhum dado encontrado.',
            instances: 'Nenhuma instância disponível no momento.',
            projects: 'Nenhum projeto cadastrado até agora.',
            messages: 'Nenhuma mensagem cadastrada.',
            groups: 'Nenhum grupo vinculado a este projeto.',
            campaigns: 'Nenhuma campanha encontrada.'
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

const ConfigUtils = (() => {
    const { mask: maskDefaults } = CONFIG.ui;

    const normalizeString = (value) => {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value).trim();
    };

    const buildURL = (path = '') => {
        const sanitized = normalizeString(path).replace(/^\//, '');
        if (!sanitized) return CONFIG.api.baseURL;
        return `${CONFIG.api.baseURL}/${sanitized}`;
    };

    const resolveEndpoint = (category, action) => {
        const categoryKey = normalizeString(category);
        const actionKey = normalizeString(action);
        if (!categoryKey || !actionKey) {
            return '';
        }
        return CONFIG.api.endpoints?.[categoryKey]?.[actionKey] || '';
    };

    const getEndpointURL = (category, action) => {
        const endpoint = resolveEndpoint(category, action);
        if (!endpoint) {
            CONFIG.development.enableDebugLogs && console.warn(`Endpoint não encontrado: ${category}.${action}`);
            return '';
        }
        return buildURL(endpoint);
    };

    const maskSensitive = (value, options = {}) => {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value);
        const keepStart = Number.isInteger(options.keepStart) ? options.keepStart : maskDefaults.keepStart;
        const keepEnd = Number.isInteger(options.keepEnd) ? options.keepEnd : maskDefaults.keepEnd;
        const placeholder = typeof options.placeholder === 'string' ? options.placeholder : maskDefaults.placeholder;

        if (stringValue.length <= keepStart + keepEnd) {
            return stringValue;
        }

        const start = keepStart > 0 ? stringValue.slice(0, keepStart) : '';
        const end = keepEnd > 0 ? stringValue.slice(-keepEnd) : '';
        return `${start}${placeholder}${end}`;
    };

    const truncate = (value, maxLength = 120) => {
        const normalized = normalizeString(value);
        if (!normalized) return '';
        if (normalized.length <= maxLength) return normalized;
        return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
    };

    const clamp = (value, min, max) => {
        const number = Number(value);
        if (Number.isNaN(number)) return min;
        if (typeof min === 'number' && number < min) return min;
        if (typeof max === 'number' && number > max) return max;
        return number;
    };

    const ensureArray = (value) => {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined) return [];
        return [value];
    };

    const toArray = (value) => {
        if (Array.isArray(value)) {
            return value.filter((entry) => entry !== null && entry !== undefined && String(entry).trim().length > 0);
        }
        if (typeof value === 'string') {
            return value
                .split(',')
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0);
        }
        if (value === null || value === undefined) return [];
        return [String(value).trim()].filter(Boolean);
    };

    const unique = (values) => {
        return Array.from(new Set(ensureArray(values).map(normalizeString))).filter(Boolean);
    };

    const validate = (field, value) => {
        const rule = CONFIG.validation?.[field];
        if (!rule) {
            return { valid: true };
        }

        const stringValue = normalizeString(value);

        if (rule.pattern instanceof RegExp && !rule.pattern.test(stringValue)) {
            return { valid: false, message: rule.message };
        }

        if (Number.isFinite(rule.minLength) && stringValue.length < rule.minLength) {
            return { valid: false, message: rule.message };
        }

        if (typeof rule.custom === 'function') {
            return rule.custom(value);
        }

        return { valid: true };
    };

    const extractDigits = (value) => {
        return normalizeString(value).replace(/\D+/g, '');
    };

    const formatNationalPhone = (digits) => {
        if (!digits) return '';
        const areaCode = digits.slice(0, 2);
        const mainNumber = digits.slice(2);
        const isMobile = mainNumber.startsWith('9');
        const splitIndex = isMobile ? 5 : 4;

        if (!areaCode) return digits;

        const prefix = `(${areaCode})`;
        if (mainNumber.length <= splitIndex) {
            return `${prefix} ${mainNumber}`;
        }
        return `${prefix} ${mainNumber.slice(0, splitIndex)}-${mainNumber.slice(splitIndex)}`;
    };

    const formatWhatsappNumber = (value) => {
        const digits = extractDigits(value);
        if (!digits) return '—';

        const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
        const formatted = formatNationalPhone(withoutCountry);
        if (formatted) {
            return formatted;
        }
        return maskSensitive(digits, { keepStart: 3, keepEnd: 2 });
    };

    const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short'
    });

    const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const formatDateTime = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return dateTimeFormatter.format(date);
    };

    const formatDate = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return dateFormatter.format(date);
    };

    const formatTime = (value) => {
        if (!value) return '';
        if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
            return value;
        }
        const date = new Date(`1970-01-01T${value}`);
        if (Number.isNaN(date.getTime())) return String(value);
        return timeFormatter.format(date);
    };

    const formatSlug = (value) => {
        const normalized = normalizeString(value);
        if (!normalized) return '';
        let slug = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        slug = slug
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug;
    };

    const parseJSON = (value, fallback = null) => {
        try {
            if (typeof value === 'string') {
                return JSON.parse(value);
            }
            if (typeof value === 'object') {
                return value;
            }
            return fallback;
        } catch (error) {
            CONFIG.development.enableDebugLogs && console.warn('JSON inválido', error);
            return fallback;
        }
    };

    const storageGet = (key) => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (parsed && parsed.timestamp) {
                const elapsed = Date.now() - parsed.timestamp;
                if (elapsed > CONFIG.storage.sessionExpiry) {
                    localStorage.removeItem(key);
                    return null;
                }
            }
            return parsed;
        } catch (error) {
            CONFIG.development.enableDebugLogs && console.error('Erro ao ler localStorage:', error);
            return null;
        }
    };

    const storageSet = (key, data, { withTimestamp = true } = {}) => {
        try {
            const payload = withTimestamp
                ? { ...data, timestamp: Date.now() }
                : { ...data };
            localStorage.setItem(key, JSON.stringify(payload));
            return true;
        } catch (error) {
            CONFIG.development.enableDebugLogs && console.error('Erro ao salvar no localStorage:', error);
            return false;
        }
    };

    const storageRemove = (key) => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            CONFIG.development.enableDebugLogs && console.error('Erro ao remover item do localStorage:', error);
        }
    };

    const log = (...args) => {
        if (CONFIG.development.enableDebugLogs) {
            console.log('[Garagem]', ...args);
        }
    };

    const hasContent = (value) => {
        if (Array.isArray(value)) return value.length > 0;
        if (value && typeof value === 'object') return Object.keys(value).length > 0;
        return Boolean(normalizeString(value));
    };

    const getStatusInfo = (category, status) => {
        const fallback = {
            label: status || 'Indefinido',
            color: 'gray',
            icon: 'fa-circle-question'
        };
        if (!category || !status) return fallback;
        return CONFIG.status?.[category]?.[status] || fallback;
    };

    const createUID = (prefix = 'uid') => {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    };

    return {
        buildURL,
        resolveEndpoint,
        getEndpointURL,
        normalizeString,
        maskSensitive,
        mask: maskSensitive,
        truncate,
        clamp,
        ensureArray,
        toArray,
        unique,
        extractDigits,
        formatNationalPhone,
        formatWhatsappNumber,
        formatDateTime,
        formatDate,
        formatTime,
        formatSlug,
        validate,
        parseJSON,
        storage: {
            get: storageGet,
            set: storageSet,
            remove: storageRemove
        },
        getStorageData: storageGet,
        setStorageData: storageSet,
        removeStorageData: storageRemove,
        log,
        hasContent,
        getStatusInfo,
        createUID
    };
})();

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.ConfigUtils = ConfigUtils;
}

