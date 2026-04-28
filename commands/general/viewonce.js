const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function viewonceCommand(sock, chatId, message) {
    // Extract quoted message from your structure
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;
    const quotedAudio = quoted?.audioMessage;

    // Check for view-once image
    if (quotedImage && quotedImage.viewOnce) {
        // Download and send the image
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(chatId, { 
            image: buffer, 
            fileName: 'media.jpg', 
            caption: quotedImage.caption || '📸 *View-Once Image Recovered*'
        }, { quoted: message });
        return;
    }
    
    // Check for view-once video
    if (quotedVideo && quotedVideo.viewOnce) {
        // Download and send the video
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(chatId, { 
            video: buffer, 
            fileName: 'media.mp4', 
            caption: quotedVideo.caption || '🎥 *View-Once Video Recovered*',
            gifPlayback: false
        }, { quoted: message });
        return;
    }
    
    // Check for view-once voice note (audio)
    if (quotedAudio && quotedAudio.viewOnce) {
        // Download and send the voice note
        const stream = await downloadContentFromMessage(quotedAudio, 'audio');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        // Send as voice note (PTT)
        await sock.sendMessage(chatId, { 
            audio: buffer, 
            mimetype: 'audio/mp4',
            ptt: true,  // This makes it appear as a voice note
            fileName: 'voice_note.opus'
        }, { quoted: message });
        return;
    }
    
    // If no view-once media found
    await sock.sendMessage(chatId, { 
        text: '❌ *Please reply to a view-once message*\n\n*Supported types:*\n📸 View-Once Image\n🎥 View-Once Video\n🎤 View-Once Voice Note' 
    }, { quoted: message });
}

module.exports = viewonceCommand;