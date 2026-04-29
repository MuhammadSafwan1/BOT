const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

const messageStore = new Map();
const CONFIG_PATH = path.join(__dirname, '../../data/antidelete.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

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
function loadAntideleteConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH));
    } catch {
        return { enabled: false };
    }
}

// Save config
function saveAntideleteConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('Config save error:', err);
    }
}

const isOwnerOrSudo = require('../../lib/isOwner');

// Command Handler
async function handleAntideleteCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId, { text: '*Only the bot owner can use this command.*' }, { quoted: message });
    }

    const config = loadAntideleteConfig();

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*🔰 ANTIDELETE SETUP* 🔰\n\n*Current Status:* ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n*.antidelete on* - Enable auto recovery\n*.antidelete off* - Disable auto recovery\n\n*Features:*\n• 📝 Text messages recovery\n• 📸 Image/Video recovery\n• 🔐 View-Once recovery (original state)\n• 🎵 Audio/Sticker recovery\n• 📄 Document/File recovery (including .bat files)\n\n*Reports sent to owner only!*`
        }, { quoted: message });
    }

    if (match === 'on') {
        config.enabled = true;
    } else if (match === 'off') {
        config.enabled = false;
    } else {
        return sock.sendMessage(chatId, { text: '*Invalid command. Use .antidelete on/off*' }, { quoted: message });
    }

    saveAntideleteConfig(config);
    return sock.sendMessage(chatId, { text: `*✅ Antidelete ${match === 'on' ? 'enabled' : 'disabled'} successfully!*` }, { quoted: message });
}

// Store incoming messages
async function storeMessage(sock, message) {
    try {
        const config = loadAntideleteConfig();
        if (!config.enabled) return;

        if (!message.key?.id) return;

        const messageId = message.key.id;
        let content = '';
        let mediaType = '';
        let mediaPath = '';
        let isViewOnce = false;

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
                console.log(`📸 View-Once image stored: ${messageId}`);
            } else if (viewOnceContainer.videoMessage) {
                mediaType = 'video';
                content = viewOnceContainer.videoMessage.caption || '';
                const buffer = await downloadContentFromMessage(viewOnceContainer.videoMessage, 'video');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
                await writeFile(mediaPath, buffer);
                isViewOnce = true;
                console.log(`🎥 View-Once video stored: ${messageId}`);
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
        } else if (message.message?.documentMessage) {
            mediaType = 'document';
            const docMsg = message.message.documentMessage;
            content = docMsg.caption || '';
            const mimeType = docMsg.mimetype || 'application/octet-stream';
            const extension = getFileExtension(mimeType);
            const buffer = await downloadContentFromMessage(docMsg, 'document');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${extension}`);
            await writeFile(mediaPath, buffer);
            console.log(`📄 Document stored: ${messageId}.${extension} (${mimeType})`);
        }

        messageStore.set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
            timestamp: new Date().toISOString(),
            isViewOnce
        });

    } catch (err) {
        console.error('storeMessage error:', err);
    }
}

// Handle message deletion - WITH VIEW-ONCE AUTO RECOVERY TO OWNER
async function handleMessageRevocation(sock, revocationMessage) {
    try {
        const config = loadAntideleteConfig();
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
        
        // Get bot owner number
        const botNumber = sock.user.id.split(':')[0];
        const ownerNumber = botNumber + '@s.whatsapp.net';
        
        // Don't report if bot or owner deleted
        if (deletedBy === ownerNumber || deletedBy.includes(botNumber)) {
            console.log('Owner/bot deleted message, not reporting');
            return;
        }

        const original = messageStore.get(deletedMessageId);
        if (!original) {
            console.log('Message not found in store:', deletedMessageId);
            return;
        }

        // Extract sender info
        const sender = original.sender;
        const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
        const senderName = sender.split('@')[0];
        
        // Extract deleter info
        let deleterNumber = deletedBy.split('@')[0].replace(/[^0-9]/g, '');
        let deleterName = deletedBy.split('@')[0];
        
        // Check if it's self-delete or admin-delete
        const isSelfDelete = (sender === deletedBy);
        
        // Check if it was a view-once message
        const isViewOnce = original.isViewOnce || false;
        
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

        let reportText = `🔰 *ANTIDELETE REPORT* 🔰\n\n`;

        // Add view-once indicator
        if (isViewOnce) {
            reportText += `🔐 *VIEW-ONCE MEDIA DETECTED & RECOVERED* 🔐\n\n`;
            reportText += `*📎 Original State Preserved!*\n\n`;
        }

        if (isSelfDelete) {
            reportText += `⚠️ *User deleted their OWN message*\n\n`;
            reportText += `🔹 <═════════════════>\n\n`;
            reportText += `🔹 *User:* @${deleterName}\n`;
            reportText += `🔹 *Number:* ${deleterNumber}\n`;
        } else {
            reportText += `🗑️ *DELETED BY (Admin/Moderator)*\n`;
            reportText += `🔹 *Name:* @${deleterName}\n`;
            reportText += `🔹 *Number:* ${deleterNumber}\n\n`;
            reportText += `🔹 <═════════════════>\n\n`;
            reportText += `👤 *ORIGINAL SENDER*\n`;
            reportText += `🔹 *Name:* @${senderName}\n`;
            reportText += `🔹 *Number:* ${senderNumber}\n`;
        }

        if (groupName) {
            reportText += `\n🔹 *Group:* ${groupName}`;
        }

        reportText += `\n🔹 *Time:* ${time}`;

        reportText += `\n\n💾 *Report Saved Successfully!*\n`;
        reportText += `👨‍💻 *Developer:* S7 SAFWAN`;

        // DELETED MESSAGE AT THE END WITH 💬 EMOJI
        if (original.content) {
            reportText += `\n\n💬 *Deleted Message:* *${original.content}*`;
        }

        // SEND REPORT TO OWNER ONLY
        await sock.sendMessage(ownerNumber, {
            text: reportText,
            mentions: [deletedBy, sender]
        });

        // Send media if exists (in ORIGINAL STATE - not view-once)
        if (original.mediaType && fs.existsSync(original.mediaPath)) {
            let mediaCaption = '';
            
            if (isViewOnce) {
                mediaCaption = `*🔐 VIEW-ONCE ${original.mediaType.toUpperCase()} RECOVERED* 🔐\n\n`;
                mediaCaption += `*📎 Original State:* Normal (Savable)\n`;
                mediaCaption += `*👤 From:* @${senderName}\n`;
                if (!isSelfDelete) {
                    mediaCaption += `*🗑️ Deleted by:* @${deleterName}\n`;
                }
                mediaCaption += `\n*💬 Message:* ${original.content || 'No caption'}`;
            } else if (isSelfDelete) {
                mediaCaption = `*Deleted ${original.mediaType.toUpperCase()}*\nUser deleted their own ${original.mediaType}\nFrom: @${senderName}`;
            } else {
                mediaCaption = `*Deleted ${original.mediaType.toUpperCase()}*\nFrom: @${senderName}\nDeleted by: @${deleterName}`;
            }
            
            // Add deleted message at the end of media caption
            if (original.content && !isViewOnce) {
                mediaCaption += `\n\n💬 *Deleted Message:* *${original.content}*`;
            }
            
            const mediaOptions = {
                caption: mediaCaption,
                mentions: [sender, deletedBy]
            };

            try {
                switch (original.mediaType) {
                    case 'image':
                        // Send as NORMAL image (not view-once) - original state preserved
                        await sock.sendMessage(ownerNumber, {
                            image: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        console.log(`📸 View-Once image recovered to owner (normal state)`);
                        break;
                    case 'sticker':
                        await sock.sendMessage(ownerNumber, {
                            sticker: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        break;
                    case 'video':
                        // Send as NORMAL video (not view-once) - original state preserved
                        await sock.sendMessage(ownerNumber, {
                            video: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        console.log(`🎥 View-Once video recovered to owner (normal state)`);
                        break;
                    case 'audio':
                        await sock.sendMessage(ownerNumber, {
                            audio: { url: original.mediaPath },
                            mimetype: 'audio/mpeg',
                            ptt: false,
                            ...mediaOptions
                        });
                        break;
                    case 'document':
                        const fileName = path.basename(original.mediaPath);
                        await sock.sendMessage(ownerNumber, {
                            document: { url: original.mediaPath },
                            mimetype: 'application/octet-stream',
                            fileName: `recovered_${fileName}`,
                            ...mediaOptions
                        });
                        console.log(`📄 Document recovered to owner: ${fileName}`);
                        break;
                }
            } catch (err) {
                await sock.sendMessage(ownerNumber, {
                    text: `⚠️ Error sending media: ${err.message}`
                });
            }

            // Cleanup media file
            try {
                fs.unlinkSync(original.mediaPath);
            } catch (err) {
                console.error('Media cleanup error:', err);
            }
        }

        messageStore.delete(deletedMessageId);
        console.log(`✅ Antidelete report sent to owner for message: ${deletedMessageId}`);

    } catch (err) {
        console.error('handleMessageRevocation error:', err);
    }
}

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
        'application/octet-stream': 'file'
    };
    return extensions[mimetype] || 'file';
}

module.exports = {
    handleAntideleteCommand,
    handleMessageRevocation,
    storeMessage
};