const settings = require('../../settings');
const fs = require('fs');
const path = require('path');
const os = require('os');
const isOwnerOrSudo = require('../../lib/isOwner');

const MENU_IMAGE_JSON = path.join(__dirname, '../../data/menuImage.json');
const LOCAL_MENU_IMAGE = path.join(__dirname, '../../assets/bot_image.jpg');

function loadMenuImageUrl() {
    try {
        if (!fs.existsSync(MENU_IMAGE_JSON)) return '';
        const parsed = JSON.parse(fs.readFileSync(MENU_IMAGE_JSON, 'utf8'));
        return String(parsed.url || '').trim();
    } catch {
        return '';
    }
}

function readJsonSafe(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return [days ? `${days}d` : '', hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', `${secs}s`].filter(Boolean).join(' ');
}

async function helpCommand(sock, chatId, message) {
    const prefix = settings.commandPrefix || '.';
    const senderId = message.key.participant || message.key.remoteJid;
    const isPremium = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    const modeData = readJsonSafe('./data/messageCount.json', { isPublic: true });
    const lagosNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();
    const memUsage = `${(usedMem / 1024 / 1024 / 1024).toFixed(1)}GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(1)}GB`;
    const cpuModel = os.cpus()?.[0]?.model || 'Intel(R) Xeon(R)';
    const userName = message.pushName || senderId.split('@')[0];
    const mood = lagosNow.getHours() >= 18 || lagosNow.getHours() < 6 ? '🌙' : '☀️';

    const helpMessage = `+══════════════════>
║
║
║     🤖 ${settings.botName} v${settings.version} 🤖
║
║
║══════════════════>
║
║ 👑 OWNER    : M.Safwan   
║ ⚡ PREFIX   : ${prefix}
║ 👤 USER     : M.Safwan
║ 💎 PLAN     : ${isPremium ? 'PREMIUM ✓' : 'FREE ✓'}
║ 📦 VERSION  : ${settings.version}
║ ⏰ TIME : ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Karachi' })}
║ 📊 UPTIME   : ${formatUptime(process.uptime())}
║ 🎯 COMMANDS : 146
║ 📅 TODAY    : ${lagosNow.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Africa/Lagos' })}
║ 🗓️ DATE     : ${lagosNow.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' })}
║ 💻 PLATFORM : Chrome 
║ 🟢 NODE     : ${process.version}
║ 🧠 CPU      : Intel(R) Xeon(R)
║ 💾 RAM      : ${memUsage}
║ 🔧 MODE     : ${modeData.isPublic ? 'PUBLIC' : 'PRIVATE'}
║ 🌤️ MOOD     : ${mood}
║
║══════════════════>
║
║ 📞 CONTACT OWNER: 
║     +92 3345216246  
║
║══════════════════>
║
║ ✦ 👑 CONTACT OWNER ✦
║
║══════════════════>
║
║═🔹 📞 Number:
║      +92 3315546339
║
║═🔹 💬 WhatsApp: 
║      +92 3345216246      
║
║═🔹 🔧 For issues,
║      bugs & support
║
║═🔹 ⭐ Report problems   
║     here
║
║══════════════════>
║
║ 📌 GENERAL COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}status<reply/
║             number/mention>
║═🔹 ${prefix}ping
║═🔹 ${prefix}alive
║═🔹 ${prefix}tts <text>
║═🔹 ${prefix}owner
║═🔹 ${prefix}joke
║═🔹 ${prefix}quote
║═🔹 ${prefix}fact
║═🔹 ${prefix}weather <city>
║═🔹 ${prefix}news
║═🔹 ${prefix}attp <text>
║═🔹 ${prefix}lyrics <title>
║═🔹 ${prefix}8ball <question>
║═🔹 ${prefix}groupinfo
║═🔹 ${prefix}staff
║═🔹 ${prefix}admins
║═🔹 ${prefix}trt <text> <lang>
║═🔹 ${prefix}ss <link>
║═🔹 ${prefix}jid
║═🔹 ${prefix}plane
║═🔹 ${prefix}update
║═🔹 ${prefix}status
║
║══════════════════>
║
║ ⚙️ ADMIN COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}ban @user
║═🔹 ${prefix}promote @user
║═🔹 ${prefix}demote @user
║═🔹 ${prefix}mute <minutes>
║═🔹 ${prefix}unmute
║═🔹 ${prefix}delete
║═🔹 ${prefix}del
║═🔹 ${prefix}kick @user
║═🔹 ${prefix}warnings @user
║═🔹 ${prefix}warn @user
║═🔹 ${prefix}antilink
║═🔹 ${prefix}antibadword
║═🔹 ${prefix}clear
║═🔹 ${prefix}tag <message>
║═🔹 ${prefix}tagall
║═🔹 ${prefix}chatbot
║═🔹 ${prefix}resetlink
║═🔹 ${prefix}antitag <on/off>
║═🔹 ${prefix}welcome <on/off>
║═🔹 ${prefix}goodbye <on/off>
║
║══════════════════>
║
║ 👑 OWNER COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}mode
║═🔹 ${prefix}settings
║═🔹 ${prefix}setprefix <char>
║═🔹 ${prefix}autostatus
║═🔹 ${prefix}clearsession
║═🔹 ${prefix}antidelete
║═🔹 ${prefix}alldelete
║═🔹 ${prefix}cleartmp
║═🔹 ${prefix}setpp
║═🔹 ${prefix}autoreact <on/off>
║═🔹 ${prefix}autotyping <on/off>
║═🔹 ${prefix}autoread <on/off>
║═🔹 ${prefix}anticall <on/off>
║═🔹 ${prefix}viewagain
║═🔹 ${prefix}help
║═🔹 ${prefix}menu
║
║══════════════════>
║
║ 🖥️ FF PANEL COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}aimbot
║═🔹 ${prefix}external
║═🔹 ${prefix}premium
║═🔹 ${prefix}injector
║═🔹 ${prefix}internal
║
║══════════════════>
║
║ 🎨 IMAGE & STICKER
║
║══════════════════>
║
║═🔹 ${prefix}blur
║═🔹 ${prefix}simage
║═🔹 ${prefix}sticker
║═🔹 ${prefix}tgsticker <link>
║═🔹 ${prefix}meme
║═🔹 ${prefix}take <packname>
║═🔹 ${prefix}emojimix <emj1+emj2>
║═🔹 ${prefix}igs <url>
║═🔹 ${prefix}igsc <url>
║═🔹 ${prefix}removebg
║═🔹 ${prefix}remini
║
║══════════════════>
║
║ 🌍 PIES COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}pies <country>
║═🔹 ${prefix}china
║═🔹 ${prefix}indonesia
║═🔹 ${prefix}japan
║═🔹 ${prefix}korea
║═🔹 ${prefix}hijab
║
║══════════════════>
║
║ 🎮 GAME COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}tictactoe @user
║═🔹 ${prefix}hangman
║═🔹 ${prefix}guess <letter>
║═🔹 ${prefix}trivia
║═🔹 ${prefix}answer <ans>
║═🔹 ${prefix}truth
║═🔹 ${prefix}dare
║
║══════════════════>
║
║ 🤖 AI COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}gpt <question>
║═🔹 ${prefix}gemini <quest>
║═🔹 ${prefix}imagine <prompt>
║═🔹 ${prefix}flux <prompt>
║═🔹 ${prefix}sora <query>
║
║══════════════════>
║
║ 😂 FUN COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}compliment @user
║═🔹 ${prefix}insult @user
║═🔹 ${prefix}flirt
║═🔹 ${prefix}shayari
║═🔹 ${prefix}goodnight
║═🔹 ${prefix}roseday
║═🔹 ${prefix}character @user
║═🔹 ${prefix}wasted @user
║═🔹 ${prefix}ship @user
║═🔹 ${prefix}simp @user
║═🔹 ${prefix}stupid @user
║
║══════════════════>
║
║ ✨ TEXTMAKER
║
║══════════════════>
║
║═🔹 ${prefix}metallic <text>
║═🔹 ${prefix}ice <text>
║═🔹 ${prefix}snow <text>
║═🔹 ${prefix}impressive <text>
║═🔹 ${prefix}matrix <text>
║═🔹 ${prefix}light <text>
║═🔹 ${prefix}neon <text>
║═🔹 ${prefix}devil <text>
║═🔹 ${prefix}purple <text>
║═🔹 ${prefix}thunder <text>
║═🔹 ${prefix}leaves <text>
║═🔹 ${prefix}1917 <text>
║═🔹 ${prefix}arena <text>
║═🔹 ${prefix}hacker <text>
║═🔹 ${prefix}sand <text>
║═🔹 ${prefix}blackpink <text>
║═🔹 ${prefix}glitch <text>
║═🔹 ${prefix}fire <text>
║
║══════════════════>
║
║ 📥 DOWNLOADER
║
║══════════════════>
║
║═🔹 ${prefix}play <song>
║═🔹 ${prefix}song <name>
║═🔹 ${prefix}instagram <url>
║═🔹 ${prefix}facebook <url>
║═🔹 ${prefix}tiktok <url>
║═🔹 ${prefix}video <name>
║═🔹 ${prefix}ytmp4 <link>
║
║══════════════════>
║
║ 🎭 MISC COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}heart
║═🔹 ${prefix}horny
║═🔹 ${prefix}circle
║═🔹 ${prefix}lgbt
║═🔹 ${prefix}lolice
║═🔹 ${prefix}its-so-stupid
║═🔹 ${prefix}namecard
║═🔹 ${prefix}oogway
║═🔹 ${prefix}tweet
║═🔹 ${prefix}ytcomment
║═🔹 ${prefix}comrade
║═🔹 ${prefix}gay
║═🔹 ${prefix}glass
║═🔹 ${prefix}jail
║═🔹 ${prefix}passed
║═🔹 ${prefix}triggered
║
║══════════════════>
║
║ 🌸 ANIME COMMANDS
║
║══════════════════>
║
║═🔹 ${prefix}nom
║═🔹 ${prefix}poke
║═🔹 ${prefix}cry
║═🔹 ${prefix}kiss
║═🔹 ${prefix}pat
║═🔹 ${prefix}hug
║═🔹 ${prefix}wink
║═🔹 ${prefix}facepalm
║
║══════════════════>`;

    const contextInfo = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363419197664425@newsletter',
            newsletterName: 'S7 SAFWAN',
            serverMessageId: -1
        }
    };

    try {
        const imageUrl = loadMenuImageUrl();
        if (imageUrl) {
            await sock.sendMessage(chatId, { image: { url: imageUrl }, caption: helpMessage, contextInfo }, { quoted: message });
            return;
        }
        if (fs.existsSync(LOCAL_MENU_IMAGE)) {
            await sock.sendMessage(chatId, { image: fs.readFileSync(LOCAL_MENU_IMAGE), caption: helpMessage, contextInfo }, { quoted: message });
            return;
        }
        await sock.sendMessage(chatId, { text: helpMessage, contextInfo }, { quoted: message });
    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: helpMessage }, { quoted: message });
    }
}

module.exports = helpCommand;