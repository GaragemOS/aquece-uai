/**
 * Garagem - Formulário de Grupo (standalone)
 *
 * Página dedicada à criação de grupos fora do dashboard.
 */

const GroupFormApp = (() => {
    const state = {
        thumbnail: ''
    };

    const elements = {
        loader: () => document.getElementById('globalLoader'),
        modal: () => document.getElementById('notificationModal'),
        modalTitle: () => document.getElementById('modalTitle'),
        modalMessage: () => document.getElementById('modalMessage'),
        modalIcon: () => document.getElementById('modalIcon'),
        form: () => document.getElementById('groupForm'),
        projectSelect: () => document.getElementById('projectSelect'),
        uploadArea: () => document.getElementById('uploadArea'),
        imagePreview: () => document.getElementById('imagePreview'),
        previewImg: () => document.getElementById('previewImg'),
        thumbnailInput: () => document.getElementById('groupThumb')
    };

    const ui = {
        loader: {
            show(message = 'Carregando...') {
                const container = elements.loader();
                if (!container) return;
                const label = container.querySelector('[data-loader-label]');
                if (label) label.textContent = message;
                container.classList.remove('hidden');
            },
            hide() {
                const container = elements.loader();
                if (!container) return;
                container.classList.add('hidden');
            }
        },
        notify({ title = '', message = '', type = 'info' }) {
            const modal = elements.modal();
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
            const icon = elements.modalIcon();
            if (icon) icon.innerHTML = `<i class="${iconMap[type] || iconMap.info}"></i>`;
            const titleElement = elements.modalTitle();
            const messageElement = elements.modalMessage();
            if (titleElement) titleElement.textContent = title;
            if (messageElement) messageElement.textContent = message;
            modal.classList.remove('hidden');
        },
        closeModal() {
            const modal = elements.modal();
            if (modal) modal.classList.add('hidden');
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
        validate(file) {
            const allowed = CONFIG.ui.imageFormats || [];
            const maxSize = CONFIG.ui.maxUploadSize || (50 * 1024 * 1024);
            if (allowed.length && !allowed.includes(file.type)) {
                return { valid: false, message: `Formato inválido. Utilize ${allowed.join(', ')}.` };
            }
            if (file.size > maxSize) {
                const maxMb = Math.round(maxSize / (1024 * 1024));
                return { valid: false, message: `O arquivo selecionado excede ${maxMb}MB.` };
            }
            return { valid: true };
        }
    };

    function ensureAuthenticated() {
        if (!authService.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    async function loadProjects() {
        const select = elements.projectSelect();
        if (!select) return;
        select.innerHTML = '<option value="">Carregando projetos...</option>';

        try {
            const projects = await projectService.list();
            if (!Array.isArray(projects) || !projects.length) {
                select.innerHTML = '<option value="">Nenhum projeto disponível</option>';
                return;
            }

            const options = projects
                .filter((project) => project?.hashProjeto)
                .map(
                    (project) => `
                        <option value="${project.hashProjeto}">
                            ${project.nomeProjeto || 'Projeto'}
                        </option>
                    `
                )
                .join('');

            select.innerHTML = '<option value="">Selecione um projeto</option>' + options;
        } catch (error) {
            ConfigUtils.log('Erro ao carregar projetos', error);
            ui.notify({ title: 'Erro', message: 'Não foi possível carregar os projetos.', type: 'error' });
            select.innerHTML = '<option value="">Erro ao carregar projetos</option>';
        }
    }

    function bindModalClose() {
        document.querySelectorAll('[data-modal-close="notificationModal"]').forEach((button) => {
            button.addEventListener('click', () => ui.closeModal());
        });
    }

    function bindThumbnailInput() {
        const input = elements.thumbnailInput();
        if (!input) return;

        input.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            const preview = elements.imagePreview();
            const image = elements.previewImg();
            const uploadArea = elements.uploadArea();

            if (!file) {
                state.thumbnail = '';
                if (image) image.removeAttribute('src');
                if (preview) preview.classList.add('hidden');
                if (uploadArea) uploadArea.classList.remove('hidden');
                return;
            }

            const validation = files.validate(file);
            if (!validation.valid) {
                ui.notify({ title: 'Validação', message: validation.message, type: 'warning' });
                event.target.value = '';
                return;
            }

            try {
                state.thumbnail = await files.toBase64(file);
                if (image) image.src = state.thumbnail;
                if (preview) preview.classList.remove('hidden');
                if (uploadArea) uploadArea.classList.add('hidden');
            } catch (error) {
                ConfigUtils.log('Erro ao processar thumbnail do grupo', error);
                ui.notify({ title: 'Erro', message: 'Não foi possível processar a imagem selecionada.', type: 'error' });
                event.target.value = '';
            }
        });

        const removeButton = document.querySelector('[data-action="group.removeThumbnail"]');
        if (removeButton) {
            removeButton.addEventListener('click', () => {
                state.thumbnail = '';
                const input = elements.thumbnailInput();
                if (input) input.value = '';
                const preview = elements.imagePreview();
                const image = elements.previewImg();
                const uploadArea = elements.uploadArea();
                if (image) image.removeAttribute('src');
                if (preview) preview.classList.add('hidden');
                if (uploadArea) uploadArea.classList.remove('hidden');
            });
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const form = elements.form();
        if (!form) return;

        const hashProjeto = form.projectSelect.value;
        const nomeGrupo = form.groupName.value.trim();
        const descricaoGrupo = form.groupDescription.value.trim();
        const mensagemGrupoCheio = form.fullGroupMessage.value.trim();
        const naoEnviarMsgGrupoCheio = form.disableFullMessage.checked;
        const grupoEncerrado = form.autoClose.checked;
        const groupType = form.groupType.value;

        if (!hashProjeto) {
            ui.notify({ title: 'Validação', message: 'Selecione um projeto.', type: 'warning' });
            return;
        }

        if (!nomeGrupo) {
            ui.notify({ title: 'Validação', message: 'Informe o nome do grupo.', type: 'warning' });
            return;
        }

        const user = authService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        ui.loader.show('Criando grupo...');

        try {
            await groupService.create({
                hashProjeto,
                nomeGrupo,
                descricaoGrupo,
                msgGrupoCheio: mensagemGrupoCheio,
                naoEnviarMsgGrupoCheio,
                grupoEncerrado,
                thumbGrupo: state.thumbnail || '',
                tipo: groupType
            });

            ui.notify({ title: 'Sucesso!', message: `${groupType === 'community' ? 'Comunidade' : 'Grupo'} criado com sucesso!`, type: 'success' });
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } catch (error) {
            ConfigUtils.log('Erro ao criar grupo', error);
            ui.notify({ title: 'Erro', message: error.message || CONFIG.messages.errors.generic, type: 'error' });
        } finally {
            ui.loader.hide();
        }
    }

    function init() {
        if (!ensureAuthenticated()) return;
        bindModalClose();
        bindThumbnailInput();
        loadProjects();

        const form = elements.form();
        form?.addEventListener('submit', handleSubmit);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    GroupFormApp.init();
});


