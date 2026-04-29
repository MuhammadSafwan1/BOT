const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function storieCommand(sock, chatId, message, args) {
    try {
        // Extract quoted message from the reply
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // Check for story/image status
        const imageStory = quoted?.imageMessage;
        const videoStory = quoted?.videoMessage;
        
        // Get sender info
        const sender = quoted?.key?.remoteJid || message.key.remoteJid;
        const isStatus = sender?.includes('status@broadcast');
        
        // Check if it's actually a status/story
        if (!imageStory && !videoStory) {
            await sock.sendMessage(chatId, { 
                text: '❌ Please reply to a status/story message\n\n*Usage:*\nReply to any status with .storie to download it\n\nThe media will be sent directly to your chat.' 
            }, { quoted: message });
            return;
        }
        
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
                caption: `📸 *Status Downloaded*\n\n🔹 *Type:* Image\n🔹 *Sender:* ${sender.split('@')[0]}\n🔹 *Time:* ${new Date().toLocaleString()}\n\n💾 *Status saved successfully!*`,
                mimetype: 'image/jpeg'
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
                caption: `🎥 *Status Downloaded*\n\n🔹 *Type:* Video\n🔹 *Sender:* ${sender.split('@')[0]}\n🔹 *Time:* ${new Date().toLocaleString()}\n\n💾 *Status saved successfully!*`,
                mimetype: 'video/mp4'
            });
            
            console.log(`✅ Status video downloaded and sent to ${chatId}`);
            return;
        }
        
    } catch (error) {
        console.error('Error in storie command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to download status\n\nPossible reasons:\n• Status may have expired\n• Status was already viewed\n• Network error\n\nPlease try again with a fresh status.'
        }, { quoted: message });
    }
}

module.exports = storieCommand;