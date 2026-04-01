/**
 * Garagem - Dashboard
 *
 * Camada de orquestração do front-end da área logada.
 * Responsável por carregar dados, renderizar componentes,
 * lidar com modais e acionar os serviços de API.
 */

const DashboardApp = (() => {
    const state = {
        user: null,
        currentTab: 'instances',
        caches: {
            projects: [],
            whatsappInstances: [],
            groups: [],
            messages: {
                scheduled: [],
                dispatched: []
            }
        },
        current: {
            projectHash: null,
            connectInstance: null,
            messagesProjectKey: null,
            editingScheduledMessageId: null,
            groupProjectHash: null,
            groupProjectData: null,
            schedulingProjectHash: null,
            schedulingProjectData: null,
            schedulingProjectUpdates: []
        },
        temp: {
            newProject: {
                thumbnail: '',
                fullMessageMedia: ''
            },
            editProject: {
                thumbnail: '',
                fullMessageMedia: ''
            },
            createMessage: {
                media: ''
            },
            editMessage: {
                media: ''
            },
            createGroup: {
                fullMessageMedia: ''
            },
            editGroup: {
                fullMessageMedia: ''
            },
            scheduleProject: {
                thumbnails: {}
            }
        }
    };

    const services = {
        auth: authService,
        projects: projectService,
        instances: instanceService,
        whatsapp: whatsappService,
        messages: messageService,
        groups: groupService,
        campaigns: campaignService
    };

    const ui = {
        get(id) {
            return document.getElementById(id);
        },
        qs(selector, scope = document) {
            return scope.querySelector(selector);
        },
        qsa(selector, scope = document) {
            return Array.from(scope.querySelectorAll(selector));
        },
        setHidden(element, hidden) {
            if (!element) return;
            element.classList.toggle('hidden', hidden);
        },
        setText(element, value) {
            if (!element) return;
            element.textContent = value ?? '';
        },
        setHTML(element, html) {
            if (!element) return;
            element.innerHTML = html;
        },
        loader: (() => {
            const loader = () => ui.get('globalLoader');
            return {
                show(message = 'Carregando...') {
                    const container = loader();
                    if (!container) return;
                    const label = ui.qs('[data-loader-label]', container);
                    if (label) {
                        label.textContent = message;
                    }
                    container.classList.remove('hidden');
                },
                hide() {
                    const container = loader();
                    if (!container) return;
                    container.classList.add('hidden');
                }
            };
        })(),
        modal: (() => {
            const handlers = new Map();

            function getModal(id) {
                return ui.get(id);
            }

            function open(id) {
                const modal = getModal(id);
                if (!modal) return;
                modal.classList.remove('hidden');
                handlers.get(id)?.onOpen?.();
            }

            function close(id) {
                const modal = getModal(id);
                if (!modal) return;
                modal.classList.add('hidden');
                handlers.get(id)?.onClose?.();
            }

            function bindTriggers() {
                ui.qsa('[data-modal-open]').forEach((trigger) => {
                    trigger.addEventListener('click', (event) => {
                        const target = event.currentTarget.dataset.modalOpen;
                        if (target) {
                            open(target);
                        }
                    });
                });

                ui.qsa('[data-modal-close]').forEach((trigger) => {
                    trigger.addEventListener('click', (event) => {
                        const target = event.currentTarget.dataset.modalClose;
                        if (target) {
                            close(target);
                        }
                    });
                });
            }

            return {
                open,
                close,
                register(id, handler) {
                    handlers.set(id, handler);
                },
                init: bindTriggers
            };
        })(),
        confirm(options = {}) {
            const modal = ui.get('confirmModal');
            if (!modal) {
                if (window.confirm(options.message || options.title || 'Confirmar ação?')) {
                    options.onConfirm?.();
                }
                return;
            }

            const {
                title = 'Confirmar ação',
                message = '',
                confirmLabel = 'Confirmar',
                cancelLabel = 'Cancelar',
                onConfirm = () => { }
            } = options;

            ui.setText(ui.qs('[data-confirm-title]', modal), title);
            ui.setText(ui.get('confirmMessage'), message);

            const confirmButton = ui.get('confirmButton');
            if (confirmButton) {
                confirmButton.textContent = confirmLabel;
                confirmButton.onclick = () => {
                    ui.modal.close('confirmModal');
                    onConfirm();
                };
            }

            const cancelButton = ui.qs('[data-modal-close="confirmModal"]', modal);
            if (cancelButton) {
                cancelButton.textContent = cancelLabel;
            }

            ui.modal.open('confirmModal');
        },
        feedback: {
            success(message, title = 'Sucesso!') {
                ui.alert({ title, message, type: 'success' });
            },
            error(message, title = 'Erro') {
                ui.alert({ title, message, type: 'error' });
            },
            info(message, title = 'Informação') {
                ui.alert({ title, message, type: 'info' });
            },
            warning(message, title = 'Aviso') {
                ui.alert({ title, message, type: 'warning' });
            }
        },
        alert({ title = '', message = '', type = 'info' } = {}) {
            const modal = ui.get('notificationModal');
            if (!modal) {
                window.alert(`${title ? `${title}\n` : ''}${message}`);
                return;
            }

            const iconMap = {
                success: 'fas fa-check-circle text-green-500 text-3xl',
                error: 'fas fa-times-circle text-red-500 text-3xl',
                info: 'fas fa-info-circle text-blue-500 text-3xl',
                warning: 'fas fa-exclamation-triangle text-yellow-500 text-3xl'
            };

            const iconElement = ui.get('modalIcon');
            if (iconElement) {
                iconElement.innerHTML = `<i class="${iconMap[type] || iconMap.info}"></i>`;
            }

            ui.setText(ui.get('modalTitle'), title);
            ui.setText(ui.get('modalMessage'), message);
            ui.modal.open('notificationModal');
        },
        renderEmptyState(container, { icon = 'fa-layer-group', message = CONFIG.messages.emptyStates.generic } = {}) {
            if (!container) return;
            ui.setHTML(
                container,
                `
                <div class="text-center py-16">
                    <i class="fas ${icon} text-gray-300 text-6xl mb-4"></i>
                    <p class="text-gray-500 text-lg">${message}</p>
                    </div>
                `
            );
        }
    };

    const files = {
        async toBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
        },
        validate(file, { allowed = CONFIG.ui.imageFormats, maxSize = CONFIG.ui.maxUploadSize } = {}) {
            if (!file) {
                return { valid: true };
            }

            if (allowed && allowed.length && !allowed.includes(file.type)) {
                return { valid: false, message: `Formato inválido. Utilize ${allowed.join(', ')}.` };
            }

            if (maxSize && file.size > maxSize) {
                const maxMb = Math.round(maxSize / (1024 * 1024));
                return { valid: false, message: `O arquivo selecionado excede ${maxMb}MB.` };
            }

            return { valid: true };
        }
    };

    const helpers = {
        mask(value, options) {
            return ConfigUtils.maskSensitive(value, options);
        },
        formatDateTime(value) {
            return ConfigUtils.formatDateTime(value);
        },
        formatDate(value) {
            return ConfigUtils.formatDate(value);
        },
        formatTime(value) {
            return ConfigUtils.formatTime(value);
        },
        formatWhatsapp(value) {
            const digits = ConfigUtils.extractDigits ? ConfigUtils.extractDigits(value) : (value || '').toString().replace(/\D/g, '');
            if (!digits) return '—';
            if (ConfigUtils.formatNationalPhone) {
                const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
                return ConfigUtils.formatNationalPhone(withoutCountry);
            }
            return helpers.maskIdentifier(digits);
        },
        formatSlug(value) {
            return ConfigUtils.formatSlug ? ConfigUtils.formatSlug(value) : value;
        },
        normalizeString(value) {
            return ConfigUtils.normalizeString ? ConfigUtils.normalizeString(value) : (value ?? '').toString().trim();
        },
        isProjectActive(project) {
            const value = project?.projetoDesativado;
            if (value === null || value === undefined) return true;
            if (typeof value === 'boolean') return value === false;
            if (typeof value === 'number') return value === 0;
            const normalized = helpers.normalizeString(value).toLowerCase();
            if (['true', '1', 'sim', 'desativado', 'pausado', 'inativo'].includes(normalized)) return false;
            return true;
        },
        getProjectStatusBadge(project) {
            const isActive = helpers.isProjectActive(project);
            return {
                label: isActive ? 'Ativo' : 'Desativado',
                className: `inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`
            };
        },
        maskIdentifier(value) {
            return helpers.mask(value, { keepStart: 4, keepEnd: 4 });
        },
        ensureArray: ConfigUtils.ensureArray,
        toArray: ConfigUtils.toArray,
        getStatusInfo: ConfigUtils.getStatusInfo,
        truncate: ConfigUtils.truncate,
        slugManager(inputId) {
            const input = ui.get(inputId);
            if (!input) return null;
            const format = () => {
                const formatted = helpers.formatSlug(input.value);
                if (formatted !== input.value) {
                    input.value = formatted;
                }
            };
            input.addEventListener('input', format);
            input.addEventListener('blur', format);
            return {
                set(value = '') {
                    input.value = helpers.formatSlug(value);
                },
                reset() {
                    input.value = '';
                },
                get() {
                    return helpers.formatSlug(input.value);
                }
            };
        },
        createUID(prefix = 'uid') {
            return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
        }
    };

    const navigation = {
        init() {
            ui.qsa('[data-tab-target]').forEach((button) => {
                button.addEventListener('click', () => {
                    navigation.setActiveTab(button.dataset.tabTarget);
                });
            });
        },
        setActiveTab(tab) {
            if (!tab || state.currentTab === tab) {
                return;
            }

            state.currentTab = tab;

            ui.qsa('[data-tab-target]').forEach((button) => {
                const isActive = button.dataset.tabTarget === tab;
                button.classList.toggle('text-orange-600', isActive);
                button.classList.toggle('border-b-2', isActive);
                button.classList.toggle('border-orange-600', isActive);
                button.classList.toggle('text-gray-600', !isActive);
            });

            ui.qsa('.tab-content').forEach((content) => {
                ui.setHidden(content, true);
            });

            const activeContent = ui.get(`${tab}Tab`);
            if (activeContent) {
                ui.setHidden(activeContent, false);
            }

            switch (tab) {
                case 'instances':
                    projects.load();
                    break;
                case 'whatsapp':
                    whatsapp.load();
                    break;
                case 'messages':
                    messages.load();
                    break;
                case 'groups':
                    groups.load();
                    break;
                default:
                    break;
            }
        }
    };

    const projects = (() => {
        const elements = {
            grid: () => ui.get('instancesGrid'),
            emptyState: () => ui.get('noInstances'),
            newForm: () => ui.get('newInstanceForm'),
            detailsForm: () => ui.get('projectDetailsForm'),
            ownerSelect: () => ui.get('projectOwnerSelect'),
            detailsOwnerSelect: () => ui.get('projectDetailsOwnerSelect'),
            instancesList: () => ui.get('projectInstancesList'),
            detailsInstancesList: () => ui.get('projectDetailsInstancesList'),
            instancesEmpty: () => ui.get('projectInstancesEmptyState'),
            detailsInstancesEmpty: () => ui.get('projectDetailsInstancesEmptyState'),
            newModal: 'newInstanceModal',
            detailsModal: 'projectDetailsModal',
            scheduleModal: 'scheduleProjectModal',
            scheduleForm: () => ui.get('scheduleProjectUpdateForm'),
            scheduleUpdatesList: () => ui.get('scheduleProjectUpdatesList'),
            scheduleUpdatesEmpty: () => ui.get('scheduleProjectUpdatesEmptyState'),
            scheduleUpdatesRefresh: () => ui.get('refreshScheduleProjectUpdates')
        };

        const FULL_MESSAGE_MEDIA_TYPES = ['image', 'video'];

        const slugManagers = {
            create: helpers.slugManager('projectSlug'),
            details: helpers.slugManager('projectDetailsSlug')
        };

        async function load(force = false) {
            if (!force && state.caches.projects.length) {
                renderList();
                return;
            }

            ui.loader.show('Carregando projetos...');
            try {
                const data = await services.projects.list();
                state.caches.projects = Array.isArray(data) ? data : [];
                renderList();
            } catch (error) {
                ConfigUtils.log('Erro ao carregar projetos', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
            }
        }

        function renderList() {
            const grid = elements.grid();
            const emptyState = elements.emptyState();
            if (!grid) return;

            if (!state.caches.projects.length) {
                ui.setHTML(grid, '');
                ui.setHidden(emptyState, false);
                return;
            }

            ui.setHidden(emptyState, true);

            const cards = state.caches.projects.map((project) => renderCard(project)).join('');
            ui.setHTML(grid, cards);
        }

        function renderCard(project) {
            const statusBadge = helpers.getProjectStatusBadge(project);
            const maskedToken = helpers.maskIdentifier(project?.tokensProjeto || project?.tokenProjeto || project?.token_dono || '---');
            const description = helpers.truncate(project?.descricaoProjeto || 'Projeto sem descrição.', 140);
            const adminCount = helpers.toArray(project?.adminsProjeto).length || 0;

            return `
                <article class="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 flex flex-col">
                    <header class="flex items-start justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center">
                                <i class="fas fa-bullhorn text-orange-600 text-xl"></i>
                            </div>
                    <div>
                                <h3 class="font-bold text-gray-800 line-clamp-1" title="${project?.nomeProjeto || 'Projeto'}">${project?.nomeProjeto || 'Projeto'}</h3>
                                <p class="text-xs text-gray-500 font-mono">${maskedToken}</p>
                    </div>
                </div>
                        <span class="${statusBadge.className}">${statusBadge.label}</span>
                    </header>
                    <p class="text-sm text-gray-600 mb-4 line-clamp-3">${description}</p>
                    <dl class="text-sm text-gray-500 space-y-1 mb-5">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-users text-orange-500"></i>
                            <dt class="font-medium text-gray-700">Admins:</dt>
                            <dd>${adminCount}</dd>
                </div>
                        <div class="flex items-center gap-2">
                            <i class="fas fa-envelope text-blue-500"></i>
                            <dt class="font-medium text-gray-700">Proprietário:</dt>
                            <dd>${helpers.maskIdentifier(project?.emailUsuario || project?.email || '—')}</dd>
                        </div>
                    </dl>
                    <div class="mt-auto space-y-2">
                        <div class="flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                class="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm font-medium transition"
                                data-action="project.view"
                                data-project-hash="${project?.hashProjeto || ''}">
                                Ver detalhes
                            </button>
                            <button
                                type="button"
                                class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${statusBadge.label === 'Ativo'
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                    : 'bg-green-100 hover:bg-green-200 text-green-700'}"
                                data-action="project.toggle"
                                data-project-hash="${project?.hashProjeto || ''}"
                                data-project-active="${statusBadge.label === 'Ativo'}">
                                ${statusBadge.label === 'Ativo' ? '<i class="fas fa-pause mr-2"></i>Desativar' : '<i class="fas fa-play mr-2"></i>Ativar'}
                            </button>
                        </div>
                        <button
                            type="button"
                            class="w-full border border-dashed border-orange-300 text-orange-700 hover:bg-orange-50 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
                            data-action="project.schedule"
                            data-project-hash="${project?.hashProjeto || ''}">
                            <i class="fas fa-clock"></i>
                            Agendar alteração
                        </button>
                    </div>
                </article>
            `;
        }

        async function toggleStatus(hashProjeto, currentActive) {
            if (!hashProjeto) return;
            const shouldPause = Boolean(currentActive);
            const actionVerb = shouldPause ? 'desativar' : 'ativar';

            ui.confirm({
                title: 'Confirmar alteração',
                message: `Tem certeza que deseja ${actionVerb} este projeto?`,
                onConfirm: async () => {
                    ui.loader.show('Atualizando projeto...');
                    try {
                        await services.projects.toggle(hashProjeto, shouldPause);
                        await load(true);
                        ui.feedback.success(`Projeto ${shouldPause ? 'desativado' : 'ativado'} com sucesso!`);
                    } catch (error) {
                        ConfigUtils.log('Erro ao alterar status do projeto', error);
                        ui.feedback.error(error.message || CONFIG.messages.errors.generic);
                    } finally {
                        ui.loader.hide();
                    }
                }
            });
        }

        function getProjectByHash(hashProjeto) {
            return state.caches.projects.find((project) => project?.hashProjeto === hashProjeto);
        }

        function collectSelectedInstances(listElement) {
            if (!listElement) return { tokens: [], instancias: [] };
            const checked = ui.qsa('input[type="checkbox"]:checked', listElement);
            const tokens = [];
            const instancias = [];
            checked.forEach((checkbox) => {
                const token = checkbox.dataset.token || '';
                const instancia = checkbox.dataset.instancia || '';
                if (token) tokens.push(token);
                if (instancia) instancias.push(instancia);
            });
            return { tokens, instancias };
        }

        function buildInstancesList(instances, { listElement, emptyElement, selectedTokens = [], selectedInstancias = [], ownerToken } = {}) {
            if (!listElement) return;
            const normalizedSelectedTokens = new Set(selectedTokens.map((token) => token.trim()));
            const normalizedSelectedInstancias = new Set(selectedInstancias.map((value) => value.trim()));

            if (!Array.isArray(instances) || !instances.length) {
                ui.setHTML(listElement, '<p class="text-sm text-gray-500">Nenhuma instância administradora disponível.</p>');
                if (emptyElement) {
                    ui.setHidden(emptyElement, false);
                }
                return;
            }

            if (emptyElement) {
                ui.setHidden(emptyElement, true);
            }

            const items = instances
                .filter((instance) => instance && typeof instance === 'object')
                .map((instance, index) => {
                    const token = helpers.normalizeString(instance.token);
                    const instancia = helpers.normalizeString(instance.instancia);
                    const hashInstancia = instance.hash_instancia || `${index}`;
                    const statusKey = helpers.normalizeString(instance.status).toLowerCase();
                    const statusInfo = helpers.getStatusInfo('instances', statusKey);
                    const isDisconnected = statusKey === 'disconnected';

                    const isSelected =
                        (token && normalizedSelectedTokens.has(token)) ||
                        (instancia && normalizedSelectedInstancias.has(instancia));

                    const isOwnerToken = token && token === ownerToken;

                    return `
                        <label class="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-orange-300 transition ${isDisconnected ? 'opacity-60 cursor-not-allowed' : ''}">
                            <input
                                type="checkbox"
                                class="mt-1 h-4 w-4 text-orange-600 border-gray-300 rounded project-instance-checkbox"
                                data-token="${token}"
                                data-instancia="${instancia}"
                                data-status="${statusKey}"
                                ${isSelected && !isDisconnected ? 'checked' : ''}
                                ${isDisconnected || isOwnerToken ? 'disabled' : ''}
                            >
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-800">${instance.nome_instancia || 'Instância'}</p>
                                <p class="text-xs text-gray-500">${ConfigUtils.formatNationalPhone
                            ? ConfigUtils.formatNationalPhone(instancia.slice(2))
                            : helpers.maskIdentifier(instancia)}</p>
                                ${token
                            ? `<p class="text-xs text-gray-400">Token: ${helpers.maskIdentifier(token)}</p>`
                            : '<p class="text-xs text-gray-400">Token não disponível</p>'}
                                ${isDisconnected
                            ? `<p class="text-xs text-red-500 font-medium">Status: ${statusInfo.label || 'Desconectada'} • Indisponível</p>`
                            : ''}
                            </div>
                        </label>
                    `;
                })
                .join('');

            ui.setHTML(listElement, items);
        }

        function buildMediaPreviewMarkup(source, { alt = 'Prévia do arquivo', className = '' } = {}) {
            const raw = helpers.normalizeString(source);
            if (!raw) return '';
            const normalized = raw.replace(/^"+|"+$/g, '');
            const baseClass = className || 'w-full h-32 object-cover rounded-lg border border-gray-200';

            if (/^data:image\//i.test(normalized) || /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(normalized)) {
                return `<img src="${normalized}" alt="${alt}" class="${baseClass}">`;
            }

            if (/^data:video\//i.test(normalized) || /\.(mp4|webm|mov|3gp)(\?.*)?$/i.test(normalized)) {
                return `<video src="${normalized}" class="${baseClass}" controls></video>`;
            }

            return `
                <a href="${normalized}" target="_blank" rel="noopener noreferrer" class="block text-xs text-orange-600 break-all">
                    Abrir arquivo
                </a>
            `;
        }

        function setEntryThumbPreview(previewElement, { src, name, size } = {}) {
            if (!previewElement) return;
            if (!src) {
                previewElement.classList.add('hidden');
                previewElement.innerHTML = '';
                return;
            }

            const markup = buildMediaPreviewMarkup(src, {
                alt: helpers.normalizeString(name) || 'Prévia do arquivo',
                className: 'w-full max-h-40 object-cover rounded-lg border border-gray-200'
            });

            const sizeLabel = size ? ` • ${size}` : '';
            previewElement.innerHTML = `
                ${markup}
                <p class="text-xs text-gray-500 mt-1">${helpers.normalizeString(name)}${sizeLabel}</p>
            `;
            previewElement.classList.remove('hidden');
        }

        async function loadWhatsappInstances({ force = false } = {}) {
            if (!force && state.caches.whatsappInstances.length) {
                return state.caches.whatsappInstances;
            }
            try {
                const instances = await services.whatsapp.list();
                state.caches.whatsappInstances = Array.isArray(instances) ? instances : [];
                return state.caches.whatsappInstances;
            } catch (error) {
                ConfigUtils.log('Erro ao carregar instâncias WhatsApp', error);
                ui.feedback.error('Não foi possível carregar as instâncias administradoras.');
                return [];
            }
        }

        async function prepareNewProjectModal() {
            state.temp.newProject.thumbnail = '';
            state.temp.newProject.fullMessageMedia = '';
            slugManagers.create?.reset();

            const form = elements.newForm();
            if (form) {
                form.reset();
            }

            const ownerSelect = elements.ownerSelect();
            if (ownerSelect) {
                ownerSelect.innerHTML = '<option value="">Selecione uma instância</option>';
                ownerSelect.disabled = true;
            }

            const disableFullMessageCheckbox = ui.get('projectDisableGroupFullMessage');
            if (disableFullMessageCheckbox) {
                disableFullMessageCheckbox.checked = false;
            }

            const fullMessageTypeSelect = ui.get('projectFullMessageType');
            if (fullMessageTypeSelect) {
                fullMessageTypeSelect.value = 'text';
            }

            updateFullMessageControls();

            const instancesList = elements.instancesList();
            const emptyElement = elements.instancesEmpty();
            if (instancesList) {
                ui.setHTML(instancesList, '<p class="text-sm text-gray-500">Carregando instâncias...</p>');
            }
            if (emptyElement) {
                ui.setHidden(emptyElement, true);
            }

            const instances = await loadWhatsappInstances();

            if (ownerSelect) {
                ownerSelect.disabled = !instances.length;
                const options = instances
                    .map((instance) => {
                        const token = helpers.normalizeString(instance.token);
                        const status = helpers.normalizeString(instance.status).toLowerCase();
                        const statusInfo = helpers.getStatusInfo('instances', status);
                        const isDisconnected = status === 'disconnected';

                        return `
                            <option
                                value="${instance.hash_instancia || token || helpers.createUID?.('instance') || ''}"
                                data-token="${token}"
                                data-instancia="${helpers.normalizeString(instance.instancia)}"
                                ${isDisconnected ? 'disabled' : ''}
                            >
                                ${instance.nome_instancia || 'Instância'}${isDisconnected ? ` • ${statusInfo.label || 'Desconectada'}` : ''}
                            </option>
                        `;
                    })
                    .join('');
                ownerSelect.insertAdjacentHTML('beforeend', options);
            }

            buildInstancesList(instances, {
                listElement: instancesList,
                emptyElement: elements.instancesEmpty()
            });
        }

        async function prepareProjectDetailsModal(hashProjeto) {
            const project = getProjectByHash(hashProjeto);
            if (!project) {
                ui.feedback.warning('Projeto não encontrado.');
                return;
            }

            state.current.projectHash = hashProjeto;
            state.temp.editProject.thumbnail = helpers.normalizeString(project.thumbProjeto || project.thumbProjetoBase64 || '');
            state.temp.editProject.fullMessageMedia = helpers.normalizeString(project.midiaMsgGrupoCheio || '');

            const form = elements.detailsForm();
            if (!form) return;

            form.reset();

            ui.setText(ui.get('projectDetailsHashDisplay'), helpers.maskIdentifier(hashProjeto));
            const statusBadge = helpers.getProjectStatusBadge(project);
            const statusElement = ui.get('projectDetailsStatusBadge');
            if (statusElement) {
                statusElement.className = statusBadge.className;
                statusElement.textContent = statusBadge.label;
            }

            const nameInput = ui.get('projectDetailsName');
            if (nameInput) {
                nameInput.value = project?.nomeProjeto || '';
            }

            slugManagers.details?.set(project?.slugProjeto || project?.slug || '');

            const descriptionInput = ui.get('projectDetailsDescription');
            if (descriptionInput) {
                descriptionInput.value = project?.descricaoProjeto || '';
            }

            form.dataset.hashProjeto = hashProjeto;

            const thumbnailPreview = ui.get('projectDetailsThumbPreview');
            const thumbnailImage = ui.get('projectDetailsThumbPreviewImage');
            const thumbnailInput = ui.get('projectDetailsThumbnail');
            if (thumbnailPreview && thumbnailImage) {
                if (state.temp.editProject.thumbnail) {
                    thumbnailImage.src = state.temp.editProject.thumbnail;
                    thumbnailPreview.classList.remove('hidden');
                } else {
                    thumbnailImage.removeAttribute('src');
                    thumbnailPreview.classList.add('hidden');
                }
            }
            if (thumbnailInput) {
                thumbnailInput.value = '';
            }

            const ownerSelect = elements.detailsOwnerSelect();
            if (ownerSelect) {
                ownerSelect.innerHTML = '<option value="">Selecione uma instância</option>';
                ownerSelect.disabled = true;
            }

            const instancesList = elements.detailsInstancesList();
            if (instancesList) {
                ui.setHTML(instancesList, '<p class="text-sm text-gray-500">Carregando instâncias...</p>');
            }
            const emptyState = elements.detailsInstancesEmpty();
            if (emptyState) {
                ui.setHidden(emptyState, true);
            }

            const instances = await loadWhatsappInstances();

            const selectedTokens = helpers.toArray(project?.tokensProjeto || project?.adminsProjeto);
            const selectedInstancias = helpers.toArray(project?.telAdminsProjeto || project?.instanciasProjeto);
            const ownerToken = helpers.normalizeString(project?.token_dono || project?.tokenDono || project?.tokenOwner);

            if (ownerSelect) {
                ownerSelect.disabled = !instances.length;
                const options = instances
                    .map((instance) => {
                        const token = helpers.normalizeString(instance.token);
                        const status = helpers.normalizeString(instance.status).toLowerCase();
                        const isDisconnected = status === 'disconnected';
                        const selected = ownerToken && ownerToken === token;

                        return `
                            <option
                                value="${instance.hash_instancia || token || helpers.createUID?.('instance') || ''}"
                                data-token="${token}"
                                data-instancia="${helpers.normalizeString(instance.instancia)}"
                                ${isDisconnected ? 'disabled' : ''}
                                ${selected ? 'selected' : ''}
                            >
                                ${instance.nome_instancia || 'Instância'}${isDisconnected ? ' • Desconectada' : ''}
                            </option>
                        `;
                    })
                    .join('');
                ownerSelect.insertAdjacentHTML('beforeend', options);
            }

            buildInstancesList(instances, {
                listElement: instancesList,
                emptyElement: emptyState,
                selectedTokens,
                selectedInstancias,
                ownerToken
            });
        }

        function ensureScheduleEntryThumbnails() {
            if (!state.temp.scheduleProject.thumbnails || typeof state.temp.scheduleProject.thumbnails !== 'object') {
                state.temp.scheduleProject.thumbnails = {};
            }
            return state.temp.scheduleProject.thumbnails;
        }

        function clearScheduleEntryThumbnails() {
            state.temp.scheduleProject.thumbnails = {};
        }

        function setScheduleEntryThumbnail(entryId, value = '') {
            const storage = ensureScheduleEntryThumbnails();
            if (value) {
                storage[entryId] = value;
            } else {
                delete storage[entryId];
            }
        }

        function getScheduleEntryThumbnail(entryId) {
            return ensureScheduleEntryThumbnails()[entryId] || '';
        }

        function scheduleEntriesContainer() {
            return ui.get('scheduleProjectEntries');
        }

        function getScheduleEntryElements() {
            const container = scheduleEntriesContainer();
            return container ? ui.qsa('.schedule-entry', container) : [];
        }

        function updateScheduleEntryLabels() {
            const entries = getScheduleEntryElements();
            entries.forEach((entry, index) => {
                const label = entry.querySelector('[data-entry-label]');
                if (label) {
                    label.textContent = `Agendamento #${index + 1}`;
                }
            });
        }

        function createScheduleEntryElement(entryId) {
            const entry = document.createElement('div');
            entry.className = 'schedule-entry bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm';
            entry.dataset.entryId = entryId;
            entry.innerHTML = `
                <div class="flex items-start justify-between gap-2 mb-4">
                    <div>
                        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agendamento</p>
                        <h4 class="text-base font-semibold text-gray-800" data-entry-label>Agendamento</h4>
                    </div>
                    <button type="button" class="text-xs text-red-500 hover:text-red-600 font-semibold" data-action="remove-entry">
                        Remover
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                        <input type="text" data-field="name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Nome do projeto para este agendamento">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
                        <textarea data-field="description" rows="3" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Descrição aplicada neste agendamento."></textarea>
                    </div>
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label class="block text-sm font-medium text-gray-700">Thumb (opcional)</label>
                            <button type="button" class="text-xs text-red-500 hover:text-red-600 font-medium" data-action="remove-entry-thumb">
                                Remover seleção
                            </button>
                        </div>
                        <input type="file" data-field="thumb" accept="image/*" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                        <div data-role="thumb-preview" class="hidden mt-2 text-xs text-gray-500 bg-white border border-dashed border-gray-300 rounded-lg p-2"></div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Data do agendamento *</label>
                            <input type="date" data-field="date" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Hora do agendamento *</label>
                            <input type="time" data-field="time" step="300" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                            <p class="text-xs text-gray-400 mt-1">Os minutos devem ser múltiplos de 5 (ex: 14:05, 14:10, 14:15).</p>
                        </div>
                    </div>
                </div>
            `;
            return entry;
        }

        function getDefaultScheduleDateTime(offsetMinutes = 0) {
            const base = new Date(Date.now() + 30 * 60 * 1000 + offsetMinutes * 60 * 1000);
            const rounded = roundMinutes(base);
            const dateValue = rounded.toISOString().slice(0, 10);
            const timeValue = `${String(rounded.getHours()).padStart(2, '0')}:${String(rounded.getMinutes()).padStart(2, '0')}`;
            return { dateValue, timeValue };
        }

        function initializeScheduleEntry(entry, defaults = {}) {
            const entryId = entry.dataset.entryId;
            setScheduleEntryThumbnail(entryId);

            const { dateValue, timeValue } = getDefaultScheduleDateTime(defaults.offsetMinutes || 0);
            const nameInput = entry.querySelector('[data-field="name"]');
            const descriptionInput = entry.querySelector('[data-field="description"]');
            const dateInput = entry.querySelector('[data-field="date"]');
            const timeInput = entry.querySelector('[data-field="time"]');

            const fallbackName = defaults.name ?? state.current.schedulingProjectData?.name ?? '';
            const fallbackDescription = defaults.description ?? state.current.schedulingProjectData?.description ?? '';

            if (nameInput) {
                nameInput.value = helpers.normalizeString(defaults.name ?? fallbackName);
            }
            if (descriptionInput) {
                descriptionInput.value = helpers.normalizeString(defaults.description ?? fallbackDescription);
            }
            if (dateInput) {
                const today = new Date().toISOString().slice(0, 10);
                dateInput.min = today;
                dateInput.value = defaults.date || dateValue;
            }
            if (timeInput) {
                timeInput.step = 300;
                timeInput.value = defaults.time || timeValue;
            }
        }

        function bindScheduleEntryEvents(entry) {
            const entryId = entry.dataset.entryId;
            const removeButton = entry.querySelector('[data-action="remove-entry"]');
            if (removeButton) {
                removeButton.addEventListener('click', () => removeScheduleEntry(entry));
            }

            const thumbInput = entry.querySelector('[data-field="thumb"]');
            const thumbPreview = entry.querySelector('[data-role="thumb-preview"]');
            const removeThumbButton = entry.querySelector('[data-action="remove-entry-thumb"]');

            if (thumbInput) {
                thumbInput.addEventListener('change', async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                        setScheduleEntryThumbnail(entryId);
                        setEntryThumbPreview(thumbPreview);
                        return;
                    }

                    const validation = files.validate(file);
                    if (!validation.valid) {
                        ui.feedback.warning(validation.message);
                        event.target.value = '';
                        setScheduleEntryThumbnail(entryId);
                        setEntryThumbPreview(thumbPreview);
                        return;
                    }

                    try {
                        const base64 = await files.toBase64(file);
                        setScheduleEntryThumbnail(entryId, base64);
                        const sizeMb = `${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                        setEntryThumbPreview(thumbPreview, {
                            src: base64,
                            name: file.name,
                            size: sizeMb
                        });
                    } catch (error) {
                        ConfigUtils.log('Erro ao processar thumb do agendamento', error);
                        ui.feedback.error('Não foi possível processar a imagem selecionada.');
                        event.target.value = '';
                        setScheduleEntryThumbnail(entryId);
                        setEntryThumbPreview(thumbPreview);
                    }
                });
            }

            if (removeThumbButton) {
                removeThumbButton.addEventListener('click', () => {
                    if (thumbInput) {
                        thumbInput.value = '';
                    }
                    setScheduleEntryThumbnail(entryId);
                    setEntryThumbPreview(thumbPreview);
                });
            }
        }

        function addScheduleEntry(defaults = {}) {
            const container = scheduleEntriesContainer();
            if (!container) return;
            const existingCount = getScheduleEntryElements().length;
            const entryId = helpers.createUID('schedule-entry');
            const entry = createScheduleEntryElement(entryId);
            container.appendChild(entry);
            initializeScheduleEntry(entry, { ...defaults, offsetMinutes: existingCount * 5 });
            bindScheduleEntryEvents(entry);
            updateScheduleEntryLabels();
        }

        function resetScheduleEntries(defaults = {}) {
            const container = scheduleEntriesContainer();
            if (!container) return;
            container.innerHTML = '';
            clearScheduleEntryThumbnails();
            addScheduleEntry(defaults);
        }

        function removeScheduleEntry(entry) {
            const container = scheduleEntriesContainer();
            if (!container) return;
            const entries = getScheduleEntryElements();
            if (entries.length <= 1) {
                ui.feedback.warning('Mantenha ao menos um agendamento.');
                return;
            }
            const entryId = entry.dataset.entryId;
            if (entryId) {
                setScheduleEntryThumbnail(entryId);
            }
            entry.remove();
            updateScheduleEntryLabels();
        }

        function bindScheduleEntryControls() {
            const addButton = ui.get('addScheduleProjectEntry');
            if (!addButton) return;
            addButton.addEventListener('click', () => {
                if (!state.current.schedulingProjectHash) {
                    ui.feedback.warning('Selecione um projeto antes de adicionar agendamentos.');
                    return;
                }
                addScheduleEntry({
                    name: state.current.schedulingProjectData?.name,
                    description: state.current.schedulingProjectData?.description
                });
            });
        }

        function normalizeScheduleUpdateDate(value) {
            if (!value) return '';
            if (typeof value === 'string') {
                return value.replace(/^"+|"+$/g, '').trim();
            }
            return value;
        }

        function setScheduleUpdatesLoading(message = 'Carregando atualizações...') {
            const list = elements.scheduleUpdatesList();
            if (list) {
                ui.setHTML(
                    list,
                    `<p class="text-sm text-gray-500">${message}</p>`
                );
            }
            const empty = elements.scheduleUpdatesEmpty();
            if (empty) {
                ui.setHidden(empty, true);
            }
        }

        function renderScheduleUpdates() {
            const list = elements.scheduleUpdatesList();
            const empty = elements.scheduleUpdatesEmpty();
            if (!list) return;
            const updates = helpers.ensureArray(state.current.schedulingProjectUpdates);
            if (!updates.length) {
                ui.setHTML(list, '');
                if (empty) {
                    ui.setHidden(empty, false);
                }
                return;
            }

            if (empty) {
                ui.setHidden(empty, true);
            }

            const items = updates
                .map((update) => {
                    const scheduledAt = helpers.formatDateTime(
                        normalizeScheduleUpdateDate(
                            update.datetime ||
                            update.dataHoraAgendamento ||
                            update.dataHora ||
                            update.datahora
                        )
                    );
                    const description =
                        helpers.normalizeString(update.descricaoProjeto || update.descricao || '') ||
                        'Sem descrição.';
                    const name = helpers.normalizeString(update.nomeProjeto || update.nome || 'Atualização');
                    const thumb = helpers.normalizeString(update.thumbProjeto || '');
                    const id = update.id ?? '—';
                    const previewMarkup = thumb
                        ? buildMediaPreviewMarkup(thumb, {
                            alt: `Prévia de ${name}`,
                            className: 'w-full h-32 object-cover rounded-lg border border-gray-100 mt-3'
                        })
                        : '';
                    const deleteDisabled = id === '—';

                    return `
                        <article class="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-sm font-semibold text-gray-800">${name}</p>
                                    <p class="text-xs text-gray-500">${description}</p>
                                </div>
                                <div class="flex flex-col items-end gap-2">
                                    <span class="text-xs font-medium text-gray-500 whitespace-nowrap">${scheduledAt || '—'}</span>
                                    <button
                                        type="button"
                                        class="text-xs text-red-600 hover:text-red-700 font-semibold disabled:text-gray-300 disabled:cursor-not-allowed"
                                        data-action="schedule.update.delete"
                                        data-update-id="${deleteDisabled ? '' : id}"
                                        ${deleteDisabled ? 'disabled' : ''}
                                    >
                                        <i class="fas fa-trash mr-1"></i> Remover
                                    </button>
                                </div>
                            </div>
                            ${previewMarkup}
                            <p class="text-[11px] text-gray-400 mt-2">ID: ${id}</p>
                        </article>
                    `;
                })
                .join('');

            ui.setHTML(list, items);
        }

        async function loadScheduleUpdates(hashProjeto, { silent = false } = {}) {
            const normalizedHash = helpers.normalizeString(hashProjeto);
            if (!normalizedHash) {
                state.current.schedulingProjectUpdates = [];
                renderScheduleUpdates();
                return;
            }

            const refreshButton = elements.scheduleUpdatesRefresh();
            let originalContent = '';
            if (refreshButton && !silent) {
                originalContent = refreshButton.innerHTML;
                refreshButton.disabled = true;
                refreshButton.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i><span class="ml-2">Atualizando...</span>';
            }

            if (!silent) {
                setScheduleUpdatesLoading();
            }

            try {
                const updates = await services.projects.getUpdates({ hashProjeto: normalizedHash });
                state.current.schedulingProjectUpdates = Array.isArray(updates) ? updates : [];
                renderScheduleUpdates();
            } catch (error) {
                ConfigUtils.log('Erro ao carregar atualizações agendadas', error);
                if (!silent) {
                    ui.feedback.error(error.message || CONFIG.messages.errors.generic);
                }
                state.current.schedulingProjectUpdates = [];
                const list = elements.scheduleUpdatesList();
                if (list) {
                    ui.setHTML(
                        list,
                        `<p class="text-sm text-red-500">${helpers.normalizeString(
                            error.message || 'Não foi possível carregar as atualizações.'
                        )}</p>`
                    );
                }
                const empty = elements.scheduleUpdatesEmpty();
                if (empty) {
                    ui.setHidden(empty, true);
                }
            } finally {
                if (refreshButton && !silent) {
                    refreshButton.disabled = false;
                    refreshButton.innerHTML = originalContent;
                }
            }
        }

        function bindScheduleUpdatesControls() {
            const button = elements.scheduleUpdatesRefresh();
            if (button) {
                button.addEventListener('click', () => {
                    if (!state.current.schedulingProjectHash) {
                        ui.feedback.warning('Selecione um projeto antes de atualizar as atualizações agendadas.');
                        return;
                    }
                    loadScheduleUpdates(state.current.schedulingProjectHash);
                });
            }

            const list = elements.scheduleUpdatesList();
            if (list) {
                list.addEventListener('click', (event) => {
                    const actionButton = event.target.closest('[data-action="schedule.update.delete"]');
                    if (!actionButton) return;
                    const updateId = actionButton.dataset.updateId;
                    if (!updateId) return;
                    handleDeleteScheduleUpdate(updateId);
                });
            }
        }

        async function handleDeleteScheduleUpdate(updateId) {
            if (!state.current.schedulingProjectHash) {
                ui.feedback.warning('Selecione um projeto antes de remover um agendamento.');
                return;
            }

            const idValue = updateId ?? '';
            const target = state.current.schedulingProjectUpdates.find(
                (entry) => String(entry?.id) === String(idValue)
            );

            if (!target) {
                ui.feedback.warning('Agendamento não encontrado.');
                return;
            }

            ui.confirm({
                title: 'Remover agendamento',
                message: 'Deseja realmente remover este agendamento programado?',
                confirmLabel: 'Remover',
                onConfirm: async () => {
                    ui.loader.show('Removendo agendamento...');
                    try {
                        await services.projects.deleteUpdate({
                            id: target.id,
                            hashProjeto: state.current.schedulingProjectHash
                        });
                        ui.feedback.success('Agendamento removido com sucesso!');
                        await loadScheduleUpdates(state.current.schedulingProjectHash, { silent: true });
                    } catch (error) {
                        ConfigUtils.log('Erro ao remover agendamento do projeto', error);
                        ui.feedback.error(error.message || CONFIG.messages.errors.generic);
                    } finally {
                        ui.loader.hide();
                    }
                }
            });
        }

        function getFullMessageControls() {
            return {
                disableCheckbox: ui.get('projectDisableGroupFullMessage'),
                configContainer: ui.get('projectFullMessageConfig'),
                typeSelect: ui.get('projectFullMessageType'),
                mediaField: ui.get('projectFullMessageMediaField'),
                mediaInput: ui.get('projectFullMessageMedia'),
                mediaPreview: ui.get('projectFullMessageMediaPreview')
            };
        }

        function updateFullMessageControls() {
            const { disableCheckbox, configContainer, typeSelect, mediaField, mediaInput, mediaPreview } =
                getFullMessageControls();

            const disabled = disableCheckbox?.checked ?? false;
            if (configContainer) {
                ui.setHidden(configContainer, disabled);
            }

            const typeValue = helpers.normalizeString(typeSelect?.value || 'text');
            const requiresMedia = !disabled && FULL_MESSAGE_MEDIA_TYPES.includes(typeValue);

            if (mediaField) {
                ui.setHidden(mediaField, !requiresMedia);
            }

            if (mediaInput) {
                mediaInput.required = requiresMedia;
                if (!requiresMedia) {
                    mediaInput.value = '';
                }
            }

            if (!requiresMedia) {
                state.temp.newProject.fullMessageMedia = '';
                if (mediaPreview) {
                    mediaPreview.classList.add('hidden');
                    mediaPreview.textContent = '';
                }
            }
        }

        function bindFullMessageControls() {
            const { disableCheckbox, typeSelect } = getFullMessageControls();

            if (disableCheckbox) {
                disableCheckbox.addEventListener('change', updateFullMessageControls);
            }

            if (typeSelect) {
                typeSelect.addEventListener('change', () => {
                    const mediaInput = ui.get('projectFullMessageMedia');
                    const mediaPreview = ui.get('projectFullMessageMediaPreview');
                    if (mediaInput) {
                        mediaInput.value = '';
                    }
                    state.temp.newProject.fullMessageMedia = '';
                    if (mediaPreview) {
                        mediaPreview.classList.add('hidden');
                        mediaPreview.textContent = '';
                    }
                    updateFullMessageControls();
                });
            }

            updateFullMessageControls();
        }

        function roundMinutes(value, step = 5) {
            const date = value instanceof Date ? new Date(value) : new Date();
            const minutes = date.getMinutes();
            const remainder = minutes % step;
            if (remainder === 0) {
                return date;
            }
            date.setMinutes(minutes + (step - remainder), 0, 0);
            return date;
        }

        function prepareScheduleModal(hashProjeto) {
            const project = getProjectByHash(hashProjeto);
            if (!project) {
                ui.feedback.warning('Projeto não encontrado.');
                ui.modal.close(elements.scheduleModal);
                return;
            }

            state.current.schedulingProjectHash = hashProjeto;
            state.current.schedulingProjectData = {
                name: project?.nomeProjeto || '',
                description: project?.descricaoProjeto || ''
            };
            state.current.schedulingProjectUpdates = [];
            clearScheduleEntryThumbnails();

            const form = elements.scheduleForm();
            if (form) {
                form.reset();
            }

            setScheduleUpdatesLoading('Carregando atualizações agendadas...');

            const summaryName = ui.get('scheduleProjectSummaryName');
            const summaryHash = ui.get('scheduleProjectSummaryHash');
            const summaryDescription = ui.get('scheduleProjectSummaryDescription');
            const currentThumbImage = ui.get('scheduleProjectCurrentThumbImage');
            const currentThumbPlaceholder = ui.get('scheduleProjectCurrentThumbPlaceholder');
            const hashInput = ui.get('scheduleProjectHash');

            ui.setText(summaryName, project?.nomeProjeto || 'Projeto');
            ui.setText(summaryHash, helpers.maskIdentifier(hashProjeto));
            ui.setText(summaryDescription, project?.descricaoProjeto || 'Projeto sem descrição.');

            const currentThumb =
                helpers.normalizeString(project?.thumbProjetoBase64 || project?.thumbProjeto || project?.thumb || '');
            if (currentThumb && currentThumbImage) {
                currentThumbImage.src = currentThumb;
                currentThumbImage.classList.remove('hidden');
                if (currentThumbPlaceholder) currentThumbPlaceholder.classList.add('hidden');
            } else if (currentThumbImage) {
                currentThumbImage.classList.add('hidden');
                currentThumbImage.removeAttribute('src');
                if (currentThumbPlaceholder) currentThumbPlaceholder.classList.remove('hidden');
            }

            if (hashInput) {
                hashInput.value = hashProjeto;
            }

            resetScheduleEntries({
                name: state.current.schedulingProjectData.name,
                description: state.current.schedulingProjectData.description
            });

            loadScheduleUpdates(hashProjeto, { silent: true });
        }

        function validateScheduleTime(timeValue) {
            if (!timeValue) return false;
            const [hours, minutes] = timeValue.split(':').map((part) => Number(part));
            if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
            return minutes % 5 === 0;
        }

        async function handleScheduleSubmit(event) {
            event.preventDefault();

            const form = elements.scheduleForm();
            if (!form) return;

            const hashProjeto = helpers.normalizeString(ui.get('scheduleProjectHash')?.value);
            if (!hashProjeto) {
                ui.feedback.warning('Projeto inválido. Tente novamente.');
                return;
            }

            const entries = getScheduleEntryElements();
            if (!entries.length) {
                ui.feedback.warning('Adicione pelo menos um agendamento.');
                return;
            }

            const payloads = [];

            for (let index = 0; index < entries.length; index += 1) {
                const entry = entries[index];
                const label = entry.querySelector('[data-entry-label]')?.textContent || `Agendamento #${index + 1}`;
                const nameInput = entry.querySelector('[data-field="name"]');
                const descriptionInput = entry.querySelector('[data-field="description"]');
                const dateInput = entry.querySelector('[data-field="date"]');
                const timeInput = entry.querySelector('[data-field="time"]');

                const name = helpers.normalizeString(nameInput?.value);
                const description = helpers.normalizeString(descriptionInput?.value);
                const dateValue = helpers.normalizeString(dateInput?.value);
                const timeValue = helpers.normalizeString(timeInput?.value);

                if (!name || !description) {
                    ui.feedback.warning(`Informe nome e descrição para ${label}.`);
                    nameInput?.focus();
                    return;
                }

                if (!dateValue || !timeValue) {
                    ui.feedback.warning(`Selecione data e horário para ${label}.`);
                    dateInput?.focus();
                    return;
                }

                if (!validateScheduleTime(timeValue)) {
                    ui.feedback.warning(`Os minutos do horário em ${label} devem ser múltiplos de 5.`);
                    timeInput?.focus();
                    return;
                }

                const scheduledDateTime = new Date(`${dateValue}T${timeValue}:00`);
                if (Number.isNaN(scheduledDateTime.getTime())) {
                    ui.feedback.warning(`Data ou horário inválido em ${label}.`);
                    dateInput?.focus();
                    return;
                }

                if (scheduledDateTime <= new Date()) {
                    ui.feedback.warning(`Selecione uma data e horário futuros para ${label}.`);
                    dateInput?.focus();
                    return;
                }

                const payload = {
                    hashProjeto,
                    nomeProjeto: name,
                    descricaoProjeto: description,
                    dataAgendamento: dateValue,
                    horaAgendamento: timeValue,
                    dataHoraAgendamento: scheduledDateTime.toISOString()
                };

                const entryId = entry.dataset.entryId;
                const thumbnail = entryId ? getScheduleEntryThumbnail(entryId) : '';
                if (thumbnail) {
                    payload.thumbProjeto = thumbnail;
                }

                payloads.push(payload);
            }

            ui.loader.show(
                payloads.length > 1
                    ? `Agendando ${payloads.length} atualizações...`
                    : 'Agendando atualização...'
            );
            try {
                for (const payload of payloads) {
                    await services.projects.scheduleUpdate(payload);
                }
                ui.modal.close(elements.scheduleModal);
                ui.feedback.success(
                    payloads.length > 1
                        ? `${payloads.length} atualizações foram agendadas com sucesso!`
                        : 'Atualização do projeto agendada com sucesso!'
                );
            } catch (error) {
                ConfigUtils.log('Erro ao agendar atualização do projeto', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
            }
        }

        async function handleCreateSubmit(event) {
            event.preventDefault();

            const form = elements.newForm();
            if (!form) return;

            const nameInput = ui.get('projectName');
            const descriptionInput = ui.get('projectDescription');
            const groupQuantityInput = ui.get('projectGroupQuantity');
            const ownerSelect = elements.ownerSelect();
            const instancesList = elements.instancesList();

            const name = helpers.normalizeString(nameInput?.value);
            const description = helpers.normalizeString(descriptionInput?.value);
            const groupQuantity = Number(groupQuantityInput?.value || 1);
            const slug = slugManagers.create?.get() || helpers.formatSlug(name);

            if (!name || !description) {
                ui.feedback.warning('Informe nome e descrição do projeto.');
                return;
            }

            if (!ownerSelect || !ownerSelect.value) {
                ui.feedback.warning('Selecione a instância proprietária do projeto.');
                return;
            }

            if (!slug) {
                ui.feedback.warning('Informe um slug válido.');
                return;
            }

            const ownerOption = ownerSelect.selectedOptions[0];
            const ownerToken = helpers.normalizeString(ownerOption?.dataset.token);
            const ownerInstancia = helpers.normalizeString(ownerOption?.dataset.instancia);

            const { tokens, instancias } = collectSelectedInstances(instancesList);

            if (ownerToken && !tokens.includes(ownerToken)) {
                tokens.unshift(ownerToken);
            }
            if (ownerInstancia && !instancias.includes(ownerInstancia)) {
                instancias.unshift(ownerInstancia);
            }

            const disableFullMessage = ui.qs('#projectDisableGroupFullMessage')?.checked ?? false;
            const messageType = helpers.normalizeString(ui.qs('#projectFullMessageType')?.value || 'text');
            const messageContent = helpers.normalizeString(ui.qs('#projectFullMessageText')?.value);
            const requiresMedia = !disableFullMessage && ['image', 'video'].includes(messageType);

            if (!disableFullMessage && !messageContent) {
                ui.feedback.warning('Informe a mensagem que será enviada quando o grupo estiver cheio.');
                return;
            }

            if (requiresMedia && !state.temp.newProject.fullMessageMedia) {
                ui.feedback.warning('Selecione uma mídia para a mensagem de grupo cheio.');
                return;
            }

            ui.loader.show('Criando projeto...');

            try {
                await services.projects.create({
                    nomeProjeto: name,
                    descricaoProjeto: description,
                    slug,
                    adminsProjeto: tokens.join(','),
                    telAdminsProjeto: instancias.join(','),
                    quantidadeGrupos: Math.min(Math.max(groupQuantity, 1), 100),
                    token_dono: ownerToken,
                    thumbProjeto: state.temp.newProject.thumbnail || '',
                    naoEnviarMsgGrupoCheio: disableFullMessage,
                    tipoMsgGrupoCheio: disableFullMessage ? null : messageType,
                    mensagemGrupoCheio: disableFullMessage ? '' : messageContent,
                    midiaMsgGrupoCheio: disableFullMessage ? '' : state.temp.newProject.fullMessageMedia
                });

                ui.modal.close(elements.newModal);
                await load(true);
                ui.feedback.success('Projeto criado com sucesso!');
            } catch (error) {
                ConfigUtils.log('Erro ao criar projeto', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
            }
        }

        async function handleUpdateSubmit(event) {
            event.preventDefault();

            const form = elements.detailsForm();
            if (!form) return;

            const hashProjeto = form.dataset.hashProjeto;
            if (!hashProjeto) {
                ui.feedback.warning('Projeto inválido. Tente novamente.');
                return;
            }

            const name = helpers.normalizeString(ui.get('projectDetailsName')?.value);
            const description = helpers.normalizeString(ui.get('projectDetailsDescription')?.value);
            const slug = slugManagers.details?.get() || helpers.formatSlug(name);

            if (!name || !description) {
                ui.feedback.warning('Informe nome e descrição do projeto.');
                return;
            }

            if (!slug) {
                ui.feedback.warning('Informe um slug válido.');
                return;
            }

            const ownerSelect = elements.detailsOwnerSelect();
            if (!ownerSelect || !ownerSelect.value) {
                ui.feedback.warning('Selecione a instância proprietária do projeto.');
                return;
            }

            const ownerOption = ownerSelect.selectedOptions[0];
            const ownerToken = helpers.normalizeString(ownerOption?.dataset.token);
            const ownerInstancia = helpers.normalizeString(ownerOption?.dataset.instancia);

            const { tokens, instancias } = collectSelectedInstances(elements.detailsInstancesList());

            if (ownerToken && !tokens.includes(ownerToken)) {
                tokens.unshift(ownerToken);
            }
            if (ownerInstancia && !instancias.includes(ownerInstancia)) {
                instancias.unshift(ownerInstancia);
            }

            ui.loader.show('Atualizando projeto...');

            try {
                await services.projects.update({
                    hashProjeto,
                    nomeProjeto: name,
                    descricaoProjeto: description,
                    slug,
                    adminsProjeto: tokens.join(','),
                    telAdminsProjeto: instancias.join(','),
                    thumbProjeto: state.temp.editProject.thumbnail || '',
                    token_dono: ownerToken
                });

                ui.modal.close(elements.detailsModal);
                await load(true);
                ui.feedback.success('Projeto atualizado com sucesso!');
            } catch (error) {
                ConfigUtils.log('Erro ao atualizar projeto', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
            }
        }

        function bindEvents() {
            const grid = elements.grid();
            if (grid) {
                grid.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-action]');
                    if (!button) return;

                    const action = button.dataset.action;
                    const hashProjeto = button.dataset.projectHash;

                    switch (action) {
                        case 'project.view':
                            ui.modal.open(elements.detailsModal);
                            prepareProjectDetailsModal(hashProjeto);
                            break;
                        case 'project.schedule':
                            ui.modal.open(elements.scheduleModal);
                            prepareScheduleModal(hashProjeto);
                            break;
                        case 'project.toggle':
                            toggleStatus(hashProjeto, button.dataset.projectActive === 'true');
                            break;
                        default:
                            break;
                    }
                });
            }

            const newForm = elements.newForm();
            if (newForm) {
                newForm.addEventListener('submit', handleCreateSubmit);
            }

            const detailsForm = elements.detailsForm();
            if (detailsForm) {
                detailsForm.addEventListener('submit', handleUpdateSubmit);
            }

            const scheduleForm = elements.scheduleForm();
            if (scheduleForm) {
                scheduleForm.addEventListener('submit', handleScheduleSubmit);
            }

            ui.qsa('[data-action="logout"]').forEach((button) => {
                button.addEventListener('click', () => {
                    ui.confirm({
                        title: 'Sair da conta',
                        message: CONFIG.messages.confirmations.logout,
                        onConfirm: () => services.auth.logout()
                    });
                });
            });

            const refreshCreateButton = ui.get('refreshProjectInstances');
            if (refreshCreateButton) {
                refreshCreateButton.addEventListener('click', async () => {
                    ui.loader.show('Atualizando instâncias...');
                    try {
                        const instances = await loadWhatsappInstances({ force: true });
                        buildInstancesList(instances, {
                            listElement: elements.instancesList(),
                            emptyElement: elements.instancesEmpty()
                        });
                    } catch (error) {
                        ConfigUtils.log('Erro ao atualizar instâncias', error);
                        ui.feedback.error('Não foi possível atualizar as instâncias administradoras.');
                    } finally {
                        ui.loader.hide();
                    }
                });
            }

            const refreshDetailsButton = ui.get('refreshProjectDetailsInstances');
            if (refreshDetailsButton) {
                refreshDetailsButton.addEventListener('click', async () => {
                    ui.loader.show('Atualizando instâncias...');
                    try {
                        const instances = await loadWhatsappInstances({ force: true });
                        if (state.current.projectHash) {
                            buildInstancesList(instances, {
                                listElement: elements.detailsInstancesList(),
                                emptyElement: elements.detailsInstancesEmpty(),
                                selectedTokens: helpers.toArray(getProjectByHash(state.current.projectHash)?.tokensProjeto || []),
                                selectedInstancias: helpers.toArray(getProjectByHash(state.current.projectHash)?.telAdminsProjeto || [])
                            });
                        } else {
                            buildInstancesList(instances, {
                                listElement: elements.detailsInstancesList(),
                                emptyElement: elements.detailsInstancesEmpty()
                            });
                        }
                    } catch (error) {
                        ConfigUtils.log('Erro ao atualizar instâncias', error);
                        ui.feedback.error('Não foi possível atualizar as instâncias administradoras.');
                    } finally {
                        ui.loader.hide();
                    }
                });
            }
        }

        function bindFileInputs() {
            const createThumbnailInput = ui.get('projectThumbnail');
            const createThumbnailPreview = ui.get('projectThumbPreview');
            const createThumbnailImage = ui.get('projectThumbPreviewImage');

            if (createThumbnailInput) {
                createThumbnailInput.addEventListener('change', async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                        state.temp.newProject.thumbnail = '';
                        if (createThumbnailPreview) createThumbnailPreview.classList.add('hidden');
                        if (createThumbnailImage) createThumbnailImage.removeAttribute('src');
                        return;
                    }

                    const validation = files.validate(file);
                    if (!validation.valid) {
                        ui.feedback.warning(validation.message);
                        event.target.value = '';
                        return;
                    }

                    try {
                        state.temp.newProject.thumbnail = await files.toBase64(file);
                        if (createThumbnailImage) createThumbnailImage.src = state.temp.newProject.thumbnail;
                        if (createThumbnailPreview) createThumbnailPreview.classList.remove('hidden');
                    } catch (error) {
                        ConfigUtils.log('Erro ao processar thumbnail do projeto', error);
                        ui.feedback.error('Não foi possível processar a imagem selecionada.');
                        event.target.value = '';
                    }
                });
            }

            const detailsThumbnailInput = ui.get('projectDetailsThumbnail');
            const detailsThumbnailPreview = ui.get('projectDetailsThumbPreview');
            const detailsThumbnailImage = ui.get('projectDetailsThumbPreviewImage');
            const removeThumbnailButton = ui.get('projectDetailsRemoveThumbnail');

            if (detailsThumbnailInput) {
                detailsThumbnailInput.addEventListener('change', async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                        state.temp.editProject.thumbnail = '';
                        if (detailsThumbnailPreview) detailsThumbnailPreview.classList.add('hidden');
                        if (detailsThumbnailImage) detailsThumbnailImage.removeAttribute('src');
                        return;
                    }

                    const validation = files.validate(file);
                    if (!validation.valid) {
                        ui.feedback.warning(validation.message);
                        event.target.value = '';
                        return;
                    }

                    try {
                        state.temp.editProject.thumbnail = await files.toBase64(file);
                        if (detailsThumbnailImage) detailsThumbnailImage.src = state.temp.editProject.thumbnail;
                        if (detailsThumbnailPreview) detailsThumbnailPreview.classList.remove('hidden');
                    } catch (error) {
                        ConfigUtils.log('Erro ao processar thumbnail do projeto (detalhes)', error);
                        ui.feedback.error('Não foi possível processar a imagem selecionada.');
                        event.target.value = '';
                    }
                });
            }

            if (removeThumbnailButton) {
                removeThumbnailButton.addEventListener('click', () => {
                    state.temp.editProject.thumbnail = '';
                    const preview = ui.get('projectDetailsThumbPreview');
                    const image = ui.get('projectDetailsThumbPreviewImage');
                    if (preview) preview.classList.add('hidden');
                    if (image) image.removeAttribute('src');
                    const input = ui.get('projectDetailsThumbnail');
                    if (input) input.value = '';
                });
            }

            const fullMessageMediaInput = ui.get('projectFullMessageMedia');
            const fullMessageMediaPreview = ui.get('projectFullMessageMediaPreview');

            if (fullMessageMediaInput) {
                fullMessageMediaInput.addEventListener('change', async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                        state.temp.newProject.fullMessageMedia = '';
                        if (fullMessageMediaPreview) {
                            fullMessageMediaPreview.classList.add('hidden');
                            fullMessageMediaPreview.textContent = '';
                        }
                        return;
                    }

                    const validation = files.validate(file, {
                        allowed: [
                            ...CONFIG.ui.imageFormats,
                            'video/mp4',
                            'video/quicktime',
                            'video/webm',
                            'video/3gpp'
                        ]
                    });

                    if (!validation.valid) {
                        ui.feedback.warning(validation.message);
                        event.target.value = '';
                        state.temp.newProject.fullMessageMedia = '';
                        if (fullMessageMediaPreview) {
                            fullMessageMediaPreview.classList.add('hidden');
                            fullMessageMediaPreview.textContent = '';
                        }
                        return;
                    }

                    try {
                        state.temp.newProject.fullMessageMedia = await files.toBase64(file);
                        if (fullMessageMediaPreview) {
                            const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
                            fullMessageMediaPreview.textContent = `${file.name} • ${sizeMb}MB`;
                            fullMessageMediaPreview.classList.remove('hidden');
                        }
                    } catch (error) {
                        ConfigUtils.log('Erro ao processar mídia da mensagem de grupo cheio', error);
                        ui.feedback.error('Não foi possível processar a mídia selecionada.');
                        event.target.value = '';
                        state.temp.newProject.fullMessageMedia = '';
                        if (fullMessageMediaPreview) {
                            fullMessageMediaPreview.classList.add('hidden');
                            fullMessageMediaPreview.textContent = '';
                        }
                    }
                });
            }

        }

        function registerModals() {
            ui.modal.register(elements.newModal, {
                onOpen: prepareNewProjectModal,
                onClose: () => {
                    state.temp.newProject.thumbnail = '';
                    state.temp.newProject.fullMessageMedia = '';
                }
            });

            ui.modal.register(elements.detailsModal, {
                onOpen: () => { },
                onClose: () => {
                    state.current.projectHash = null;
                    state.temp.editProject.thumbnail = '';
                    state.temp.editProject.fullMessageMedia = '';
                }
            });

            ui.modal.register(elements.scheduleModal, {
                onOpen: () => { },
                onClose: () => {
                    state.current.schedulingProjectHash = null;
                    state.current.schedulingProjectData = null;
                    state.current.schedulingProjectUpdates = [];
                    clearScheduleEntryThumbnails();
                    const form = elements.scheduleForm();
                    if (form) {
                        form.reset();
                    }
                    const container = scheduleEntriesContainer();
                    if (container) {
                        container.innerHTML = '';
                    }
                    setScheduleUpdatesLoading('Selecione um projeto para visualizar as atualizações.');
                }
            });
        }

        return {
            load,
            init() {
                bindEvents();
                bindFullMessageControls();
                bindFileInputs();
                bindScheduleEntryControls();
                bindScheduleUpdatesControls();
                registerModals();
            },
            refresh(force = true) {
                return load(force);
            }
        };
    })();

    const whatsapp = (() => {
        const elements = {
            grid: () => ui.get('whatsappInstancesGrid'),
            emptyState: () => ui.get('noWhatsappInstances'),
            connectModal: 'connectInstanceModal',
            regenerateButton: () => ui.get('connectInstanceRegenerate'),
            verifyButton: () => ui.get('connectInstanceVerify'),
            methodInputs: () => {
                const modal = ui.get('connectInstanceModal');
                return modal ? ui.qsa('input[name="connectInstanceMethod"]', modal) : [];
            },
            paircodeWrapper: () => ui.get('connectInstancePaircodeWrapper'),
            paircodeValue: () => ui.get('connectInstancePaircode'),
            qrWrapper: () => ui.get('connectInstanceQrWrapper'),
            qrImage: () => ui.get('connectInstanceQrImage'),
            qrPlaceholder: () => ui.get('connectInstanceQrPlaceholder')
        };

        const CONNECT_METHODS = Object.freeze({
            PAIRCODE: 'paircode',
            QRCODE: 'qrcode'
        });

        function getConnectModal() {
            return ui.get(elements.connectModal);
        }

        function updateMethodRadios(method) {
            const modal = getConnectModal();
            if (!modal) return;
            ui.qsa('input[name="connectInstanceMethod"]', modal).forEach((radio) => {
                radio.checked = radio.value === method;
            });
        }

        function updateMethodViews(method) {
            const paircodeWrapper = elements.paircodeWrapper();
            const qrWrapper = elements.qrWrapper();
            const placeholder = elements.qrPlaceholder();

            const isPaircode = method === CONNECT_METHODS.PAIRCODE;
            const isQrCode = method === CONNECT_METHODS.QRCODE;

            if (!isPaircode && !isQrCode) {
                if (paircodeWrapper) {
                    ui.setHidden(paircodeWrapper, true);
                }
                if (qrWrapper) {
                    ui.setHidden(qrWrapper, true);
                }
                if (placeholder) {
                    placeholder.textContent = 'Selecione um método para gerar o código.';
                    placeholder.classList.remove('hidden');
                }
                return;
            }

            if (paircodeWrapper) {
                ui.setHidden(paircodeWrapper, !isPaircode);
            }
            if (qrWrapper) {
                ui.setHidden(qrWrapper, !isQrCode);
            }

            if (isPaircode) {
                const paircodeValue = elements.paircodeValue();
                if (paircodeValue) {
                    paircodeValue.textContent = '—';
                }
                if (placeholder) {
                    placeholder.classList.add('hidden');
                }
            } else {
                const qrImage = elements.qrImage();
                if (qrImage) {
                    qrImage.classList.add('hidden');
                    qrImage.removeAttribute('src');
                }
                if (placeholder) {
                    placeholder.textContent = 'QR Code não gerado.';
                    placeholder.classList.remove('hidden');
                }
            }
        }

        function resetConnectFeedback() {
            const statusElement = ui.get('connectInstanceStatus');
            const errorElement = ui.get('connectInstanceError');
            if (statusElement) {
                statusElement.classList.add('hidden');
            }
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.classList.add('hidden');
            }
        }

        function applyConnectMethod(method, { fetch = false, silent = false } = {}) {
            if (!state.current.connectInstance) return;
            if (method !== CONNECT_METHODS.PAIRCODE && method !== CONNECT_METHODS.QRCODE) {
                return;
            }
            const normalized = method === CONNECT_METHODS.QRCODE ? CONNECT_METHODS.QRCODE : CONNECT_METHODS.PAIRCODE;
            state.current.connectInstance.method = normalized;
            updateMethodRadios(normalized);
            updateMethodViews(normalized);
            resetConnectFeedback();
            if (fetch) {
                fetchConnectCode({ silent });
            }
        }

        function buildQrSource(value = '') {
            const raw = helpers.normalizeString ? helpers.normalizeString(value) : (value ?? '').toString().trim();
            if (!raw) return '';
            if (/^data:image\//i.test(raw) || /^https?:\/\//i.test(raw)) {
                return raw;
            }
            return `data:image/png;base64,${raw}`;
        }

        async function load(force = false) {
            if (!force && state.caches.whatsappInstances.length) {
                renderList();
                return;
            }

            ui.loader.show('Carregando instâncias...');
            try {
                const data = await services.whatsapp.list();
                state.caches.whatsappInstances = Array.isArray(data) ? data : [];
                renderList();
            } catch (error) {
                ConfigUtils.log('Erro ao carregar instâncias WhatsApp', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
            }
        }

        function renderList() {
            const grid = elements.grid();
            const emptyState = elements.emptyState();
            if (!grid) return;

            if (!state.caches.whatsappInstances.length) {
                ui.setHTML(grid, '');
                ui.setHidden(emptyState, false);
                return;
            }

            ui.setHidden(emptyState, true);

            const cards = state.caches.whatsappInstances.map((instance) => renderCard(instance)).join('');
            ui.setHTML(grid, cards);
        }

        function renderCard(instance) {
            const statusKey = helpers.normalizeString(instance.status).toLowerCase();
            const statusInfo = helpers.getStatusInfo('instances', statusKey);
            const statusClass = {
                green: 'bg-green-100 text-green-700',
                red: 'bg-red-100 text-red-700',
                yellow: 'bg-yellow-100 text-yellow-700',
                blue: 'bg-blue-100 text-blue-700',
                orange: 'bg-orange-100 text-orange-700'
            }[statusInfo.color] || 'bg-gray-100 text-gray-700';
            const formattedNumber = helpers.formatWhatsapp(instance.instancia);
            const isDisconnected = statusKey === 'disconnected';
            const isConnected = statusKey === 'connected';
            const encodedHash = encodeURIComponent(instance.hash_instancia || '');

            let actionsMarkup = '';

            if (isDisconnected) {
                actionsMarkup = `
                    <button
                        type="button"
                        class="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm font-medium transition"
                        data-action="instance.connect"
                        data-instance-hash="${encodedHash}"
                    >
                        Conectar instância
                    </button>
                `;
            } else if (isConnected) {
                actionsMarkup = `
                    <button
                        type="button"
                        class="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                        data-action="instance.heat"
                        data-instance-hash="${encodedHash}"
                    >
                        <span>Aquecimento</span>
                        <i class="fas fa-fire"></i>
                    </button>
                `;
            } else {
                actionsMarkup = `
                    <p class="w-full text-sm text-gray-500 bg-gray-100 rounded-lg py-2 text-center">
                        Aguardando status para ações.
                    </p>
                `;
            }

            return `
                <article class="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 flex flex-col">
                    <header class="flex items-start justify-between mb-4">
                            <div>
                            <h3 class="font-bold text-gray-800 line-clamp-1">${instance.nome_instancia || 'Instância'}</h3>
                            <p class="text-sm text-gray-500">${formattedNumber || '—'}</p>
                            </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">
                            ${statusInfo.label || statusKey || 'Indefinido'}
                        </span>
                    </header>
                    <dl class="text-sm text-gray-500 space-y-1 mb-5">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-fire text-red-500"></i>
                            <dt class="font-medium text-gray-700">Dias aquecido:</dt>
                            <dd>${instance.datas_aquecido ?? '—'}</dd>
                    </div>
                        <div class="flex items-center gap-2">
                            <i class="fas fa-clock text-green-500"></i>
                            <dt class="font-medium text-gray-700">Último aquecimento:</dt>
                            <dd>${helpers.formatDateTime(instance.ultimo_aquecimento)}</dd>
                        </div>
                    </dl>
                    <div class="mt-auto space-y-3">${actionsMarkup}</div>
                </article>
            `;
        }

        function decodeHash(encoded) {
            try {
                return decodeURIComponent(encoded);
            } catch (error) {
                return encoded;
            }
        }

        async function openConnectModal(hashEncoded) {
            const hash = decodeHash(hashEncoded);
            const instance = state.caches.whatsappInstances.find((item) => item.hash_instancia === hash);
            if (!instance) {
                ui.feedback.warning('Instância não encontrada.');
                return;
            }

            state.current.connectInstance = {
                hash_instancia: instance.hash_instancia,
                nome_instancia: instance.nome_instancia,
                instancia: instance.instancia,
                method: null
            };

            const modalElements = {
                name: ui.get('connectInstanceName'),
                number: ui.get('connectInstanceNumber'),
                hash: ui.get('connectInstanceHash'),
                paircode: ui.get('connectInstancePaircode'),
                status: ui.get('connectInstanceStatus'),
                error: ui.get('connectInstanceError')
            };

            ui.setText(modalElements.name, instance.nome_instancia || 'Instância');
            ui.setText(modalElements.number, ConfigUtils.formatNationalPhone ? ConfigUtils.formatNationalPhone(instance.instancia) : helpers.maskIdentifier(instance.instancia));
            ui.setText(modalElements.hash, helpers.maskIdentifier(instance.hash_instancia));
            if (modalElements.paircode) modalElements.paircode.textContent = '—';
            if (modalElements.status) modalElements.status.classList.add('hidden');
            if (modalElements.error) {
                modalElements.error.textContent = '';
                modalElements.error.classList.add('hidden');
            }

            updateMethodRadios('');
            updateMethodViews(null);
            resetConnectFeedback();
            ui.modal.open(elements.connectModal);
        }

        async function fetchConnectCode({ silent = false } = {}) {
            const current = state.current.connectInstance;
            if (!current?.hash_instancia) {
                return;
            }

            const method = current.method;
            if (method !== CONNECT_METHODS.QRCODE && method !== CONNECT_METHODS.PAIRCODE) {
                if (!silent) {
                    ui.feedback.warning('Selecione como deseja conectar antes de gerar o código.');
                }
                return;
            }

            const loading = ui.get('connectInstanceLoading');
            const statusElement = ui.get('connectInstanceStatus');
            const paircodeElement = elements.paircodeValue();
            const errorElement = ui.get('connectInstanceError');
            const qrImage = elements.qrImage();
            const qrPlaceholder = elements.qrPlaceholder();

            if (!silent && statusElement) {
                statusElement.classList.add('hidden');
            }

            if (method === CONNECT_METHODS.PAIRCODE && paircodeElement) {
                paircodeElement.textContent = '—';
            }

            if (method === CONNECT_METHODS.QRCODE) {
                if (qrImage) {
                    qrImage.classList.add('hidden');
                    qrImage.removeAttribute('src');
                }
                if (qrPlaceholder) {
                    qrPlaceholder.textContent = 'Gerando QR Code...';
                    qrPlaceholder.classList.remove('hidden');
                }
            }

            ui.setHidden(loading, false);
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.classList.add('hidden');
            }

            try {
                const qrPayload = (() => {
                    if (!current.instancia) {
                        return {};
                    }
                    const digits = ConfigUtils.extractDigits
                        ? ConfigUtils.extractDigits(current.instancia)
                        : helpers.normalizeString(current.instancia);
                    return digits ? { phone: digits } : {};
                })();

                const payloadResponse =
                    method === CONNECT_METHODS.QRCODE
                        ? await services.whatsapp.connectQRCode(current.hash_instancia, qrPayload)
                        : await services.whatsapp.connect(current.hash_instancia);

                const payload = Array.isArray(payloadResponse) ? payloadResponse[0] : payloadResponse || {};
                const instanceData = payload.instance || payload || {};
                const status = helpers.normalizeString(instanceData.status || payload.status || 'connecting').toLowerCase();
                const statusInfo = helpers.getStatusInfo('instances', status);

                if (method === CONNECT_METHODS.QRCODE) {
                    const qrData =
                        instanceData.qrcode ||
                        instanceData.qr_code ||
                        instanceData.qrCode ||
                        instanceData.qr ||
                        instanceData.image ||
                        instanceData.imagem ||
                        payload.qrcode ||
                        payload.qrCode ||
                        payload.qr_code ||
                        payload.qr ||
                        payload.image ||
                        payload.imagem;

                    const pairCode = instanceData.paircode;

                    if (!qrData && pairCode) {
                        throw new Error('QR Code não disponível, use o pair code para conectar ou aguarde sem tentar novamente.');
                    }

                    if (!qrData) {
                        throw new Error('QR Code não disponível. Tente novamente.');
                    }

                    const source = buildQrSource(qrData);
                    if (!source) {
                        throw new Error('QR Code inválido recebido.');
                    }

                    if (qrImage) {
                        qrImage.src = source;
                        qrImage.classList.remove('hidden');
                    }
                    if (qrPlaceholder) {
                        qrPlaceholder.textContent = 'Escaneie o QR Code pelo WhatsApp.';
                        qrPlaceholder.classList.add('hidden');
                    }
                } else if (paircodeElement) {
                    const pairCode = helpers.normalizeString(instanceData.paircode || payload.paircode || '');

                    const qrData =
                        instanceData.qrcode ||
                        instanceData.qr_code ||
                        instanceData.qrCode ||
                        instanceData.qr ||
                        instanceData.image ||
                        instanceData.imagem ||
                        payload.qrcode ||
                        payload.qrCode ||
                        payload.qr_code ||
                        payload.qr ||
                        payload.image ||
                        payload.imagem;

                    if (qrData && !pairCode) {
                        throw new Error('Pair code não disponível, use o QR Code para conectar ou aguarde sem tentar novamente.');
                    }

                    if (!pairCode) {
                        throw new Error('Pair code não disponível. Tente novamente.');
                    }

                    paircodeElement.textContent = pairCode || '—';
                }

                if (statusElement) {
                    statusElement.innerHTML = `
                        <span class="inline-flex items-center gap-2 text-sm font-medium">
                            <i class="fas ${statusInfo.icon}"></i>
                            <span>${statusInfo.label || status}</span>
                        </span>
                    `;
                    statusElement.classList.remove('hidden');
                }
            } catch (error) {
                ConfigUtils.log('Erro ao gerar código da instância', error);
                if (errorElement) {
                    errorElement.textContent = error.message || 'Não foi possível gerar o código. Tente novamente.';
                    errorElement.classList.remove('hidden');
                }
                if (method === CONNECT_METHODS.QRCODE && qrPlaceholder) {
                    qrPlaceholder.textContent = 'Não foi possível gerar o QR Code.';
                    qrPlaceholder.classList.remove('hidden');
                }
            } finally {
                ui.setHidden(loading, true);
                if (method === CONNECT_METHODS.QRCODE && qrPlaceholder && !(qrImage && qrImage.getAttribute('src'))) {
                    qrPlaceholder.classList.remove('hidden');
                }
            }
        }

        async function requestHeating(hashEncoded, button) {
            const hash = decodeHash(hashEncoded);
            ui.loader.show('Solicitando aquecimento...');
            const originalText = button?.innerHTML;
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span class="ml-2">Solicitando...</span>';
            }
            try {
                await services.whatsapp.heat(hash);
                ui.feedback.success('Solicitação de aquecimento enviada com sucesso!');
            } catch (error) {
                ConfigUtils.log('Erro ao solicitar aquecimento', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
                if (button) {
                    button.disabled = false;
                    button.innerHTML = originalText;
                }
            }
        }

        function bindEvents() {
            const grid = elements.grid();
            if (!grid) return;

            grid.addEventListener('click', async (event) => {
                const button = event.target.closest('[data-action]');
                if (!button) return;

                const action = button.dataset.action;
                const hash = button.dataset.instanceHash;

                switch (action) {
                    case 'instance.connect':
                        await openConnectModal(hash);
                        break;
                    case 'instance.heat':
                        await requestHeating(hash, button);
                        break;
                    default:
                        break;
                }
            });

            const regenerateButton = elements.regenerateButton();
            if (regenerateButton) {
                regenerateButton.addEventListener('click', () => {
                    if (!state.current.connectInstance?.method) {
                        ui.feedback.warning('Selecione como deseja conectar antes de gerar o código.');
                        return;
                    }
                    fetchConnectCode({ silent: true });
                });
            }

            const methodInputs = elements.methodInputs();
            if (Array.isArray(methodInputs) && methodInputs.length) {
                methodInputs.forEach((input) => {
                    input.addEventListener('change', (event) => {
                        if (!event.target?.checked) return;
                        applyConnectMethod(event.target.value, { fetch: true });
                    });
                });
            }

            const verifyButton = elements.verifyButton();
            if (verifyButton) {
                verifyButton.addEventListener('click', () => {
                    ui.modal.close(elements.connectModal);
                    load(true);
                });
            }

            ui.modal.register(elements.connectModal, {
                onClose: () => {
                    state.current.connectInstance = null;
                }
            });
        }

        return {
            init: bindEvents,
            load
        };
    })();

    const messages = (() => {
        const elements = {
            grid: () => ui.get('projectMessagesGrid'),
            emptyState: () => ui.get('noProjectMessages'),
            modal: 'projectMessagesModal',
            createModal: 'createScheduledMessageModal',
            editModal: 'editScheduledMessageModal',
            createForm: () => ui.get('createScheduledMessageForm'),
            editForm: () => ui.get('editScheduledMessageForm')
        };

        const MEDIA_TYPES = ['image', 'imagem', 'video', 'vídeo'];
        const isMediaType = (value) => MEDIA_TYPES.includes(helpers.normalizeString(value).toLowerCase());
        const setButtonLoading = (button, label = 'Processando...') => {
            if (!button) {
                return () => { };
            }
            const original = {
                html: button.innerHTML,
                disabled: button.disabled
            };
            button.disabled = true;
            button.dataset.loading = 'true';
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span class="ml-2">${label}</span>`;
            return () => {
                if (!button) return;
                button.innerHTML = original.html;
                button.disabled = original.disabled;
                delete button.dataset.loading;
            };
        };

        const NO_PROJECT_KEY = '__no_project__';
        const NO_PROJECT_NAME = 'Mensagens sem projeto';
        const NO_PROJECT_DESCRIPTION = 'Mensagens agendadas sem vínculo de projeto.';

        function buildNoProjectEntry() {
            return {
                projectKey: NO_PROJECT_KEY,
                hashProjeto: '',
                hash_projeto: '',
                nomeProjeto: NO_PROJECT_NAME,
                descricaoProjeto: NO_PROJECT_DESCRIPTION,
                projetoDesativado: false,
                isGeneral: true,
                scheduled: [],
                dispatched: []
            };
        }

        function resolveMessageProjectHash(message) {
            return helpers.normalizeString(
                message?.hashProjeto ||
                message?.hash_projeto ||
                message?.projectHash ||
                message?.hashProjetoProgramado ||
                message?.hashProjetoMensagem
            );
        }

        function buildProjectMap() {
            const projectMap = new Map();
            state.caches.projects.forEach((project) => {
                const hashProjeto = helpers.normalizeString(project?.hashProjeto || project?.hash_projeto);
                if (!hashProjeto) return;
                projectMap.set(hashProjeto, {
                    ...project,
                    hashProjeto: project?.hashProjeto || project?.hash_projeto || hashProjeto
                });
            });
            return projectMap;
        }

        async function load(force = false) {
            const shouldReload =
                force ||
                !state.caches.messages.scheduled.length ||
                !state.caches.messages.dispatched.length ||
                !state.caches.projects.length;

            if (!shouldReload) {
                renderProjects();
                return;
            }

            ui.loader.show('Carregando mensagens...');
            try {
                const [projectsList, scheduled, dispatched] = await Promise.all([
                    services.projects.list(),
                    services.messages.listScheduled(),
                    services.messages.listDispatched()
                ]);

                state.caches.projects = Array.isArray(projectsList) ? projectsList : [];
                state.caches.messages.scheduled = Array.isArray(scheduled) ? scheduled : [];
                state.caches.messages.dispatched = Array.isArray(dispatched) ? dispatched : [];

                renderProjects();
            } catch (error) {
                ConfigUtils.log('Erro ao carregar mensagens', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
            }
        }

        function buildProjectMessages() {
            const projectMap = buildProjectMap();

            const aggregated = new Map();

            const ensureEntry = (projectKey) => {
                if (!aggregated.has(projectKey)) {
                    if (projectKey === NO_PROJECT_KEY) {
                        aggregated.set(projectKey, buildNoProjectEntry());
                    } else {
                        const project = projectMap.get(projectKey) || {};
                        aggregated.set(projectKey, {
                            projectKey,
                            hashProjeto: project.hashProjeto || projectKey,
                            hash_projeto: project.hashProjeto || projectKey,
                            nomeProjeto: project.nomeProjeto || 'Projeto',
                            descricaoProjeto: project.descricaoProjeto || '',
                            projetoDesativado: project.projetoDesativado,
                            isGeneral: false,
                            scheduled: [],
                            dispatched: []
                        });
                    }
                }
                return aggregated.get(projectKey);
            };

            state.caches.messages.scheduled.forEach((message) => {
                const normalizedHash = resolveMessageProjectHash(message);
                const projectKey = normalizedHash || NO_PROJECT_KEY;
                const entryRef = ensureEntry(projectKey);
                entryRef.scheduled.push({
                    ...message,
                    hashProjeto: message?.hashProjeto || message?.hash_projeto || normalizedHash,
                    hash_projeto: message?.hash_projeto || message?.hashProjeto || normalizedHash,
                    nomeProjeto: message?.nomeProjeto || entryRef.nomeProjeto
                });
            });

            state.caches.messages.dispatched.forEach((message) => {
                const normalizedHash = resolveMessageProjectHash(message);
                const projectKey = normalizedHash || NO_PROJECT_KEY;
                const entryRef = ensureEntry(projectKey);
                entryRef.dispatched.push({
                    ...message,
                    hashProjeto: message?.hashProjeto || message?.hash_projeto || normalizedHash,
                    hash_projeto: message?.hash_projeto || message?.hashProjeto || normalizedHash,
                    nomeProjeto: message?.nomeProjeto || entryRef.nomeProjeto
                });
            });

            projectMap.forEach((_, hashProjeto) => {
                if (hashProjeto) {
                    ensureEntry(hashProjeto);
                }
            });

            return Array.from(aggregated.values()).sort((a, b) =>
                helpers.normalizeString(a.nomeProjeto).localeCompare(helpers.normalizeString(b.nomeProjeto))
            );
        }

        function renderProjects() {
            const grid = elements.grid();
            const emptyState = elements.emptyState();
            if (!grid) return;

            const projectMessages = buildProjectMessages();

            if (!projectMessages.length) {
                ui.setHTML(grid, '');
                ui.setHidden(emptyState, false);
                return;
            }

            ui.setHidden(emptyState, true);

            const cards = projectMessages.map((entry) => renderProjectCard(entry)).join('');
            ui.setHTML(grid, cards);
        }

        function renderProjectCard(entry) {
            const statusBadge = helpers.getProjectStatusBadge(entry);
            const scheduledCount = entry.scheduled.length;
            const dispatchedCount = entry.dispatched.length;
            const projectKey = helpers.normalizeString(entry.projectKey || entry.hashProjeto);
            const canCreate = !entry.isGeneral;

            return `
                <article class="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 flex flex-col">
                    <header class="flex items-start justify-between mb-4">
                        <div>
                            <h3 class="font-bold text-gray-800 line-clamp-1">${entry.nomeProjeto}</h3>
                            <p class="text-sm text-gray-500">${entry.descricaoProjeto || 'Projeto sem descrição.'}</p>
                    </div>
                        <span class="${statusBadge.className}">${statusBadge.label}</span>
                    </header>
                    <div class="space-y-2 text-sm text-gray-600 mb-5">
                        <p><i class="fas fa-calendar-check text-blue-500 mr-2"></i>${scheduledCount} mensagem${scheduledCount === 1 ? '' : 's'} agendada${scheduledCount === 1 ? '' : 's'}</p>
                        <p><i class="fas fa-paper-plane text-green-500 mr-2"></i>${dispatchedCount} mensagem${dispatchedCount === 1 ? '' : 's'} disparada${dispatchedCount === 1 ? '' : 's'}</p>
                    </div>
                    <div class="mt-auto flex gap-2">
                        ${canCreate
                    ? `
                                <button
                                    type="button"
                                    class="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                                    data-action="messages.create"
                                    data-project-hash="${projectKey}"
                                >
                                    <i class="fas fa-plus"></i>
                                    Agendar mensagem
                                </button>
                            `
                    : ''
                }
                        <button
                            type="button"
                            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                            data-action="messages.view"
                            data-project-hash="${projectKey}"
                        >
                            <i class="fas fa-envelope-open-text"></i>
                            Ver mensagens
                        </button>
                </div>
                </article>
            `;
        }

        function getProjectMessages(projectKey) {
            const normalizedKey = helpers.normalizeString(projectKey);
            const isGeneral = normalizedKey === NO_PROJECT_KEY;

            const scheduled = state.caches.messages.scheduled.filter((message) => {
                const messageKey = resolveMessageProjectHash(message);
                return isGeneral ? !messageKey : messageKey === normalizedKey;
            });

            const dispatched = state.caches.messages.dispatched.filter((message) => {
                const messageKey = resolveMessageProjectHash(message);
                return isGeneral ? !messageKey : messageKey === normalizedKey;
            });

            if (isGeneral) {
                return {
                    project: {
                        projectKey: NO_PROJECT_KEY,
                        hashProjeto: '',
                        hash_projeto: '',
                        nomeProjeto: NO_PROJECT_NAME,
                        descricaoProjeto: NO_PROJECT_DESCRIPTION,
                        projetoDesativado: false,
                        isGeneral: true
                    },
                    scheduled,
                    dispatched
                };
            }

            const project = state.caches.projects.find((entry) =>
                helpers.normalizeString(entry.hashProjeto || entry.hash_projeto) === normalizedKey
            );

            return {
                project:
                    project || {
                        nomeProjeto: 'Projeto',
                        hashProjeto: normalizedKey,
                        hash_projeto: normalizedKey
                    },
                scheduled,
                dispatched
            };
        }

        function renderMessagesModal(projectKey) {
            const normalizedKey = helpers.normalizeString(projectKey);
            const { project, scheduled, dispatched } = getProjectMessages(normalizedKey);
            const isGeneral = normalizedKey === NO_PROJECT_KEY || project?.isGeneral;
            state.current.messagesProjectKey = normalizedKey;

            ui.setText(ui.get('projectMessagesProjectName'), project.nomeProjeto || 'Projeto');
            ui.setText(
                ui.get('projectMessagesProjectHash'),
                isGeneral ? '—' : helpers.maskIdentifier(project.hashProjeto || project.hash_projeto || normalizedKey)
            );
            ui.setText(ui.get('projectMessagesSubtitle'), project.nomeProjeto || 'Projeto');
            ui.setText(ui.get('projectMessagesScheduledCount'), scheduled.length);
            ui.setText(ui.get('projectMessagesDispatchedCount'), dispatched.length);

            const modalCreateButton = ui.get('projectMessagesCreateButton');
            if (modalCreateButton) {
                ui.setHidden(modalCreateButton, !!isGeneral);
                modalCreateButton.disabled = !!isGeneral;
            }

            const scheduledList = ui.get('projectMessagesScheduledList');
            const scheduledEmpty = ui.get('projectMessagesScheduledEmptyState');

            if (scheduledList) {
                if (!scheduled.length) {
                    ui.setHTML(scheduledList, '');
                    ui.setHidden(scheduledEmpty, false);
                } else {
                    ui.setHidden(scheduledEmpty, true);
                    const items = scheduled.map((message) => renderMessageCard(message, { scheduled: true })).join('');
                    ui.setHTML(scheduledList, items);
                }
            }

            const dispatchedList = ui.get('projectMessagesDispatchedList');
            const dispatchedEmpty = ui.get('projectMessagesDispatchedEmptyState');
            if (dispatchedList) {
                if (!dispatched.length) {
                    ui.setHTML(dispatchedList, '');
                    ui.setHidden(dispatchedEmpty, false);
                } else {
                    ui.setHidden(dispatchedEmpty, true);
                    const items = dispatched.map((message) => renderMessageCard(message, { scheduled: false })).join('');
                    ui.setHTML(dispatchedList, items);
                }
            }
        }

        function renderMessageCard(message, { scheduled }) {
            const identifier = helpers.normalizeString(
                message.hashMensagem ||
                message.hash_mensagem ||
                message.hashMensagemProgramada ||
                message.idMensagem ||
                message.id
            );
            const statusBadge = helpers.getStatusInfo('messages', helpers.normalizeString(message.statusMensagem).toLowerCase());
            const scheduleDisplay = formatSchedule(message, { scheduled });

            return `
                <article class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <header class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-sm font-semibold text-gray-800">${message.nomeGrupo || 'Grupo'}</p>
                            <p class="text-xs text-gray-500">${scheduleDisplay}</p>
                        </div>
                        <span class="px-2 py-1 rounded-full text-xs font-semibold bg-${statusBadge.color || 'gray'}-100 text-${statusBadge.color || 'gray'}-700">
                            ${statusBadge.label || (scheduled ? 'Agendada' : 'Disparada')}
                        </span>
                    </header>
                    <div class="mt-3 space-y-1 text-xs text-gray-500">
                        <p><span class="font-medium text-gray-700">Mensagem:</span> ${message.mensagem || '<span class="text-gray-400">—</span>'}</p>
                        ${message.tipoMensagem ? `<p><span class="font-medium text-gray-700">Tipo:</span> ${message.tipoMensagem}</p>` : ''}
                        ${message.midiaMensagem ? `<p><span class="font-medium text-gray-700">Mídia:</span> ${helpers.maskIdentifier(message.midiaMensagem)}</p>` : ''}
                        <p><span class="font-medium text-gray-700">Hash:</span> ${helpers.maskIdentifier(identifier || '—')}</p>
                    </div>
                    <footer class="flex flex-wrap gap-2 mt-4">
                        ${scheduled
                    ? `
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition"
                                    data-action="messages.edit"
                                    data-message-id="${identifier}"
                                >
                                    <i class="fas fa-pen"></i>
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition"
                                    data-action="messages.deleteScheduled"
                                    data-message-id="${identifier}"
                                >
                                    <i class="fas fa-trash"></i>
                                    Excluir
                                </button>
                            `
                    : `
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition"
                                    data-action="messages.deleteDispatched"
                                    data-message-id="${identifier}"
                                >
                                    <i class="fas fa-eraser"></i>
                                    Apagar mensagem
                                </button>
                            `}
                    </footer>
                </article>
            `;
        }

        function toggleCreateMediaField(typeValue) {
            const requiresMedia = isMediaType(typeValue);
            const mediaField = ui.get('createScheduledMessageMediaField');
            const textField = ui.get('createScheduledMessageTextField');
            const mediaInput = ui.get('createScheduledMessageMedia');
            const messageInput = ui.get('createScheduledMessageText');

            if (requiresMedia) {
                ui.setHidden(mediaField, false);
                if (textField) {
                    textField.querySelector('label span')?.classList?.remove('hidden');
                }
                if (mediaInput) {
                    mediaInput.required = true;
                }
                if (messageInput) {
                    messageInput.placeholder = 'Mensagem de apoio (opcional)';
                }
            } else {
                ui.setHidden(mediaField, true);
                if (mediaInput) {
                    mediaInput.required = false;
                    mediaInput.value = '';
                }
                state.temp.createMessage.media = '';
                const preview = ui.get('createScheduledMessageMediaPreview');
                if (preview) {
                    preview.classList.add('hidden');
                    preview.textContent = '';
                }
                if (messageInput) {
                    messageInput.placeholder = 'Conteúdo da mensagem';
                }
            }
        }

        function refreshEditMediaRequirement() {
            const mediaInput = ui.get('editScheduledMessageMedia');
            if (!mediaInput) return;
            const typeSelect = ui.get('editScheduledMessageType');
            const requiresMedia = isMediaType(typeSelect?.value || 'texto');
            mediaInput.required = Boolean(requiresMedia && !state.temp.editMessage.media);
        }

        function toggleEditMediaField(typeValue) {
            const requiresMedia = isMediaType(typeValue);
            const mediaField = ui.get('editScheduledMessageMediaWrapper');
            const mediaInput = ui.get('editScheduledMessageMedia');

            if (requiresMedia) {
                ui.setHidden(mediaField, false);
            } else {
                ui.setHidden(mediaField, true);
                if (mediaInput) {
                    mediaInput.value = '';
                }
                state.temp.editMessage.media = '';
                const preview = ui.get('editScheduledMessageMediaPreview');
                if (preview) {
                    preview.classList.add('hidden');
                    preview.textContent = '';
                }
            }
            refreshEditMediaRequirement();
        }

        function formatSchedule(message, { scheduled }) {
            const dateValue = helpers.normalizeString(
                message.dataMensagem || message.dataEnvio || message.dataDisparo
            );
            const timeValue = helpers.normalizeString(
                message.horaMensagem || message.horaEnvio || message.horaDisparo
            );

            if (dateValue) {
                const formattedDate = helpers.formatDate(dateValue);
                if (timeValue) {
                    return `${formattedDate} às ${helpers.formatTime(timeValue)}`;
                }
                return formattedDate;
            }

            if (timeValue) {
                return `Horário: ${helpers.formatTime(timeValue)}`;
            }

            const fallback = message.created_at || message.createdAt || message.updatedAt;
            return fallback ? helpers.formatDateTime(fallback) : scheduled ? 'Agendada' : 'Disparada';
        }

        function buildProjectSelectOption(hashProjeto) {
            const normalizedHash = helpers.normalizeString(hashProjeto);
            const project = state.caches.projects.find(
                (entry) => helpers.normalizeString(entry.hashProjeto || entry.hash_projeto) === normalizedHash
            );
            if (project) {
                return {
                    ...project,
                    hashProjeto: project.hashProjeto || project.hash_projeto || normalizedHash
                };
            }
            return { hashProjeto: normalizedHash, nomeProjeto: 'Projeto' };
        }

        async function handleCreateSubmit(event) {
            event.preventDefault();

            const hashProjeto = helpers.normalizeString(ui.get('createScheduledMessageHashProjeto')?.value);
            const dateValue = ui.get('createScheduledMessageDate')?.value || '';
            const timeValue = ui.get('createScheduledMessageTime')?.value || '';
            const typeValue = helpers.normalizeString(ui.get('createScheduledMessageType')?.value || 'texto').toLowerCase();
            const messageText = helpers.normalizeString(ui.get('createScheduledMessageText')?.value);
            const requiresMedia = isMediaType(typeValue);

            if (!hashProjeto) {
                ui.feedback.warning('Projeto inválido. Tente novamente.');
                return;
            }

            if (!dateValue || !timeValue) {
                ui.feedback.warning('Informe data e hora do disparo.');
                return;
            }

            if (!messageText) {
                ui.feedback.warning('Informe o conteúdo da mensagem.');
                return;
            }

            if (requiresMedia && !state.temp.createMessage.media) {
                ui.feedback.warning('Selecione uma mídia para a mensagem.');
                return;
            }

            const submitButton = event.submitter instanceof HTMLElement ? event.submitter : null;
            const restoreButton = setButtonLoading(submitButton, 'Agendando...');
            ui.loader.show('Agendando mensagem...');
            try {
                const payload = {
                    hashProjeto,
                    hash_projeto: hashProjeto,
                    hashProjetoMensagem: hashProjeto,
                    hashProjetoProgramado: hashProjeto,
                    projectHash: hashProjeto,
                    tipoMensagem: requiresMedia ? typeValue : 'texto',
                    mensagem: messageText,
                    dataMensagem: dateValue,
                    horaMensagem: timeValue,
                    midiaMensagem: requiresMedia ? state.temp.createMessage.media : ''
                };
                await services.messages.createScheduled(payload);

                ui.modal.close(elements.createModal);
                await load(true);
                renderMessagesModal(hashProjeto);
                ui.modal.open(elements.modal);
                //ui.feedback.success('Mensagem agendada com sucesso!');
            } catch (error) {
                ConfigUtils.log('Erro ao agendar mensagem', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
                restoreButton();
            }
        }

        async function handleEditSubmit(event) {
            event.preventDefault();

            const hashMensagem = helpers.normalizeString(ui.get('editScheduledMessageHashMensagem')?.value);
            const hashProjeto = helpers.normalizeString(ui.get('editScheduledMessageHashProjeto')?.value);
            const dateValue = ui.get('editScheduledMessageDate')?.value || '';
            const timeValue = ui.get('editScheduledMessageTime')?.value || '';
            const typeValue = helpers.normalizeString(ui.get('editScheduledMessageType')?.value || 'texto').toLowerCase();
            const messageText = helpers.normalizeString(ui.get('editScheduledMessageText')?.value);
            const requiresMedia = isMediaType(typeValue);

            if (!hashMensagem || !hashProjeto) {
                ui.feedback.warning('Mensagem ou projeto inválido.');
                return;
            }

            if (!dateValue || !timeValue) {
                ui.feedback.warning('Informe data e hora do disparo.');
                return;
            }

            if (!messageText) {
                ui.feedback.warning('Informe o conteúdo da mensagem.');
                return;
            }

            if (requiresMedia && !state.temp.editMessage.media) {
                ui.feedback.warning('Selecione uma mídia para a mensagem.');
                return;
            }

            const submitButton = event.submitter instanceof HTMLElement ? event.submitter : null;
            const restoreButton = setButtonLoading(submitButton, 'Salvando...');
            ui.loader.show('Atualizando mensagem...');
            try {
                const payload = {
                    hashMensagem,
                    hashProjeto,
                    hash_projeto: hashProjeto,
                    hashProjetoMensagem: hashProjeto,
                    hashProjetoProgramado: hashProjeto,
                    projectHash: hashProjeto,
                    mensagem: messageText,
                    tipoMensagem: requiresMedia ? typeValue : 'texto',
                    dataMensagem: dateValue,
                    horaMensagem: timeValue,
                    midiaMensagem: requiresMedia ? state.temp.editMessage.media : ''
                };
                await services.messages.updateScheduled(payload);

                ui.modal.close(elements.editModal);
                await load(true);
                renderMessagesModal(hashProjeto);
                ui.modal.open(elements.modal);
                ui.feedback.success('Mensagem atualizada com sucesso!');
            } catch (error) {
                ConfigUtils.log('Erro ao atualizar mensagem agendada', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
                restoreButton();
            }
        }

        async function deleteScheduled(messageId) {
            const message = state.caches.messages.scheduled.find((entry) => {
                const identifier = helpers.normalizeString(
                    entry.hashMensagem ||
                    entry.hash_mensagem ||
                    entry.hashMensagemProgramada ||
                    entry.idMensagem ||
                    entry.id
                );
                return identifier === messageId;
            });

            if (!message) {
                ui.feedback.warning('Mensagem não encontrada.');
                return;
            }

            ui.confirm({
                title: 'Excluir mensagem agendada',
                message: CONFIG.messages.confirmations.delete,
                onConfirm: async () => {
                    ui.loader.show('Excluindo mensagem...');
                    try {
                        await services.messages.deleteScheduled({
                            hashMensagem: message.hashMensagem || message.idMensagem || message.id
                        });
                        await load(true);
                        if (state.current.messagesProjectKey) {
                            renderMessagesModal(state.current.messagesProjectKey);
                        }
                        ui.feedback.success('Mensagem agendada excluída!');
                    } catch (error) {
                        ConfigUtils.log('Erro ao excluir mensagem agendada', error);
                        ui.feedback.error(error.message || CONFIG.messages.errors.generic);
                    } finally {
                        ui.loader.hide();
                    }
                }
            });
        }

        async function deleteDispatched(messageId) {
            const message = state.caches.messages.dispatched.find((entry) => {
                const identifier = helpers.normalizeString(
                    entry.hashMensagem ||
                    entry.hash_mensagem ||
                    entry.hashMensagemDisparada ||
                    entry.idMensagem ||
                    entry.id
                );
                return identifier === messageId;
            });

            if (!message) {
                ui.feedback.warning('Mensagem não encontrada.');
                return;
            }

            ui.confirm({
                title: 'Apagar mensagem disparada',
                message: CONFIG.messages.confirmations.delete,
                onConfirm: async () => {
                    ui.loader.show('Apagando mensagem...');
                    try {
                        await services.messages.deleteMessage(message.hashMensagem || message.idMensagem || message.id);
                        await load(true);
                        if (state.current.messagesProjectKey) {
                            renderMessagesModal(state.current.messagesProjectKey);
                        }
                        ui.feedback.success('Mensagem apagada!');
                    } catch (error) {
                        ConfigUtils.log('Erro ao apagar mensagem', error);
                        ui.feedback.error(error.message || CONFIG.messages.errors.generic);
                    } finally {
                        ui.loader.hide();
                    }
                }
            });
        }

        function prepareCreateModal(hashProjeto) {
            if (helpers.normalizeString(hashProjeto) === NO_PROJECT_KEY) {
                ui.feedback.warning('Selecione um projeto válido antes de agendar uma mensagem.');
                return;
            }
            state.temp.createMessage.media = '';

            const form = elements.createForm();
            if (form) {
                form.reset();
            }

            toggleCreateMediaField('texto');

            const project = buildProjectSelectOption(hashProjeto);
            const projectHash = helpers.normalizeString(project.hashProjeto || project.hash_projeto || hashProjeto);
            ui.setText(ui.get('createScheduledMessageProjectName'), project.nomeProjeto || 'Projeto');
            ui.setText(
                ui.get('createScheduledMessageProjectHashDisplay'),
                helpers.maskIdentifier(project.hashProjeto || project.hash_projeto || hashProjeto)
            );
            const hashInput = ui.get('createScheduledMessageHashProjeto');
            if (hashInput) {
                hashInput.value = projectHash;
            }

            const mediaPreview = ui.get('createScheduledMessageMediaPreview');
            if (mediaPreview) {
                mediaPreview.classList.add('hidden');
                mediaPreview.textContent = '';
            }
        }

        function prepareEditModal(messageId) {
            const message = state.caches.messages.scheduled.find((entry) => {
                const identifier = helpers.normalizeString(
                    entry.hashMensagem ||
                    entry.hash_mensagem ||
                    entry.hashMensagemProgramada ||
                    entry.idMensagem ||
                    entry.id
                );
                return identifier === messageId;
            });

            if (!message) {
                ui.feedback.warning('Mensagem não encontrada.');
                return;
            }

            state.current.editingScheduledMessageId = messageId;
            state.temp.editMessage.media = helpers.normalizeString(message.midiaMensagem || message.midia || '');

            const form = elements.editForm();
            if (!form) return;

            form.reset();

            const projectHash = resolveMessageProjectHash(message);
            const projectInfo = buildProjectSelectOption(projectHash);

            ui.setText(
                ui.get('editScheduledMessageProjectName'),
                message.nomeProjeto || projectInfo.nomeProjeto || 'Projeto'
            );

            const hashMensagemInput = ui.get('editScheduledMessageHashMensagem');
            if (hashMensagemInput) {
                hashMensagemInput.value = message.hashMensagem || message.hash_mensagem || message.hashMensagemProgramada || '';
            }

            const hashProjetoInput = ui.get('editScheduledMessageHashProjeto');
            if (hashProjetoInput) {
                hashProjetoInput.value = projectHash;
            }

            const dateInput = ui.get('editScheduledMessageDate');
            if (dateInput) {
                const dateValue = helpers.normalizeString(message.dataMensagem || message.dataEnvio || message.dataDisparo);
                if (dateValue) {
                    const parsed = new Date(dateValue);
                    if (!Number.isNaN(parsed.getTime())) {
                        dateInput.value = parsed.toISOString().slice(0, 10);
                    }
                }
            }

            const timeInput = ui.get('editScheduledMessageTime');
            if (timeInput) {
                const timeValue = helpers.normalizeString(message.horaMensagem || message.horaEnvio || message.horaDisparo);
                if (timeValue && /^\d{2}:\d{2}/.test(timeValue)) {
                    timeInput.value = timeValue.slice(0, 5);
                }
            }

            const typeSelect = ui.get('editScheduledMessageType');
            if (typeSelect) {
                typeSelect.value = helpers.normalizeString(message.tipoMensagem || 'texto').toLowerCase();
                toggleEditMediaField(typeSelect.value);
            }

            const messageInput = ui.get('editScheduledMessageText');
            if (messageInput) {
                messageInput.value = helpers.normalizeString(message.mensagem || '');
            }

            const mediaPreview = ui.get('editScheduledMessageMediaPreview');
            if (mediaPreview) {
                if (state.temp.editMessage.media) {
                    mediaPreview.classList.remove('hidden');
                    mediaPreview.textContent = 'Uma mídia já está configurada para esta mensagem.';
                } else {
                    mediaPreview.classList.add('hidden');
                    mediaPreview.textContent = '';
                }
            }
        }

        function bindEvents() {
            const grid = elements.grid();
            if (grid) {
                grid.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-action]');
                    if (!button) return;

                    const action = button.dataset.action;
                    const hashProjeto = button.dataset.projectHash;

                    switch (action) {
                        case 'messages.create':
                            prepareCreateModal(hashProjeto);
                            ui.modal.open(elements.createModal);
                            break;
                        case 'messages.view':
                            renderMessagesModal(hashProjeto);
                            ui.modal.open(elements.modal);
                            break;
                        default:
                            break;
                    }
                });
            }

            const refreshButton = ui.get('refreshProjectMessagesButton');
            if (refreshButton) {
                refreshButton.addEventListener('click', async () => {
                    if (refreshButton.disabled) {
                        return;
                    }
                    const originalContent = refreshButton.innerHTML;
                    refreshButton.disabled = true;
                    refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span class="ml-2">Atualizando...</span>';
                    try {
                        await load(true);
                    } finally {
                        refreshButton.disabled = false;
                        refreshButton.innerHTML = originalContent;
                    }
                });
            }

            const scheduledList = ui.get('projectMessagesScheduledList');
            if (scheduledList) {
                scheduledList.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-action]');
                    if (!button) return;

                    const action = button.dataset.action;
                    const messageId = button.dataset.messageId;

                    switch (action) {
                        case 'messages.edit':
                            prepareEditModal(messageId);
                            ui.modal.open(elements.editModal);
                            break;
                        case 'messages.deleteScheduled':
                            deleteScheduled(messageId);
                            break;
                        default:
                            break;
                    }
                });
            }

            const dispatchedList = ui.get('projectMessagesDispatchedList');
            if (dispatchedList) {
                dispatchedList.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-action]');
                    if (!button) return;

                    if (button.dataset.action === 'messages.deleteDispatched') {
                        deleteDispatched(button.dataset.messageId);
                    }
                });
            }

            const modalCreateButton = ui.get('projectMessagesCreateButton');
            if (modalCreateButton) {
                modalCreateButton.addEventListener('click', () => {
                    const hashProjeto = state.current.messagesProjectKey;
                    if (!hashProjeto) {
                        ui.feedback.warning('Selecione um projeto antes de agendar a mensagem.');
                        return;
                    }
                    prepareCreateModal(hashProjeto);
                    ui.modal.open(elements.createModal);
                });
            }

            const createForm = elements.createForm();
            if (createForm) {
                createForm.addEventListener('submit', handleCreateSubmit);
            }

            const createTypeSelect = ui.get('createScheduledMessageType');
            if (createTypeSelect) {
                createTypeSelect.addEventListener('change', (event) => {
                    toggleCreateMediaField(event.target.value);
                });
            }

            const editForm = elements.editForm();
            if (editForm) {
                editForm.addEventListener('submit', handleEditSubmit);
            }

            const editTypeSelect = ui.get('editScheduledMessageType');
            if (editTypeSelect) {
                editTypeSelect.addEventListener('change', (event) => {
                    toggleEditMediaField(event.target.value);
                });
            }

            ui.modal.register(elements.createModal, {
                onClose: () => {
                    state.temp.createMessage.media = '';
                    toggleCreateMediaField('texto');
                }
            });

            ui.modal.register(elements.editModal, {
                onClose: () => {
                    state.current.editingScheduledMessageId = null;
                    state.temp.editMessage.media = '';
                    toggleEditMediaField('texto');
                }
            });
        }

        function bindFileInputs() {
            const createMediaInput = ui.get('createScheduledMessageMedia');
            const createMediaPreview = ui.get('createScheduledMessageMediaPreview');
            const createRemoveMedia = ui.get('createScheduledMessageRemoveMedia');

            if (createMediaInput) {
                createMediaInput.addEventListener('change', async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                        state.temp.createMessage.media = '';
                        if (createMediaPreview) createMediaPreview.classList.add('hidden');
                        return;
                    }

                    const validation = files.validate(file, {
                        allowed: [...CONFIG.ui.imageFormats, 'video/mp4', 'video/quicktime']
                    });

                    if (!validation.valid) {
                        ui.feedback.warning(validation.message);
                        event.target.value = '';
                        return;
                    }

                    try {
                        state.temp.createMessage.media = await files.toBase64(file);
                        if (createMediaPreview) {
                            createMediaPreview.textContent = `${file.name} • ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                            createMediaPreview.classList.remove('hidden');
                        }
                    } catch (error) {
                        ConfigUtils.log('Erro ao processar mídia da mensagem agendada', error);
                        ui.feedback.error('Não foi possível processar a mídia selecionada.');
                        event.target.value = '';
                    }
                });
            }

            if (createRemoveMedia) {
                createRemoveMedia.addEventListener('click', () => {
                    state.temp.createMessage.media = '';
                    const input = ui.get('createScheduledMessageMedia');
                    if (input) input.value = '';
                    if (createMediaPreview) {
                        createMediaPreview.classList.add('hidden');
                        createMediaPreview.textContent = '';
                    }
                });
            }

            const editMediaInput = ui.get('editScheduledMessageMedia');
            const editMediaPreview = ui.get('editScheduledMessageMediaPreview');
            const editRemoveMedia = ui.get('editScheduledMessageRemoveMedia');

            if (editMediaInput) {
                editMediaInput.addEventListener('change', async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                        if (!state.temp.editMessage.media && editMediaPreview) {
                            editMediaPreview.classList.add('hidden');
                            editMediaPreview.textContent = '';
                        }
                        refreshEditMediaRequirement();
                        return;
                    }

                    const validation = files.validate(file, {
                        allowed: [...CONFIG.ui.imageFormats, 'video/mp4', 'video/quicktime']
                    });

                    if (!validation.valid) {
                        ui.feedback.warning(validation.message);
                        event.target.value = '';
                        refreshEditMediaRequirement();
                        return;
                    }

                    try {
                        state.temp.editMessage.media = await files.toBase64(file);
                        if (editMediaPreview) {
                            editMediaPreview.textContent = `${file.name} • ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                            editMediaPreview.classList.remove('hidden');
                        }
                        refreshEditMediaRequirement();
                    } catch (error) {
                        ConfigUtils.log('Erro ao processar mídia da mensagem (edição)', error);
                        ui.feedback.error('Não foi possível processar a mídia selecionada.');
                        event.target.value = '';
                        refreshEditMediaRequirement();
                    }
                });
            }

            if (editRemoveMedia) {
                editRemoveMedia.addEventListener('click', () => {
                    state.temp.editMessage.media = '';
                    const input = ui.get('editScheduledMessageMedia');
                    if (input) input.value = '';
                    if (editMediaPreview) {
                        editMediaPreview.classList.add('hidden');
                        editMediaPreview.textContent = '';
                    }
                    refreshEditMediaRequirement();
                });
            }
        }

        return {
            init() {
                bindEvents();
                bindFileInputs();
            },
            load
        };
    })();

    const groups = (() => {
        const elements = {
            grid: () => ui.get('projectGroupsGrid'),
            emptyState: () => ui.get('noProjectGroups'),
            modal: 'projectGroupsModal',
            list: () => ui.get('projectGroupsList'),
            subtitle: () => ui.get('projectGroupsSubtitle')
        };

        const movementElements = {
            modal: 'groupMovementsModal',
            title: () => ui.get('groupMovementsTitle'),
            hash: () => ui.get('groupMovementsHash'),
            updatedAt: () => ui.get('groupMovementsUpdatedAt'),
            entriesCount: () => ui.get('groupMovementsEntries'),
            exitsCount: () => ui.get('groupMovementsExits'),
            netCount: () => ui.get('groupMovementsNet'),
            emptyState: () => ui.get('groupMovementsEmpty'),
            filterStart: () => ui.get('groupMovementsFilterStart'),
            filterEnd: () => ui.get('groupMovementsFilterEnd'),
            loader: () => ui.get('groupMovementsLoader'),
            chart: () => ui.get('groupMovementsChart'),
            project: {
                modal: 'projectGroupsMovementsModal',
                title: () => ui.get('projectMovementsTitle'),
                hash: () => ui.get('projectMovementsHash'),
                updatedAt: () => ui.get('projectMovementsUpdatedAt'),
                entriesCount: () => ui.get('projectMovementsEntries'),
                exitsCount: () => ui.get('projectMovementsExits'),
                netCount: () => ui.get('projectMovementsNet'),
                emptyState: () => ui.get('projectMovementsEmpty'),
                filterStart: () => ui.get('projectMovementsFilterStart'),
                filterEnd: () => ui.get('projectMovementsFilterEnd'),
                loader: () => ui.get('projectMovementsLoader'),
                chart: () => ui.get('projectMovementsChart'),
                groupsList: () => ui.get('projectMovementsGroupsList')
            }
        };

        const MOVEMENT_TIME_STEP_MINUTES = 60;
        const movementState = {
            timerId: null,
            group: null,
            data: [],
            lastUpdated: null,
            filter: {
                start: null,
                end: null
            }
        };

        const projectMovementState = {
            timerId: null,
            projectHash: null,
            projectName: '',
            data: [],
            groups: [],
            selectedGroups: new Set(),
            lastUpdated: null,
            filter: {
                start: null,
                end: null
            }
        };

        const parseDateTimeInput = (value) => {
            if (!value) return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        async function load(force = false) {
            const shouldReload =
                force ||
                !state.caches.projects.length ||
                !state.caches.groups.length;

            if (!shouldReload) {
                renderProjects();
                return;
            }

            ui.loader.show('Carregando grupos...');
            try {
                const [projectsList, groupsList] = await Promise.all([
                    services.projects.list(),
                    services.groups.list()
                ]);

                state.caches.projects = Array.isArray(projectsList) ? projectsList : [];
                state.caches.groups = Array.isArray(groupsList) ? groupsList : [];

                renderProjects();
            } catch (error) {
                ConfigUtils.log('Erro ao carregar grupos', error);
                ui.feedback.error(error.message || CONFIG.messages.errors.generic);
            } finally {
                ui.loader.hide();
            }
        }

        function buildProjectGroups() {
            const projectMap = new Map();

            state.caches.projects.forEach((project) => {
                if (!project?.hashProjeto) return;
                projectMap.set(project.hashProjeto, {
                    hashProjeto: project.hashProjeto,
                    nomeProjeto: project.nomeProjeto || 'Projeto',
                    descricaoProjeto: project.descricaoProjeto || '',
                    projetoDesativado: project.projetoDesativado,
                    groups: []
                });
            });

            state.caches.groups.forEach((group) => {
                const hashProjeto = helpers.normalizeString(group.hashProjeto);
                if (!hashProjeto) return;
                if (!projectMap.has(hashProjeto)) {
                    projectMap.set(hashProjeto, {
                        hashProjeto,
                        nomeProjeto: group.nomeProjeto || 'Projeto',
                        descricaoProjeto: group.descricaoProjeto || '',
                        projetoDesativado: false,
                        groups: []
                    });
                }
                projectMap.get(hashProjeto).groups.push(group);
            });

            return Array.from(projectMap.values()).map((entry) => ({
                ...entry,
                groups: entry.groups.sort((a, b) => helpers.normalizeString(a?.nomeGrupo).localeCompare(helpers.normalizeString(b?.nomeGrupo)))
            }));
        }

        function renderProjects() {
            const grid = elements.grid();
            const emptyState = elements.emptyState();
            if (!grid) return;

            const projectGroups = buildProjectGroups();
            if (!projectGroups.length) {
                ui.setHTML(grid, '');
                ui.setHidden(emptyState, false);
                return;
            }

            ui.setHidden(emptyState, true);

            const cards = projectGroups.map((entry) => renderProjectCard(entry)).join('');
            ui.setHTML(grid, cards);
        }

        function renderProjectCard(entry) {
            const statusBadge = helpers.getProjectStatusBadge(entry);
            const totalGroups = entry.groups.length;
            return `
                <article class="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 flex flex-col">
                    <header class="flex items-start justify-between mb-4">
                        <div>
                            <h3 class="font-bold text-gray-800 line-clamp-1">${entry.nomeProjeto}</h3>
                            <p class="text-sm text-gray-500">${entry.descricaoProjeto || 'Projeto sem descrição.'}</p>
                        </div>
                        <span class="${statusBadge.className}">${statusBadge.label}</span>
                    </header>
                    <p class="text-sm text-gray-500 mb-4">${totalGroups} grupo${totalGroups === 1 ? '' : 's'} vinculado${totalGroups === 1 ? '' : 's'}</p>
                    <div class="mt-auto">
                        <button
                            type="button"
                            class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                            data-action="groups.view"
                            data-project-hash="${entry.hashProjeto}"
                        >
                            <i class="fas fa-list"></i>
                            Ver grupos
                        </button>
                    </div>
                </article>
            `;
        }

        function renderGroupsModal(hashProjeto) {
            const entry = buildProjectGroups().find((item) => item.hashProjeto === hashProjeto);
            if (!entry) {
                ui.feedback.warning('Projeto não encontrado.');
                return;
            }

            state.current.groupProjectHash = hashProjeto;
            state.current.groupProjectData = entry;
            ui.setText(elements.subtitle(), entry.nomeProjeto || 'Projeto');

            const list = elements.list();
            if (!list) return;

            if (!entry.groups.length) {
                ui.setHTML(list, '<p class="text-sm text-gray-500">Nenhum grupo cadastrado para este projeto.</p>');
                return;
            }

            const aggregatedButton = `
                <div class="flex justify-end mb-4">
                    <button
                        type="button"
                        class="px-4 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-semibold transition"
                        data-action="groups.projectMovements"
                    >
                        <i class="fas fa-chart-line mr-2"></i>
                        Ver movimentação do projeto
                    </button>
                </div>
            `;

            const items = entry.groups
                .map((group) => {
                    const membersDisplay = group.quantidadeMembros ?? '—';
                    const groupJid = helpers.normalizeString(
                        group.groupJidMsg || group.groupjidmsg || group.groupJid || group.group_jid || group.groupjid || ''
                    );
                    const encodedGroupJid = encodeURIComponent(groupJid);
                    const encodedProjectHash = encodeURIComponent(hashProjeto || '');
                    const encodedGroupName = encodeURIComponent(group.nomeGrupo || 'Grupo');

                    return `
                        <article class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <header class="flex items-center justify-between mb-2">
                                <h4 class="text-sm font-semibold text-gray-800">${group.nomeGrupo || 'Grupo'}</h4>
                                <span class="px-2 py-1 text-xs font-semibold rounded-full ${group.grupoCheio ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }">
                                    ${group.grupoCheio ? 'Cheio' : 'Disponível'}
                                </span>
                            </header>
                            <p class="text-xs text-gray-500 mb-2">${group.descricaoGrupo || 'Sem descrição.'}</p>
                            <dl class="text-xs text-gray-500 space-y-1">
                                <div><span class="font-medium text-gray-700">Integrantes:</span> ${membersDisplay}</div>
                                <div><span class="font-medium text-gray-700">Dono:</span> ${helpers.maskIdentifier(group.dono || group.owner || '—')}</div>
                                ${group.linkConvite ? `<div><span class="font-medium text-gray-700">Convite:</span> <a href="${group.linkConvite}" target="_blank" rel="noopener noreferrer" class="text-orange-600 hover:text-orange-700 break-words">${group.linkConvite}</a></div>` : ''}
                            </dl>
                            <div class="mt-4">
                                <button
                                    type="button"
                                    class="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2"
                                    data-action="groups.movements"
                                    data-project-hash="${encodedProjectHash}"
                                    data-group-jid="${encodedGroupJid}"
                                    data-group-name="${encodedGroupName}"
                                >
                                    <i class="fas fa-person-walking"></i>
                                    Ver movimentações
                                </button>
                            </div>
                        </article>
                    `;
                })
                .join('');

            ui.setHTML(list, `${aggregatedButton}${items}`);
        }

        const decodeAttr = (value) => {
            try {
                return decodeURIComponent(value ?? '');
            } catch (error) {
                return value ?? '';
            }
        };

        const findGroup = (projectHash, groupJid) => {
            const normalizedProject = helpers.normalizeString(projectHash);
            const normalizedJid = helpers.normalizeString(groupJid);
            return state.caches.groups.find((group) => {
                const groupHash = helpers.normalizeString(group.hashProjeto || group.hash_projeto);
                const jid = helpers.normalizeString(
                    group.groupJidMsg || group.groupjidmsg || group.groupJid || group.group_jid || group.groupjid || ''
                );
                return groupHash === normalizedProject && jid === normalizedJid;
            });
        };

        function clearMovementsInterval() {
            if (movementState.timerId) {
                clearInterval(movementState.timerId);
                movementState.timerId = null;
            }
        }

        let movementChart = null;
        let projectMovementChart = null;

        const destroyMovementChart = () => {
            if (movementChart) {
                movementChart.destroy();
                movementChart = null;
            }
        };

        const destroyProjectMovementChart = () => {
            if (projectMovementChart) {
                projectMovementChart.destroy();
                projectMovementChart = null;
            }
        };

        function resetMovementsState() {
            clearMovementsInterval();
            movementState.group = null;
            movementState.data = [];
            movementState.lastUpdated = null;
            movementState.filter.start = null;
            movementState.filter.end = null;
            const startInput = movementElements.filterStart();
            const endInput = movementElements.filterEnd();
            if (startInput) startInput.value = '';
            if (endInput) endInput.value = '';
            updateMovementsSummary(0, 0);
            ui.setText(movementElements.updatedAt(), '—');
            destroyMovementChart();
            const emptyState = movementElements.emptyState();
            if (emptyState) emptyState.classList.add('hidden');
            const loader = movementElements.loader();
            if (loader) loader.classList.add('hidden');
        }

        function setMovementsLoading(isLoading) {
            const loader = movementElements.loader();
            if (loader) {
                loader.classList.toggle('hidden', !isLoading);
            }
        }

        function clearProjectMovementsInterval() {
            if (projectMovementState.timerId) {
                clearInterval(projectMovementState.timerId);
                projectMovementState.timerId = null;
            }
        }

        function resetProjectMovementsState() {
            clearProjectMovementsInterval();
            projectMovementState.projectHash = null;
            projectMovementState.projectName = '';
            projectMovementState.data = [];
            projectMovementState.groups = [];
            projectMovementState.selectedGroups = new Set();
            projectMovementState.lastUpdated = null;
            projectMovementState.filter.start = null;
            projectMovementState.filter.end = null;
            const startInput = movementElements.project.filterStart();
            const endInput = movementElements.project.filterEnd();
            if (startInput) startInput.value = '';
            if (endInput) endInput.value = '';
            updateProjectMovementsSummary(0, 0);
            ui.setText(movementElements.project.updatedAt(), '—');
            destroyProjectMovementChart();
            const emptyState = movementElements.project.emptyState();
            if (emptyState) emptyState.classList.add('hidden');
            const loader = movementElements.project.loader();
            if (loader) loader.classList.add('hidden');
            const groupsList = movementElements.project.groupsList();
            if (groupsList) groupsList.innerHTML = '';
        }

        function setProjectMovementsLoading(isLoading) {
            const loader = movementElements.project.loader();
            if (loader) {
                loader.classList.toggle('hidden', !isLoading);
            }
        }

        function updateMovementsSummary(entries, exits) {
            const net = entries - exits;
            ui.setText(movementElements.entriesCount(), entries);
            ui.setText(movementElements.exitsCount(), exits);
            ui.setText(movementElements.netCount(), net);
        }

        function updateProjectMovementsSummary(entries, exits) {
            const net = entries - exits;
            ui.setText(movementElements.project.entriesCount(), entries);
            ui.setText(movementElements.project.exitsCount(), exits);
            ui.setText(movementElements.project.netCount(), net);
        }

        const filterMovements = (movements, filter = {}) => {
            const { start, end } = filter;
            return movements.filter((item) => {
                if (start && item.timestamp < start) return false;
                if (end && item.timestamp > end) return false;
                return true;
            });
        };

        const ensureTimeRange = (movements, filter = {}) => {
            if (!movements.length) {
                const now = new Date();
                return {
                    start: new Date(now.getTime() - MOVEMENT_TIME_STEP_MINUTES * 60 * 1000),
                    end: now
                };
            }
            const first = movements[0].timestamp;
            const last = movements[movements.length - 1].timestamp;
            const start = filter.start ? new Date(filter.start) : new Date(first);
            const end = filter.end ? new Date(filter.end) : new Date(last);

            if (end <= start) {
                end.setTime(start.getTime() + MOVEMENT_TIME_STEP_MINUTES * 60 * 1000);
            }

            start.setSeconds(0, 0);
            end.setSeconds(0, 0);
            return { start, end };
        };

        const buildTimeSteps = (range) => {
            const stepMs = MOVEMENT_TIME_STEP_MINUTES * 60 * 1000;
            const steps = [];
            let cursor = Math.floor(range.start.getTime() / stepMs) * stepMs;
            const endMs = Math.ceil(range.end.getTime() / stepMs) * stepMs;

            while (cursor <= endMs) {
                steps.push(new Date(cursor));
                cursor += stepMs;
            }

            if (steps.length < 2) {
                steps.push(new Date(steps[0].getTime() + stepMs));
            }

            return steps;
        };

        const buildChartData = (movements, filter = {}) => {
            const range = ensureTimeRange(movements, filter);
            const steps = buildTimeSteps(range);
            const stepMs = MOVEMENT_TIME_STEP_MINUTES * 60 * 1000;
            const entries = new Array(steps.length).fill(0);
            const exits = new Array(steps.length).fill(0);
            const startMs = steps[0].getTime();

            movements.forEach((item) => {
                const index = Math.min(
                    steps.length - 1,
                    Math.max(0, Math.floor((item.timestamp.getTime() - startMs) / stepMs))
                );
                if (item.tipo === 1) {
                    entries[index] += 1;
                } else if (item.tipo === -1) {
                    exits[index] += 1;
                }
            });

            return { steps, entries, exits };
        };

        function renderGroupMovements() {
            setMovementsLoading(false);
            const emptyState = movementElements.emptyState();
            if (!emptyState) return;

            const filtered = filterMovements(movementState.data, movementState.filter);
            const entries = filtered.filter((item) => item.tipo === 1).length;
            const exits = filtered.filter((item) => item.tipo === -1).length;
            updateMovementsSummary(entries, exits);

            if (movementState.lastUpdated) {
                ui.setText(movementElements.updatedAt(), helpers.formatDateTime(movementState.lastUpdated));
            } else {
                ui.setText(movementElements.updatedAt(), '—');
            }

            if (!filtered.length) {
                destroyMovementChart();
                emptyState.classList.remove('hidden');
                return;
            }

            emptyState.classList.add('hidden');

            const { steps, entries: entriesData, exits: exitsData } = buildChartData(filtered, movementState.filter);
            const canvas = movementElements.chart();
            if (!canvas) {
                return;
            }

            const chartData = {
                labels: steps,
                datasets: [
                    {
                        label: 'Entradas',
                        data: entriesData,
                        backgroundColor: 'rgba(34, 197, 94, 0.6)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'Saídas',
                        data: exitsData,
                        backgroundColor: 'rgba(239, 68, 68, 0.6)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        tension: 0.3,
                        fill: false
                    }
                ]
            };

            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: MOVEMENT_TIME_STEP_MINUTES >= 60 ? 'hour' : 'minute',
                            stepSize: MOVEMENT_TIME_STEP_MINUTES >= 60 ? MOVEMENT_TIME_STEP_MINUTES / 60 : MOVEMENT_TIME_STEP_MINUTES
                        },
                        ticks: {
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: true
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            title(context) {
                                if (!context.length) return '';
                                return helpers.formatDateTime(context[0].parsed.x);
                            },
                            label(context) {
                                return `${context.dataset.label}: ${context.parsed.y}`;
                            }
                        }
                    }
                }
            };

            if (movementChart) {
                movementChart.data = chartData;
                movementChart.options = chartOptions;
                movementChart.update();
            } else {
                movementChart = new Chart(canvas.getContext('2d'), {
                    type: 'line',
                    data: chartData,
                    options: chartOptions
                });
            }
        }

        function renderProjectMovements() {
            setProjectMovementsLoading(false);
            const emptyState = movementElements.project.emptyState();
            if (!emptyState) return;

            const filtered = filterMovements(projectMovementState.data, projectMovementState.filter);
            const totalEntries = filtered.filter((item) => item.tipo === 1).length;
            const totalExits = filtered.filter((item) => item.tipo === -1).length;
            updateProjectMovementsSummary(totalEntries, totalExits);

            if (projectMovementState.lastUpdated) {
                ui.setText(movementElements.project.updatedAt(), helpers.formatDateTime(projectMovementState.lastUpdated));
            } else {
                ui.setText(movementElements.project.updatedAt(), '—');
            }

            const groupsList = movementElements.project.groupsList();
            if (groupsList) {
                const groupItems = projectMovementState.groups.map((group) => {
                    const groupFiltered = filterMovements(group.movements || [], projectMovementState.filter);
                    const entries = groupFiltered.filter((item) => item.tipo === 1).length;
                    const exits = groupFiltered.filter((item) => item.tipo === -1).length;
                    const net = entries - exits;
                    const isSelected = projectMovementState.selectedGroups.has(group.groupJidMsg);

                    return `
                        <label class="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm cursor-pointer hover:border-orange-300 transition">
                            <div class="flex items-center gap-3">
                                <input type="checkbox" 
                                    class="text-orange-600 focus:ring-orange-500 border-gray-300 rounded group-movement-checkbox"
                                    data-group-jid="${group.groupJidMsg}"
                                    ${isSelected ? 'checked' : ''}>
                                <div>
                                    <p class="text-sm font-semibold text-gray-800">${group.name}</p>
                                    <p class="text-xs text-gray-500">${helpers.maskIdentifier(group.groupJidMsg || '—')}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 text-xs font-semibold">
                                <span class="text-green-600">+${entries}</span>
                                <span class="text-red-600">-${exits}</span>
                                <span class="text-blue-600">${net >= 0 ? '+' : ''}${net}</span>
                            </div>
                        </label>
                    `;
                });

                if (groupItems.length) {
                    groupsList.innerHTML = groupItems.join('');
                } else {
                    groupsList.innerHTML = `
                        <p class="text-sm text-gray-500 bg-gray-100 border border-dashed border-gray-300 rounded-lg p-3 text-center">
                            Nenhum grupo disponível para este projeto.
                        </p>
                    `;
                }

                // Update Select All checkbox state
                const selectAllCheckbox = ui.get('projectMovementsSelectAll');
                if (selectAllCheckbox) {
                    const allSelected = projectMovementState.groups.length > 0 &&
                        projectMovementState.groups.every(g => projectMovementState.selectedGroups.has(g.groupJidMsg));
                    selectAllCheckbox.checked = allSelected;
                    selectAllCheckbox.indeterminate = !allSelected && projectMovementState.selectedGroups.size > 0;
                }
            }

            // Filter data based on selected groups
            const selectedData = filtered.filter(item => projectMovementState.selectedGroups.has(item.groupjidmsg));

            if (!selectedData.length) {
                destroyProjectMovementChart();
                emptyState.classList.remove('hidden');
                // Update summary even if empty
                updateProjectMovementsSummary(0, 0);
                return;
            }

            emptyState.classList.add('hidden');

            // Recalculate summary based on selected data
            const selectedEntries = selectedData.filter((item) => item.tipo === 1).length;
            const selectedExits = selectedData.filter((item) => item.tipo === -1).length;
            updateProjectMovementsSummary(selectedEntries, selectedExits);

            const { steps, entries, exits } = buildChartData(selectedData, projectMovementState.filter);
            const canvas = movementElements.project.chart();
            if (!canvas) return;

            const chartData = {
                labels: steps,
                datasets: [
                    {
                        label: 'Entradas (todos os grupos)',
                        data: entries,
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Saídas (todos os grupos)',
                        data: exits,
                        backgroundColor: 'rgba(249, 115, 22, 0.2)',
                        borderColor: 'rgba(249, 115, 22, 1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            };

            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: MOVEMENT_TIME_STEP_MINUTES >= 60 ? 'hour' : 'minute',
                            stepSize: MOVEMENT_TIME_STEP_MINUTES >= 60 ? MOVEMENT_TIME_STEP_MINUTES / 60 : MOVEMENT_TIME_STEP_MINUTES
                        },
                        ticks: {
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: true
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            title(context) {
                                if (!context.length) return '';
                                return helpers.formatDateTime(context[0].parsed.x);
                            },
                            label(context) {
                                const label = context.dataset.label || '';
                                return `${label}: ${context.parsed.y}`;
                            }
                        }
                    }
                }
            };

            if (projectMovementChart) {
                projectMovementChart.data = chartData;
                projectMovementChart.options = chartOptions;
                projectMovementChart.update();
            } else {
                projectMovementChart = new Chart(canvas.getContext('2d'), {
                    type: 'line',
                    data: chartData,
                    options: chartOptions
                });
            }
        }

        async function fetchGroupMovements({ silent = false } = {}) {
            if (!movementState.group?.groupJidMsg) {
                return;
            }

            if (!silent) {
                setMovementsLoading(true);
                const emptyState = movementElements.emptyState();
                if (emptyState) emptyState.classList.add('hidden');
            }

            try {
                const response = await services.groups.fetchMovements(movementState.group.groupJidMsg);
                const rawMovements = Array.isArray(response) ? response : Array.isArray(response?.dados) ? response.dados : [];
                movementState.data = rawMovements
                    .map((item) => {
                        const timestamp = new Date(item.registro);
                        if (Number.isNaN(timestamp.getTime())) return null;
                        return {
                            groupjidmsg: helpers.normalizeString(item.groupjidmsg || item.groupJidMsg || movementState.group.groupJidMsg),
                            timestamp,
                            tipo: Number(item.tipo)
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.timestamp - b.timestamp);

                movementState.lastUpdated = new Date();
                renderGroupMovements();
            } catch (error) {
                ConfigUtils.log('Erro ao carregar movimentações do grupo', error);
                if (!silent) {
                    ui.feedback.error(error.message || CONFIG.messages.errors.generic);
                    setMovementsLoading(false);
                }
            }
        }

        async function fetchProjectMovements({ silent = false } = {}) {
            if (!projectMovementState.projectHash) {
                return;
            }

            if (!projectMovementState.groups.length) {
                projectMovementState.data = [];
                projectMovementState.lastUpdated = new Date();
                renderProjectMovements();
                return;
            }

            if (!silent) {
                setProjectMovementsLoading(true);
                const emptyState = movementElements.project.emptyState();
                if (emptyState) emptyState.classList.add('hidden');
            }

            const aggregatedMovements = [];
            const updatedGroups = [];
            let fetchError = null;

            const fetchPromises = projectMovementState.groups.map(async (group) => {
                if (!group.groupJidMsg) {
                    return { group, movements: [] };
                }

                try {
                    const response = await services.groups.fetchMovements(group.groupJidMsg);
                    const rawMovements = Array.isArray(response)
                        ? response
                        : Array.isArray(response?.dados)
                            ? response.dados
                            : [];

                    const normalized = rawMovements
                        .map((item) => {
                            const timestamp = new Date(item.registro);
                            if (Number.isNaN(timestamp.getTime())) return null;
                            return {
                                groupjidmsg: helpers.normalizeString(item.groupjidmsg || item.groupJidMsg || group.groupJidMsg),
                                timestamp,
                                tipo: Number(item.tipo)
                            };
                        })
                        .filter(Boolean)
                        .sort((a, b) => a.timestamp - b.timestamp);

                    aggregatedMovements.push(...normalized);
                    return { ...group, movements: normalized };
                } catch (error) {
                    ConfigUtils.log('Erro ao carregar movimentações do grupo (projeto)', error);
                    fetchError = error;
                    return { ...group, movements: [] };
                }
            });

            const results = await Promise.all(fetchPromises);
            projectMovementState.groups = results;
            projectMovementState.data = aggregatedMovements.sort((a, b) => a.timestamp - b.timestamp);
            projectMovementState.lastUpdated = new Date();

            if (fetchError && !silent) {
                ui.feedback.error(fetchError.message || CONFIG.messages.errors.generic);
            }

            renderProjectMovements();
        }

        function openProjectMovementsModal(projectEntry) {
            if (!projectEntry) {
                ui.feedback.warning('Projeto inválido.');
                return;
            }

            resetProjectMovementsState();

            const normalizedGroups = Array.isArray(projectEntry.groups)
                ? projectEntry.groups
                : [];

            const groupsWithJid = normalizedGroups
                .map((group) => {
                    const groupJid = helpers.normalizeString(
                        group.groupJidMsg || group.groupjidmsg || group.groupJid || group.group_jid || group.groupjid || ''
                    );
                    return {
                        name: group.nomeGrupo || 'Grupo',
                        groupJidMsg: groupJid,
                        movements: []
                    };
                })
                .filter((group) => helpers.normalizeString(group.groupJidMsg));

            projectMovementState.projectHash = projectEntry.hashProjeto;
            projectMovementState.projectName = projectEntry.nomeProjeto || 'Projeto';
            projectMovementState.groups = groupsWithJid;

            // Initialize all groups as selected
            projectMovementState.selectedGroups = new Set(groupsWithJid.map(g => g.groupJidMsg));

            ui.setText(movementElements.project.title(), projectMovementState.projectName);
            ui.setText(movementElements.project.hash(), helpers.maskIdentifier(projectMovementState.projectHash));

            if (!groupsWithJid.length) {
                const groupsList = movementElements.project.groupsList();
                if (groupsList) {
                    groupsList.innerHTML = `
                        <p class="text-sm text-gray-500 bg-gray-100 border border-dashed border-gray-300 rounded-lg p-3 text-center">
                            Nenhum grupo com identificação disponível para consultar movimentações.
                        </p>
                    `;
                }
                updateProjectMovementsSummary(0, 0);
                ui.setText(movementElements.project.updatedAt(), '—');
                ui.modal.open(movementElements.project.modal);
                return;
            }

            fetchProjectMovements();
            clearProjectMovementsInterval();
            projectMovementState.timerId = setInterval(() => fetchProjectMovements({ silent: true }), 10000);
            ui.modal.open(movementElements.project.modal);
        }

        function openMovementsModal(group) {
            if (!group) {
                ui.feedback.warning('Grupo inválido.');
                return;
            }

            resetMovementsState();

            const groupJid = helpers.normalizeString(
                group.groupJidMsg || group.groupjidmsg || group.groupJid || group.group_jid || group.groupjid || ''
            );

            movementState.group = {
                ...group,
                groupJidMsg: groupJid
            };

            ui.setText(movementElements.title(), group.nomeGrupo || 'Grupo');
            ui.setText(movementElements.hash(), helpers.maskIdentifier(groupJid || '—'));

            fetchGroupMovements();
            clearMovementsInterval();
            movementState.timerId = setInterval(() => fetchGroupMovements({ silent: true }), 10000);
            ui.modal.open(movementElements.modal);
        }

        function setupMovementFilters() {
            const startInput = movementElements.filterStart();
            if (startInput) {
                startInput.addEventListener('change', () => {
                    movementState.filter.start = parseDateTimeInput(startInput.value);
                    renderGroupMovements();
                });
            }

            const endInput = movementElements.filterEnd();
            if (endInput) {
                endInput.addEventListener('change', () => {
                    movementState.filter.end = parseDateTimeInput(endInput.value);
                    renderGroupMovements();
                });
            }
        }

        function setupProjectMovementFilters() {
            const startInput = movementElements.project.filterStart();
            if (startInput) {
                startInput.addEventListener('change', () => {
                    projectMovementState.filter.start = parseDateTimeInput(startInput.value);
                    renderProjectMovements();
                });
            }

            const endInput = movementElements.project.filterEnd();
            if (endInput) {
                endInput.addEventListener('change', () => {
                    projectMovementState.filter.end = parseDateTimeInput(endInput.value);
                    renderProjectMovements();
                });
            }

            const selectAllCheckbox = ui.get('projectMovementsSelectAll');
            if (selectAllCheckbox) {
                selectAllCheckbox.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    if (isChecked) {
                        projectMovementState.groups.forEach(g => projectMovementState.selectedGroups.add(g.groupJidMsg));
                    } else {
                        projectMovementState.selectedGroups.clear();
                    }
                    renderProjectMovements();
                });
            }

            const groupsList = movementElements.project.groupsList();
            if (groupsList) {
                groupsList.addEventListener('change', (e) => {
                    if (e.target.classList.contains('group-movement-checkbox')) {
                        const groupJid = e.target.dataset.groupJid;
                        if (e.target.checked) {
                            projectMovementState.selectedGroups.add(groupJid);
                        } else {
                            projectMovementState.selectedGroups.delete(groupJid);
                        }
                        renderProjectMovements();
                    }
                });
            }
        }

        function bindEvents() {
            const grid = elements.grid();
            if (grid) {
                grid.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-action="groups.view"]');
                    if (!button) {
                        return;
                    }
                    renderGroupsModal(button.dataset.projectHash);
                    ui.modal.open(elements.modal);
                });
            }

            const listContainer = elements.list();
            if (listContainer) {
                listContainer.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-action]');
                    if (!button) {
                        return;
                    }

                    const action = button.dataset.action;
                    if (action === 'groups.movements') {
                        const projectHash = decodeAttr(button.dataset.projectHash);
                        const groupJid = decodeAttr(button.dataset.groupJid);
                        const groupName = decodeAttr(button.dataset.groupName);
                        const group = findGroup(projectHash, groupJid) || {
                            hashProjeto: projectHash,
                            nomeGrupo: groupName,
                            groupJidMsg: groupJid
                        };
                        openMovementsModal(group);
                        return;
                    }

                    if (action === 'groups.projectMovements') {
                        if (!state.current.groupProjectData) {
                            ui.feedback.warning('Projeto não encontrado. Atualize a lista.');
                            return;
                        }
                        openProjectMovementsModal(state.current.groupProjectData);
                    }
                });
            }

            ui.modal.register(elements.modal, {
                onClose: () => {
                    state.current.groupProjectHash = null;
                    state.current.groupProjectData = null;
                }
            });

            ui.modal.register(movementElements.modal, {
                onClose: () => {
                    resetMovementsState();
                }
            });

            ui.modal.register(movementElements.project.modal, {
                onClose: () => {
                    resetProjectMovementsState();
                }
            });
        }

        return {
            init() {
                bindEvents();
                setupMovementFilters();
                setupProjectMovementFilters();
            },
            load
        };
    })();

    function ensureAuthenticated() {
        if (!services.auth.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        state.user = services.auth.getCurrentUser();
        ui.setText(ui.get('userEmail'), state.user?.email || '');
        return true;
    }

    function bindGlobalActions() {
        ui.qsa('[data-action="logout"]').forEach((button) => {
            button.addEventListener('click', () => {
                ui.confirm({
                    title: 'Sair da conta',
                    message: CONFIG.messages.confirmations.logout,
                    onConfirm: () => services.auth.logout()
                });
            });
        });

        const whatsappNumberInput = ui.get('whatsappNumber');
        if (whatsappNumberInput) {
            whatsappNumberInput.addEventListener('input', (event) => {
                const digits = ConfigUtils.extractDigits ? ConfigUtils.extractDigits(event.target.value) : event.target.value.replace(/\D/g, '');
                const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
                const limited = withoutCountry.slice(0, 11);
                event.target.dataset.digits = limited;
                if (ConfigUtils.formatNationalPhone) {
                    event.target.value = ConfigUtils.formatNationalPhone(limited);
                }
            });
        }
    }

    async function init() {
        if (!ensureAuthenticated()) {
            return;
        }

        state.currentTab = null;
        ui.modal.init();
        navigation.init();
        projects.init();
        whatsapp.init();
        messages.init();
        groups.init();
        bindGlobalActions();

        navigation.setActiveTab('instances');
    }

    return {
        init,
        refreshProjects: () => projects.refresh(true)
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    DashboardApp.init();
});


