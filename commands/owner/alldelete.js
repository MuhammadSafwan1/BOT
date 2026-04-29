const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

// Import settings for owner number
const settings = require('../../settings');

const messageStore = new Map();
const CONFIG_PATH = path.join(__dirname, '../../data/alldelete.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

// Owner information from settings.js (no default value)
const OWNER_NUMBER = settings.ownerNumber;
const OWNER_JID = OWNER_NUMBER ? OWNER_NUMBER + '@s.whatsapp.net' : '';

// Get all owner numbers from settings for proper checks
const OWNER_NUMBERS = settings.ownerNumbers || [];
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

// Function to get file extension from mimetype
function getFileExtension(mimetype) {
    const extensions = {
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-rar': 'rar',
    'application/vnd.rar': 'rar',
    'application/vnd.android.package-archive': 'apk',
    'application/x-apk': 'apk',
    'application/vnd.xapk': 'xapk',
    'application/x-xapk-package': 'xapk',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'application/json': 'json',
    'application/xml': 'xml',
    'text/xml': 'xml',
    'application/javascript': 'js',
    'text/css': 'css',
    'text/html': 'html',
    'application/x-httpd-php': 'php',
    'application/x-python-code': 'py',
    'application/x-java-archive': 'jar',
    'application/x-7z-compressed': '7z',
    'application/x-tar': 'tar',
    'application/gzip': 'gz',
    'application/x-bzip2': 'bz2',
    'application/x-iso9660-image': 'iso',
    'application/x-msi': 'msi',
    'application/x-msdownload': 'exe',
    'application/x-shockwave-flash': 'swf',
    'application/x-www-form-urlencoded': 'url',
    'text/plain': 'bat',        
    'application/x-bat': 'bat', 
    'application/octet-stream': 'file'  // Keep as fallback
};
    return extensions[mimetype] || 'file';
}

// Load config
function loadAllDeleteConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH));
    } catch {
        return { enabled: false };
    }
}

// Save config
function saveAllDeleteConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('Config save error:', err);
    }
}

// Command Handler
async function handleAllDeleteCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId, { 
            text: '*Only the bot owner can use this command.*',
            contextInfo: contextInfo
        }, { quoted: message });
    }

    const config = loadAllDeleteConfig();

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*🗑️ ALL DELETE RECOVERY SETUP*\n\n<══════════════════>\n\n*Current Status:* ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n*.alldelete on* - Enable auto recovery\n*.alldelete off* - Disable auto recovery\n\n<══════════════════>\n\n📞 *Contact Owner:* +92 3345216246\n👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n<══════════════════>\n\n*Note:* \n✅ Deleted messages will be automatically recovered\n✅ Supports: Images, Videos, Audio, Stickers, Documents (PDF, RAR, ZIP, APK, XAPK, Word, Excel, PPT, TXT, etc.)`,
            contextInfo: contextInfo
        }, { quoted: message });
    }

    if (match === 'on') {
        config.enabled = true;
    } else if (match === 'off') {
        config.enabled = false;
    } else {
        return sock.sendMessage(chatId, { 
            text: '*Invalid command. Use .alldelete on/off*',
            contextInfo: contextInfo
        }, { quoted: message });
    }

    saveAllDeleteConfig(config);
    return sock.sendMessage(chatId, { 
        text: `*🗑️ All Delete Recovery ${match === 'on' ? 'enabled' : 'disabled'} successfully!*`,
        contextInfo: contextInfo
    }, { quoted: message });
}

// Store incoming messages
async function storeAllDeleteMessage(sock, message) {
    try {
        const config = loadAllDeleteConfig();
        if (!config.enabled) return;
        if (!message.key?.id) return;

        const messageId = message.key.id;
        let content = '';
        let mediaType = '';
        let mediaPath = '';
        let fileName = '';
        let mimetype = '';
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        // Check for normal messages
        if (message.message?.conversation) {
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
        } else if (message.message?.documentMessage) {
            mediaType = 'document';
            const docMsg = message.message.documentMessage;
            content = docMsg.caption || '';
            mimetype = docMsg.mimetype || 'application/octet-stream';
            fileName = docMsg.fileName || `document_${messageId}`;
            
            // Get extension from mimetype or filename
            let ext = getFileExtension(mimetype);
            if (ext === 'file' && fileName.includes('.')) {
                ext = fileName.split('.').pop();
            }
            
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
            const buffer = await downloadContentFromMessage(docMsg, 'document');
            await writeFile(mediaPath, buffer);
            console.log(`📄 Document stored: ${fileName} (${mimetype})`);
        } else if (message.message?.documentWithCaptionMessage?.message?.documentMessage) {
            mediaType = 'document';
            const docMsg = message.message.documentWithCaptionMessage.message.documentMessage;
            content = docMsg.caption || '';
            mimetype = docMsg.mimetype || 'application/octet-stream';
            fileName = docMsg.fileName || `document_${messageId}`;
            
            let ext = getFileExtension(mimetype);
            if (ext === 'file' && fileName.includes('.')) {
                ext = fileName.split('.').pop();
            }
            
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
            const buffer = await downloadContentFromMessage(docMsg, 'document');
            await writeFile(mediaPath, buffer);
            console.log(`📄 Document stored: ${fileName} (${mimetype})`);
        }

        // Store only if we have content or media
        if (content || mediaPath) {
            messageStore.set(messageId, {
                content,
                mediaType,
                mediaPath,
                fileName,
                mimetype,
                sender,
                group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
                timestamp: new Date().toISOString()
            });
            console.log(`📝 Message stored: ${messageId} (Type: ${mediaType || 'text'})`);
        }

    } catch (err) {
        console.error('storeAllDeleteMessage error:', err);
    }
}

// Handle message deletion - RECOVER IN SAME CHAT
async function handleAllDeleteRevocation(sock, revocationMessage) {
    try {
        const config = loadAllDeleteConfig();
        if (!config.enabled) return;

        const protocolMessage = revocationMessage.message?.protocolMessage;
        if (!protocolMessage || protocolMessage.type !== 0) return;

        const deletedMessageId = protocolMessage.key?.id;
        if (!deletedMessageId) return;

        console.log(`🔄 Message deletion detected: ${deletedMessageId}`);

        // WHO DELETED THE MESSAGE
        let deletedBy = revocationMessage.key?.participant || 
                        revocationMessage.key?.remoteJid || 
                        protocolMessage.participant ||
                        revocationMessage.participant;
        
        // Clean the JID for comparison
        const cleanDeletedBy = deletedBy.split('@')[0].replace(/[^0-9]/g, '');
        const cleanOwnerNumber = OWNER_NUMBER.replace(/[^0-9]/g, '');
        
        // Check if deleter is bot owner
        const isOwnerDeleter = (cleanDeletedBy === cleanOwnerNumber);
        
        console.log(`🔍 Deleted by: ${cleanDeletedBy}, IsOwner: ${isOwnerDeleter}`);
        
        const botNumber = sock.user.id.split(':')[0];
        const botJid = botNumber + '@s.whatsapp.net';
        
        if (deletedBy === botJid || deletedBy.includes(botNumber)) {
            console.log('Bot deleted message, not recovering');
            return;
        }

        const original = messageStore.get(deletedMessageId);
        if (!original) {
            console.log('Message not found in store:', deletedMessageId);
            return;
        }

        const recoverChatId = original.group || original.sender;
        const sender = original.sender;
        const senderName = sender.split('@')[0];
        const deleterName = deletedBy.split('@')[0];
        const isSelfDelete = (sender === deletedBy);
        
        let groupName = '';
        if (original.group) {
            try {
                const groupMetadata = await sock.groupMetadata(original.group);
                groupName = groupMetadata.subject;
            } catch (e) {
                groupName = 'Unknown Group';
            }
        }

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
        recoverText += `📞 *Contact Owner:* +92 3345216246\n`;
        recoverText += `👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n`;
        recoverText += `<══════════════════>\n\n`;
        
        // Show content only if not deleted by owner
        if (!isOwnerDeleter && original.content) {
            recoverText += `💬 *Deleted Message:* *${original.content}*`;
        } else if (isOwnerDeleter) {
            recoverText += `🔒 *Message content hidden (deleted by owner)* 🔒`;
        }

        // Send recovery message
        await sock.sendMessage(recoverChatId, {
            text: recoverText,
            mentions: [deletedBy, sender],
            contextInfo: contextInfo
        });

        // Send media if exists
        if (original.mediaType && original.mediaPath && fs.existsSync(original.mediaPath)) {
            let mediaCaption = `*🔰 DELETED ${original.mediaType.toUpperCase()} RECOVERED* 🔰\n\n`;
            mediaCaption += `<══════════════════>\n\n`;
            
            if (original.mediaType === 'document' && original.fileName) {
                mediaCaption += `📄 *File Name:* ${original.fileName}\n`;
                if (original.mimetype) {
                    mediaCaption += `📎 *Type:* ${original.mimetype}\n`;
                }
                mediaCaption += `<══════════════════>\n\n`;
            }
            
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
            mediaCaption += `📞 *Contact Owner:* +92 3345216246\n`;
            mediaCaption += `👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n`;
            mediaCaption += `<══════════════════>\n\n`;
            
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

            try {
                switch (original.mediaType) {
                    case 'image':
                        await sock.sendMessage(recoverChatId, { 
                            image: { url: original.mediaPath }, 
                            ...mediaOptions 
                        });
                        console.log(`✅ Image recovered successfully`);
                        break;
                    case 'sticker':
                        await sock.sendMessage(recoverChatId, { 
                            sticker: { url: original.mediaPath }, 
                            ...mediaOptions 
                        });
                        console.log(`✅ Sticker recovered successfully`);
                        break;
                    case 'video':
                        await sock.sendMessage(recoverChatId, { 
                            video: { url: original.mediaPath }, 
                            ...mediaOptions 
                        });
                        console.log(`✅ Video recovered successfully`);
                        break;
                    case 'audio':
                        await sock.sendMessage(recoverChatId, { 
                            audio: { url: original.mediaPath }, 
                            mimetype: 'audio/mpeg', 
                            ptt: false, 
                            ...mediaOptions 
                        });
                        console.log(`✅ Audio recovered successfully`);
                        break;
                    case 'document':
                        await sock.sendMessage(recoverChatId, { 
                            document: { url: original.mediaPath },
                            fileName: original.fileName || 'document',
                            mimetype: original.mimetype || 'application/octet-stream',
                            ...mediaOptions 
                        });
                        console.log(`✅ Document recovered successfully: ${original.fileName}`);
                        break;
                }
            } catch (err) {
                console.error('Media send error:', err);
            }

            // Cleanup
            try { 
                fs.unlinkSync(original.mediaPath); 
                console.log(`🧹 Cleaned up temp file: ${original.mediaPath}`);
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
    handleAllDeleteCommand,
    handleAllDeleteRevocation,
    storeAllDeleteMessage
}