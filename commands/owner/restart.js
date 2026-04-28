const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');

module.exports = {
    name: 'restart',
    description: 'Restart the bot without sending connection message',
    category: 'owner',
    async execute(sock, message, args, from) {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, from);
        
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(from, { text: '❌ Only bot owner can use this command.' });
            return;
        }
        
        await sock.sendMessage(from, { text: '🔄 Restarting bot...' });
        
        // Create flag to prevent connection message on restart
        fs.writeFileSync(path.join(process.cwd(), '.updating'), 'true');
        
        setTimeout(() => {
            process.exit(0);
        }, 2000);
    }
};