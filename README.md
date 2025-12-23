# WhatsWeb - Acessibilidade Aprimorada 🚀

Este script (userscript) foi desenvolvido para tornar o **WhatsApp Web** mais acessível e produtivo, especialmente para usuários de leitores de tela (como NVDA, JAWS e VoiceOver) e navegação por teclado.

Ele transforma a experiência de uso, adicionando atalhos diretos, corrigindo falhas de leitura e fornecendo feedback sonoro e falado para novas mensagens.

## ✨ Principais Funcionalidades

*   **Leitura Automática:** Lê o nome do remetente e o conteúdo de novas mensagens assim que elas chegam na **conversa aberta**, ignorando notificações de outros contatos em segundo plano.
*   **Feedback de Envio:** Lê automaticamente as mensagens que **você envia** (ex: "Enviada: Olá!"), confirmando o conteúdo.
*   **Filtro Inteligente:** Remove números de telefone da leitura (ex: "+55 11...") para focar apenas no nome e na mensagem.
*   **Notificação Sonora:** Toca um "ding" suave quando chega uma nova mensagem na conversa ativa.
*   **Navegação Rápida:** Atalhos de teclado para pular instantaneamente entre a lista de conversas e o campo de mensagem.
*   **Correção de Foco:** Garante que o foco vá para a conversa correta ou para a última mensagem recebida.
*   **Leitura de Status:** Permite ler rapidamente o status do contato (Online, Visto por último, Digitando...).
*   **Acessibilidade Forçada:** Adiciona etiquetas (`aria-label`) em botões e mensagens que o WhatsApp nativo esquece de etiquetar (como áudios e mensagens de erro).

---

## ⌨️ Teclas de Atalho (Comandos)

| Atalho | Função |
| :--- | :--- |
| **Alt + S** | **Ligar/Desligar** o script. (Use se precisar desativar temporariamente). |
| **Alt + 1** | Foca na **Lista de Conversas**. Se já houver uma selecionada, foca nela. |
| **Alt + 2** | Foca no **Campo de Digitação**. Se já estiver nele, foca na **Lista de Mensagens**. |
| **Alt + V** | Lê o **Status** do contato atual (Ex: "Visto hoje às...", "Online"). |

---

## ⌨️ Atalhos Nativos do WhatsApp Web

Para sua conveniência, aqui estão os principais atalhos já existentes no WhatsApp Web que você pode usar em conjunto com este script:

| Atalho | Função |
| :--- | :--- |
| **Alt + I** | Abrir informações da conversa |
| **Alt + R** | Responder mensagem |
| **Alt + A** | Abrir menu de anexos |
| **Alt + P** | Pausar gravação de áudio |
| **Alt + 8** | Favoritar mensagem |
| **Alt + K** | Pesquisa estendida |
| **Shift + .** | Aumentar velocidade do áudio |
| **Shift + ,** | Diminuir velocidade do áudio |
| **Ctrl + Alt + /** | Pesquisar (Geral) |
| **Ctrl + Shift + F** | Pesquisar na conversa |
| **Ctrl + Alt + N** | Nova conversa |
| **Ctrl + Enter** | Enviar áudio (PTT) |
| **Escape** | Fechar conversa / Sair de menus |

---

## 🛠️ Como Instalar

1.  Instale a extensão **Tampermonkey** no seu navegador (Chrome, Edge, Firefox).
2.  [Clique aqui para instalar o script](https://github.com/brunowelber/whatsWeb/raw/refs/heads/main/whatsWeb.user.js).
3.  O Tampermonkey abrirá uma aba de confirmação. Clique em **Instalar**.
4.  Abra o [WhatsApp Web](https://web.whatsapp.com) e pressione **Alt + S** para ativar. Você ouvirá "Acessibilidade Ativada".

---

## 💡 Dicas de Uso

*   **Para navegar nas mensagens:** Use **Alt + 2** duas vezes. A primeira foca no campo de texto, a segunda joga o foco para a última mensagem recebida. Depois use as setas para cima/baixo.
*   **Mensagens "não carregadas":** Se aparecer aquela mensagem de "Aguardando mensagem...", o script tentará ler o conteúdo assim que ele estiver disponível.
*   **Grupos:** Em grupos, o script lê quem mandou a mensagem antes do texto, facilitando saber quem está falando sem precisar navegar.

---

## 👨‍💻 Créditos

*   **Autor:** Bruno Welber
*   **Baseado no trabalho original de:** Juliano Lopes
*   **Licença:** MIT

---

*Este projeto é open-source e feito pela comunidade para a comunidade. Feedback e sugestões são bem-vindos!*