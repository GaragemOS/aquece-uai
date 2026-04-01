/**
 * Garagem - Formulário de Projeto (standalone)
 *
 * Página dedicada à criação de projetos fora do dashboard.
 */

const ProjectFormApp = (() => {
    const state = {
        thumbnail: ''
    };

    const elements = {
        loader: () => document.getElementById('globalLoader'),
        modal: () => document.getElementById('notificationModal'),
        modalTitle: () => document.getElementById('modalTitle'),
        modalMessage: () => document.getElementById('modalMessage'),
        modalIcon: () => document.getElementById('modalIcon'),
        form: () => document.getElementById('projectForm'),
        adminsList: () => document.getElementById('adminsList'),
        addAdminButton: () => document.querySelector('[data-action="admin.add"]'),
        thumbnailInput: () => document.getElementById('projectThumb'),
        thumbnailPreview: () => document.getElementById('imagePreview'),
        thumbnailImage: () => document.getElementById('previewImg'),
        uploadArea: () => document.getElementById('uploadArea')
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

    function ensureAuthenticated() {
        if (!authService.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    function bindModalClose() {
        document.querySelectorAll('[data-modal-close="notificationModal"]').forEach((button) => {
            button.addEventListener('click', () => ui.closeModal());
        });
    }

    function addAdminField() {
        const list = elements.adminsList();
        if (!list) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'flex gap-2 items-center';
        wrapper.innerHTML = `
            <input type="tel" placeholder="5511999999999"
                class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent admin-phone">
            <button type="button" class="bg-red-100 hover:bg-red-200 text-red-600 px-4 rounded-lg transition" data-action="admin.remove" aria-label="Remover administrador">
                <i class="fas fa-trash"></i>
            </button>
        `;
        list.appendChild(wrapper);
    }

    function bindAdminControls() {
        const addButton = elements.addAdminButton();
        if (addButton) {
            addButton.addEventListener('click', addAdminField);
        }

        const list = elements.adminsList();
        if (list) {
            list.addEventListener('click', (event) => {
                const button = event.target.closest('[data-action="admin.remove"]');
                if (!button) return;
                button.parentElement?.remove();
            });
        }
    }

    function bindThumbnailInput() {
        const input = elements.thumbnailInput();
        if (!input) return;

        input.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            const preview = elements.thumbnailPreview();
            const image = elements.thumbnailImage();
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
                ConfigUtils.log('Erro ao processar thumbnail', error);
                ui.notify({ title: 'Erro', message: 'Não foi possível processar a imagem selecionada.', type: 'error' });
                event.target.value = '';
            }
        });
    }

    function getAdminPhones() {
        const list = elements.adminsList();
        if (!list) return [];
        return Array.from(list.querySelectorAll('.admin-phone'))
            .map((input) => input.value.trim())
            .filter((value) => value.length);
    }

    function filesValidate(file) {
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

    const files = {
        async toBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
        },
        validate: filesValidate
    };

    async function handleSubmit(event) {
        event.preventDefault();
        const form = elements.form();
        if (!form) return;

        const name = form.projectName.value.trim();
        const description = form.projectDescription.value.trim();
        const tokens = form.projectTokens.value.trim();
        const adminPhones = getAdminPhones();

        if (!name || !description) {
            ui.notify({ title: 'Validação', message: 'Informe nome e descrição do projeto.', type: 'warning' });
            return;
        }

        if (!tokens) {
            ui.notify({ title: 'Validação', message: 'Informe ao menos um token de acesso.', type: 'warning' });
            return;
        }

        const user = authService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        ui.loader.show('Salvando projeto...');

        try {
            await projectService.create({
                nomeProjeto: name,
                descricaoProjeto: description,
                tokensProjeto: tokens,
                telAdminsProjeto: adminPhones.join(','),
                hashUsuario: user.hashUsuario,
                emailUsuario: user.email,
                thumbProjeto: state.thumbnail || ''
            });

            ui.notify({ title: 'Sucesso!', message: 'Projeto criado com sucesso!', type: 'success' });
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } catch (error) {
            ConfigUtils.log('Erro ao criar projeto', error);
            ui.notify({ title: 'Erro', message: error.message || CONFIG.messages.errors.generic, type: 'error' });
        } finally {
            ui.loader.hide();
        }
    }

    function init() {
        if (!ensureAuthenticated()) return;
        bindModalClose();
        bindAdminControls();
        bindThumbnailInput();

        const form = elements.form();
        form?.addEventListener('submit', handleSubmit);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    ProjectFormApp.init();
});


