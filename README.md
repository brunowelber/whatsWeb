# WhatsWeb - Acessibilidade Aprimorada 🚀

Este script (userscript) foi desenvolvido para tornar o **WhatsApp Web** mais acessível e produtivo, especialmente para usuários de leitores de tela (como NVDA, JAWS e VoiceOver) e navegação por teclado.

Ele transforma a experiência de uso, adicionando atalhos diretos, corrigindo falhas de leitura e fornecendo feedback sonoro e falado para novas mensagens.

## ✨ Principais Funcionalidades

*   **Leitura Automática:** Lê o nome do remetente e o conteúdo de novas mensagens assim que elas chegam na **conversa aberta**, ignorando notificações de outros contatos em segundo plano.
*   **Monitor de Status (Novo):** Anuncia automaticamente quando o contato está **"Digitando..."**, **"Gravando áudio..."** ou fica **"Online"**. O anúncio é educado (polite) e não interrompe se você estiver lendo outra coisa.
*   **Filtro de Ruído:** Remove automaticamente números de telefone (ex: "+55 11...") da leitura, focando apenas no nome do contato e no conteúdo.
*   **Correção de Navegação:** Resolve bugs onde o foco se perde ao sair da lista de conversas.
*   **Menu de Contexto:** Permite abrir o menu de opções da mensagem (Responder, Apagar, Dados) usando a tecla **Applications** (ou Menu Contextual) do teclado.
*   **Feedback Sonoro:** Toca um "ding" suave quando chega uma nova mensagem na conversa ativa.

---

## ⌨️ Teclas de Atalho do Script

| Atalho | Função |
| :--- | :--- |
| **Alt + S** | **Ligar/Desligar** o script geral. |
| **Alt + 1** | Foca na **Lista de Conversas**. Tenta recuperar a última conversa ativa. |
| **Alt + 2** | Alterna entre o **Campo de Digitação** e a **Lista de Mensagens**. |
| **Alt + V** | Lê o **Status** atual do contato (Ex: "Visto hoje às 14:00"). |
| **Alt + A** | Abre o menu de **Anexos** (Fotos, Documentos, etc.) e foca nos itens. |
| **Alt + O** | **Ligar/Desligar** o Monitoramento Automático de Status (Digitando/Online). |
| **Applications** | Abre o menu de opções da mensagem focada (Responder, Apagar...). |

---

## ⌨️ Atalhos Nativos do WhatsApp Web

Para sua conveniência, aqui estão os atalhos padrão do WhatsApp que funcionam bem em conjunto:

| Atalho | Função |
| :--- | :--- |
| **Ctrl + Alt + /** | Pesquisar conversas |
| **Ctrl + Alt + N** | Nova conversa |
| **Ctrl + Alt + P** | Perfil e recado |
| **Ctrl + Alt + ,** | Configurações |
| **Ctrl + Alt + Shift + /** | Atalhos de teclado (Lista oficial) |
| **Escape** | Fechar conversa / Sair de menus |

---

## 🛠️ Como Instalar

1.  Instale a extensão **Tampermonkey** no seu navegador (Chrome, Edge, Firefox).
2.  [Clique aqui para instalar o script](https://github.com/brunowelber/whatsWeb/raw/refs/heads/main/whatsWeb.user.js).
3.  O Tampermonkey abrirá uma aba de confirmação. Clique em **Instalar**.
4.  Abra o [WhatsApp Web](https://web.whatsapp.com) e pressione **Alt + S** para ativar. Você ouvirá "Acessibilidade Ativada".

---

## 💡 Dicas de Uso

*   **Monitor de Status:** Se estiver em um grupo muito movimentado, você pode desligar os avisos de "Digitando..." pressionando **Alt + O**.
*   **Navegação:** Use **Alt + 2** duas vezes. A primeira foca no campo de texto, a segunda joga o foco para a última mensagem recebida. Depois use as setas para cima/baixo.
*   **Mensagens "não carregadas":** Se aparecer aquela mensagem de "Aguardando mensagem...", o script tentará ler o conteúdo assim que ele estiver disponível.

---

## 👨‍💻 Créditos

*   **Autor:** Bruno Welber
*   **Baseado no trabalho original de:** Juliano Lopes
*   **Licença:** MIT

---

*Este projeto é open-source e feito pela comunidade para a comunidade. Feedback e sugestões são bem-vindos!*
