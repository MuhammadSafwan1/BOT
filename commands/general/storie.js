const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const contextInfo = {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363419197664425@newsletter',
        newsletterName: 'S7 SAFWAN',
        serverMessageId: -1
    }
};

async function storieCommand(sock, chatId, message, args) {
    try {
        // Extract quoted message from the reply
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // Check for story/image status
        const imageStory = quoted?.imageMessage;
        const videoStory = quoted?.videoMessage;
        
        // Get sender info and clean JID to show only number
        const sender = quoted?.key?.remoteJid || message.key.remoteJid;
        const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
        const isStatus = sender?.includes('status@broadcast');

        if (!imageStory && !videoStory) {
            await sock.sendMessage(chatId, { 
                text: '❌ Please reply to a status/story message\n\n*Usage:*\nReply to any status with .storie to download it\n\nThe media will be sent directly to your chat.',
                ...contextInfo
            }, { quoted: message });
            return;
        }

        const currentTime = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: true, 
            timeZone: 'Asia/Karachi' 
        });
        
        // Handle image story
        if (imageStory) {
            // Download the image
            const stream = await downloadContentFromMessage(imageStory, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            // Send to the chat where command was executed (user's personal chat)
            await sock.sendMessage(chatId, {
                image: buffer,
                caption: `📸 *Status Downloaded*\n\n🔹 *Type:* Image\n🔹 *Sender:* ${senderNumber}\n🔹 *Time:* ${currentTime}\n\n💾 *Status saved successfully!*\n\n👨‍💻 *Developer:* S7 SAFWAN`,
                mimetype: 'image/jpeg',
                ...contextInfo
            });
            
            console.log(`✅ Status image downloaded and sent to ${chatId}`);
            return;
        }
        
        // Handle video story
        if (videoStory) {
            // Download the video
            const stream = await downloadContentFromMessage(videoStory, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            // Send to the chat where command was executed (user's personal chat)
            await sock.sendMessage(chatId, {
                video: buffer,
                caption: `🎥 *Status Downloaded*\n\n🔹 *Type:* Video\n🔹 *Sender:* ${senderNumber}\n🔹 *Time:* ${currentTime}\n\n💾 *Status saved successfully!*\n\n👨‍💻 *Developer:* S7 SAFWAN`,
                mimetype: 'video/mp4',
                ...contextInfo
            });
            
            console.log(`✅ Status video downloaded and sent to ${chatId}`);
            return;
        }
        
    } catch (error) {
        console.error('Error in storie command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to download status\n\nPossible reasons:\n• Status may have expired\n• Status was already viewed\n• Network error\n\nPlease try again with a fresh status.',
            ...contextInfo
        }, { quoted: message });
    }
}

module.exports = storieCommand;