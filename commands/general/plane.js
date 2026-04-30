module.exports = {
    name: 'plane',
    description: 'Show plane animation with pricing info',
    usage: '.plane',
    
    async execute(sock, chatId, message, args) {
        const planeAnimation = `
*🔞 PREMIUM BOT SERVICE 🔞*

━━━━━━━━━━━━━━━━━━━━━

💎 *BENEFITS:* 💎
✅ 24/7 Active Bot
✅ Fast Response
✅ All Features Unlocked
✅ Priority Support
✅ Free Updates
✅ 100% Secure & Safe

━━━━━━━━━━━━━━━━━━━━━

💰 *PRICING PLANS:* 💰

📦 *7 DAYS* 
   💵 $2 USD / 500 PKR

📦 *1 Months* 
   💵 $7 USD / 1800 PKR

📦 *1 Year* 
   💵 $35 USD / 9500 PKR

━━━━━━━━━━━━━━━━━━━━━

🛡️ *100% SECURE & SAFE* 🛡️
✅ Encrypted
✅ Private
✅ Reliable

━━━━━━━━━━━━━━━━━━━━━

📞 *CONTACT NUMBER:* 
+92 3345216246

💫 *Muhammad Safwan* 💫`;

        await sock.sendMessage(chatId, {
            text: planeAnimation,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363419197664425@newsletter',
                    newsletterName: 'S7 SAFWAN',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });
    }
};