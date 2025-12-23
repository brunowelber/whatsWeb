// ==UserScript==
// @name         whatsWeb
// @namespace    https://github.com/brunowelber/whatsWeb/
// @version      7.12.1
// @description  Melhoria de acessibilidade para WhatsApp Web.
// @author       Bruno Welber
// @match        https://web.whatsapp.com
// @downloadURL  https://github.com/brunowelber/whatsWeb/raw/refs/heads/main/whatsWeb.user.js
// @updateURL    https://github.com/brunowelber/whatsWeb/raw/refs/heads/main/whatsWeb.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    class Logger {
        static get DEBUG() { return true; } 
        static get PREFIX() { return '[WppA11y]'; }
        static info(...args) { console.info(Logger.PREFIX, ...args); }
        static error(...args) { console.error(Logger.PREFIX, '❌', ...args); }
        static debug(...args) { if (Logger.DEBUG) console.log(Logger.PREFIX, '🐛', ...args); }
    }

    class StorageManager {
        static get KEYS() {
            return {
                LANG: 'wpp_a11y_lang',
                ACTIVATED: 'wpp_a11y_is_active'
            };
        }
        static get(key, defaultValue) {
            const val = localStorage.getItem(key);
            return val !== null ? val : defaultValue;
        }
        static set(key, value) { try { localStorage.setItem(key, value); } catch (e) { Logger.error('Storage save failed', e); } }
    }

    class DOMUtils {
        static findFirst(root, selectors) {
            const base = root || document;
            for (const selector of selectors) {
                const el = base.querySelector(selector);
                if (el) return el;
            }
            return null;
        }

        // Remove números de telefone do texto para limpar a leitura
        static cleanText(text) {
            if (!text) return "";
            
            // Regex para remover números tipo: +55 11 99999-9999 ou 11 9999-9999
            let cleaned = text.replace(/(?:\+?\d{1,3}\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/g, '');
            
            // Limpa caracteres de pontuação que podem sobrar soltos (ex: "Nome : Mensagem")
            cleaned = cleaned.replace(/~ */g, ''); // Remove til solto
            cleaned = cleaned.replace(/ +: +/g, ': '); // Normaliza dois pontos
            
            return cleaned.trim();
        }

        static getMessageContent(msgNode, i18n) {
            let content = null;

            if (msgNode) {
                // 1. Texto padrão
                const textNode = msgNode.querySelector('[data-testid="selectable-text"]') || 
                                 msgNode.querySelector('.copyable-text span') ||
                                 msgNode.querySelector('.copyable-text');
                
                if (textNode) content = textNode.innerText;

                // 2. Mensagens do Sistema
                else if (msgNode.querySelector('._akbu')) {
                    content = msgNode.querySelector('._akbu').innerText;
                }

                // 3. Imagem
                else if (msgNode.querySelector('img[alt]')) {
                    const alt = msgNode.querySelector('img[alt]').getAttribute('alt');
                    content = (alt && alt.length > 0) ? "Imagem: " + alt : "Imagem sem descrição";
                }

                // 4. Voz
                else if (msgNode.querySelector('button span[data-icon="audio-play"]') || 
                         msgNode.querySelector('span[data-icon="audio-play"]')) {
                    content = i18n ? i18n.t('BTN_PLAY_AUDIO') : "Audio";
                }

                // 5. Fallback Geral
                else {
                    const rawText = msgNode.innerText;
                    if (rawText && rawText.length > 0) {
                        content = rawText.replace(/\d{1,2}:\d{2}\s*$/, ''); // Tenta remover hora do fim
                    }
                }
            }

            // Sempre retorna o texto limpo (sem números de telefone)
            return content ? this.cleanText(content) : null;
        }
    }

    class Constants {
        static get VERSION() { return "7.12"; } 
        
        static get SELECTORS() {
            return {
                app: '#app',
                mainPanel: '#main',
                sidePanel: '#pane-side',
                headerTitle: '#main header [dir="auto"]', 
                messageList: ['[class*="message-in"]', '[class*="message-out"]'],
                messageInClass: 'message-in',
                messageContainer: '#main [role="application"]', 
                footer: 'footer',
                footerInput: 'footer [contenteditable="true"]',
                btnSend: '[data-icon="send"]',
                btnMic: '[data-icon="mic-outlined"]',
                btnAudioPlay: 'button span[data-icon="audio-play"]'
            };
        }

        static get SHORTCUTS() {
            return {
                TOGGLE: 'KeyS', 
                CHANGE_LANG: 'KeyL',
                FOCUS_CHAT_LIST: 'Digit1', 
                FOCUS_MSG_LIST: 'Digit2',  
                READ_STATUS: 'KeyI'        
            };
        }
    }

    class I18nManager {
        constructor() {
            this.currentLang = StorageManager.get(StorageManager.KEYS.LANG, navigator.language.toLowerCase());
            this.dictionaries = {
                "pt-br": {
                    ACTIVATED: "Acessibilidade Ativada",
                    DEACTIVATED: "Acessibilidade Desativada",
                    LOADING: "Aguardando WhatsApp...",
                    JUMP_TO_CHAT: "Foco na lista de conversas",
                    JUMP_TO_INPUT: "Escrever mensagem",
                    JUMP_TO_MSG_LIST: "Lista de mensagens",
                    NO_CHAT_OPEN: "Nenhuma conversa aberta",
                    STATUS_PREFIX: "Status: ",
                    NO_STATUS: "Status indisponível",
                    NEW_MSG_FROM: "Nova: ", // Encurtei para ser mais rápido
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
                    JUMP_TO_INPUT: "Type message",
                    JUMP_TO_MSG_LIST: "Message list",
                    NO_CHAT_OPEN: "No chat open",
                    STATUS_PREFIX: "Status: ",
                    NO_STATUS: "Status unavailable",
                    NEW_MSG_FROM: "New: ",
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
                    JUMP_TO_INPUT: "Escribir mensaje",
                    JUMP_TO_MSG_LIST: "Lista de mensajes",
                    NO_CHAT_OPEN: "Ningún chat abierto",
                    STATUS_PREFIX: "Estado: ",
                    NO_STATUS: "Sin estado",
                    NEW_MSG_FROM: "Nuevo: ",
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

    class BeepService {
        constructor() {
            this.audioCtx = null;
        }
        _initCtx() {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
        }
        playNotification() {
            try {
                this._initCtx();
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                const oscillator = this.audioCtx.createOscillator();
                const gainNode = this.audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(600, this.audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1000, this.audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
                oscillator.start();
                oscillator.stop(this.audioCtx.currentTime + 0.2);
            } catch (e) {
                Logger.error("Beep failed", e);
            }
        }
    }

    class LiveAnnouncer {
        constructor() {
            this.element = null;
            this._createDOM();
        }
        _createDOM() {
            if (document.getElementById('wpp-a11y-live')) return;
            this.element = document.createElement('div');
            this.element.id = 'wpp-a11y-live';
            this.element.setAttribute('aria-live', 'assertive');
            this.element.className = 'sr-only-refined';
            document.body.appendChild(this.element);
        }
        announce(text) {
            if (!this.element) this._createDOM();
            this.element.textContent = ''; 
            setTimeout(() => { this.element.textContent = text; }, 100);
        }
    }

    class ToastService {
        constructor() {
            this.element = null;
            this._createDOM();
        }
        _createDOM() {
            if (document.getElementById('wpp-a11y-toast')) return;
            this.element = document.createElement('div');
            this.element.id = 'wpp-a11y-toast';
            this.element.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.element);
        }
        show(message) {
            if (!this.element) this._createDOM();
            this.element.textContent = message;
            this.element.classList.add('visible');
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.element.classList.remove('visible');
                setTimeout(() => { if(!this.element.classList.contains('visible')) this.element.textContent = ''; }, 500);
            }, 3000);
        }
    }

    class NavigationService {
        constructor(i18n, toast) {
            this.i18n = i18n;
            this.toast = toast;
        }
        
        focusChatList() {
            const side = document.querySelector(Constants.SELECTORS.sidePanel);
            if (!side) return;
            let selected = side.querySelector('[role="gridcell"] [aria-selected="true"]');
            if (!selected) selected = side.querySelector('[role="row"]');
            if (selected) {
                selected.scrollIntoView({block: 'center', inline: 'nearest'}); 
                selected.focus();
                this.toast.show(this.i18n.t('JUMP_TO_CHAT'));
            }
        }

        handleMessageAreaFocus() {
            const footer = document.querySelector(Constants.SELECTORS.footer);
            if (!footer) {
                this.toast.show(this.i18n.t('NO_CHAT_OPEN'));
                return;
            }
            const input = document.querySelector(Constants.SELECTORS.footerInput);
            const activeEl = document.activeElement;
            if (activeEl === input) {
                this._focusMessageListContainer();
            } else {
                if (input) {
                    input.focus();
                    this.toast.show(this.i18n.t('JUMP_TO_INPUT'));
                }
            }
        }
        
        _focusMessageListContainer() {
            const messages = document.querySelectorAll(Constants.SELECTORS.messageList[0] + ', ' + Constants.SELECTORS.messageList[1]);
            if (messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg.hasAttribute('tabindex')) lastMsg.setAttribute('tabindex', '-1');
                lastMsg.focus();
                this.toast.show(this.i18n.t('JUMP_TO_MSG_LIST'));
            }
        }
        
        readChatStatus() {
            const header = document.querySelector('#main header');
            if (!header) {
                this.toast.show(this.i18n.t('NO_CHAT_OPEN'));
                return;
            }
            const titleEl = header.querySelector('[dir="auto"]');
            if (titleEl) {
                const fullText = header.innerText;
                const contactName = titleEl.innerText;
                let statusText = fullText.replace(contactName, '').replace(/\n/g, ' ').trim();
                statusText = statusText.replace(/video-call|voice-call|search/gi, '').trim();
                if (statusText.length > 1) {
                    this.toast.show(this.i18n.t('STATUS_PREFIX') + statusText);
                    return;
                }
            } else {
                const possibleStatus = header.querySelector('span[title]:not([dir="auto"])');
                if (possibleStatus) {
                    this.toast.show(this.i18n.t('STATUS_PREFIX') + possibleStatus.getAttribute('title'));
                    return;
                }
            }
            this.toast.show(this.i18n.t('NO_STATUS'));
        }
    }

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
            const titleEl = document.querySelector(Constants.SELECTORS.headerTitle);
            const contactName = titleEl ? titleEl.innerText : "";
            if (input && input.getAttribute('aria-label') !== (this.i18n.t('WRITE_TO') + contactName)) {
                 input.setAttribute('aria-label', this.i18n.t('WRITE_TO') + contactName);
            }
            const btnSend = document.querySelector(Constants.SELECTORS.btnSend);
            if (btnSend) btnSend.setAttribute('aria-label', this.i18n.t('BTN_SEND'));
            const btnMic = document.querySelector(Constants.SELECTORS.btnMic);
            if (btnMic) btnMic.parentElement.setAttribute('aria-label', this.i18n.t('BTN_RECORD'));
        }
        
        _enhanceMessages() {
            const messages = document.querySelectorAll('[class*="message-"]');
            messages.forEach(msg => {
                if(msg.dataset.wppA11yProcessed) return; 

                // Extrai e LIMPA o conteúdo (sem números de telefone)
                const content = DOMUtils.getMessageContent(msg, this.i18n);
                
                if (content && !msg.getAttribute('aria-label')) {
                    msg.setAttribute('aria-label', content);
                } else if (!msg.getAttribute('aria-label')) {
                    // Fallback com limpeza
                    const raw = DOMUtils.cleanText(msg.innerText);
                    if(raw && raw.length > 0) {
                         msg.setAttribute('aria-label', raw);
                    }
                }

                const audioPlay = msg.querySelector(Constants.SELECTORS.btnAudioPlay);
                if (audioPlay) {
                    const btn = audioPlay.closest('button');
                    if (btn) btn.setAttribute('aria-label', this.i18n.t('BTN_PLAY_AUDIO'));
                }
                
                msg.dataset.wppA11yProcessed = "true";
            });
        }
    }

    class WppA11yApp {
        constructor() {
            this.i18n = new I18nManager();
            this.toast = new ToastService();
            this.liveAnnouncer = new LiveAnnouncer();
            this.beep = new BeepService();
            this.navigator = new NavigationService(this.i18n, this.toast);
            this.enhancer = new MessageEnhancer(this.i18n);
            
            this.state = new Proxy({ activated: false }, {
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

            // Carrega estado anterior
            const wasActivated = StorageManager.get(StorageManager.KEYS.ACTIVATED, 'false') === 'true';
            if (wasActivated) {
                // Pequeno delay para garantir que o WhatsApp carregou o básico
                setTimeout(() => { this.state.activated = true; }, 3000);
            }
        }

        _injectStyles() {
            if (typeof GM_addStyle !== "undefined") {
                GM_addStyle(`
                    .sr-only-refined { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); } 
                    #wpp-a11y-toast {
                        position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
                        background-color: #202c33; color: #e9edef; border: 1px solid #00a884;
                        padding: 12px 24px; border-radius: 24px; z-index: 9999;
                        font-family: Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif;
                        font-size: 14px; font-weight: 500; opacity: 0; transition: opacity 0.2s; pointer-events: none;
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
                
                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_CHAT_LIST) { e.preventDefault(); this.navigator.focusChatList(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_MSG_LIST) { e.preventDefault(); this.navigator.handleMessageAreaFocus(); }
                if (e.ctrlKey && e.code === Constants.SHORTCUTS.READ_STATUS) { e.preventDefault(); this.navigator.readChatStatus(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.CHANGE_LANG) { e.preventDefault(); const m = this.i18n.cycleLanguage(); this.toast.show(m); this.enhancer.enhanceAll(); }
            });
        }

        _handleActivation(isActive) {
            StorageManager.set(StorageManager.KEYS.ACTIVATED, isActive);
            if (isActive) {
                if (!document.querySelector(Constants.SELECTORS.sidePanel)) {
                    this.toast.show(this.i18n.t('LOADING'));
                    this.state.activated = false;
                    return;
                }
                this.toast.show(this.i18n.t('ACTIVATED'));
                this.enhancer.enhanceAll();
                const appRoot = document.querySelector(Constants.SELECTORS.app) || document.body;
                this.mutationObserver.observe(appRoot, { childList: true, subtree: true });
            } else {
                this.toast.show(this.i18n.t('DEACTIVATED'));
                this.mutationObserver.disconnect();
            }
        }

        _onMutation(mutations) {
            if (!this.state.activated) return;

            const potentialMessages = [];
            
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length === 0) return;
                
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;

                    if (node.classList && node.classList.contains(Constants.SELECTORS.messageInClass)) {
                        potentialMessages.push(node);
                    } 
                    else if (node.querySelector) {
                        const nestedMsgs = node.querySelectorAll(`.${Constants.SELECTORS.messageInClass}`);
                        nestedMsgs.forEach(m => potentialMessages.push(m));
                    }
                });
            });

            if (potentialMessages.length > 0 && potentialMessages.length < 5) {
                potentialMessages.forEach(msgNode => {
                    if (msgNode.dataset.wppA11yAnnounced) return;
                    
                    setTimeout(() => {
                        const content = DOMUtils.getMessageContent(msgNode, this.i18n);
                        if (content) {
                            Logger.debug("📢 Anunciando:", content);
                            this.beep.playNotification();
                            this.liveAnnouncer.announce(this.i18n.t('NEW_MSG_FROM') + content);
                            msgNode.dataset.wppA11yAnnounced = "true";
                        }
                    }, 500);
                });
            }

            if (this._debounceTimer) clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                 this.enhancer.enhanceAll();
            }, 300);
        }
    }

    const app = new WppA11yApp();
    app.init();

})();