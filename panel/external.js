module.exports = {
    name: 'external',
    description: 'Get all external resources and links',
    usage: '.external',
    
    async execute(sock, chatId, message, args) {
        const externalLinks = `
*🌐 EXTERNAL RESOURCES & LINKS 🌐*

━━━━━━━━━━━━━━━━━━━━━

✈️ *PLANE PRICING LIST* ✈️

📅 *1 Day* 
   💵 $1 USD / 200 PKR

📆 *1 Month* 
   💵 $5 USD / 1000 PKR

⭐ *LifeTime* 
   💵 $20 USD / 4500 PKR

━━━━━━━━━━━━━━━━━━━━━

📥 *PANEL DOWNLOADS* 📥
🔗 https://www.mediafire.com/file/ag1uyw22e9fzb21/LG_EXTERNAL_C%252B%252B_.rar/file

━━━━━━━━━━━━━━━━━━━━━

🗺️ *FREE LOCATION PANEL* 🗺️
🔗 https://www.mediafire.com/file/qgz113be61jzwik/FREELOCATION.rar/file

━━━━━━━━━━━━━━━━━━━━━

⚙️ *APPLYING METHOD* ⚙️
🔗 https://youtu.be/ikKZf5mTCF4?si=0XcUPJaedh2ytvx2

━━━━━━━━━━━━━━━━━━━━━

🔥 *FREE FIRE LINKS* 🔥
🔗 https://www.mediafire.com/file/kdh6b4iwy5koovn/LG_FF.xapk/file

━━━━━━━━━━━━━━━━━━━━━

🎮 *EMULATOR LINKS* 🎮
🔗 https://www.mediafire.com/file/m8z4xtrppg6p9g8/MSI-APP-Player.zip/file

━━━━━━━━━━━━━━━━━━━━━

⚠️ *IMPORTANT NOTE* ⚠️
*If you don't have an account,* 
*please contact us to get access!*

📞 *CONTACT FOR ACCOUNT & SUPPORT:* 
+92 3345216246

━━━━━━━━━━━━━━━━━━━━━

🛡️ *100% SAFE & SECURE* 🛡️
✅ Tested Links
✅ Updated Daily
✅ No Virus
✅ Free Access

💫 *Muhammad Safwan* 💫`;

        await sock.sendMessage(chatId, {
            text: externalLinks,
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