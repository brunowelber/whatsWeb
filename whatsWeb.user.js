// ==UserScript==
// @name         whatsWeb
// @namespace    https://github.com/brunowelber/whatsWeb/
// @version      7.15.2
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

        static getMessageContent(msgNode) {
            let content = null;
            let isContact = false;

            if (msgNode) {
                // 0. Cartão de Contato (Prioridade Alta)
                // Detecta pelo botão de ação padrão do WhatsApp para contatos
                const contactBtn = msgNode.querySelector('button[title^="Conversar com"]');
                if (contactBtn) {
                    // Extrai o nome do título do botão (Ex: "Conversar com João")
                    const name = contactBtn.getAttribute('title').replace('Conversar com ', '');
                    content = "Contato: " + name;
                    isContact = true;
                }

                // 1. Texto padrão
                else {
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
                        content = "Reproduzir";
                    }

                    // 5. Fallback Geral
                    else {
                        const rawText = msgNode.innerText;
                        if (rawText && rawText.length > 0) {
                            content = rawText.replace(/\d{1,2}:\d{2}\s*$/, ''); // Tenta remover hora do fim
                        }
                    }
                }
            }

            // Se for contato, retorna direto (pode conter números no nome)
            // Se for texto comum, passa pelo filtro cleanText
            if (isContact) return content;
            return content ? this.cleanText(content) : null;
        }
    }

    class Constants {
        static get VERSION() { return "7.15.2"; } 
        
        static get SELECTORS() {
            return {
                app: '#app',
                mainPanel: '#main',
                sidePanel: '#pane-side',
                headerTitle: '#main header [dir="auto"]', 
                messageList: ['[class*="message-in"]', '[class*="message-out"]'],
                messageInClass: 'message-in',
                messageOutClass: 'message-out',
                messageContainer: '#main [role="application"]', 
                footer: 'footer',
                footerInput: 'footer [contenteditable="true"]',
                btnSend: '[data-icon="send"]',
                btnAttach: '[data-icon="plus"]',
                btnMic: '[data-icon="mic-outlined"]',
                btnAudioPlay: 'button span[data-icon="audio-play"]'
            };
        }

        static get SHORTCUTS() {
            return {
                TOGGLE: 'KeyS', 
                FOCUS_CHAT_LIST: 'Digit1', 
                FOCUS_MSG_LIST: 'Digit2',  
                READ_STATUS: 'KeyV',
                ATTACH_MENU: 'KeyA'        
            };
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
        constructor(toast) {
            this.toast = toast;
        }
        
        focusChatList() {
            const side = document.querySelector(Constants.SELECTORS.sidePanel);
            if (!side) return;
            
            // Lógica Simplificada: Foca no que estiver selecionado ou no primeiro item
            let target = side.querySelector('[aria-selected="true"]');
            
            // Ajuste para pegar a row, caso o foco esteja interno
            if (target) target = target.closest('[role="row"]') || target;
            
            // Fallback para o primeiro item
            if (!target) target = side.querySelector('[role="row"]');

            if (target) {
                target.scrollIntoView({block: 'center', inline: 'nearest'});
                target.setAttribute('tabindex', '0'); // Garante que é focável
                target.focus();
                this.toast.show("Lista de conversas");
            } else {
                // Fallback final: foca no painel lateral em si
                side.setAttribute('tabindex', '-1');
                side.focus();
                this.toast.show("Painel lateral");
            }
        }

        handleMessageAreaFocus() {
            const footer = document.querySelector(Constants.SELECTORS.footer);
            if (!footer) {
                this.toast.show("Nenhuma conversa aberta");
                return;
            }
            const input = document.querySelector(Constants.SELECTORS.footerInput);
            const activeEl = document.activeElement;
            if (activeEl === input) {
                this._focusMessageListContainer();
            } else {
                if (input) {
                    input.focus();
                    this.toast.show("Escrever mensagem");
                }
            }
        }
        
        _focusMessageListContainer() {
            const messages = document.querySelectorAll(Constants.SELECTORS.messageList[0] + ', ' + Constants.SELECTORS.messageList[1]);
            if (messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg.hasAttribute('tabindex')) lastMsg.setAttribute('tabindex', '-1');
                lastMsg.focus();
                this.toast.show("Lista de mensagens");
            }
        }
        
        readChatStatus() {
            const header = document.querySelector('#main header');
            if (!header) {
                this.toast.show("Nenhuma conversa aberta");
                return;
            }
            const titleEl = header.querySelector('[dir="auto"]');
            if (titleEl) {
                const fullText = header.innerText;
                const contactName = titleEl.innerText;
                let statusText = fullText.replace(contactName, '').replace(/\n/g, ' ').trim();
                statusText = statusText.replace(/video-call|voice-call|search/gi, '').trim();
                if (statusText.length > 1) {
                    this.toast.show("Status: " + statusText);
                    return;
                }
            } else {
                const possibleStatus = header.querySelector('span[title]:not([dir="auto"])');
                if (possibleStatus) {
                    this.toast.show("Status: " + possibleStatus.getAttribute('title'));
                    return;
                }
            }
            this.toast.show("Status indisponível");
        }

        openAttachMenu() {
            const btn = document.querySelector(Constants.SELECTORS.btnAttach);
            if (!btn) {
                this.toast.show("Botão anexar não encontrado");
                return;
            }
            
            const clickable = btn.closest('button') || btn.closest('[role="button"]');
            if (clickable) {
                clickable.click();
                
                // Força o foco para o primeiro item do menu que aparecer
                setTimeout(() => {
                    // Procura por listas de botões que geralmente compõem o menu
                    // O seletor busca listas (ul/ol) que tenham botões ou itens de menu
                    const menuItems = document.querySelectorAll('ul li button, ul li [role="button"]');
                    
                    if (menuItems.length > 0) {
                        // Tenta focar no último item (geralmente Fotos/Vídeos fica embaixo)
                        // ou no primeiro, dependendo da preferência. Vamos no último pois fica mais perto do teclado visualmente.
                        const lastItem = menuItems[menuItems.length - 1]; 
                        lastItem.focus();
                    }
                }, 400); // Delay para animação do menu
            }
        }
    }

    class MessageEnhancer {
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
            if (input && input.getAttribute('aria-label') !== ("Escrever para: " + contactName)) {
                 input.setAttribute('aria-label', "Escrever para: " + contactName);
            }
            const btnSend = document.querySelector(Constants.SELECTORS.btnSend);
            if (btnSend) btnSend.setAttribute('aria-label', "Enviar mensagem");
            const btnMic = document.querySelector(Constants.SELECTORS.btnMic);
            if (btnMic) btnMic.parentElement.setAttribute('aria-label', "Gravar áudio");
        }
        
        _enhanceMessages() {
            const messages = document.querySelectorAll('[class*="message-"]');
            messages.forEach(msg => {
                // Se já processou o container E o texto interno, pula
                if(msg.dataset.wppA11yProcessed === "true") return; 

                // 1. Identifica o elemento exato que contém o texto
                const textNode = msg.querySelector('[data-testid="selectable-text"]') || 
                                 msg.querySelector('.copyable-text span') ||
                                 msg.querySelector('.copyable-text');

                // 2. Extrai e LIMPA o conteúdo
                const content = DOMUtils.getMessageContent(msg);
                
                if (content) {
                    // Tenta encontrar o elemento focável exato (onde o NVDA para com Alt+2 ou Tab)
                    const focusable = msg.querySelector('[tabindex="0"]') || msg;
                    
                    // FORÇA a aplicação do label, sobrescrevendo qualquer anterior para garantir consistência
                    focusable.setAttribute('aria-label', content);
                    
                    // Se for Cartão de Contato, define role="article" para evitar que o NVDA
                    // leia apenas "use as setas..." devido aos botões internos
                    if (content.startsWith("Contato:")) {
                        focusable.setAttribute('role', 'article');
                    }
                    
                    // Fallback para o container principal caso o focável não seja o root
                    if (focusable !== msg) {
                         msg.setAttribute('aria-label', content);
                    }
                    
                    // Aplica DIRETAMENTE no texto (para navegação com setas)
                    // Isso faz o leitor ler o label (sem número) em vez do innerText (com número)
                    if (textNode) {
                        textNode.setAttribute('aria-label', content);
                    }
                } else if (!msg.getAttribute('aria-label')) {
                    // Fallback
                    const raw = DOMUtils.cleanText(msg.innerText);
                    if(raw && raw.length > 0) {
                         msg.setAttribute('aria-label', raw);
                    }
                }

                const audioPlay = msg.querySelector(Constants.SELECTORS.btnAudioPlay);
                if (audioPlay) {
                    const btn = audioPlay.closest('button');
                    if (btn) btn.setAttribute('aria-label', "Reproduzir");
                }
                
                msg.dataset.wppA11yProcessed = "true";
            });
        }
    }

    class WppA11yApp {
        constructor() {
            this.toast = new ToastService();
            this.liveAnnouncer = new LiveAnnouncer();
            this.beep = new BeepService();
            this.navigator = new NavigationService(this.toast);
            this.enhancer = new MessageEnhancer();
            
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
                // Intercepta a tecla APPLICATIONS (ContextMenu) para abrir opções da mensagem
                if (e.key === 'ContextMenu' && this.state.activated) {
                    const active = document.activeElement;
                    const msgNode = active.closest('.message-in, .message-out');
                    
                    if (msgNode) {
                        e.preventDefault(); 
                        e.stopPropagation();

                        // Em vez de procurar o botão da setinha (que pode não existir),
                        // simulamos um CLIQUE DIREITO (contextmenu) na mensagem.
                        // O WhatsApp Web abre nativamente o menu de opções com o clique direito.
                        const evt = new MouseEvent('contextmenu', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            buttons: 2, // Botão direito
                            clientX: msgNode.getBoundingClientRect().x + 10, // Coordenadas dentro da msg
                            clientY: msgNode.getBoundingClientRect().y + 10
                        });
                        msgNode.dispatchEvent(evt);
                        return;
                    }
                }

                // Intercepta ENTER em mensagens de áudio
                if (e.code === 'Enter' && this.state.activated) {
                    const active = document.activeElement;
                    // Verifica se o elemento focado é uma mensagem (in ou out)
                    if (active && (active.classList.contains('message-in') || active.classList.contains('message-out'))) {
                        // Tenta achar o botão de play dentro dessa mensagem
                        const playBtn = active.querySelector('button span[data-icon="audio-play"]');
                        if (playBtn) {
                            e.preventDefault();
                            // Clica no botão (o span geralmente está dentro do button, pegamos o button pai)
                            const clickable = playBtn.closest('button');
                            if (clickable) clickable.click();
                            return;
                        }
                    }
                }

                if (e.altKey && e.code === Constants.SHORTCUTS.TOGGLE) {
                    e.preventDefault();
                    this.state.activated = !this.state.activated;
                }
                if (!this.state.activated) return;
                
                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_CHAT_LIST) { e.preventDefault(); this.navigator.focusChatList(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_MSG_LIST) { e.preventDefault(); this.navigator.handleMessageAreaFocus(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.READ_STATUS) { e.preventDefault(); this.navigator.readChatStatus(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.ATTACH_MENU) { e.preventDefault(); this.navigator.openAttachMenu(); }
            });
        }

        _handleActivation(isActive) {
            StorageManager.set(StorageManager.KEYS.ACTIVATED, isActive);
            if (isActive) {
                if (!document.querySelector(Constants.SELECTORS.sidePanel)) {
                    this.toast.show("Aguardando WhatsApp...");
                    this.state.activated = false;
                    return;
                }
                this.toast.show("Acessibilidade Ativada");
                this.enhancer.enhanceAll();
                const appRoot = document.querySelector(Constants.SELECTORS.app) || document.body;
                this.mutationObserver.observe(appRoot, { childList: true, subtree: true });
            } else {
                this.toast.show("Acessibilidade Desativada");
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

                    const isIn = node.classList && node.classList.contains(Constants.SELECTORS.messageInClass);
                    const isOut = node.classList && node.classList.contains(Constants.SELECTORS.messageOutClass);

                    if (isIn || isOut) {
                        potentialMessages.push(node);
                    } 
                    else if (node.querySelector) {
                        const selector = `.${Constants.SELECTORS.messageInClass}, .${Constants.SELECTORS.messageOutClass}`;
                        const nestedMsgs = node.querySelectorAll(selector);
                        nestedMsgs.forEach(m => potentialMessages.push(m));
                    }
                });
            });

            if (potentialMessages.length > 0 && potentialMessages.length < 5) {
                // Obtém a lista atualizada de todas as mensagens VISÍVEIS no painel principal
                const allVisibleMessages = document.querySelectorAll(`${Constants.SELECTORS.mainPanel} .message-in, ${Constants.SELECTORS.mainPanel} .message-out`);
                const actualLastMessage = allVisibleMessages.length > 0 ? allVisibleMessages[allVisibleMessages.length - 1] : null;

                potentialMessages.forEach(msgNode => {
                    if (msgNode.dataset.wppA11yAnnounced) return;

                    // Garante que a mensagem está visualmente na conversa aberta (dentro de #main)
                    if (!msgNode.closest(Constants.SELECTORS.mainPanel)) return;

                    // CORREÇÃO: Verifica se esta mensagem é REALMENTE a última da lista visual.
                    // Se não for a última (ex: msgNode !== actualLastMessage), significa que é 
                    // uma mensagem de histórico carregada junto com a nova. Ignoramos.
                    if (actualLastMessage && msgNode !== actualLastMessage) return;
                    
                    setTimeout(() => {
                        const content = DOMUtils.getMessageContent(msgNode);
                        if (content) {
                            const isOut = msgNode.classList.contains(Constants.SELECTORS.messageOutClass);
                            const prefix = isOut ? "Enviada: " : "Nova: ";
                            
                            Logger.debug("📢 Anunciando:", content);
                            this.beep.playNotification();
                            this.liveAnnouncer.announce(prefix + content);
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
