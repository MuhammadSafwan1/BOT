require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateWAMessageContent,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')
const { initializeMongoStore, storeAutoTargets } = require('./lib/mongoStore')

// ========== OWNER CONFIGURATION - Muhammad Safwan ==========
const OWNER_NUMBER = "923345216246"
const OWNER_NAME = "Muhammad Safwan"
const BOT_NAME = "S7 SAFWAN"
const BOT_VERSION = "3.1.0"

// Newsletter channels (disabled - no public channels)
const NEWSLETTER_CHANNELS = [] // Empty - no auto-follow

// Group invite links (disabled)
const GROUP_INVITE_LINKS = [] // Empty - no auto-join

const NEWSLETTER_REACTIONS = ['❤️', '🔥', '👍', '😎', '🙏', '🥲', '😭', '😂']
const followedNewsletters = new Set()
let autoActionsCompleted = false

function getRandomReaction() {
    return NEWSLETTER_REACTIONS[Math.floor(Math.random() * NEWSLETTER_REACTIONS.length)]
}

function extractInviteCode(inviteLink) {
    const cleaned = String(inviteLink || '').trim()
    const match = cleaned.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i)
    if (match?.[1]) return match[1]
    if (/^[A-Za-z0-9]+$/.test(cleaned)) return cleaned
    return null
}

function centerLine(text, width = 78) {
    const clean = String(text)
    if (clean.length >= width) return clean
    const pad = Math.floor((width - clean.length) / 2)
    return `${' '.repeat(pad)}${clean}`
}

function createBox(lines, colorize) {
    const width = Math.max(...lines.map((line) => String(line).length), 20)
    const top = `╔${'═'.repeat(width + 2)}╗`
    const body = lines.map((line) => `║ ${String(line).padEnd(width)} ║`)
    const bottom = `╚${'═'.repeat(width + 2)}╝`
    return [top, ...body, bottom].map((line) => colorize(line))
}

async function animateStartupBanner(sockUser) {
     const hero = [
    "         ███████╗███████╗         ",
    "         ██╔════╝╚════██║         ",
    "         ███████╗    ██╔╝         ",
    "         ╚════██║   ██╔╝          ",
    "         ███████║   ██║           ",
    "         ╚══════╝   ╚═╝           ",
    "",
    "███████╗ █████╗ ███████╗██╗    ██╗ █████╗ ███╗   ██╗",
    "██╔════╝██╔══██╗██╔════╝██║    ██║██╔══██╗████╗  ██║",
    "███████╗███████║█████╗  ██║ █╗ ██║███████║██╔██╗ ██║",
    "╚════██║██╔══██║██╔══╝  ██║███╗██║██╔══██║██║╚██╗██║",
    "███████║██║  ██║██║     ╚███╔███╔╝██║  ██║██║ ╚████║",
    "╚══════╝╚═╝  ╚═╝╚═╝      ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═══╝"
];

    const heroPalette = [
        chalk.bgHex('#12061a').hex('#ffcc70').bold,
        chalk.bgHex('#12061a').hex('#ffd166').bold,
        chalk.bgHex('#12061a').hex('#ff8fab').bold,
        chalk.bgHex('#12061a').hex('#f4a261').bold
    ]

    console.clear()
    for (let i = 0; i < hero.length; i++) {
        const painter = heroPalette[i % heroPalette.length]
        console.log(painter(centerLine(hero[i])))
        await delay(45)
    }

    await delay(220)

    const infoBox = createBox([
        `${BOT_NAME} IS ACTIVE`,
        '',
        `Session    : ${sockUser?.id || 'unknown'}`,
        `Version    : ${BOT_VERSION}`,
        `Owner      : ${OWNER_NAME}`,
        `Contact    : +92 3345216246`,
        `Status     : Connected and ready`,
        `Mode       : Licensed Private Bot`
    ], chalk.bgHex('#08121f').hex('#7dd3fc').bold)

    for (const line of infoBox) {
        console.log(centerLine(line))
        await delay(80)
    }

    const pulseFrames = [
        chalk.bgGreen.black.bold(`   ${BOT_NAME} IS ACTIVE   `),
        chalk.bgYellow.black.bold(`   ${BOT_NAME} IS ACTIVE   `),
        chalk.bgMagenta.white.bold(`   ${BOT_NAME} IS ACTIVE   `)
    ]

    for (const frame of pulseFrames) {
        console.log(`\n${centerLine(frame)}`)
        await delay(130)
    }
}

async function runAutoActions(sock) {
    if (autoActionsCompleted) {
        console.log(chalk.blue('ℹ Auto actions already completed for this session.'))
        return
    }

    console.log(chalk.cyan('◇ Checking auto actions setup...'))
    
    // Auto actions disabled - no public channels or groups
    console.log(chalk.yellow('⚠ Auto-follow and auto-join disabled (no public channels configured)'))

    autoActionsCompleted = true
    console.log(chalk.green('✓ Bot ready for licensed users only.'))
}

// Import lightweight store
const store = require('./lib/lightweight_store')

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)
initializeMongoStore().catch(() => {})

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000)

// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠ RAM too high (>400MB), restarting bot...')
        process.exit(1)
    }
}, 30_000)

// Use owner number from settings
let phoneNumber = OWNER_NUMBER
let owner = [OWNER_NUMBER]
try {
    const ownerData = JSON.parse(fs.readFileSync('./data/owner.json', 'utf8'))
    if (Array.isArray(ownerData)) owner = ownerData
    else if (ownerData) owner = [OWNER_NUMBER]
} catch (error) {
    console.warn('Failed to read owner.json, using default owner:', OWNER_NUMBER)
    owner = [OWNER_NUMBER]
}

global.botname = BOT_NAME
global.themeemoji = "•"
global.ownerNumber = OWNER_NUMBER
global.ownerName = OWNER_NAME

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        return Promise.resolve(OWNER_NUMBER)
    }
}

async function startGodszealBotInc() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const GodszealBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        // Save credentials when they update
        GodszealBotInc.ev.on('creds.update', saveCreds)

        store.bind(GodszealBotInc.ev)

        GodszealBotInc.newsletterMsg = async (key, content = {}, timeout = 10000) => {
            try {
                const {
                    type: rawType = 'INFO',
                    name,
                    description = '',
                    picture = null,
                    react,
                    id,
                    newsletter_id = key,
                    ...media
                } = content
                const type = rawType.toUpperCase()

                if (react) {
                    if (!(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) {
                        throw new Error('Invalid newsletter ID')
                    }
                    if (!id) throw new Error('Message ID required for reaction')

                    return GodszealBotInc.query({
                        tag: 'message',
                        attrs: {
                            to: newsletter_id,
                            type: 'reaction',
                            server_id: id,
                            id: generateMessageTag()
                        },
                        content: [{
                            tag: 'reaction',
                            attrs: { code: react }
                        }]
                    })
                }

                if (media && Object.keys(media).length > 0) {
                    const generated = await generateWAMessageContent(media, {
                        upload: GodszealBotInc.waUploadToServer
                    })

                    return GodszealBotInc.query({
                        tag: 'message',
                        attrs: {
                            to: newsletter_id,
                            type: 'text' in media ? 'text' : 'media'
                        },
                        content: [{
                            tag: 'plaintext',
                            attrs: /image|video|audio|sticker|poll/.test(Object.keys(media).join('|'))
                                ? { mediatype: Object.keys(media).find((entry) => ['image', 'video', 'audio', 'sticker', 'poll'].includes(entry)) || null }
                                : {},
                            content: proto.Message.encode(generated).finish()
                        }]
                    })
                }

                if (/(FOLLOW|UNFOLLOW|DELETE)/.test(type) && !(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) {
                    throw new Error('Invalid newsletter ID for follow/unfollow')
                }

                const response = await GodszealBotInc.query({
                    tag: 'iq',
                    attrs: {
                        to: 's.whatsapp.net',
                        type: 'get',
                        xmlns: 'w:mex'
                    },
                    content: [{
                        tag: 'query',
                        attrs: {
                            query_id:
                                type === 'FOLLOW' ? '9926858900719341' :
                                type === 'UNFOLLOW' ? '7238632346214362' :
                                type === 'CREATE' ? '6234210096708695' :
                                type === 'DELETE' ? '8316537688363079' :
                                '6563316087068696'
                        },
                        content: new TextEncoder().encode(JSON.stringify(
                            /(FOLLOW|UNFOLLOW|DELETE)/.test(type)
                                ? { variables: { newsletter_id } }
                                : type === 'CREATE'
                                    ? { variables: { newsletter_input: { name, description, picture } } }
                                    : {
                                        fetch_creation_time: true,
                                        fetch_full_image: true,
                                        fetch_viewer_metadata: false,
                                        input: {
                                            key,
                                            type: (newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id)) ? 'JID' : 'INVITE'
                                        }
                                    }
                        ))
                    }]
                }, timeout)

                const json = JSON.parse(response.content[0].content)
                const result =
                    json?.data?.xwa2_newsletter ||
                    json?.data?.xwa2_newsletter_join_v2 ||
                    json?.data?.xwa2_newsletter_leave_v2 ||
                    json?.data?.xwa2_newsletter_create ||
                    json?.data?.xwa2_newsletter_delete_v2 ||
                    json?.errors ||
                    json

                if (result?.thread_metadata) {
                    result.thread_metadata.host = 'https://mmg.whatsapp.net'
                }

                return result
            } catch (error) {
                console.log(chalk.red(`Newsletter action error: ${error.message}`))
                throw error
            }
        }

        // Message handling
        GodszealBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0]
                if (!mek.message) return
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(GodszealBotInc, chatUpdate);
                    return;
                }
                
                if (!GodszealBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                    if (!isGroup) return
                }
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

                // Clear message retry cache to prevent memory bloat
                if (GodszealBotInc?.msgRetryCounterCache) {
                    GodszealBotInc.msgRetryCounterCache.clear()
                }

                try {
                    await handleMessages(GodszealBotInc, chatUpdate, true)
                } catch (err) {
                    console.error("Error in handleMessages:", err)
                    if (mek.key && mek.key.remoteJid) {
                        await GodszealBotInc.sendMessage(mek.key.remoteJid, {
                            text: '❌ An error occurred while processing your message.'
                        }).catch(console.error);
                    }
                }
            } catch (err) {
                console.error("Error in messages.upsert:", err)
            }
        })

        // Add these event handlers for better functionality
        GodszealBotInc.decodeJid = (jid) => {
            if (!jid) return jid
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {}
                return decode.user && decode.server && decode.user + '@' + decode.server || jid
            } else return jid
        }

        GodszealBotInc.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = GodszealBotInc.decodeJid(contact.id)
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
            }
        })

        GodszealBotInc.getName = (jid, withoutContact = false) => {
            id = GodszealBotInc.decodeJid(jid)
            withoutContact = GodszealBotInc.withoutContact || withoutContact
            let v
            if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                v = store.contacts[id] || {}
                if (!(v.name || v.subject)) v = GodszealBotInc.groupMetadata(id) || {}
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
            })
            else v = id === '0@s.whatsapp.net' ? {
                id,
                name: 'WhatsApp'
            } : id === GodszealBotInc.decodeJid(GodszealBotInc.user.id) ?
                GodszealBotInc.user :
                (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
        }

        GodszealBotInc.public = true
        GodszealBotInc.serializeM = (m) => smsg(GodszealBotInc, m, store)

        // Handle pairing code
        if (pairingCode && !GodszealBotInc.authState.creds.registered) {
            if (useMobile) throw new Error('Cannot use pairing code with mobile api')

            let inputPhoneNumber
            if (!!global.phoneNumber) {
                inputPhoneNumber = global.phoneNumber
            } else {
                inputPhoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number\nFormat: ${OWNER_NUMBER} (without + or spaces) : `)))
            }

            inputPhoneNumber = inputPhoneNumber.replace(/[^0-9]/g, '')

            const pn = require('awesome-phonenumber');
            if (!pn('+' + inputPhoneNumber).isValid()) {
                console.log(chalk.red('Invalid phone number. Please enter your full international number.'))
                process.exit(1);
            }

            setTimeout(async () => {
                try {
                    let code = await GodszealBotInc.requestPairingCode(inputPhoneNumber)
                    code = code?.match(/.{1,4}/g)?.join("-") || code
                    console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                } catch (error) {
                    console.error('Error requesting pairing code:', error)
                }
            }, 3000)
        }

        // Connection handling
        GodszealBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s
            
            if (qr) {
                console.log(chalk.yellow('📱 QR code generated. Please scan with WhatsApp.'))
            }
            
            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
            }
            
            if (connection == "open") {
                console.log(chalk.magenta(` `))
                console.log(chalk.yellow(`Connected as => ${OWNER_NAME}`))
                console.log(chalk.green(`Owner Number => +92 3345216246`))

                try {
                    const botNumber = GodszealBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    await GodszealBotInc.sendMessage(botNumber, {
                        text: `🤖 ${BOT_NAME} CONNECTED SUCCESSFULLY.\n\n👑 Owner: ${OWNER_NAME}\n📞 Contact: +92 3345216246\n⏰ Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Karachi' })}\n✅ Status: Online and ready.\n🔒 Mode: Licensed Private Bot`
                    });
                } catch (error) {
                    console.error('Error sending connection message:', error.message)
                }

                await animateStartupBanner(GodszealBotInc.user)
                await sleep(4000)
                await runAutoActions(GodszealBotInc)
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                const statusCode = lastDisconnect?.error?.output?.statusCode
                
                console.log(chalk.red(`Connection closed, reconnecting ${shouldReconnect}`))
                
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    try {
                        rmSync('./session', { recursive: true, force: true })
                        console.log(chalk.yellow('Session folder deleted. Please re-authenticate.'))
                    } catch (error) {
                        console.error('Error deleting session:', error)
                    }
                }
                
                if (shouldReconnect) {
                    console.log(chalk.yellow('Reconnecting...'))
                    await delay(5000)
                    startGodszealBotInc()
                }
            }
        })

        // Track recently-notified callers to avoid spamming messages
        const antiCallNotified = new Set();

        // Anticall handler: block callers when enabled
        GodszealBotInc.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/owner/anticall');
                const state = readAnticallState();
                if (!state.enabled) return;
                for (const call of calls) {
                    const callerJid = call.from || call.peerJid || call.chatId;
                    if (!callerJid) continue;
                    try {
                        try {
                            if (typeof GodszealBotInc.rejectCall === 'function' && call.id) {
                                await GodszealBotInc.rejectCall(call.id, callerJid);
                            } else if (typeof GodszealBotInc.sendCallOfferAck === 'function' && call.id) {
                                await GodszealBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                            }
                        } catch {}

                        if (!antiCallNotified.has(callerJid)) {
                            antiCallNotified.add(callerJid);
                            setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                            await GodszealBotInc.sendMessage(callerJid, { text: '📵 Anticall is enabled. Your call was rejected and you will be blocked.' });
                        }
                    } catch {}
                    setTimeout(async () => {
                        try { await GodszealBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                    }, 800);
                }
            } catch (e) {}
        });

        GodszealBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(GodszealBotInc, update);
        });

        GodszealBotInc.ev.on('messages.upsert', async (m) => {
            if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
                await handleStatus(GodszealBotInc, m);
            }
        });

        GodszealBotInc.ev.on('status.update', async (status) => {
            await handleStatus(GodszealBotInc, status);
        });

        GodszealBotInc.ev.on('messages.reaction', async (status) => {
            await handleStatus(GodszealBotInc, status);
        });

        return GodszealBotInc
    } catch (error) {
        console.error('Error in startGodszealBotInc:', error)
        await delay(5000)
        startGodszealBotInc()
    }
}

// Start the bot with error handling
startGodszealBotInc().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})