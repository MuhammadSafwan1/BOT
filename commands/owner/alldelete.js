const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

// Import settings for owner number
const settings = require('../../settings');
const isOwnerOrSudo = require('../../lib/isOwner');

const messageStore = new Map();
const CONFIG_PATH = path.join(__dirname, '../../data/alldelete.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

// Owner information from settings.js
const OWNER_NUMBER = settings.ownerNumber || '923345216246';
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

// Helper function to download media from view-once
async function downloadViewOnceMedia(mediaMessage, mediaType, messageId) {
    try {
        const stream = await downloadContentFromMessage(mediaMessage, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        let ext = '';
        let filePath = '';
        
        if (mediaType === 'image') {
            ext = 'jpg';
            filePath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
        } else if (mediaType === 'video') {
            ext = 'mp4';
            filePath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
        } else if (mediaType === 'audio') {
            ext = 'mp3';
            filePath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
        }
        
        await writeFile(filePath, buffer);
        return filePath;
    } catch (err) {
        console.error(`Error downloading view-once ${mediaType}:`, err);
        return null;
    }
}

// Helper function to send view-once back to sender
async function sendViewOnceToSender(sock, originalMessage, mediaType, mediaPath, content, sender, chatId) {
    try {
        const senderName = sender.split('@')[0];
        const caption = `*🔐 VIEW-ONCE DETECTED & SAVED* 🔐\n\n<══════════════════>\n\n👤 *Sender:* @${senderName}\n📎 *Type:* ${mediaType.toUpperCase()}\n💬 *Caption:* ${content || 'No caption'}\n\n<══════════════════>\n\n⚠️ *You sent a view-once message*\n📥 *It has been saved and sent back to you*\n\n📞 *Contact Owner:* ${OWNER_NUMBER}\n👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n<══════════════════>`;
        
        const mediaOptions = {
            caption: caption,
            mentions: [sender],
            contextInfo: contextInfo
        };
        
        // Send to the sender's private chat
        const senderJid = sender;
        
        if (mediaType === 'image') {
            await sock.sendMessage(senderJid, { 
                image: { url: mediaPath }, 
                ...mediaOptions 
            });
            console.log(`📸 View-Once image sent back to sender: ${senderName}`);
        } else if (mediaType === 'video') {
            await sock.sendMessage(senderJid, { 
                video: { url: mediaPath }, 
                ...mediaOptions 
            });
            console.log(`🎥 View-Once video sent back to sender: ${senderName}`);
        } else if (mediaType === 'audio') {
            await sock.sendMessage(senderJid, { 
                audio: { url: mediaPath }, 
                mimetype: 'audio/mpeg', 
                ptt: true,
                ...mediaOptions 
            });
            console.log(`🎵 View-Once audio sent back to sender: ${senderName}`);
        }
        
        // Also send a warning to the group (optional - can be removed if you want stealth)
        if (chatId.endsWith('@g.us')) {
            const warningMsg = `🔐 *View-Once Detected*\n\n@${senderName} sent a view-once ${mediaType}.\nIt has been saved automatically.`;
            await sock.sendMessage(chatId, {
                text: warningMsg,
                mentions: [sender],
                contextInfo: contextInfo
            });
        }
        
        return true;
    } catch (err) {
        console.error('Error sending view-once to sender:', err);
        return false;
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
            text: `*🗑️ ALL DELETE RECOVERY SETUP*\n\n<══════════════════>\n\n*Current Status:* ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n*.alldelete on* - Enable auto recovery\n*.alldelete off* - Disable auto recovery\n\n<══════════════════>\n\n📞 *Contact Owner:* ${OWNER_NUMBER}\n👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n<══════════════════>\n\n*Note:* \n✅ Deleted messages will be automatically recovered\n✅ View-once messages will be saved & sent back to sender`,
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
        let isViewOnce = false;
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        // CRITICAL: Check for view-once messages FIRST
        let viewOnceMsg = null;
        
        // Check all possible view-once message structures
        if (message.message?.viewOnceMessageV2?.message) {
            viewOnceMsg = message.message.viewOnceMessageV2.message;
            console.log('🔐 Detected ViewOnceMessageV2');
        } else if (message.message?.viewOnceMessage?.message) {
            viewOnceMsg = message.message.viewOnceMessage.message;
            console.log('🔐 Detected ViewOnceMessage');
        } else if (message.message?.ephemeralMessage?.message?.viewOnceMessageV2?.message) {
            viewOnceMsg = message.message.ephemeralMessage.message.viewOnceMessageV2.message;
            console.log('🔐 Detected Ephemeral ViewOnceMessageV2');
        } else if (message.message?.ephemeralMessage?.message?.viewOnceMessage?.message) {
            viewOnceMsg = message.message.ephemeralMessage.message.viewOnceMessage.message;
            console.log('🔐 Detected Ephemeral ViewOnceMessage');
        }
        
        if (viewOnceMsg) {
            // Check for image in view-once
            if (viewOnceMsg.imageMessage) {
                mediaType = 'image';
                content = viewOnceMsg.imageMessage.caption || '';
                const imgMsg = viewOnceMsg.imageMessage;
                mediaPath = await downloadViewOnceMedia(imgMsg, 'image', messageId);
                if (mediaPath) {
                    isViewOnce = true;
                    console.log(`📸 View-Once image stored: ${messageId}`);
                    
                    // AUTO SEND BACK TO SENDER
                    await sendViewOnceToSender(sock, message, mediaType, mediaPath, content, sender, chatId);
                }
            } 
            // Check for video in view-once
            else if (viewOnceMsg.videoMessage) {
                mediaType = 'video';
                content = viewOnceMsg.videoMessage.caption || '';
                const videoMsg = viewOnceMsg.videoMessage;
                mediaPath = await downloadViewOnceMedia(videoMsg, 'video', messageId);
                if (mediaPath) {
                    isViewOnce = true;
                    console.log(`🎥 View-Once video stored: ${messageId}`);
                    
                    // AUTO SEND BACK TO SENDER
                    await sendViewOnceToSender(sock, message, mediaType, mediaPath, content, sender, chatId);
                }
            }
            // Check for audio in view-once
            else if (viewOnceMsg.audioMessage) {
                mediaType = 'audio';
                content = viewOnceMsg.audioMessage.caption || '';
                const audioMsg = viewOnceMsg.audioMessage;
                mediaPath = await downloadViewOnceMedia(audioMsg, 'audio', messageId);
                if (mediaPath) {
                    isViewOnce = true;
                    console.log(`🎵 View-Once audio stored: ${messageId}`);
                    
                    // AUTO SEND BACK TO SENDER
                    await sendViewOnceToSender(sock, message, mediaType, mediaPath, content, sender, chatId);
                }
            }
        }
        
        // If not view-once, check for normal messages
        if (!isViewOnce) {
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
            }
        }

        // Store only if we have content or media
        if (content || mediaPath) {
            messageStore.set(messageId, {
                content,
                mediaType,
                mediaPath,
                sender,
                group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
                timestamp: new Date().toISOString(),
                isViewOnce: isViewOnce
            });
            console.log(`📝 Message stored: ${messageId}, ViewOnce: ${isViewOnce}`);
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

        const isViewOnce = original.isViewOnce || false;
        console.log(`Is ViewOnce: ${isViewOnce}, MediaType: ${original.mediaType}`);

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
        
        if (isViewOnce) {
            recoverText += `🔐 *VIEW-ONCE MEDIA RECOVERED* 🔐\n\n`;
            recoverText += `<══════════════════>\n\n`;
        }
        
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
        recoverText += `📞 *Contact Owner:* ${OWNER_NUMBER}\n`;
        recoverText += `👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n`;
        recoverText += `<══════════════════>\n\n`;
        
        // Show content only if not deleted by owner and not view-once
        if (!isOwnerDeleter && original.content && !isViewOnce) {
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

        // Send media if exists (including view-once)
        if (original.mediaType && original.mediaPath && fs.existsSync(original.mediaPath)) {
            let mediaCaption = `*🔰 DELETED ${original.mediaType.toUpperCase()} RECOVERED* 🔰\n\n`;
            mediaCaption += `<══════════════════>\n\n`;
            
            if (isViewOnce) {
                mediaCaption += `🔐 *VIEW-ONCE ${original.mediaType.toUpperCase()}* 🔐\n`;
                mediaCaption += `📎 *Recovered as normal media*\n\n`;
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
            mediaCaption += `📞 *Contact Owner:* ${OWNER_NUMBER}\n`;
            mediaCaption += `👨‍💻 *Developer:* ${settings.author || 'S7 SAFWAN'}\n\n`;
            mediaCaption += `<══════════════════>\n\n`;
            
            if (!isOwnerDeleter && original.content && !isViewOnce) {
                mediaCaption += `💬 *Message:* *${original.content}*`;
            } else if (isOwnerDeleter) {
                mediaCaption += `🔒 *Message content hidden (deleted by owner)* 🔒`;
            } else if (isViewOnce && original.content) {
                mediaCaption += `💬 *Caption:* *${original.content}*`;
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
                        break;
                }
            } catch (err) {
                console.error('Media send error:', err);
            }

            // Cleanup
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
    handleAllDeleteCommand,
    handleAllDeleteRevocation,
    storeAllDeleteMessage
}