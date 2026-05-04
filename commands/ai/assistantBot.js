const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ✅ Your owner number - hardcoded and normalized
const OWNER_NUMBER = '923345216246@s.whatsapp.net';

// ✅ Helper to normalize any number format for comparison
function normalizeJid(jid) {
    if (!jid) return '';
    return jid.includes('@') ? jid.split('@')[0] : jid;
}

// ✅ Check if a chatId belongs to the owner
function isOwner(chatId) {
    return normalizeJid(chatId) === normalizeJid(OWNER_NUMBER);
}

class AIAgent {
    constructor(sock, ownerNumber) {
        this.sock = sock;
        // ✅ Always normalize to full JID format
        this.ownerNumber = ownerNumber.includes('@')
            ? ownerNumber
            : ownerNumber + '@s.whatsapp.net';
        this.autoReplyEnabled = false;
        this.activeSessions = new Map();
        this.pendingApprovals = new Map();
    }

    // ✅ Check ownership using normalized comparison
    isOwnerChat(chatId) {
        return normalizeJid(chatId) === normalizeJid(this.ownerNumber);
    }

    // Simple text to speech using free API
    async textToSpeech(text, chatId) {
        try {
            const response = await axios.get(
                `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`,
                { responseType: 'arraybuffer' }
            );
            const audioPath = path.join(__dirname, 'temp_audio.mp3');
            fs.writeFileSync(audioPath, response.data);
            await this.sock.sendMessage(chatId, {
                audio: { url: audioPath },
                mimetype: 'audio/mp4',
                ptt: true
            });
            fs.unlinkSync(audioPath);
        } catch (error) {
            console.error('TTS Error:', error);
        }
    }

    // Feature 1: Detect real-time messages and notify owner with voice
    async detectAndNotify(message, chatId, senderName) {
        try {
            const text = message.message?.conversation ||
                message.message?.extendedTextMessage?.text ||
                message.message?.audioMessage?.caption;

            if (!text && !message.message?.audioMessage) return;

            // ✅ Use normalized check
            if (this.isOwnerChat(chatId)) return;

            const sender = senderName || normalizeJid(chatId);

            await this.sock.sendPresenceUpdate('composing', this.ownerNumber);

            let notificationText = `🔔 *New Message Alert*\n\n`;
            notificationText += `*From:* ${sender}\n`;
            notificationText += `*Number:* ${chatId}\n`;

            if (message.message?.audioMessage) {
                notificationText += `*Type:* 🎵 Voice Message\n`;
                notificationText += `*Duration:* ${message.message.audioMessage.seconds} seconds\n`;
                notificationText += `*Note:* Voice message received - needs manual listening`;
            } else {
                notificationText += `*Type:* 📝 Text Message\n`;
                notificationText += `*Message:* ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}\n`;
            }

            notificationText += `\n*Time:* ${new Date().toLocaleString()}`;

            await this.sock.sendMessage(this.ownerNumber, {
                text: notificationText,
                contextInfo: {
                    mentionedJid: [chatId],
                    forwardingScore: 1,
                    isForwarded: true
                }
            });

            const voiceText = `Message from ${sender}. ${message.message?.audioMessage ? 'Voice message received' : `Message says: ${text.substring(0, 100)}`}`;
            await this.textToSpeech(voiceText, this.ownerNumber);

            if (!message.message?.audioMessage && text) {
                await this.textToSpeech(`The message content is: ${text.substring(0, 200)}`, this.ownerNumber);
            }

        } catch (error) {
            console.error('Detection Error:', error);
        }
    }

    // Feature 2: Auto reply toggle (owner only)
    async toggleAutoReply(command, chatId) {
        if (command === '.autoreply on') {
            this.autoReplyEnabled = true;
            await this.sock.sendMessage(chatId, {
                text: "✅ Auto-reply feature ACTIVATED\n\nI will now automatically reply to contacts when you're offline."
            });
            return true;
        } else if (command === '.autoreply off') {
            this.autoReplyEnabled = false;
            await this.sock.sendMessage(chatId, {
                text: "❌ Auto-reply feature DEACTIVATED\n\nI will no longer send automatic replies."
            });
            return true;
        }
        return false;
    }

    // Feature 3: Warn contacts about owner being offline and offer assistant
    async offerAssistant(message, chatId, senderName) {
        // ✅ Use normalized check
        if (this.isOwnerChat(chatId)) return false;

        if (this.activeSessions.has(chatId)) return true;
        if (this.pendingApprovals.has(chatId)) return false;

        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text;

        this.pendingApprovals.set(chatId, {
            timestamp: Date.now(),
            message: text
        });

        const warningMessage = `⚠️ *Owner Offline* ⚠️\n\n` +
            `Hello ${senderName || 'there'}! 👋\n\n` +
            `The owner is currently offline/unavailable.\n\n` +
            `Would you like to talk with the owner's AI assistant instead?\n\n` +
            `The assistant can help answer basic questions or take messages.\n\n` +
            `*Reply with:*\n` +
            `• "yes" - to chat with AI assistant\n` +
            `• "no" - to wait for the owner\n` +
            `• "leave" - to cancel`;

        await this.sock.sendMessage(chatId, {
            text: warningMessage,
            contextInfo: {
                mentionedJid: [chatId],
                forwardingScore: 1
            }
        });

        setTimeout(() => {
            if (this.pendingApprovals.has(chatId)) {
                this.pendingApprovals.delete(chatId);
            }
        }, 300000);

        return false;
    }

    // Simple predefined responses
    getSimpleResponse(query) {
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
            return "Hello! How can I help you today?";
        }
        if (lowerQuery.includes('how are you')) {
            return "I'm doing great, thank you for asking! How can I assist you?";
        }
        if (lowerQuery.includes('help')) {
            return "I can help you with:\n- Answering basic questions\n- Taking messages for the owner\n- Providing information\n- Chatting with you until the owner returns\n\nWhat would you like to know?";
        }
        if (lowerQuery.includes('owner') || lowerQuery.includes('when will he')) {
            return "The owner will be notified of your message and will respond as soon as they're available. Is there anything I can help you with in the meantime?";
        }
        if (lowerQuery.includes('message') || lowerQuery.includes('tell owner')) {
            return "I'll make sure to pass your message to the owner. Please go ahead and type your message, and I'll forward it.";
        }
        if (lowerQuery.includes('thank')) {
            return "You're welcome! Is there anything else I can help you with?";
        }
        if (lowerQuery.includes('bye') || lowerQuery.includes('goodbye')) {
            return "Goodbye! Have a great day! The owner will be notified of our conversation.";
        }

        return "I'm a basic assistant. I'll make sure to forward your message to the owner. Is there anything specific you'd like me to help with?";
    }

    // Handle user response to assistant offer
    async handleAssistantResponse(message, chatId, response) {
        const lowerResponse = response.toLowerCase().trim();

        if (!this.pendingApprovals.has(chatId)) return false;

        if (lowerResponse === 'yes') {
            this.activeSessions.set(chatId, {
                startTime: Date.now(),
                lastMessage: Date.now(),
                conversation: []
            });
            this.pendingApprovals.delete(chatId);

            await this.sock.sendMessage(chatId, {
                text: "🤖 *AI Assistant Activated* 🤖\n\n" +
                    "Hello! I'm the owner's AI assistant. How can I help you today?\n\n" +
                    "I can:\n" +
                    "• Answer basic questions\n" +
                    "• Take messages for the owner\n" +
                    "• Chat with you until the owner returns\n\n" +
                    "Just send me your message and I'll respond!\n\n" +
                    "_Type 'end' to stop talking with assistant_"
            });
            return true;

        } else if (lowerResponse === 'no') {
            const pendingData = this.pendingApprovals.get(chatId);
            this.pendingApprovals.delete(chatId);

            await this.sock.sendMessage(chatId, {
                text: "👍 No problem! The owner will respond when they come online.\n\n" +
                    "Your message has been saved and will be delivered."
            });

            if (pendingData && pendingData.message) {
                await this.sock.sendMessage(this.ownerNumber, {
                    text: `📨 *Message from ${chatId}*\n\nUser declined AI assistant and is waiting for you.\n\nOriginal message: ${pendingData.message}`
                });
            }
            return true;

        } else if (lowerResponse === 'leave') {
            this.pendingApprovals.delete(chatId);
            await this.sock.sendMessage(chatId, {
                text: "👋 Conversation cancelled. Have a great day!"
            });
            return true;
        }

        return false;
    }

    // Process messages in active sessions
    async processActiveSession(message, chatId, query) {
        if (!this.activeSessions.has(chatId)) return false;

        const session = this.activeSessions.get(chatId);
        session.lastMessage = Date.now();
        session.conversation.push({ role: 'user', content: query });

        if (query.toLowerCase() === 'end') {
            const conversationSummary = session.conversation.map(msg =>
                `${msg.role}: ${msg.content}`
            ).join('\n');

            this.activeSessions.delete(chatId);

            await this.sock.sendMessage(chatId, {
                text: "👋 Assistant session ended. The owner will be notified of your conversation.\n\nHave a great day!"
            });

            await this.sock.sendMessage(this.ownerNumber, {
                text: `📋 *Conversation with ${chatId}*\n\n${conversationSummary}\n\nSession duration: ${Math.round((Date.now() - session.startTime) / 60000)} minutes`
            });

            return true;
        }

        await this.sock.sendPresenceUpdate('composing', chatId);
        const aiResponse = this.getSimpleResponse(query);

        session.conversation.push({ role: 'assistant', content: aiResponse });

        await this.sock.sendMessage(chatId, {
            text: `🤖 *Assistant:*\n\n${aiResponse}`,
            contextInfo: {
                forwardingScore: 0,
                isForwarded: false
            }
        });

        return true;
    }

    // Auto reply to messages when feature is enabled
    async autoReplyToMessages(message, chatId, query) {
        if (!this.autoReplyEnabled) return false;
        // ✅ Use normalized check
        if (this.isOwnerChat(chatId)) return false;

        const autoMessage = `📱 *Auto-Reply*\n\n` +
            `The owner is currently offline.\n\n` +
            `Your message: "${query.substring(0, 100)}"\n\n` +
            `The owner will get back to you as soon as possible.\n\n` +
            `_Type "assistant" to talk with AI assistant immediately_`;

        await this.sock.sendMessage(chatId, {
            text: autoMessage
        });

        await this.sock.sendMessage(this.ownerNumber, {
            text: `📨 *Auto-reply sent to ${chatId}*\n\nOriginal message: ${query}\n\nTime: ${new Date().toLocaleString()}`
        });

        return true;
    }
}

// ✅ Main handler — owner number hardcoded and normalized
async function aiCommand(sock, chatId, message, ownerNumber) {
    try {
        // ✅ Always use the hardcoded owner number, normalized to full JID
        const resolvedOwner = OWNER_NUMBER;
        const agent = new AIAgent(sock, resolvedOwner);

        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text;

        const senderName = message.pushName || normalizeJid(chatId);

        // ✅ Normalized ownership check — works regardless of @s.whatsapp.net or not
        const ownerChat = normalizeJid(chatId) === normalizeJid(resolvedOwner);

        // Auto-reply toggle — owner only
        if (text && (text.startsWith('.autoreply on') || text.startsWith('.autoreply off'))) {
            if (ownerChat) {
                await agent.toggleAutoReply(text, chatId);
            } else {
                await sock.sendMessage(chatId, {
                    text: "❌ Only the owner can control auto-reply settings."
                });
            }
            return;
        }

        // Feature 1: Notify owner of incoming messages
        if (!ownerChat && text) {
            await agent.detectAndNotify(message, chatId, senderName);
        }

        let isAssistantActive = false;

        // Check if in active assistant session
        if (agent.activeSessions.has(chatId) && text) {
            isAssistantActive = await agent.processActiveSession(message, chatId, text);
        }

        // Check if this is a response to assistant offer
        if (!isAssistantActive && text && agent.pendingApprovals.has(chatId)) {
            const handled = await agent.handleAssistantResponse(message, chatId, text);
            if (handled) return;
        }

        // If no session and no pending, offer assistant
        if (!isAssistantActive && !ownerChat && text && !agent.pendingApprovals.has(chatId)) {
            if (!text.startsWith('.') && text.length > 2) {
                await agent.offerAssistant(message, chatId, senderName);
                return;
            }
        }

        // Feature 2: Auto reply if enabled
        if (agent.autoReplyEnabled && !isAssistantActive && !ownerChat && text) {
            await agent.autoReplyToMessages(message, chatId, text);
        }

    } catch (error) {
        console.error('AI Agent Error:', error);
        try {
            await sock.sendMessage(chatId, {
                text: "❌ An error occurred in the AI agent system. Please try again later."
            });
        } catch (err) {
            console.error('Failed to send error message:', err);
        }
    }
}

module.exports = aiCommand;