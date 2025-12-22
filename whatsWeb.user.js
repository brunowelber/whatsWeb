// ==UserScript==
// @name         WhatsappWeb With More Accessibility (Infrastructure Ready)
// @namespace    https://github.com/juliano-lopes/accessibility-by-force/
// @version      7.2
// @description  Versão 7.2: Fundação completa com StorageManager, Logger e DOMUtils. Pronta para implementação de features.
// @author       Juliano Lopes (Refactored by Gemini)
// @match        https://web.whatsapp.com
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    /**
     * @class Logger
     * Gerencia logs do sistema. Permite ativar/desativar modo debug.
     */
    class Logger {
        static get DEBUG() { return true; } // Mude para false em produção
        static get PREFIX() { return '[WppA11y]'; }

        static info(...args) {
            console.info(Logger.PREFIX, ...args);
        }

        static error(...args) {
            console.error(Logger.PREFIX, '❌', ...args);
        }

        static debug(...args) {
            if (Logger.DEBUG) {
                console.log(Logger.PREFIX, '🐛', ...args);
            }
        }
    }

    /**
     * @class StorageManager
     * Centraliza o acesso ao localStorage com tipagem segura e valores padrão.
     */
    class StorageManager {
        static get KEYS() {
            return {
                LANG: 'wpp_a11y_lang',
                ACTIVATED: 'wpp_a11y_is_active',
                PLAYBACK_RATE: 'wpp_a11y_playback_rate',
                DEBUG_MODE: 'wpp_a11y_debug'
            };
        }

        /**
         * @param {string} key
         * @param {any} defaultValue
         */
        static get(key, defaultValue) {
            const val = localStorage.getItem(key);
            return val !== null ? val : defaultValue;
        }

        /**
         * @param {string} key
         * @param {any} value
         */
        static set(key, value) {
            try {
                localStorage.setItem(key, value);
                Logger.debug(`Storage saved: ${key} = ${value}`);
            } catch (e) {
                Logger.error('Storage save failed', e);
            }
        }

        static getBool(key, defaultValue = false) {
            return this.get(key, String(defaultValue)) === 'true';
        }

        static getFloat(key, defaultValue = 1.0) {
            const val = parseFloat(this.get(key, defaultValue));
            return isNaN(val) ? defaultValue : val;
        }
    }

    /**
     * @class DOMUtils
     * Utilitários para manipulação segura do DOM e seletores resilientes.
     */
    class DOMUtils {
        /**
         * Tenta encontrar um elemento usando múltiplos seletores (fallback).
         * Útil quando o WhatsApp muda classes.
         * @param {HTMLElement} root - Elemento raiz para busca (default document)
         * @param {string[]} selectors - Array de seletores para tentar em ordem
         * @returns {HTMLElement|null}
         */
        static findFirst(root, selectors) {
            const base = root || document;
            for (const selector of selectors) {
                const el = base.querySelector(selector);
                if (el) return el;
            }
            return null;
        }

        /**
         * Cria elementos acessíveis "sr-only" (apenas para leitura de tela).
         */
        static createSrOnlyText(text, id = null) {
            const span = document.createElement('span');
            span.className = 'sr-only-refined'; // Classe definida no GM_addStyle
            if (id) span.id = id;
            span.textContent = text;
            return span;
        }
    }

    /**
     * @class Constants
     * Seletores e atalhos.
     */
    class Constants {
        static get VERSION() { return "7.2"; }
        
        static get SELECTORS() {
            return {
                app: '#app',
                mainPanel: '#main',
                sidePanel: '#pane-side',
                // Exemplo de estratégia de fallback (Array de seletores)
                headerTitle: ['#main header [dir="auto"]', '#main header span[title]'],
                messageList: ['[class*="message-in"]', '[class*="message-out"]'],
                footer: 'footer',
                footerInput: 'footer [contenteditable="true"]',
                
                // Botões baseados em data-icon são muito mais estáveis
                btnSend: '[data-icon="send"]',
                btnMic: '[data-icon="ptt"]',
                btnAudioPlay: 'button span[data-icon="audio-play"]',
                btnAttach: '[data-icon="clip"]'
            };
        }

        static get SHORTCUTS() {
            return {
                TOGGLE: 'KeyS',
                JUMP_PANEL: 'KeyJ',
                CHANGE_LANG: 'KeyL',
                READ_NEW: 'KeyK' // Preparando para feature de ler novas msgs
            };
        }
    }

    /**
     * @class I18nManager
     */
    class I18nManager {
        constructor() {
            this.currentLang = StorageManager.get(StorageManager.KEYS.LANG, navigator.language.toLowerCase());
            this.dictionaries = {
                "pt-br": {
                    ACTIVATED: "Acessibilidade Ativada",
                    DEACTIVATED: "Acessibilidade Desativada",
                    LOADING: "Aguardando WhatsApp...",
                    JUMP_TO_CHAT: "Foco na lista de conversas",
                    JUMP_TO_MSG: "Foco na área de mensagens",
                    WRITE_TO: "Escrever para: ",
                    BTN_SEND: "Enviar mensagem",
                    BTN_RECORD: "Gravar áudio",
                    BTN_PLAY_AUDIO: "Reproduzir",
                    LANG_CHANGED: "Idioma: Português"
                },
                "en-us": {
                    ACTIVATED: "Accessibility Activated",
                    DEACTIVATED: "Accessibility Deactivated",
                    LOADING: "Waiting for WhatsApp...",
                    JUMP_TO_CHAT: "Chat list focused",
                    JUMP_TO_MSG: "Message area focused",
                    WRITE_TO: "Write to: ",
                    BTN_SEND: "Send",
                    BTN_RECORD: "Record voice",
                    BTN_PLAY_AUDIO: "Play",
                    LANG_CHANGED: "Language: English"
                },
                "es-es": {
                    ACTIVATED: "Accesibilidad Activada",
                    DEACTIVATED: "Accesibilidad Desactivada",
                    LOADING: "Esperando a WhatsApp...",
                    JUMP_TO_CHAT: "Lista de chats enfocada",
                    JUMP_TO_MSG: "Área de mensajes enfocada",
                    WRITE_TO: "Escribir a: ",
                    BTN_SEND: "Enviar",
                    BTN_RECORD: "Grabar voz",
                    BTN_PLAY_AUDIO: "Reproducir",
                    LANG_CHANGED: "Idioma: Español"
                }
            };
        }

        t(key) {
            const dict = this.dictionaries[this.currentLang] || this.dictionaries['en-us'];
            return dict[key] || `[${key}]`;
        }

        cycleLanguage() {
            const langs = Object.keys(this.dictionaries);
            let idx = langs.indexOf(this.currentLang);
            const nextLang = langs[(idx + 1) % langs.length];
            
            this.currentLang = nextLang;
            StorageManager.set(StorageManager.KEYS.LANG, nextLang);
            return this.t('LANG_CHANGED');
        }
    }

    /**
     * @class ToastService
     */
    class ToastService {
        constructor() {
            this.element = null;
            this._createDOM();
        }

        _createDOM() {
            if (document.getElementById('wpp-a11y-toast')) return;
            this.element = document.createElement('div');
            this.element.id = 'wpp-a11y-toast';
            this.element.setAttribute('aria-live', 'polite'); // 'polite' não interrompe o leitor
            document.body.appendChild(this.element);
        }

        show(message) {
            if (!this.element) this._createDOM();
            this.element.textContent = message;
            this.element.classList.add('visible');
            Logger.debug(`Toast: ${message}`);

            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.element.classList.remove('visible');
                // Limpa conteúdo para garantir evento aria na próxima msg igual
                setTimeout(() => { if(!this.element.classList.contains('visible')) this.element.textContent = ''; }, 500);
            }, 3000);
        }
    }

    /**
     * @class NavigationService
     */
    class NavigationService {
        constructor(i18n, toast) {
            this.i18n = i18n;
            this.toast = toast;
        }

        jumpPanel() {
            const side = document.querySelector(Constants.SELECTORS.sidePanel);
            const activeEl = document.activeElement;
            const isInsideSidePanel = side && side.contains(activeEl);

            if (isInsideSidePanel) {
                this._focusMessageArea();
            } else {
                this._focusSidePanel();
            }
        }

        _focusMessageArea() {
            const input = document.querySelector(Constants.SELECTORS.footerInput);
            if (input) {
                input.focus();
                this.toast.show(this.i18n.t('JUMP_TO_MSG'));
            } else {
                Logger.debug("Jump Failed: Footer input not found");
            }
        }

        _focusSidePanel() {
            const side = document.querySelector(Constants.SELECTORS.sidePanel);
            if (!side) return;
            // Busca inteligente pelo último focado ou o primeiro da lista
            const selected = side.querySelector('[aria-selected="true"]') || side.querySelector('[role="row"]');
            if (selected) {
                selected.focus();
                this.toast.show(this.i18n.t('JUMP_TO_CHAT'));
            }
        }
    }

    /**
     * @class MessageEnhancer
     */
    class MessageEnhancer {
        constructor(i18n) {
            this.i18n = i18n;
        }

        enhanceAll() {
            this._enhanceFooter();
            this._enhanceMessages();
        }

        _enhanceFooter() {
            const footer = document.querySelector(Constants.SELECTORS.footer);
            if (!footer) return;

            const input = footer.querySelector('[contenteditable="true"]');
            // Usando DOMUtils para buscar titulo com fallback (Array de seletores)
            const titleEl = DOMUtils.findFirst(document, Constants.SELECTORS.headerTitle);
            const contactName = titleEl ? titleEl.innerText : "";

            if (input && input.getAttribute('aria-label') !== (this.i18n.t('WRITE_TO') + contactName)) {
                 input.setAttribute('aria-label', this.i18n.t('WRITE_TO') + contactName);
            }

            // Labels estáticos
            const btnSend = document.querySelector(Constants.SELECTORS.btnSend);
            if (btnSend) btnSend.setAttribute('aria-label', this.i18n.t('BTN_SEND'));

            const btnMic = document.querySelector(Constants.SELECTORS.btnMic);
            if (btnMic) btnMic.parentElement.setAttribute('aria-label', this.i18n.t('BTN_RECORD'));
        }

        _enhanceMessages() {
            // Seleciona todas as mensagens (in e out)
            // Seletor complexo? Use document.querySelectorAll com o array do Constants se necessário,
            // mas aqui simplifiquei para [class*="message-"]
            const messages = document.querySelectorAll('[class*="message-"]');
            
            messages.forEach(msg => {
                if(msg.dataset.wppA11yProcessed) return; // Evita reprocessar

                // Botão Play Audio
                const audioPlay = msg.querySelector(Constants.SELECTORS.btnAudioPlay);
                if (audioPlay) {
                    const btn = audioPlay.closest('button');
                    if (btn) btn.setAttribute('aria-label', this.i18n.t('BTN_PLAY_AUDIO'));
                }

                msg.dataset.wppA11yProcessed = "true";
            });
        }
    }

    /**
     * @class WppA11yApp
     * Orquestrador Principal.
     */
    class WppA11yApp {
        constructor() {
            this.i18n = new I18nManager();
            this.toast = new ToastService();
            this.navigator = new NavigationService(this.i18n, this.toast);
            this.enhancer = new MessageEnhancer(this.i18n);

            // Estado Reativo
            this.state = new Proxy({
                activated: false // Inicia sempre falso até carregar
            }, {
                set: (target, prop, value) => {
                    target[prop] = value;
                    if (prop === 'activated') this._handleActivation(value);
                    return true;
                }
            });
            
            this.mutationObserver = new MutationObserver((mutations) => this._onMutation(mutations));
        }

        init() {
            Logger.info(`Initializing v${Constants.VERSION}`);
            this._injectStyles();
            this._setupKeyboard();
            
            // Tenta recuperar estado anterior (opcional, por enquanto manual)
            // if (StorageManager.getBool(StorageManager.KEYS.ACTIVATED)) { ... }
        }

        _injectStyles() {
            if (typeof GM_addStyle !== "undefined") {
                GM_addStyle(`
                    .sr-only-refined {
                        position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
                        overflow: hidden; clip: rect(0,0,0,0); border: 0;
                    }
                    #wpp-a11y-toast {
                        position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
                        background-color: #202c33; color: #e9edef; border: 1px solid #00a884;
                        padding: 12px 24px; border-radius: 24px; z-index: 9999;
                        font-family: Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif;
                        font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        opacity: 0; transition: opacity 0.2s ease-in-out; pointer-events: none;
                    }
                    #wpp-a11y-toast.visible { opacity: 1; }
                `);
            }
        }

        _setupKeyboard() {
            document.addEventListener('keydown', (e) => {
                if (e.altKey && e.code === Constants.SHORTCUTS.TOGGLE) {
                    e.preventDefault();
                    this.state.activated = !this.state.activated;
                }

                if (!this.state.activated) return;

                if (e.altKey && e.code === Constants.SHORTCUTS.JUMP_PANEL) {
                    e.preventDefault();
                    this.navigator.jumpPanel();
                }

                if (e.altKey && e.code === Constants.SHORTCUTS.CHANGE_LANG) {
                    e.preventDefault();
                    const msg = this.i18n.cycleLanguage();
                    this.toast.show(msg);
                    this.enhancer.enhanceAll();
                }
            });
        }

        _handleActivation(isActive) {
            StorageManager.set(StorageManager.KEYS.ACTIVATED, isActive);
            
            if (isActive) {
                // Verificação de segurança: O WhatsApp carregou?
                if (!document.querySelector(Constants.SELECTORS.sidePanel)) {
                    Logger.info("Activation failed: Side panel not found");
                    this.toast.show(this.i18n.t('LOADING'));
                    this.state.activated = false; // Reverte silenciosamente (ou com aviso)
                    return;
                }

                this.toast.show(this.i18n.t('ACTIVATED'));
                this.enhancer.enhanceAll();
                
                // Inicia observador com debounce
                const appRoot = document.querySelector(Constants.SELECTORS.app) || document.body;
                this.mutationObserver.observe(appRoot, { childList: true, subtree: true });
                Logger.debug("Observer started");
            } else {
                this.toast.show(this.i18n.t('DEACTIVATED'));
                this.mutationObserver.disconnect();
                Logger.debug("Observer stopped");
            }
        }

        _onMutation(mutations) {
            if (!this.state.activated) return;

            // Debounce simples implementado via flag ou timeout seria ideal aqui
            // Por enquanto, confiamos na leveza do MessageEnhancer
            if (this._debounceTimer) clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                 this.enhancer.enhanceAll();
            }, 200);
        }
    }

    // Start
    const app = new WppA11yApp();
    app.init();

})();