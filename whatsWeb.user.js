// ==UserScript==
// @name         whatsWeb
// @namespace    https://github.com/brunowelber/whatsWeb/
// @version      8.0.12
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

        static getHeaderElement() {
            return document.querySelector('#main header') ||
                document.querySelector('#main [data-testid="conversation-header"]') ||
                null;
        }

        static getConversationTitle() {
            const titleEl = document.querySelector(Constants.SELECTORS.headerTitle);
            return titleEl ? titleEl.innerText.trim() : '';
        }

        static getConversationSubtitle() {
            const header = this.getHeaderElement();
            if (!header) return '';

            const subtitleEl = header.querySelector('[data-testid="chat-subtitle"]');
            return subtitleEl ? subtitleEl.innerText.trim() : '';
        }

        static getConversationStatus(header = this.getHeaderElement()) {
            const title = this.getConversationTitle();
            if (!header || !title) return '';

            let statusText = header.innerText.replace(title, '').replace(/[\n\r]+/g, ' ').trim();
            statusText = statusText.replace(/video-call|voice-call|search/gi, '').trim();
            return statusText.length > 1 ? statusText : '';
        }

        static getRelevantConversationStatus(header = this.getHeaderElement()) {
            const statusText = this.getConversationStatus(header);
            if (!statusText) return '';

            const lower = statusText.toLowerCase();
            if (lower.includes('online') || lower.includes('digitando') || lower.includes('gravando') || lower.includes('visto')) {
                return statusText;
            }

            return '';
        }

        static isGroupConversation() {
            const subtitle = this.getConversationSubtitle();
            return Boolean(subtitle && /,| e mais |participante|membro/i.test(subtitle));
        }

        static getChatListContainer() {
            const side = document.querySelector(Constants.SELECTORS.sidePanel);
            if (!side) return null;

            return side.querySelector('[data-testid="chat-list"], [role="grid"][aria-label="Lista de conversas"], [aria-label="Lista de conversas"]') || side;
        }

        static getActiveChatRow(title = this.getConversationTitle()) {
            const chatList = this.getChatListContainer();
            if (!chatList) return null;

            let selected = chatList.querySelector('[aria-selected="true"]');
            if (selected) {
                return selected.closest('[role="row"][data-testid^="list-item-"]') ||
                    selected.closest('[role="row"]') ||
                    selected.closest('[data-testid^="list-item-"]') ||
                    selected;
            }

            if (title) {
                const rows = chatList.querySelectorAll('[role="row"][data-testid^="list-item-"]');
                return Array.from(rows).find((row) => row.innerText.includes(title)) || null;
            }

            return null;
        }

        static getConversationUnreadCount(title = this.getConversationTitle()) {
            const row = this.getActiveChatRow(title);
            if (!row) return 0;

            const unreadEl = row.querySelector('[data-testid="icon-unread-count"], [data-testid="unread-count"]');
            if (!unreadEl) return 0;

            const label = unreadEl.getAttribute('aria-label') || unreadEl.innerText || '';
            const match = label.match(/(\d+)/);
            return match ? Number(match[1]) : 0;
        }

        static getConversationSummary() {
            const header = this.getHeaderElement();
            const title = this.getConversationTitle();
            if (!header || !title) return null;

            const subtitle = this.getConversationSubtitle();
            const status = this.getRelevantConversationStatus(header);
            const kind = this.isGroupConversation() ? 'Grupo' : 'Contato';
            const unread = this.getConversationUnreadCount(title);
            const parts = [title, kind];

            if (unread > 0) parts.push(`${unread} não lidas`);
            if (subtitle && subtitle !== status) parts.push(subtitle);
            if (status) parts.push(status);

            return {
                header,
                title,
                subtitle,
                status,
                kind,
                unread,
                signature: [title, kind, unread || 0, status || '', subtitle || ''].join('|'),
                summary: parts.join(', ')
            };
        }

        static getSearchInput() {
            return this.findFirst(document, Constants.SELECTORS.searchFields);
        }

        static getFirstUnreadMarker(main = document.querySelector(Constants.SELECTORS.mainPanel)) {
            if (!main) return null;

            return this.findFirst(main, [
                '[data-testid*="unread"]',
                '[aria-label*="não lidas"]',
                '[aria-label*="nao lidas"]',
                '[aria-label*="unread"]'
            ]);
        }

        static getMessageFocusTarget(msgNode) {
            if (!msgNode) return null;

            const focusableItem = msgNode.matches?.('.focusable-list-item[aria-label]')
                ? msgNode
                : msgNode.querySelector?.('.focusable-list-item[aria-label]') ||
                    msgNode.closest?.('.focusable-list-item[aria-label]') ||
                    null;

            if (focusableItem) return focusableItem;

            const messageRoot = msgNode.matches?.('.message-in, .message-out')
                ? msgNode
                : msgNode.querySelector?.('.message-in, .message-out') ||
                    msgNode.closest?.('.message-in, .message-out') ||
                    msgNode.querySelector?.('[data-testid^="conv-msg-"]') ||
                    msgNode.closest?.('[data-testid^="conv-msg-"]') ||
                    null;

            return messageRoot || msgNode;
        }

        static getConversationFocusTarget(row) {
            if (!row) return null;

            return row.querySelector('[role="gridcell"][tabindex="0"]') ||
                row.querySelector('[role="gridcell"]') ||
                row.querySelector('[aria-selected="true"][tabindex="0"]') ||
                row.querySelector('[aria-selected="true"]') ||
                row.querySelector('[tabindex="0"]') ||
                row;
        }

        static getFocusedMessageNode(activeElement) {
            if (!activeElement) return null;

            const directMessage = activeElement.closest('.message-in, .message-out');
            if (directMessage) return directMessage;

            const row = activeElement.closest('[role="row"]');
            if (!row) return null;

            return row.querySelector('.message-in, .message-out') || row.querySelector('[data-testid^="conv-msg-"]') || null;
        }

        static getMessageDirectionLabel(msgNode) {
            if (!msgNode) return '';
            return msgNode.classList && msgNode.classList.contains(Constants.SELECTORS.messageOutClass) ? 'Enviada: ' : 'Recebida: ';
        }

        static normalizeMessageStatusLabel(text) {
            const normalized = (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (!normalized) return '';

            if (normalized.includes('lida') || normalized.includes('read')) return 'Lida';
            if (normalized.includes('entreg') || normalized.includes('delivered')) return 'Entregue';
            if (normalized.includes('enviad') || normalized.includes('sent')) return 'Enviada';
            if (normalized.includes('wds-ic-read')) return 'Lida';
            if (normalized.includes('wds-ic-delivered')) return 'Entregue';

            return '';
        }

        static getMessageStatusLabel(msgNode) {
            if (!msgNode) return '';

            const messageRoot = msgNode.matches?.('.message-in, .message-out')
                ? msgNode
                : msgNode.querySelector?.('.message-in, .message-out') ||
                    msgNode.closest?.('.message-in, .message-out') ||
                    msgNode.closest?.('[data-testid^="conv-msg-"]') ||
                    msgNode;

            if (!messageRoot.classList?.contains(Constants.SELECTORS.messageOutClass)) return '';

            const metaNode = messageRoot.querySelector?.('[data-testid="msg-meta"]') ||
                msgNode.querySelector?.('[data-testid="msg-meta"]') ||
                msgNode.closest?.('[data-testid^="conv-msg-"]')?.querySelector?.('[data-testid="msg-meta"]');

            if (!metaNode) return '';

            const candidates = Array.from(metaNode.querySelectorAll('[aria-label], [title], svg title, [data-icon]'));
            for (const candidate of candidates) {
                const rawLabel = candidate.getAttribute?.('aria-label') ||
                    candidate.getAttribute?.('title') ||
                    candidate.textContent ||
                    '';
                const statusLabel = this.normalizeMessageStatusLabel(rawLabel);
                if (statusLabel) return statusLabel;
            }

            return this.normalizeMessageStatusLabel(metaNode.innerText || metaNode.textContent || '');
        }

        static getMessageAnnouncementText(msgNode) {
            const content = this.getMessageContent(msgNode);
            if (!content) return '';

            const status = this.getMessageStatusLabel(msgNode);
            return status ? `${content}, ${status.toLowerCase()}` : content;
        }

        static getMessageAnnouncementKey(msgNode) {
            if (!msgNode) return '';

            const messageRoot = msgNode.closest?.('[data-id]') ||
                msgNode.closest?.('[data-testid^="conv-msg-"]') ||
                msgNode.closest?.('.message-in, .message-out') ||
                msgNode;

            const rootKey = messageRoot.getAttribute?.('data-id') ||
                messageRoot.getAttribute?.('data-testid') ||
                messageRoot.getAttribute?.('id') ||
                '';

            if (rootKey) return rootKey;

            const prePlainText = messageRoot.querySelector?.('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';
            const content = this.getMessageContent(msgNode) || '';
            const direction = this.getMessageDirectionLabel(msgNode);
            return [direction, prePlainText, content].join('|');
        }

        static getQuotedMessageText(msgNode) {
            if (!msgNode) return '';

            const quoted = msgNode.querySelector('[data-testid="quoted-message"]');
            if (!quoted) return '';

            const quotedTextEl = quoted.querySelector('[data-testid="selectable-text"][aria-label]') ||
                quoted.querySelector('[data-testid="selectable-text"]') ||
                quoted.querySelector('[role="button"][aria-label]') ||
                quoted;

            const quotedText = quotedTextEl.getAttribute ? (quotedTextEl.getAttribute('aria-label') || quotedTextEl.innerText || quotedTextEl.textContent || '') : (quotedTextEl.innerText || quotedTextEl.textContent || '');
            return this.cleanText(quotedText);
        }

        static getMainMessageText(msgNode) {
            if (!msgNode) return '';

            // Em álbuns, a legenda inteira fica neste elemento; os spans internos
            // podem conter apenas a última linha da mensagem.
            const albumCaption = msgNode.querySelector('[data-testid~="album-caption"]');
            if (albumCaption) {
                const caption = albumCaption.getAttribute('aria-label') || albumCaption.innerText || albumCaption.textContent || '';
                if (caption) return this.cleanText(caption);
            }

            const candidates = Array.from(msgNode.querySelectorAll('[data-testid="selectable-text"], .copyable-text span, .copyable-text'))
                .filter((el) => !el.closest('[data-testid="quoted-message"]') && !el.closest('[data-testid="msg-meta"]') && !el.closest('[data-testid="author"]'));

            if (candidates.length > 0) {
                const last = candidates[candidates.length - 1];
                const text = last.getAttribute ? (last.getAttribute('aria-label') || last.innerText || last.textContent || '') : (last.innerText || last.textContent || '');
                if (text) return this.cleanText(text);
            }

            return '';
        }

        static getMessageImageNode(msgNode) {
            if (!msgNode) return null;

            const preferredSelectors = [
                '[data-testid="sticker-container"] [role="button"] img[src]',
                '[data-testid="sticker-container"] [role="button"] canvas',
                '[data-testid="sticker-container"] img[src]',
                '[data-testid="sticker-container"] canvas',
                'button[aria-label^="Imagem"] img[src]',
                'button[aria-label^="Foto"] img[src]',
                'button[aria-label*="Imagem"] img[src]',
                'button[aria-label*="Foto"] img[src]',
                '[role="button"][aria-label^="Imagem"] img[src]',
                '[role="button"][aria-label^="Foto"] img[src]',
                '[role="button"][aria-label*="Imagem"] img[src]',
                '[role="button"][aria-label*="Foto"] img[src]',
                '[data-testid="sticker-container"] img[src]',
                '[data-testid="image"] img[src]'
            ];

            for (const selector of preferredSelectors) {
                const img = msgNode.querySelector(selector);
                if (img) return img.tagName === 'IMG' ? img : img.querySelector('img[src]') || img.closest('[data-testid="sticker-container"]')?.querySelector('img[src]') || null;
            }

            const mediaButtons = msgNode.querySelectorAll('button[aria-label], [role="button"][aria-label]');
            for (const mediaButton of mediaButtons) {
                const label = (mediaButton.getAttribute('aria-label') || '').trim();
                const mediaLabel = label.toLowerCase();
                if (!mediaLabel) continue;

                if (mediaLabel.includes('imagem') || mediaLabel.includes('foto') || mediaLabel.includes('figurinha') || mediaLabel.includes('sticker')) {
                    const img = mediaButton.querySelector('img[src]');
                    if (img) return img;

                    const canvasHost = mediaButton.querySelector('canvas');
                    if (canvasHost) {
                        const stickerHost = mediaButton.closest('[data-testid="sticker-container"]');
                        if (stickerHost) {
                            const stickerImg = stickerHost.querySelector('img[src]');
                            if (stickerImg) return stickerImg;
                        }
                    }
                }
            }

            const images = msgNode.querySelectorAll('img[src]');
            for (const img of images) {
                const src = img.getAttribute('src') || '';
                const cls = (img.className || '').toString();
                const mediaHost = img.closest('button[aria-label], [role="button"][aria-label], [data-testid="sticker-container"]');

                // Ignora emojis e ícones inline; aqui queremos só mídia real da mensagem.
                if (!src || src.startsWith('data:image/')) continue;
                if (cls.includes('emoji')) continue;
                if (!mediaHost) continue;

                return img;
            }

            const stickerContainers = msgNode.querySelectorAll('[data-testid="sticker-container"]');
            for (const stickerContainer of stickerContainers) {
                const stickerImg = stickerContainer.querySelector('img[src]');
                if (stickerImg) return stickerImg;
            }

            return null;
        }

        // Remove números de telefone do texto para limpar a leitura
        static cleanText(text) {
            if (!text) return "";
            
            // Regex melhorado para capturar variações de números de telefone
            // Captura: +55, (11), 11, 99999-9999, 99999 9999, etc.
            const phoneRegex = /(?:\+?\d{2,3}[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/g;
            
            // Remove o número completamente (substitui por vazio)
            let cleaned = text.replace(phoneRegex, '');
            
            // Limpa caracteres de pontuação que podem sobrar soltos
            cleaned = cleaned.replace(/~ */g, ''); // Remove til solto
            cleaned = cleaned.replace(/ +: +/g, ': '); // Normaliza dois pontos
            
            return cleaned.trim();
        }

        static getAudioButton(msgNode) {
            if (!msgNode) return null;
            
            // 1. Tenta pelo seletor padrão
            let btn = msgNode.querySelector(Constants.SELECTORS.btnAudioPlay);
            if (btn) return btn.tagName === 'BUTTON' ? btn : btn.closest('button');

            // 2. Tenta pela nova estrutura (SVG com título de play/pause)
            const titles = msgNode.querySelectorAll('svg title');
            for (const t of titles) {
                const text = t.textContent.toLowerCase();
                if (text.includes('play') || text.includes('pause')) {
                    return t.closest('button');
                }
            }

            // 3. Fallback pelo rótulo bugado mencionado pelo usuário
            const buggedBtn = msgNode.querySelector('button[aria-label="Imagem sem descrição"]');
            if (buggedBtn && buggedBtn.querySelector('svg')) {
                return buggedBtn;
            }

            return null;
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

                // 1. Álbum de mídias. O foco do WhatsApp fica no item com
                // aria-label; use seu rótulo nativo e acrescente a legenda.
                else if (msgNode.querySelector('[data-testid="media-album"]')) {
                    const focusableItem = this.getMessageFocusTarget(msgNode);
                    const nativeLabel = focusableItem?.dataset.wppA11yNativeAriaLabel ||
                        focusableItem?.getAttribute('aria-label') ||
                        '';
                    const mainText = this.getMainMessageText(msgNode);

                    content = nativeLabel || 'Álbum de mídias';
                    if (mainText && !content.toLowerCase().includes(mainText.toLowerCase())) {
                        content = `${content}. Legenda: ${mainText}`;
                    }
                }

                // 2. Mídia da mensagem
                else {
                    const mediaNode = this.getMessageImageNode(msgNode);
                    if (mediaNode) {
                        const mediaHost = mediaNode.closest('button[aria-label], [role="button"][aria-label], [data-testid="sticker-container"]');
                        const mediaLabel = mediaHost?.getAttribute('aria-label') || mediaNode.getAttribute('alt') || '';
                        const stickerContainer = mediaNode.closest('[data-testid="sticker-container"]');
                        if (stickerContainer) {
                            if (mediaLabel && /^imagem/i.test(mediaLabel)) {
                                content = mediaLabel.replace(/^Imagem/i, 'Figurinha');
                            } else if (mediaLabel && /sem etiqueta/i.test(mediaLabel)) {
                                content = mediaLabel.replace(/sem etiqueta/i, 'sem descrição');
                            } else if (mediaLabel) {
                                content = mediaLabel.replace(/^Figurinha:\s*/i, 'Figurinha: ');
                            } else {
                                content = "Figurinha sem descrição";
                            }
                        } else {
                            content = mediaLabel ? mediaLabel : "Imagem sem descrição";
                        }
                    }

                    // 3. Mensagens do Sistema
                    else if (msgNode.querySelector('._akbu')) {
                        content = msgNode.querySelector('._akbu').innerText;
                    }

                    // 4. Texto padrão
                    else {
                        const quotedText = this.getQuotedMessageText(msgNode);
                        const mainText = this.getMainMessageText(msgNode);
                        const textNode = msgNode.querySelector('[data-testid="selectable-text"]') ||
                                         msgNode.querySelector('.copyable-text span') ||
                                         msgNode.querySelector('.copyable-text');
                        
                        if (quotedText && mainText) {
                            content = `Resposta citada: ${quotedText}. ${mainText}`;
                        } else if (quotedText) {
                            content = `Resposta citada: ${quotedText}`;
                        } else if (mainText) {
                            content = mainText;
                        } else if (textNode) content = textNode.innerText;

                        if (!content && this.getAudioButton(msgNode)) {
                            content = "Mensagem de voz";
                        }

                        if (!content) {
                            const rawText = msgNode.innerText;
                            if (rawText && rawText.length > 0) {
                                content = rawText.replace(/\d{1,2}:\d{2}\s*$/, ''); // Tenta remover hora do fim
                            }
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
        static get VERSION() { return "8.0.12"; }

        static get SELECTORS() {
            return {
                app: '#app',
                mainPanel: '#main',
                sidePanel: '#pane-side',
                headerTitle: '#main [data-testid="conversation-info-header-chat-title"]',
                messageList: ['#main [data-testid^="conv-msg-"]', '#main [class*="message-in"]', '#main [class*="message-out"]'],
                messageInClass: 'message-in',
                messageOutClass: 'message-out',
                messageContainer: '#main [role="application"]', 
                footer: 'footer',
                footerInput: 'footer [contenteditable="true"]',
                btnSend: '[data-icon="send"]',
                btnAttach: '[data-icon="plus-rounded"], [aria-label="Anexar"]',
                btnMic: '[data-icon="mic-outlined"]',
                btnAudioPlay: 'button[aria-label*="Reproduzir"], button[aria-label*="Pausar"], button[aria-label*="Play"], button[aria-label*="Pause"], [data-icon="audio-play"], [data-icon="audio-pause"]',
                searchFields: [
                    '[data-testid="chat-list-search-container"] input[role="textbox"]',
                    '[data-testid="chat-list-search-container"] [role="textbox"]',
                    '[data-testid="chat-list-search-container"] input',
                    'input[aria-label*="Pesquisar ou começar uma nova conversa"]',
                    'input[aria-label*="Pesquisar"]',
                    'input[aria-label*="Search"]',
                    '#pane-side [role="textbox"][aria-label*="Pesquisar"]',
                    '#pane-side [role="textbox"][aria-label*="Search"]',
                    '#pane-side [contenteditable="true"]',
                    '[contenteditable="true"][aria-label*="Pesquisar"]'
                ],
                filterButtons: '[role="tablist"][aria-label="chat-list-filters"] [role="tab"], [role="tablist"][aria-label="Filtros da lista de conversas"] [role="tab"]'
            };
        }

        static get SHORTCUTS() {
            return {
                TOGGLE: 'KeyS', 
                FOCUS_CHAT_LIST: 'Digit1', 
                FOCUS_MSG_LIST: 'Digit2',  
                FOCUS_HEADER: 'Digit3',
                FOCUS_RELEVANT_MESSAGE: 'Digit4',
                FOCUS_SEARCH: 'KeyF',
                READ_STATUS: 'KeyV',
                TOGGLE_MONITOR: 'KeyO',
                HELP: 'KeyH',
                FILTER_ALL: 'Digit1',
                FILTER_UNREAD: 'Digit2',
                FILTER_GROUPS: 'Digit3',
                FILTER_CONTACTS: 'Digit4'
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
            this.elementAssertive = null;
            this.elementPolite = null;
            this._createDOM();
        }
        _createDOM() {
            // Canal Assertivo (Interrompe falas, urgente)
            if (!document.getElementById('wpp-a11y-live')) {
                this.elementAssertive = document.createElement('div');
                this.elementAssertive.id = 'wpp-a11y-live';
                this.elementAssertive.setAttribute('aria-live', 'assertive');
                this.elementAssertive.className = 'sr-only-refined';
                document.body.appendChild(this.elementAssertive);
            } else {
                this.elementAssertive = document.getElementById('wpp-a11y-live');
            }

            // Canal Polite (Educação, espera terminar de falar)
            if (!document.getElementById('wpp-a11y-live-polite')) {
                this.elementPolite = document.createElement('div');
                this.elementPolite.id = 'wpp-a11y-live-polite';
                this.elementPolite.setAttribute('aria-live', 'polite');
                this.elementPolite.className = 'sr-only-refined';
                document.body.appendChild(this.elementPolite);
            } else {
                this.elementPolite = document.getElementById('wpp-a11y-live-polite');
            }
        }
        announce(text) {
            if (!this.elementAssertive) this._createDOM();
            this.elementAssertive.textContent = ''; 
            setTimeout(() => { this.elementAssertive.textContent = text; }, 50);
        }
        announcePolite(text) {
            if (!this.elementPolite) this._createDOM();
            this.elementPolite.textContent = '';
            setTimeout(() => { this.elementPolite.textContent = text; }, 50);
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

    class ShortcutHelpDialog {
        constructor() {
            this.dialog = null;
            this.content = null;
            this.closeButton = null;
            this.statusNode = null;
            this.lastFocus = null;
            this._createDOM();
        }

        _createDOM() {
            if (this.dialog) return;

            this.dialog = document.createElement('dialog');
            this.dialog.id = 'wpp-a11y-help-dialog';
            this.dialog.setAttribute('aria-labelledby', 'wpp-a11y-help-title');
            this.dialog.setAttribute('aria-describedby', 'wpp-a11y-help-desc wpp-a11y-help-hint');

            this.dialog.innerHTML = `
                <form method="dialog" class="wpp-a11y-help-shell">
                    <div class="wpp-a11y-help-header">
                        <div>
                            <h2 id="wpp-a11y-help-title">Atalhos ativos</h2>
                            <p id="wpp-a11y-help-desc">Acessibilidade ativada.</p>
                            <p id="wpp-a11y-help-hint">Alt+H para ajuda.</p>
                        </div>
                        <button value="cancel" class="wpp-a11y-help-close" aria-label="Fechar ajuda">Fechar</button>
                    </div>
                    <div class="wpp-a11y-help-body">
                        <dl class="wpp-a11y-help-list">
                            <div><dt>Alt+S</dt><dd>Liga ou desliga</dd></div>
                            <div><dt>Alt+1</dt><dd>Lista de conversas</dd></div>
                            <div><dt>Alt+2</dt><dd>Mensagens e caixa de texto</dd></div>
                            <div><dt>Alt+3</dt><dd>Cabeçalho da conversa</dd></div>
                            <div><dt>Alt+4</dt><dd>Última mensagem</dd></div>
                            <div><dt>Alt+F</dt><dd>Busca de conversas</dd></div>
                            <div><dt>Alt+V</dt><dd>Status da conversa</dd></div>
                            <div><dt>Alt+O</dt><dd>Monitor de status</dd></div>
                            <div><dt>Alt+H</dt><dd>Ajuda</dd></div>
                            <div><dt>Alt+?</dt><dd>Ajuda</dd></div>
                            <div><dt>Ctrl+Shift+1-4</dt><dd>Filtros da lista</dd></div>
                        </dl>
                    </div>
                    <div id="wpp-a11y-help-live" class="sr-only-refined" aria-live="assertive"></div>
                </form>
            `;

            document.body.appendChild(this.dialog);
            this.statusNode = this.dialog.querySelector('#wpp-a11y-help-live');
            this.dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                this.close();
            });
            this.dialog.addEventListener('close', () => {
                this._restoreFocus();
            });
        }

        _restoreFocus() {
            if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
                this.lastFocus.focus();
            }
            this.lastFocus = null;
        }

        open(trigger) {
            if (!this.dialog) this._createDOM();
            this.lastFocus = trigger || document.activeElement || null;

            if (typeof this.dialog.showModal === 'function') {
                this.dialog.showModal();
            } else {
                this.dialog.setAttribute('open', '');
            }

            const closeButton = this.dialog.querySelector('.wpp-a11y-help-close');
            if (closeButton) {
                closeButton.focus();
            } else {
                this.dialog.focus();
            }

            if (this.statusNode) {
                this.statusNode.textContent = '';
                setTimeout(() => {
                    this.statusNode.textContent = 'Acessibilidade ativada. Alt+H para ajuda.';
                }, 50);
            }
        }

        close() {
            if (!this.dialog) return;

            if (this.dialog.open) {
                this.dialog.close();
            } else {
                this.dialog.removeAttribute('open');
            }
        }

        toggle(trigger) {
            if (this.dialog && this.dialog.open) {
                this.close();
                return;
            }

            this.open(trigger);
        }
    }

    class NavigationService {
        constructor(toast) {
            this.toast = toast;
        }

        _reportFallback(reason, logLabel = '') {
            if (logLabel) {
                Logger.debug(`${logLabel} fallback`, reason);
            } else {
                Logger.debug('Focus fallback', reason);
            }
            this.toast.show(reason);
        }

        focusChatList() {
            const chatList = DOMUtils.getChatListContainer();
            if (!chatList) {
                this._reportFallback('Lista de conversas indisponível', 'focusChatList');
                return;
            }

            const activeChatTitle = DOMUtils.getConversationTitle();
            let target = chatList.querySelector('[aria-selected="true"]');

            if (target) {
                target = target.closest('[role="row"][data-testid^="list-item-"]') ||
                    target.closest('[role="row"]') ||
                    target.closest('[data-testid^="list-item-"]') ||
                    target;
            }

            if (!target && activeChatTitle) {
                const rows = chatList.querySelectorAll('[role="row"][data-testid^="list-item-"]');
                target = Array.from(rows).find((row) => row.innerText.includes(activeChatTitle)) || null;
            }

            if (!target) {
                const unreadRows = Array.from(chatList.querySelectorAll('[role="row"][data-testid^="list-item-"]'))
                    .filter((row) => row.querySelector('[data-testid="icon-unread-count"], [data-testid="unread-count"]'));
                target = unreadRows[0] || chatList.querySelector('[role="row"][data-testid^="list-item-"]') || chatList.querySelector('[role="row"]');
            }

            if (!target) {
                this._reportFallback('Lista de conversas indisponível', 'focusChatList');
                return;
            }

            target.scrollIntoView({ block: 'center', inline: 'nearest' });
            const focusTarget = DOMUtils.getConversationFocusTarget(target);
            if (!focusTarget.hasAttribute('tabindex')) {
                focusTarget.setAttribute('tabindex', '0');
            }
            focusTarget.focus();
            this.toast.show("Lista de conversas");
        }

        focusChatHeader() {
            const summary = DOMUtils.getConversationSummary();
            if (!summary) {
                this._reportFallback('Nenhuma conversa aberta', 'focusChatHeader');
                return;
            }

            const header = summary.header;
            const target = DOMUtils.findFirst(header, [
                '[data-testid="conversation-info-header"]',
                '[data-testid="group-chat-profile-picture"]',
                Constants.SELECTORS.headerTitle,
                'header'
            ]);

            if (!target) {
                this._reportFallback('Nenhuma conversa aberta', 'focusChatHeader');
                return;
            }

            const label = [summary.title, summary.kind, summary.unread > 0 ? `${summary.unread} não lidas` : '', summary.status].filter(Boolean).join(', ');
            target.setAttribute('tabindex', '-1');
            target.setAttribute('aria-label', label || summary.title);
            target.focus();
            this.toast.show("Cabeçalho");
        }

        focusChatSearch() {
            const input = DOMUtils.getSearchInput();
            if (!input) {
                this._reportFallback('Busca indisponível', 'focusChatSearch');
                return;
            }

            input.setAttribute('tabindex', '0');
            input.focus();
            if (typeof input.select === 'function') {
                input.select();
            }
            this.toast.show("Busca");
        }

        handleMessageAreaFocus() {
            const footer = document.querySelector(Constants.SELECTORS.footer);
            if (!footer) {
                this.toast.show("Nenhuma conversa aberta");
                return;
            }
            const input = document.querySelector(Constants.SELECTORS.footerInput);
            if (!input) {
                this._reportFallback('Nenhuma conversa aberta', 'handleMessageAreaFocus');
                return;
            }
            const activeEl = document.activeElement;
            const isInComposer = activeEl === input || footer.contains(activeEl);
            if (isInComposer) {
                this._focusMessageListContainer();
            } else {
                input.focus();
                this.toast.show("Escrever mensagem");
            }
        }

        _focusMessageListContainer() {
            const messages = document.querySelectorAll(Constants.SELECTORS.messageList.join(', '));
            if (messages.length === 0) {
                this._reportFallback('Nenhuma mensagem focável encontrada', 'focusMessageList');
                return false;
            }

            const lastMsg = messages[messages.length - 1];
            const focusTarget = DOMUtils.getMessageFocusTarget(lastMsg);
            if (!focusTarget) {
                this._reportFallback('Nenhuma mensagem focável encontrada', 'focusMessageList');
                return false;
            }

            focusTarget.setAttribute('tabindex', '-1');
            focusTarget.focus();
            this.toast.show("Lista de mensagens");
            return true;
        }

        focusRelevantMessage() {
            const main = document.querySelector(Constants.SELECTORS.mainPanel);
            if (!main) {
                this._reportFallback('Nenhuma conversa aberta', 'focusRelevantMessage');
                return;
            }

            const unreadMarker = DOMUtils.getFirstUnreadMarker(main);
            let target = null;

            if (unreadMarker) {
                const markerRow = unreadMarker.closest('[role="row"]') || unreadMarker.closest('[data-testid^="conv-msg-"]') || unreadMarker;
                const nextRow = markerRow.nextElementSibling;
                const nextMessage = nextRow?.querySelector('.message-in, .message-out, [data-testid^="conv-msg-"]') || nextRow;
                target = DOMUtils.getMessageFocusTarget(nextMessage || markerRow);
            }

            if (!target) {
                const incomingMessages = Array.from(main.querySelectorAll('.message-in'));
                const lastReceived = incomingMessages[incomingMessages.length - 1];
                target = DOMUtils.getMessageFocusTarget(lastReceived);
            }

            if (!target) {
                this._reportFallback('Nenhuma mensagem focável encontrada', 'focusRelevantMessage');
                return;
            }

            target.scrollIntoView({ block: 'center', inline: 'nearest' });
            target.setAttribute('tabindex', '-1');
            target.focus();
            this.toast.show("Mensagem relevante");
        }

        readChatStatus() {
            const header = DOMUtils.getHeaderElement();
            if (!header) {
                this.toast.show("Nenhuma conversa aberta");
                return;
            }
            const statusText = DOMUtils.getConversationStatus(header);
            if (statusText) {
                this.toast.show("Status: " + statusText);
                return;
            }

            const possibleStatus = header.querySelector('span[title]:not([dir="auto"])');
            if (possibleStatus) {
                this.toast.show("Status: " + possibleStatus.getAttribute('title'));
                return;
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

        selectChatFilter(index) {
            const filters = document.querySelectorAll(Constants.SELECTORS.filterButtons);
            if (filters.length > 0) {
                const targetIndex = Math.min(index, filters.length - 1);
                const filter = filters[targetIndex];
                
                if (filter) {
                    filter.click();
                    const span = filter.querySelector('span');
                    const label = (span ? span.innerText : null) || filter.getAttribute('aria-label') || filter.innerText || "Filtro " + (targetIndex + 1);
                    this.toast.show("Filtro: " + label);
                }
            } else {
                this.toast.show("Filtros não encontrados");
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
            const messages = document.querySelectorAll('[class*="message-"], [data-testid^="conv-msg-"] .focusable-list-item[aria-label]');
            messages.forEach(msg => {
                const isMediaAlbum = Boolean(msg.querySelector('[data-testid="media-album"]'));
                const focusable = DOMUtils.getMessageFocusTarget(msg);

                // A legenda do álbum pode aparecer após o item receber foco. Guarda o
                // rótulo nativo uma única vez e reprocessa somente se seu conteúdo mudar.
                if (isMediaAlbum && focusable && !focusable.dataset.wppA11yNativeAriaLabel) {
                    focusable.dataset.wppA11yNativeAriaLabel = focusable.getAttribute('aria-label') || '';
                }
                const albumSignature = isMediaAlbum
                    ? `${focusable?.dataset.wppA11yNativeAriaLabel || ''}|${DOMUtils.getMainMessageText(msg)}`
                    : '';

                if (msg.dataset.wppA11yProcessed === "true" &&
                    (!isMediaAlbum || msg.dataset.wppA11yProcessedSignature === albumSignature)) return;

                // 1. Identifica o elemento exato que contém o texto
                const textNode = msg.querySelector('[data-testid="selectable-text"]') || 
                                 msg.querySelector('.copyable-text span') ||
                                 msg.querySelector('.copyable-text');

                // 2. Extrai e LIMPA o conteúdo
                const content = DOMUtils.getMessageContent(msg);
                
                if (content) {
                    // Prioriza o root da mensagem para o foco e leitura assistida.
                    const directionLabel = DOMUtils.getMessageDirectionLabel(msg);
                    const announcementLabel = directionLabel + DOMUtils.getMessageAnnouncementText(msg);
                    
                    // FORÇA a aplicação do label, sobrescrevendo qualquer anterior para garantir consistência
                    if (!focusable.hasAttribute('tabindex')) {
                        focusable.setAttribute('tabindex', '-1');
                    }
                    focusable.setAttribute('aria-label', announcementLabel);
                    
                    // Se for Cartão de Contato, define role="article" para evitar que o NVDA
                    // leia apenas "use as setas..." devido aos botões internos
                    if (content.startsWith("Contato:")) {
                        focusable.setAttribute('role', 'article');
                    }
                    
                    // Fallback para o container principal caso o focável não seja o root
                    if (focusable !== msg) {
                         msg.setAttribute('aria-label', announcementLabel);
                    }
                    
                    // Aplica DIRETAMENTE no texto (para navegação com setas)
                    if (textNode) {
                        textNode.setAttribute('aria-label', announcementLabel);
                    }

                    // Tenta limpar o REMETENTE (se for um número)
                    // Procura spans que tenham label terminando em ":" (ex: "+55 11 9999-9999:")
                    const senderSpans = msg.querySelectorAll('span[aria-label$=":"]');
                    senderSpans.forEach(span => {
                        const originalLabel = span.getAttribute('aria-label');
                        const cleanedLabel = DOMUtils.cleanText(originalLabel);
                        if (cleanedLabel !== originalLabel) {
                            span.setAttribute('aria-label', cleanedLabel);
                        }
                    });
                } else if (!msg.getAttribute('aria-label')) {
                    // Fallback
                    const raw = DOMUtils.cleanText(msg.innerText);
                    if(raw && raw.length > 0) {
                         msg.setAttribute('aria-label', raw);
                    }
                }

                const audioBtn = DOMUtils.getAudioButton(msg);
                if (audioBtn) {
                    const currentLabel = audioBtn.getAttribute('aria-label');
                    // Verifica se é play ou pause pelo título do SVG interno
                    const svgTitle = audioBtn.querySelector('svg title')?.textContent.toLowerCase() || "";
                    const isPause = svgTitle.includes('pause');
                    const targetLabel = isPause ? "Pausar áudio" : "Reproduzir áudio";

                    if (!currentLabel || currentLabel === "Imagem sem descrição" || currentLabel.includes("Play") || currentLabel.includes("Reproduzir")) {
                         audioBtn.setAttribute('aria-label', targetLabel);
                    }
                }
                
                msg.dataset.wppA11yProcessed = "true";
                if (isMediaAlbum) {
                    msg.dataset.wppA11yProcessedSignature = albumSignature;
                }
            });
        }
    }

    class StatusMonitor {
        constructor(announcer, toast) {
            this.announcer = announcer;
            this.toast = toast;
            this.enabled = true;
            this.observer = null;
            this.currentHeader = null;
            this.lastStatus = "";
            this.currentConversationSignature = "";
        }

        toggle() {
            this.enabled = !this.enabled;
            this.toast.show("Monitor de Status: " + (this.enabled ? "Ligado" : "Desligado"));
            if (!this.enabled) this.disconnect();
            else this.checkAndAttach();
        }

        checkAndAttach() {
            if (!this.enabled) return;

            const header = DOMUtils.getHeaderElement();
            if (!header) {
                if (this.currentHeader) {
                    this.disconnect();
                }
                return;
            }

            if (header && header !== this.currentHeader) {
                this.disconnect();
                this.currentHeader = header;
                this.lastStatus = ""; // Reseta histórico ao mudar de conversa
                
                // Observa mudanças no header (onde o status aparece)
                this.observer = new MutationObserver(() => this._checkStatus());
                this.observer.observe(header, { subtree: true, childList: true, characterData: true });

                const context = this._announceConversationContext();
                if (context && context.status) {
                    this.lastStatus = context.status;
                }

                // Checagem inicial imediata (para "Visto por último")
                setTimeout(() => this._checkStatus(true), 500);
            }
        }

        disconnect() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.currentHeader = null;
            this.currentConversationSignature = "";
        }

        _announceConversationContext() {
            const context = DOMUtils.getConversationSummary();
            if (!context) return null;

            if (context.signature === this.currentConversationSignature) {
                return context;
            }

            this.currentConversationSignature = context.signature;

            const parts = [context.title, context.kind];
            if (context.unread > 0) parts.push(`${context.unread} não lidas`);
            if (context.status) parts.push(context.status);
            else if (context.subtitle && context.subtitle !== context.title) parts.push(context.subtitle);

            const announcement = parts.filter(Boolean).join(', ');
            if (announcement) {
                this.announcer.announcePolite(announcement);
                Logger.debug('Conversation context announced', context.signature);
            }

            return context;
        }

        _checkStatus(isInitial = false) {
            if (!this.currentHeader) return;

            const statusText = DOMUtils.getConversationStatus(this.currentHeader);

            if (!statusText || statusText.length < 2) return;
            if (statusText === this.lastStatus) return; // Ignora se não mudou

            // Lógica de Decisão
            const isOnline = statusText.toLowerCase() === 'online';
            const isTyping = statusText.toLowerCase().includes('digitando');
            const isRecording = statusText.toLowerCase().includes('gravando');
            const isLastSeen = statusText.toLowerCase().includes('visto');

            let shouldAnnounce = false;

            if (isOnline || isTyping || isRecording) {
                shouldAnnounce = true;
            } else if (isLastSeen) {
                // "Visto por último": Só anuncia se for a primeira vez que detectamos nesta conversa
                // Isso evita o flood de "Visto hoje às 14:01", "Visto hoje às 14:02"
                if (this.lastStatus === "") {
                    shouldAnnounce = true;
                }
            }

            if (shouldAnnounce) {
                this.lastStatus = statusText;
                // Usa o canal POLITE para não atropelar a leitura de mensagens
                this.announcer.announcePolite(statusText);
            }
        }
    }

    class WppA11yApp {
        constructor() {
            this.toast = new ToastService();
            this.liveAnnouncer = new LiveAnnouncer();
            this.beep = new BeepService();
            this.helpDialog = new ShortcutHelpDialog();
            this.navigator = new NavigationService(this.toast);
            this.enhancer = new MessageEnhancer();
            this.statusMonitor = new StatusMonitor(this.liveAnnouncer, this.toast);
            this.currentConversationSignature = '';
            this.lastAnnouncedMessageKey = '';
            
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

        _getLatestVisibleMessageNode() {
            const wrappers = document.querySelectorAll(`${Constants.SELECTORS.mainPanel} [data-testid^="conv-msg-"]`);
            if (wrappers && wrappers.length > 0) {
                const lastWrapper = wrappers[wrappers.length - 1];
                return lastWrapper.querySelector('.message-in, .message-out') || lastWrapper;
            }

            const messages = document.querySelectorAll(`${Constants.SELECTORS.mainPanel} .message-in, ${Constants.SELECTORS.mainPanel} .message-out`);
            if (!messages || messages.length === 0) return null;
            return messages[messages.length - 1];
        }

        _syncConversationMessageState() {
            const summary = DOMUtils.getConversationSummary();
            const signature = summary ? [summary.title, summary.kind].join('|') : '';

            if (!signature || signature === this.currentConversationSignature) {
                return false;
            }

            if (this._latestMessageTimer) {
                clearTimeout(this._latestMessageTimer);
                this._latestMessageTimer = null;
            }

            this.currentConversationSignature = signature;
            const latestMessage = this._getLatestVisibleMessageNode();
            this.lastAnnouncedMessageKey = latestMessage ? DOMUtils.getMessageAnnouncementKey(latestMessage) : '';
            return true;
        }

        _announceLatestMessage() {
            const msgNode = this._getLatestVisibleMessageNode();
            if (!msgNode) return;

            const content = DOMUtils.getMessageAnnouncementText(msgNode);
            if (!content) return;

            const messageKey = DOMUtils.getMessageAnnouncementKey(msgNode);
            if (!messageKey || messageKey === this.lastAnnouncedMessageKey) return;

            Logger.debug('📢 Anunciando última mensagem:', content);
            this.beep.playNotification();
            this.liveAnnouncer.announce(content);
            this.lastAnnouncedMessageKey = messageKey;
            msgNode.dataset.wppA11yAnnounced = 'true';
        }

        _scheduleLatestMessageAnnouncement() {
            if (this._latestMessageTimer) clearTimeout(this._latestMessageTimer);
            this._latestMessageTimer = setTimeout(() => {
                this._latestMessageTimer = null;
                this._announceLatestMessage();
            }, 500);
        }

        readLatestConversationMessage() {
            const msgNode = this._getLatestVisibleMessageNode();
            if (!msgNode) {
                this.toast.show("Nenhuma mensagem encontrada");
                return;
            }

            const content = DOMUtils.getMessageAnnouncementText(msgNode);
            if (!content) {
                this.toast.show("Nenhuma mensagem encontrada");
                return;
            }

            this.beep.playNotification();
            this.liveAnnouncer.announce(content);
            this.toast.show("Última mensagem");
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
                    #wpp-a11y-help-dialog {
                        width: min(640px, calc(100vw - 32px));
                        border: 1px solid #2a3942;
                        border-radius: 20px;
                        padding: 0;
                        background: #111b21;
                        color: #e9edef;
                        box-shadow: 0 24px 72px rgba(0, 0, 0, 0.45);
                    }
                    #wpp-a11y-help-dialog::backdrop {
                        background: rgba(11, 20, 26, 0.72);
                    }
                    .wpp-a11y-help-shell {
                        margin: 0;
                        padding: 20px;
                    }
                    .wpp-a11y-help-header {
                        display: flex;
                        align-items: flex-start;
                        justify-content: space-between;
                        gap: 16px;
                        margin-bottom: 16px;
                    }
                    .wpp-a11y-help-header h2 {
                        margin: 0;
                        font-size: 20px;
                        line-height: 1.2;
                    }
                    .wpp-a11y-help-header p {
                        margin: 6px 0 0;
                        color: #8696a0;
                        font-size: 13px;
                    }
                    .wpp-a11y-help-close {
                        border: 1px solid #374248;
                        background: #202c33;
                        color: #e9edef;
                        border-radius: 999px;
                        padding: 8px 14px;
                        font-size: 13px;
                    }
                    .wpp-a11y-help-body {
                        max-height: min(60vh, 520px);
                        overflow: auto;
                        padding-right: 4px;
                    }
                    .wpp-a11y-help-list {
                        display: grid;
                        gap: 10px;
                        margin: 0;
                    }
                    .wpp-a11y-help-list > div {
                        display: flex;
                        justify-content: space-between;
                        align-items: baseline;
                        gap: 16px;
                        padding: 10px 12px;
                        border-radius: 14px;
                        background: #0f1b22;
                        border: 1px solid #2a3942;
                    }
                    .wpp-a11y-help-list dt {
                        font-weight: 700;
                        margin: 0;
                        white-space: nowrap;
                    }
                    .wpp-a11y-help-list dd {
                        margin: 0;
                        color: #d1d7db;
                        text-align: right;
                    }
                `);
            }
        }

        _setupKeyboard() {
            document.addEventListener('keydown', (e) => {
                // Intercepta CTRL + C em mensagens
                if (e.ctrlKey && e.code === 'KeyC' && this.state.activated) {
                    const active = document.activeElement;
                    const msgNode = DOMUtils.getFocusedMessageNode(active);
                    
                    if (msgNode) {
                        e.preventDefault();
                        
                        // Tenta pegar o texto selecionado primeiro (comportamento padrão)
                        const selection = window.getSelection().toString();
                        if (selection) {
                            navigator.clipboard.writeText(selection);
                            this.toast.show("Texto selecionado copiado");
                            return;
                        }

                        // Sem seleção explícita, prioriza a mídia da mensagem quando existir.
                        const imgNode = DOMUtils.getMessageImageNode(msgNode);
                        if (imgNode) {
                            this._copyImageAsBinary(imgNode.src);
                            return;
                        }

                        const textNode = msgNode.querySelector('[data-testid="selectable-text"]') || 
                                         msgNode.querySelector('.copyable-text span') ||
                                         msgNode.querySelector('.copyable-text');

                        if (textNode) {
                            const text = textNode.innerText;
                            navigator.clipboard.writeText(text).then(() => {
                                this.toast.show("Texto da mensagem copiado");
                            });
                            return;
                        }

                        const fallbackImg = msgNode.querySelector('img[src^="blob:"], img[src^="http"]');
                        if (fallbackImg) {
                            this._copyImageAsBinary(fallbackImg.src);
                        }
                        return;
                    }
                }

                // Intercepta a tecla APPLICATIONS (ContextMenu) para abrir opções da mensagem
                if (e.key === 'ContextMenu' && this.state.activated) {
                    const active = document.activeElement;
                    const msgNode = DOMUtils.getFocusedMessageNode(active);
                    
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
                    const msgNode = DOMUtils.getFocusedMessageNode(active);
                    if (msgNode) {
                        // Tenta achar o botão de play/pause dentro dessa mensagem
                        const playBtn = DOMUtils.getAudioButton(msgNode);
                        if (playBtn) {
                            e.preventDefault();
                            playBtn.click();
                            return;
                        }
                    }
                }

                if (e.altKey && e.code === Constants.SHORTCUTS.TOGGLE) {
                    e.preventDefault();
                    this.state.activated = !this.state.activated;
                }
                if (!this.state.activated) return;

                const isHelpShortcut = e.altKey && (e.code === Constants.SHORTCUTS.HELP || (e.shiftKey && e.code === 'Slash'));

                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_CHAT_LIST) { e.preventDefault(); this.navigator.focusChatList(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_MSG_LIST) { e.preventDefault(); this.navigator.handleMessageAreaFocus(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_HEADER) { e.preventDefault(); this.navigator.focusChatHeader(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_RELEVANT_MESSAGE) { e.preventDefault(); this.readLatestConversationMessage(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.FOCUS_SEARCH) { e.preventDefault(); this.navigator.focusChatSearch(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.READ_STATUS) { e.preventDefault(); this.navigator.readChatStatus(); }
                if (e.altKey && e.code === Constants.SHORTCUTS.TOGGLE_MONITOR) { e.preventDefault(); this.statusMonitor.toggle(); }
                if (isHelpShortcut) { e.preventDefault(); this.helpDialog.toggle(e.target); }

                // Atalhos para Filtros de Conversa (Ctrl + Shift + 1, 2, 3, 4)
                if (e.ctrlKey && e.shiftKey && this.state.activated) {
                    if (e.code === Constants.SHORTCUTS.FILTER_ALL) { e.preventDefault(); this.navigator.selectChatFilter(0); }
                    if (e.code === Constants.SHORTCUTS.FILTER_UNREAD) { e.preventDefault(); this.navigator.selectChatFilter(1); }
                    if (e.code === Constants.SHORTCUTS.FILTER_GROUPS) { e.preventDefault(); this.navigator.selectChatFilter(2); }
                    if (e.code === Constants.SHORTCUTS.FILTER_CONTACTS) { e.preventDefault(); this.navigator.selectChatFilter(3); }
                }
            });
        }

        async _copyImageAsBinary(imgUrl) {
            this.toast.show("Processando imagem...");
            try {
                const response = await fetch(imgUrl);
                const blob = await response.blob();
                
                // Para garantir que a imagem possa ser colada em qualquer lugar (Word, Paint, etc),
                // o ideal é converter para PNG, que é o formato mais aceito pela Clipboard API.
                let blobToCopy = blob;
                if (blob.type !== 'image/png') {
                    blobToCopy = await this._convertToPng(blob);
                }

                const data = [new ClipboardItem({ [blobToCopy.type]: blobToCopy })];
                await navigator.clipboard.write(data);
                this.toast.show("Imagem copiada!");
            } catch (err) {
                Logger.error("Falha ao copiar imagem binária", err);
                // Fallback para o link se algo der errado (ex: restrição do navegador)
                navigator.clipboard.writeText(imgUrl);
                this.toast.show("Erro ao copiar imagem, link copiado");
            }
        }

        _convertToPng(blob) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob((pngBlob) => {
                        if (pngBlob) resolve(pngBlob);
                        else reject(new Error("Falha na conversão para PNG"));
                    }, 'image/png');
                    URL.revokeObjectURL(img.src);
                };
                img.onerror = (e) => {
                    URL.revokeObjectURL(img.src);
                    reject(e);
                };
                img.src = URL.createObjectURL(blob);
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
                this._syncConversationMessageState();
                const appRoot = document.querySelector(Constants.SELECTORS.app) || document.body;
                // Adiciona observação de atributos para evitar que o React reverta nossas mudanças
                this.mutationObserver.observe(appRoot, { 
                    childList: true, 
                    subtree: true, 
                    attributes: true, 
                    attributeFilter: ['aria-label'] 
                });
                this.statusMonitor.checkAndAttach();
            } else {
                this.toast.show("Acessibilidade Desativada");
                this.mutationObserver.disconnect();
                this.statusMonitor.disconnect();
                this.helpDialog.close();
            }
        }

        _onMutation(mutations) {
            if (!this.state.activated) return;

            // Verifica se precisa reanexar o monitor de status (ex: mudou de conversa)
            this.statusMonitor.checkAndAttach();
            const conversationChanged = this._syncConversationMessageState();

            let shouldAnnounceLatestMessage = false;
            let needsEnhance = false;
            
            mutations.forEach(mutation => {
                // 1. Tratamento de Novos Elementos (ChildList)
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes.length === 0) return;
                    
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;

                        const isMessageRoot = node.matches?.(Constants.SELECTORS.messageList.join(', '));
                        const hasMessageRoot = node.querySelector?.(Constants.SELECTORS.messageList.join(', '));

                        if (isMessageRoot || hasMessageRoot) {
                            shouldAnnounceLatestMessage = true;
                        }
                    });
                    needsEnhance = true;
                }
                
                // 2. Tratamento de Alterações de Atributos (Anti-Reversão do React)
                else if (mutation.type === 'attributes' && mutation.attributeName === 'aria-label') {
                    const target = mutation.target;
                    const newVal = target.getAttribute('aria-label');
                    
                    // Se o novo valor tiver número de telefone (sequência de 4 ou mais dígitos), limpa novamente
                    if (newVal && newVal.match(/\d{4,}/)) {
                        const cleaned = DOMUtils.cleanText(newVal);
                        if (cleaned !== newVal) {
                            target.setAttribute('aria-label', cleaned);
                        }
                    }
                }
            });

            if (conversationChanged) {
                shouldAnnounceLatestMessage = false;
            }

            if (shouldAnnounceLatestMessage) {
                this._scheduleLatestMessageAnnouncement();
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
