const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

// Import settings for owner number
const settings = require('../../settings');

const messageStore = new Map();
const CONFIG_PATH = path.join(__dirname, '../../data/alldelete.json');  // Changed from delete.json
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

// Owner information from settings.js
const OWNER_NUMBER = settings.ownerNumber;
const OWNER_JID = OWNER_NUMBER + '@s.whatsapp.net';

// Get all owner numbers from settings for proper checks
const OWNER_NUMBERS = settings.ownerNumbers || [OWNER_NUMBER];
const OWNER_JIDS = OWNER_NUMBERS.map(num => num + '@s.whatsapp.net');

// Context info for forwarded appearance from settings.js
const contextInfo = {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: settings.newsletterJid || '120363419197664425@newsletter',
        newsletterName: settings.botName || 'S7 SAFWAN',
        serverMessageId: -1
    }
};

// Ensure tmp dir exists
if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

// Function to get folder size in MB
const getFolderSizeInMB = (folderPath) => {
    try {
        const files = fs.readdirSync(folderPath);
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
                totalSize += fs.statSync(filePath).size;
            }
        }

        return totalSize / (1024 * 1024);
    } catch (err) {
        console.error('Error getting folder size:', err);
        return 0;
    }
};

// Function to clean temp folder if size exceeds 200MB
const cleanTempFolderIfLarge = () => {
    try {
        const sizeMB = getFolderSizeInMB(TEMP_MEDIA_DIR);
        
        if (sizeMB > 200) {
            const files = fs.readdirSync(TEMP_MEDIA_DIR);
            for (const file of files) {
                const filePath = path.join(TEMP_MEDIA_DIR, file);
                fs.unlinkSync(filePath);
            }
            console.log('🧹 Temp folder cleaned (exceeded 200MB)');
        }
    } catch (err) {
        console.error('Temp cleanup error:', err);
    }
};

// Start periodic cleanup check every 1 minute
setInterval(cleanTempFolderIfLarge, 60 * 1000);

// Load config
function loadAllDeleteConfig() {  // Changed function name
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH));
    } catch {
        return { enabled: false };
    }
}

// Save config
function saveAllDeleteConfig(config) {  // Changed function name
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('Config save error:', err);
    }
}

const isOwnerOrSudo = require('../../lib/isOwner');

// Command Handler - Changed to .alldelete
async function handleAllDeleteCommand(sock, chatId, message, match) {  // Changed function name
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId, { 
            text: '*Only the bot owner can use this command.*',
            contextInfo: contextInfo
        }, { quoted: message });
    }

    const config = loadAllDeleteConfig();  // Updated function call

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*🗑️ ALL DELETE RECOVERY SETUP*\n\n<══════════════════>\n\n*Current Status:* ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n*.alldelete on* - Enable auto recovery\n*.alldelete off* - Disable auto recovery\n\n<══════════════════>\n\n📞 *Contact Owner:* ${OWNER_NUMBER} (Contact Owner To Get Bot)\n👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n<══════════════════>\n\n*Note:* When enabled, deleted messages will be automatically recovered in the same chat!`,
            contextInfo: contextInfo
        }, { quoted: message });
    }

    if (match === 'on') {
        config.enabled = true;
    } else if (match === 'off') {
        config.enabled = false;
    } else {
        return sock.sendMessage(chatId, { 
            text: '*Invalid command. Use .alldelete on/off*',  // Changed command name
            contextInfo: contextInfo
        }, { quoted: message });
    }

    saveAllDeleteConfig(config);  // Updated function call
    return sock.sendMessage(chatId, { 
        text: `*🗑️ All Delete Recovery ${match === 'on' ? 'enabled' : 'disabled'} successfully!*`,
        contextInfo: contextInfo
    }, { quoted: message });
}

// Store incoming messages
async function storeAllDeleteMessage(sock, message) {  // Changed function name
    try {
        const config = loadAllDeleteConfig();  // Updated function call
        if (!config.enabled) return;

        if (!message.key?.id) return;

        const messageId = message.key.id;
        let content = '';
        let mediaType = '';
        let mediaPath = '';
        let isViewOnce = false;
        const chatId = message.key.remoteJid;

        const sender = message.key.participant || message.key.remoteJid;

        // Detect content (including view-once wrappers)
        const viewOnceContainer = message.message?.viewOnceMessageV2?.message || message.message?.viewOnceMessage?.message;
        if (viewOnceContainer) {
            if (viewOnceContainer.imageMessage) {
                mediaType = 'image';
                content = viewOnceContainer.imageMessage.caption || '';
                const buffer = await downloadContentFromMessage(viewOnceContainer.imageMessage, 'image');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
                await writeFile(mediaPath, buffer);
                isViewOnce = true;
            } else if (viewOnceContainer.videoMessage) {
                mediaType = 'video';
                content = viewOnceContainer.videoMessage.caption || '';
                const buffer = await downloadContentFromMessage(viewOnceContainer.videoMessage, 'video');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
                await writeFile(mediaPath, buffer);
                isViewOnce = true;
            }
        } else if (message.message?.conversation) {
            content = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            content = message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage) {
            mediaType = 'image';
            content = message.message.imageMessage.caption || '';
            const buffer = await downloadContentFromMessage(message.message.imageMessage, 'image');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.stickerMessage) {
            mediaType = 'sticker';
            const buffer = await downloadContentFromMessage(message.message.stickerMessage, 'sticker');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.webp`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.videoMessage) {
            mediaType = 'video';
            content = message.message.videoMessage.caption || '';
            const buffer = await downloadContentFromMessage(message.message.videoMessage, 'video');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.audioMessage) {
            mediaType = 'audio';
            const mime = message.message.audioMessage.mimetype || '';
            const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
            const buffer = await downloadContentFromMessage(message.message.audioMessage, 'audio');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
            await writeFile(mediaPath, buffer);
        }

        messageStore.set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
            timestamp: new Date().toISOString()
        });

        // Anti-ViewOnce: recover in same chat immediately
        if (isViewOnce && mediaType && fs.existsSync(mediaPath)) {
            try {
                const senderName = sender.split('@')[0];
                const mediaCaption = `*🔐 VIEW-ONCE RECOVERED* 🔐\n\n<══════════════════>\n\n👤 *Sender:* @${senderName}\n📎 *Type:* ${mediaType}\n\n<══════════════════>\n\n📞 *Contact Owner:* ${OWNER_NUMBER} (Contact Owner To Get Bot)\n👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n<══════════════════>`;
                const mediaOptions = {
                    caption: mediaCaption,
                    mentions: [sender],
                    contextInfo: contextInfo
                };
                
                if (mediaType === 'image') {
                    await sock.sendMessage(chatId, { image: { url: mediaPath }, ...mediaOptions });
                } else if (mediaType === 'video') {
                    await sock.sendMessage(chatId, { video: { url: mediaPath }, ...mediaOptions });
                }
                
                // Cleanup immediately
                try { fs.unlinkSync(mediaPath); } catch {}
            } catch (e) {
                console.error('ViewOnce recover error:', e);
            }
        }

    } catch (err) {
        console.error('storeAllDeleteMessage error:', err);
    }
}

// Handle message deletion - RECOVER IN SAME CHAT
async function handleAllDeleteRevocation(sock, revocationMessage) {  // Changed function name
    try {
        const config = loadAllDeleteConfig();  // Updated function call
        if (!config.enabled) return;

        const protocolMessage = revocationMessage.message?.protocolMessage;
        if (!protocolMessage || protocolMessage.type !== 0) return;

        const deletedMessageId = protocolMessage.key?.id;
        if (!deletedMessageId) return;

        // WHO DELETED THE MESSAGE
        let deletedBy = revocationMessage.key?.participant || 
                        revocationMessage.key?.remoteJid || 
                        protocolMessage.participant ||
                        revocationMessage.participant;
        
        // Get bot number
        const botNumber = sock.user.id.split(':')[0];
        const botJid = botNumber + '@s.whatsapp.net';
        
        // Check if deleter is bot owner (using owner JIDs from settings)
        const isOwnerDeleter = OWNER_JIDS.includes(deletedBy);
        
        // Don't recover if bot deleted
        if (deletedBy === botJid || deletedBy.includes(botNumber)) {
            console.log('Bot deleted message, not recovering');
            return;
        }

        const original = messageStore.get(deletedMessageId);
        if (!original) {
            console.log('Message not found in store:', deletedMessageId);
            return;
        }

        // Where to recover (same group or private chat)
        const recoverChatId = original.group || original.sender;

        // Extract sender info
        const sender = original.sender;
        const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
        const senderName = sender.split('@')[0];
        
        // Extract deleter info
        let deleterNumber = deletedBy.split('@')[0].replace(/[^0-9]/g, '');
        let deleterName = deletedBy.split('@')[0];
        
        // Check if it's self-delete or admin-delete
        const isSelfDelete = (sender === deletedBy);
        
        // Get group name if in group
        let groupName = '';
        if (original.group) {
            try {
                const groupMetadata = await sock.groupMetadata(original.group);
                groupName = groupMetadata.subject;
            } catch (e) {
                groupName = 'Unknown Group';
            }
        }

        // Format time
        const time = new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Karachi',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        let recoverText = `🔰 *DELETED MESSAGE RECOVERED* 🔰\n\n`;
        recoverText += `<══════════════════>\n\n`;
        
        if (isOwnerDeleter) {
            recoverText += `👑 *OWNER DELETED THIS MESSAGE* 👑\n\n`;
            recoverText += `<══════════════════>\n\n`;
            recoverText += `👤 *Original Sender:* @${senderName}\n`;
        } else if (isSelfDelete) {
            recoverText += `⚠️ *${deleterName} deleted their OWN message*\n\n`;
            recoverText += `<══════════════════>\n\n`;
            recoverText += `👤 *Original Sender:* @${senderName}\n`;
        } else {
            recoverText += `🗑️ *Deleted by:* @${deleterName}\n`;
            recoverText += `👤 *Original Sender:* @${senderName}\n`;
        }
        
        if (groupName) {
            recoverText += `👥 *Group:* ${groupName}\n`;
        }
        
        recoverText += `🕐 *Time:* ${time}\n\n`;
        recoverText += `<══════════════════>\n\n`;
        recoverText += `📞 *Contact Owner:* 923345216246 (Contact Owner To Get Bot)\n`;
        recoverText += `👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n`;
        recoverText += `<══════════════════>\n\n`;
        
        // Only show deleted message content if NOT deleted by owner
        if (!isOwnerDeleter && original.content) {
            recoverText += `💬 *Deleted Message:* *${original.content}*`;
        } else if (isOwnerDeleter) {
            recoverText += `🔒 *Message content hidden (deleted by owner)* 🔒`;
        }

        // RECOVER IN SAME CHAT
        await sock.sendMessage(recoverChatId, {
            text: recoverText,
            mentions: [deletedBy, sender],
            contextInfo: contextInfo
        });

        // Send media if exists
        if (original.mediaType && fs.existsSync(original.mediaPath)) {
            let mediaCaption = `*🔰 DELETED ${original.mediaType.toUpperCase()} RECOVERED* 🔰\n\n`;
            mediaCaption += `<══════════════════>\n\n`;
            
            if (isOwnerDeleter) {
                mediaCaption += `👑 *OWNER DELETED THIS MEDIA* 👑\n`;
                mediaCaption += `👤 *Sender:* @${senderName}\n`;
            } else if (isSelfDelete) {
                mediaCaption += `⚠️ *Self Delete by:* @${deleterName}\n`;
                mediaCaption += `👤 *Sender:* @${senderName}\n`;
            } else {
                mediaCaption += `🗑️ *Deleted by:* @${deleterName}\n`;
                mediaCaption += `👤 *Original Sender:* @${senderName}\n`;
            }
            
            if (groupName) {
                mediaCaption += `👥 *Group:* ${groupName}\n`;
            }
            
            mediaCaption += `🕐 *Time:* ${time}\n\n`;
            mediaCaption += `<══════════════════>\n\n`;
            mediaCaption += `📞 *Contact Owner:* 923345216246 (Contact Owner To Get Bot)\n`;
            mediaCaption += `👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n`;
            mediaCaption += `<══════════════════>\n\n`;
            
            // Only show message content if NOT deleted by owner
            if (!isOwnerDeleter && original.content) {
                mediaCaption += `💬 *Message:* *${original.content}*`;
            } else if (isOwnerDeleter) {
                mediaCaption += `🔒 *Message content hidden (deleted by owner)* 🔒`;
            }
            
            const mediaOptions = {
                caption: mediaCaption,
                mentions: [sender, deletedBy],
                contextInfo: contextInfo
            };

            // Still send media even if owner deleted (but without message content)
            try {
                switch (original.mediaType) {
                    case 'image':
                        await sock.sendMessage(recoverChatId, {
                            image: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        break;
                    case 'sticker':
                        await sock.sendMessage(recoverChatId, {
                            sticker: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        break;
                    case 'video':
                        await sock.sendMessage(recoverChatId, {
                            video: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        break;
                    case 'audio':
                        await sock.sendMessage(recoverChatId, {
                            audio: { url: original.mediaPath },
                            mimetype: 'audio/mpeg',
                            ptt: false,
                            ...mediaOptions
                        });
                        break;
                }
            } catch (err) {
                console.error('Media send error:', err);
            }

            // Cleanup media file
            try {
                fs.unlinkSync(original.mediaPath);
            } catch (err) {
                console.error('Media cleanup error:', err);
            }
        }

        messageStore.delete(deletedMessageId);
        console.log(`✅ Deleted message recovered in ${recoverChatId}`);

    } catch (err) {
        console.error('handleAllDeleteRevocation error:', err);
    }
}

module.exports = {
    handleAllDeleteCommand,      // Changed export name
    handleAllDeleteRevocation,   // Changed export name
    storeAllDeleteMessage        // Changed export name
}