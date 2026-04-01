/**
 * Garagem - Autenticação
 *
 * Responsável por orquestrar as interações da tela de login,
 * cadastro e recuperação de senha.
 */

const AuthApp = (() => {
    const state = {
        currentView: 'login'
    };

    const elements = {
        loader: () => document.getElementById('globalLoader'),
        modal: () => document.getElementById('notificationModal'),
        modalTitle: () => document.getElementById('modalTitle'),
        modalMessage: () => document.getElementById('modalMessage'),
        modalIcon: () => document.getElementById('modalIcon'),
        cards: {
            login: () => document.getElementById('loginCard'),
            register: () => document.getElementById('registerCard'),
            recover: () => document.getElementById('recoverCard')
        },
        forms: {
            login: () => document.getElementById('loginForm'),
            register: () => document.getElementById('registerForm'),
            recover: () => document.getElementById('recoverForm')
        }
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
            if (icon) {
                icon.innerHTML = `<i class="${iconMap[type] || iconMap.info}"></i>`;
            }

            const titleElement = elements.modalTitle();
            const messageElement = elements.modalMessage();
            if (titleElement) titleElement.textContent = title;
            if (messageElement) messageElement.textContent = message;

            modal.classList.remove('hidden');
        },
        closeModal() {
            const modal = elements.modal();
            if (modal) {
                modal.classList.add('hidden');
            }
        },
        switchView(view) {
            if (!view || !elements.cards[view]) return;
            state.currentView = view;

            Object.entries(elements.cards).forEach(([key, getter]) => {
                const card = getter();
                if (!card) return;
                card.classList.toggle('hidden', key !== view);
            });
        }
    };

    function validateEmail(value) {
        const validation = ConfigUtils.validate('email', value);
        if (!validation.valid) {
            throw new Error(validation.message);
        }
    }

    function validatePassword(value) {
        const rule = CONFIG.validation.password;
        if (!value || value.length < rule.minLength) {
            throw new Error(rule.message);
        }
    }

    function bindViewSwitchers() {
        document.querySelectorAll('[data-auth-view]').forEach((button) => {
            button.addEventListener('click', () => {
                ui.switchView(button.dataset.authView);
            });
        });

        document.querySelectorAll('[data-modal-close="notificationModal"]').forEach((button) => {
            button.addEventListener('click', () => ui.closeModal());
        });
    }

    async function handleLoginSubmit(event) {
        event.preventDefault();
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;

        try {
            validateEmail(email);
            validatePassword(password);
        } catch (error) {
            ui.notify({ title: 'Validação', message: error.message, type: 'warning' });
            return;
        }

        ui.loader.show('Entrando...');
        try {
            await authService.login(email, password);
            window.location.href = 'dashboard.html';
        } catch (error) {
            ui.notify({ title: 'Erro ao entrar', message: error.message || CONFIG.messages.errors.generic, type: 'error' });
        } finally {
            ui.loader.hide();
        }
    }

    async function handleRegisterSubmit(event) {
        event.preventDefault();
        const emailInput = document.getElementById('registerEmail');
        const passwordInput = document.getElementById('registerPassword');
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;

        try {
            validateEmail(email);
            validatePassword(password);
        } catch (error) {
            ui.notify({ title: 'Validação', message: error.message, type: 'warning' });
            return;
        }

        ui.loader.show('Criando conta...');
        try {
            await authService.register(email, password);
            ui.notify({ title: 'Sucesso!', message: 'Conta criada. Agora faça login.', type: 'success' });
            ui.switchView('login');
        } catch (error) {
            ui.notify({ title: 'Erro no cadastro', message: error.message || CONFIG.messages.errors.generic, type: 'error' });
        } finally {
            ui.loader.hide();
        }
    }

    async function handleRecoverSubmit(event) {
        event.preventDefault();
        const emailInput = document.getElementById('recoverEmail');
        const oldPasswordInput = document.getElementById('recoverOldPassword');
        const newPasswordInput = document.getElementById('recoverPassword');

        const email = emailInput?.value.trim();
        const oldPassword = oldPasswordInput?.value;
        const newPassword = newPasswordInput?.value;

        try {
            validateEmail(email);
            validatePassword(oldPassword);
            validatePassword(newPassword);
        } catch (error) {
            ui.notify({ title: 'Validação', message: error.message, type: 'warning' });
            return;
        }

        ui.loader.show('Atualizando senha...');
        try {
            await authService.recoverPassword(email, newPassword, oldPassword);
            ui.notify({ title: 'Sucesso!', message: 'Senha alterada. Utilize a nova senha para entrar.', type: 'success' });
            ui.switchView('login');
        } catch (error) {
            ui.notify({ title: 'Erro na alteração', message: error.message || CONFIG.messages.errors.generic, type: 'error' });
        } finally {
            ui.loader.hide();
        }
    }

    function ensureAuthenticatedRedirect() {
        if (authService.isAuthenticated()) {
            window.location.href = 'dashboard.html';
        }
    }

    function init() {
        ensureAuthenticatedRedirect();
        bindViewSwitchers();
        ui.switchView('login');

        const loginForm = elements.forms.login();
        const registerForm = elements.forms.register();
        const recoverForm = elements.forms.recover();

        loginForm?.addEventListener('submit', handleLoginSubmit);
        registerForm?.addEventListener('submit', handleRegisterSubmit);
        recoverForm?.addEventListener('submit', handleRecoverSubmit);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    AuthApp.init();
});


