class N8NAIChat {
    constructor() {
        this.apiUrl = 'https://iammarkiz.app.n8n.cloud/webhook-test/webhook/chat'; // Изменено на локальный адрес
        this.isConnected = false;
        this.currentChat = null;
        this.chats = new Map();
        this.messageCounter = 0;
        
        this.init();
    }
    
    init() {
        this.initElements();
        this.initEventListeners();
        this.createNewChat();
        this.testConnection();
    }
    
    initElements() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.chatHistory = document.getElementById('chatHistory');
        this.currentChatTitle = document.getElementById('currentChatTitle');
        
        this.newChatBtn = document.getElementById('newChatBtn');
        this.menuToggle = document.getElementById('menuToggle');
    }
    
    initEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 200) + 'px';
        });
        
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        
        this.menuToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }
    
    createNewChat() {
        const chatId = 'chat_' + Date.now();
        this.currentChat = {
            id: chatId,
            title: 'Новый чат',
            messages: [],
            createdAt: new Date()
        };
        
        this.chats.set(chatId, this.currentChat);
        this.updateChatList();
        this.clearMessages();
        this.currentChatTitle.textContent = 'Новый чат';
    }
    
    updateChatList() {
        this.chatHistory.innerHTML = '';
        
        this.chats.forEach((chat, id) => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${id === this.currentChat.id ? 'active' : ''}`;
            chatItem.innerHTML = `
                <div class="chat-item-title">${chat.title}</div>
                <div class="chat-item-preview">${chat.messages[0]?.text?.substring(0, 30) || 'Нет сообщений'}...</div>
            `;
            
            chatItem.addEventListener('click', () => this.switchChat(id));
            this.chatHistory.appendChild(chatItem);
        });
    }
    
    switchChat(chatId) {
        this.currentChat = this.chats.get(chatId);
        this.clearMessages();
        this.currentChatTitle.textContent = this.currentChat.title;
        
        this.currentChat.messages.forEach(msg => {
            this.addMessage(msg.sender, msg.text);
        });
        
        this.updateChatList();
        this.scrollToBottom();
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        
        this.addMessage('user', message);
        
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        const loadingId = this.showTypingIndicator();
        
        try {
            const response = await this.sendToN8N(message);
            
            this.removeTypingIndicator(loadingId);
            
            this.addMessage('ai', response);
            
            this.saveToChatHistory('user', message);
            this.saveToChatHistory('ai', response);
            
            this.updateConnectionStatus(true);
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.removeTypingIndicator(loadingId);
            
            this.addMessage('ai', `Ошибка: ${error.message}. Проверьте настройки n8n workflow.`);
            
            this.updateConnectionStatus(false);
            
        } finally {
            this.messageInput.disabled = false;
            this.sendBtn.disabled = false;
            this.messageInput.focus();
        }
    }
    
    async sendToN8N(message) {
        const payload = {
            message: message,
            chatId: this.currentChat.id,
            timestamp: new Date().toISOString(),
            messageId: 'msg_' + Date.now()
        };
        
        console.log('Отправка запроса на:', this.apiUrl);
        console.log('Данные:', payload);
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(30000)
            });
            
            console.log('Статус ответа:', response.status);
            
            if (!response.ok) {
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch (e) {
                    errorText = 'Не удалось прочитать ответ';
                }
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            console.log('Ответ от n8n:', data);
            
            return data.reply || 
                   data.choices?.[0]?.message?.content ||
                   data.response ||
                   data.text ||
                   JSON.stringify(data);
            
        } catch (error) {
            console.error('Ошибка сети:', error);
            
            if (error.name === 'TimeoutError') {
                throw new Error('Таймаут запроса (30 секунд)');
            }
            
            if (error.message.includes('CORS')) {
                throw new Error('CORS ошибка. Проверьте заголовки в n8n');
            }
            
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Не удалось подключиться к серверу n8n');
            }
            
            throw error;
        }
    }
    
    addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${sender}`;
        
        const time = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const senderName = sender === 'user' ? 'Вы' : 'AI Assistant';
        const avatar = sender === 'user' ? 'U' : 'AI';
        
        const formattedText = this.formatMessage(text);
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${senderName}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${formattedText}</div>
            </div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        
        if (this.isAtBottom()) {
            this.scrollToBottom();
        }
        
        if (sender === 'user' && this.currentChat.title === 'Новый чат') {
            this.currentChat.title = text.length > 30 ? 
                text.substring(0, 30) + '...' : text;
            this.currentChatTitle.textContent = this.currentChat.title;
            this.updateChatList();
        }
    }
    
    formatMessage(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>');
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message message-ai';
        typingDiv.id = 'typing-indicator';
        
        typingDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">AI Assistant</span>
                </div>
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        this.messagesContainer.appendChild(typingDiv);
        
        if (this.isAtBottom()) {
            this.scrollToBottom();
        }
        
        return 'typing-indicator';
    }
    
    removeTypingIndicator(id) {
        const indicator = document.getElementById(id);
        if (indicator) {
            indicator.remove();
        }
    }
    
    clearMessages() {
        const messages = this.messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        
        this.messagesContainer.scrollTop = 0;
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    isAtBottom() {
        const container = this.messagesContainer;
        const tolerance = 100;
        
        return container.scrollTop + container.clientHeight >= container.scrollHeight - tolerance;
    }
    
    saveToChatHistory(sender, text) {
        if (this.currentChat) {
            this.currentChat.messages.push({
                sender: sender,
                text: text,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    async testConnection() {
        console.log('Тестирование соединения с:', this.apiUrl);
        
        try {
            const payload = {
                message: "Тестовое сообщение для проверки соединения",
                chatId: "test_" + Date.now(),
                timestamp: new Date().toISOString()
            };
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Тест успешен:', data);
                this.updateConnectionStatus(true);
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.error('Тест не пройден:', error);
            this.updateConnectionStatus(false);
            return false;
        }
    }
    
    updateConnectionStatus(connected) {
        this.isConnected = connected;
        
        if (connected) {
            this.messageInput.placeholder = 'Введите сообщение для ИИ...';
            this.sendBtn.disabled = false;
        } else {
            this.messageInput.placeholder = 'Подключитесь к n8n для начала общения';
            this.sendBtn.disabled = true;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new N8NAIChat();
});
