const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const settings = require('../../settings');

const OWNER_NUMBER = settings.ownerNumber;
const OWNER_JID = OWNER_NUMBER ? OWNER_NUMBER + '@s.whatsapp.net' : '';

const contextInfo = {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: settings.newsletterJid || '120363419197664425@newsletter',
        newsletterName: settings.botName || 'S7 SAFWAN',
        serverMessageId: -1
    }
};

async function handleViewOnceCommand(sock, chatId, message) {
    if (!OWNER_JID) {
        return sock.sendMessage(chatId, {
            text: '❌ *Owner number not configured in settings.js*',
            contextInfo
        }, { quoted: message });
    }

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;
    const quotedAudio = quoted?.audioMessage;

    const senderJid = message.key.participant || message.key.remoteJid;
    const senderNumber = senderJid.split('@')[0];

    // Check for view-once image
    if (quotedImage && quotedImage.viewOnce) {
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(OWNER_JID, {
            image: buffer,
            caption: `📸 *VIEW-ONCE IMAGE RECOVERED*\n\n👤 From: ${senderNumber}${quotedImage.caption ? `\n💬 Caption: ${quotedImage.caption}` : ''}`,
            contextInfo
        });

        await sock.sendMessage(chatId, {
            text: '✅ *View-Once image sent to owner!*',
            contextInfo
        }, { quoted: message });
        return;
    }

    // Check for view-once video
    if (quotedVideo && quotedVideo.viewOnce) {
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(OWNER_JID, {
            video: buffer,
            caption: `🎥 *VIEW-ONCE VIDEO RECOVERED*\n\n👤 From: ${senderNumber}${quotedVideo.caption ? `\n💬 Caption: ${quotedVideo.caption}` : ''}`,
            gifPlayback: false,
            contextInfo
        });

        await sock.sendMessage(chatId, {
            text: '✅ *View-Once video sent to owner!*',
            contextInfo
        }, { quoted: message });
        return;
    }

    // Check for view-once audio
    if (quotedAudio && quotedAudio.viewOnce) {
        const stream = await downloadContentFromMessage(quotedAudio, 'audio');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(OWNER_JID, {
            audio: buffer,
            mimetype: 'audio/mp4',
            ptt: true,
            contextInfo
        });

        await sock.sendMessage(chatId, {
            text: '✅ *View-Once voice note sent to owner!*',
            contextInfo
        }, { quoted: message });
        return;
    }

    // No view-once media found
    await sock.sendMessage(chatId, {
        text: '❌ *Please reply to a view-once message*\n\n*Supported types:*\n📸 View-Once Image\n🎥 View-Once Video\n🎤 View-Once Voice Note',
        contextInfo
    }, { quoted: message });
}

module.exports = { handleViewOnceCommand };