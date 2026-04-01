/**
 * Garagem - Serviços de API
 *
 * Camada responsável por centralizar as chamadas ao backend,
 * garantindo padronização de erros, timeouts e autenticação.
 */

const API_SENSITIVE_KEYWORDS = ['password', 'senha', 'token', 'hash', 'email', 'authorization'];

const apiIsAbsoluteUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const apiIsPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const apiSanitizeValueForLog = (key, value) => {
    const lowerKey = String(key || '').toLowerCase();
    const isSensitive = API_SENSITIVE_KEYWORDS.some((keyword) => lowerKey.includes(keyword));

    if (isSensitive && typeof value === 'string') {
        return ConfigUtils.maskSensitive(value, { keepStart: 3, keepEnd: 2 });
    }

    if (apiIsPlainObject(value)) {
        return apiSanitizePayloadForLog(value);
    }

    if (value instanceof Blob) {
        return `[${value.type || 'blob'}]`;
    }

    if (typeof value === 'string' && value.length > 140) {
        return `${value.slice(0, 140)}…`;
    }

    return value;
};

const apiSanitizePayloadForLog = (payload) => {
    if (payload instanceof FormData) {
        const clone = {};
        for (const [key, value] of payload.entries()) {
            clone[key] = apiSanitizeValueForLog(key, value);
        }
        return clone;
    }

    if (!apiIsPlainObject(payload)) {
        return payload;
    }

    return Object.entries(payload).reduce((acc, [key, value]) => {
        acc[key] = apiSanitizeValueForLog(key, value);
        return acc;
    }, {});
};

class APIService {
    constructor(customConfig = {}) {
        this.config = {
            ...CONFIG.api,
            ...customConfig
        };
    }

    getCurrentUser() {
        return ConfigUtils.getStorageData(CONFIG.storage.keys.userData);
    }

    requireAuth() {
        const user = this.getCurrentUser();
        if (!user || !user.email || !user.password) {
            throw new Error(CONFIG.messages.errors.unauthorized);
        }
        return user;
    }

    withCredentials(payload = {}, { includeHash = true, includeEmailAlias = true } = {}) {
        const user = this.requireAuth();
        const credentials = {
            email: user.email,
            password: user.password
        };

        if (includeHash && user.hashUsuario) {
            credentials.hashUsuario = user.hashUsuario;
        }

        if (includeEmailAlias) {
            credentials.emailUsuario = user.email;
        }

        return {
            ...credentials,
            ...payload
        };
    }

    resolveEndpoint(endpointKey) {
        if (!endpointKey) {
            return '';
        }

        if (typeof endpointKey === 'string') {
            if (apiIsAbsoluteUrl(endpointKey)) {
                return endpointKey;
            }

            if (endpointKey.includes('.')) {
                const [category, action] = endpointKey.split('.');
                return ConfigUtils.getEndpointURL(category, action);
            }

            return ConfigUtils.buildURL(endpointKey);
        }

        if (apiIsPlainObject(endpointKey)) {
            const { url, path, category, action } = endpointKey;
            if (url) return url;
            if (path) return ConfigUtils.buildURL(path);
            if (category && action) return ConfigUtils.getEndpointURL(category, action);
        }

        return '';
    }

    async request(endpointKey, options = {}) {
        const {
            method = 'GET',
            headers = {},
            body,
            query,
            timeout = this.config.timeout,
            rawBody = false
        } = options;

        const endpoint = this.resolveEndpoint(endpointKey);
        if (!endpoint) {
            throw new Error(`Endpoint inválido: ${String(endpointKey)}`);
        }

        const url = new URL(endpoint);

        if (query && typeof query === 'object') {
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.set(key, value);
                }
            });
        }

        const controller = new AbortController();
        const timer = timeout ? setTimeout(() => controller.abort(), timeout) : null;

        const defaultHeaders = typeof this.config.defaultHeaders === 'function'
            ? this.config.defaultHeaders()
            : { ...CONFIG.api.defaultHeaders() };

        const finalHeaders = {
            ...defaultHeaders,
            ...headers
        };

        const fetchOptions = {
            method,
            headers: finalHeaders,
            signal: controller.signal
        };

        let finalBody = body;

        if (finalBody !== undefined && finalBody !== null) {
            if (finalBody instanceof FormData) {
                fetchOptions.body = finalBody;
                delete fetchOptions.headers['Content-Type'];
            } else if (rawBody) {
                fetchOptions.body = finalBody;
            } else if (apiIsPlainObject(finalBody)) {
                fetchOptions.body = JSON.stringify(finalBody);
            } else {
                fetchOptions.body = finalBody;
            }
        }

        ConfigUtils.log('API request', {
            method,
            url: url.toString(),
            query,
            body: apiSanitizePayloadForLog(finalBody)
        });

        try {
            const response = await fetch(url.toString(), fetchOptions);
            if (timer) clearTimeout(timer);

            if (!response.ok) {
                throw await this.handleError(response);
            }

            return await this.parseResponse(response);
        } catch (error) {
            if (timer) clearTimeout(timer);

            if (error.name === 'AbortError') {
                throw new Error(CONFIG.messages.errors.timeout);
            }

            ConfigUtils.log('API error', error);
            throw error;
        }
    }

    async parseResponse(response) {
        if (response.status === 204) return null;

        const contentLength = response.headers.get('Content-Length');
        if (contentLength === '0') return null;

        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch (error) {
                ConfigUtils.log('Falha ao interpretar JSON da resposta', error);
                return null;
            }
        }

        return response.text();
    }

    async handleError(response) {
        let payload = null;
        try {
            payload = await this.parseResponse(response);
        } catch (error) {
            ConfigUtils.log('Não foi possível ler o payload de erro.', error);
        }

        const message =
            payload?.mensagem ||
            payload?.message ||
            payload?.error ||
            CONFIG.messages.errors.generic;

        const error = new Error(message);
        error.status = response.status;
        error.data = payload;
        return error;
    }

    get(endpointKey, params = {}, options = {}) {
        return this.request(endpointKey, { method: 'GET', query: params, ...options });
    }

    post(endpointKey, data = {}, options = {}) {
        return this.request(endpointKey, { method: 'POST', body: data, ...options });
    }

    put(endpointKey, data = {}, options = {}) {
        return this.request(endpointKey, { method: 'PUT', body: data, ...options });
    }

    patch(endpointKey, data = {}, options = {}) {
        return this.request(endpointKey, { method: 'PATCH', body: data, ...options });
    }

    delete(endpointKey, data = {}, options = {}) {
        return this.request(endpointKey, { method: 'DELETE', body: data, ...options });
    }

    postWithCredentials(endpointKey, payload = {}, options = {}) {
        return this.post(endpointKey, this.withCredentials(payload), options);
    }

    patchWithCredentials(endpointKey, payload = {}, options = {}) {
        return this.patch(endpointKey, this.withCredentials(payload), options);
    }

    deleteWithCredentials(endpointKey, payload = {}, options = {}) {
        return this.delete(endpointKey, this.withCredentials(payload), options);
    }
}

class AuthService extends APIService {
    async login(email, password) {
        const response = await this.post('auth.login', { email, password });

        if (response?.retorno === 'loginAprovado') {
            const userData = {
                email,
                password,
                hashUsuario: response.hashUsuario,
                token: response.token,
                loginTime: new Date().toISOString()
            };
            ConfigUtils.setStorageData(CONFIG.storage.keys.userData, userData);
            return userData;
        }

        throw new Error(this.getErrorMessage(response?.retorno));
    }

    async register(email, password) {
        const response = await this.post('auth.register', { email, password });
        if (response?.retorno === 'cadastro_concluido') {
            return true;
        }
        throw new Error(this.getErrorMessage(response?.retorno));
    }

    async recoverPassword(email, newPassword, oldPassword) {
        const response = await this.post('auth.recover', {
            email,
            password: newPassword,
            oldPassword
        });

        if (response?.retorno === 'loginAprovado') {
            return true;
        }

        throw new Error(this.getErrorMessage(response?.retorno));
    }

    logout({ redirect = true } = {}) {
        ConfigUtils.removeStorageData(CONFIG.storage.keys.userData);
        ConfigUtils.removeStorageData(CONFIG.storage.keys.userToken);
        if (redirect && typeof window !== 'undefined') {
            window.location.href = 'index.html';
        }
    }

    isAuthenticated() {
        return Boolean(this.getCurrentUser());
    }

    getErrorMessage(code) {
        const dictionary = {
            email_existente: 'Este email já está cadastrado.',
            email_existente: 'Este email já está cadastrado.',
            email_Existente: 'Este email já está cadastrado.',
            usuarioNaoCadastrado: 'Usuário não encontrado.',
            senhaIncorreta: 'Senha incorreta.',
            loginRecusado: 'Credenciais inválidas. Verifique e tente novamente.'
        };

        return dictionary[code] || CONFIG.messages.errors.generic;
    }
}

class DashboardService extends APIService {
    async fetchOverview(payload = {}) {
        const response = await this.postWithCredentials('dashboard.overview', payload);
        return response || {};
    }
}

class InstanceService extends DashboardService {
    async list(payload = {}) {
        const data = await this.fetchOverview(payload);
        const candidates = [
            data?.instancias,
            data?.projetos,
            data?.dados,
            Array.isArray(data) ? data : null
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    async create({ name, phone }) {
        return this.postWithCredentials('instances.create', {
            nome: name,
            tel: phone
        });
    }

    async toggleStatus(token) {
        return this.postWithCredentials('instances.toggleStatus', { token });
    }

    async delete(token) {
        return this.postWithCredentials('instances.delete', { token });
    }

    async refreshStatus() {
        return this.postWithCredentials('instances.refreshStatus');
    }
}

class ProjectService extends DashboardService {
    async list(payload = {}) {
        const data = await this.fetchOverview(payload);
        const candidates = [
            data?.projetos,
            data?.dados,
            Array.isArray(data) ? data : null
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    async create(projectData) {
        return this.postWithCredentials('projects.create', projectData);
    }

    async update(projectData) {
        return this.postWithCredentials('projects.update', projectData);
    }

    async scheduleUpdate(scheduleData) {
        return this.postWithCredentials('projects.scheduleUpdate', scheduleData);
    }

    async getUpdates(payload = {}) {
        const hashProjeto = ConfigUtils.normalizeString(payload?.hashProjeto || payload?.hash_projeto);
        if (!hashProjeto) {
            throw new Error('hashProjeto é obrigatório para consultar atualizações agendadas.');
        }

        const response = await this.postWithCredentials('projects.getUpdates', { hashProjeto });
        if (Array.isArray(response)) {
            return response;
        }
        if (Array.isArray(response?.dados)) {
            return response.dados;
        }
        return [];
    }

    async deleteUpdate(payload = {}) {
        const id = payload?.id ?? payload?.updateId;
        if (id === null || id === undefined) {
            throw new Error('id é obrigatório para remover um agendamento.');
        }
        const body = {
            id,
            hashProjeto: payload?.hashProjeto || payload?.hash_projeto
        };
        return this.postWithCredentials('projects.deleteUpdate', body);
    }

    async toggle(hashProjeto, ativo) {
        return this.postWithCredentials('projects.toggle', { hashProjeto, ativo });
    }

    async remove(hashProjeto) {
        return this.postWithCredentials('projects.delete', { hashProjeto });
    }
}

class GroupService extends APIService {
    async list(payload = {}) {
        const response = await this.postWithCredentials('groups.list', payload);
        const candidates = [
            response?.grupos,
            response?.dados,
            Array.isArray(response) ? response : null
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    async create(groupData) {
        return this.postWithCredentials('groups.create', groupData);
    }

    async update(groupData) {
        return this.postWithCredentials('groups.update', groupData);
    }

    async partialUpdate(groupData) {
        return this.patchWithCredentials('groups.patch', groupData);
    }

    async remove(hashGrupo) {
        return this.postWithCredentials('groups.delete', { hashGrupo });
    }

    async fetchMovements(groupJidMsg, payload = {}) {
        if (!groupJidMsg) {
            throw new Error('groupJidMsg é obrigatório para consultar movimentações.');
        }
        return this.postWithCredentials('groups.movements', {
            groupjidmsg: groupJidMsg,
            ...payload
        });
    }
}

class MessageService extends APIService {
    async listScheduled(payload = {}) {
        const response = await this.postWithCredentials('messages.scheduled', payload);
        return this.normalizeMessages(response);
    }

    async listDispatched(payload = {}) {
        const response = await this.postWithCredentials('messages.dispatched', payload);
        return this.normalizeMessages(response);
    }

    async createScheduled(messageData) {
        return this.postWithCredentials('messages.createScheduled', messageData);
    }

    async updateScheduled(messageData) {
        return this.postWithCredentials('messages.updateScheduled', messageData);
    }

    async deleteScheduled(messageData) {
        return this.postWithCredentials('messages.deleteScheduled', messageData);
    }

    async deleteMessage(hashMensagem) {
        return this.deleteWithCredentials('messages.delete', { hashMensagem });
    }

    normalizeMessages(response) {
        const candidates = [
            response,
            response?.mensagens,
            response?.mensagensProgramadas,
            response?.mensagensDisparadas,
            response?.dados
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }
}

class CampaignService extends APIService {
    async listScheduled(payload = {}) {
        const response = await this.postWithCredentials('campaigns.scheduled', payload);
        return Array.isArray(response?.projetos) ? response.projetos : [];
    }

    async listDispatched(payload = {}) {
        const response = await this.postWithCredentials('campaigns.dispatched', payload);
        return Array.isArray(response?.projetos) ? response.projetos : [];
    }

    async cancelCampaign(payload) {
        return this.postWithCredentials('campaigns.cancel', payload);
    }
}

class WhatsappService extends APIService {
    async list(payload = {}) {
        const response = await this.postWithCredentials('whatsapp.list', payload);
        if (Array.isArray(response)) {
            return response;
        }
        if (Array.isArray(response?.instancias)) {
            return response.instancias;
        }
        return [];
    }

    async create(payload) {
        return this.postWithCredentials('whatsapp.create', payload);
    }

    async connect(hash_instancia) {
        return this.postWithCredentials('whatsapp.connect', { hash_instancia });
    }

    async connectQRCode(hash_instancia, payload = {}) {
        const body = { ...payload };
        if (hash_instancia) {
            body.hash_instancia = hash_instancia;
        }
        return this.postWithCredentials('whatsapp.connectQRCode', body);
    }

    async heat(hash_instancia) {
        return this.postWithCredentials('whatsapp.heat', { hash_instancia });
    }
}

const authService = new AuthService();
const instanceService = new InstanceService();
const projectService = new ProjectService();
const groupService = new GroupService();
const messageService = new MessageService();
const campaignService = new CampaignService();
const whatsappService = new WhatsappService();

if (typeof window !== 'undefined') {
    window.authService = authService;
    window.instanceService = instanceService;
    window.projectService = projectService;
    window.groupService = groupService;
    window.messageService = messageService;
    window.campaignService = campaignService;
    window.whatsappService = whatsappService;
}

