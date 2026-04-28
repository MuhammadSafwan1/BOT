const settings = {
  packname: 'S7 SAFWAN',
  author: 'S7 SAFWAN',
  botName: 'S7 SAFWAN',
  botOwner: 'S7 SAFWAN',
  ownerNumber: '923345216246',          // ← Your Pakistan number
  ownerNumbers: ['923345216246'],       // ← Your number
  devNumbers: ['923345216246'],         // ← Your number
  commandPrefix: '.',
  newsletterJid: '120363419197664425@newsletter',
  telegramHandlersDir: 'handlers',
  premiumDbPath: 'data/owner',
  channelUrl: 'https://whatsapp.com/channel/0029VbBCfpD5PO18ybDE1S0W',
  youtubeUrl: 'https://youtube.com/@hackthecode7?si=YrOR1PUPbJalvMnU',
  giphyApiKey: 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: 'private',
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: 'WhatsApp Bot by S7 SAFWAN',
  version: '3.1.0',
  updateZipUrl: 'https://github.com/MuhammadSafwan1/BOT/archive/refs/heads/master.zip',
  pairApiBase: process.env.PAIR_API_BASE || '',
  mongoUri: process.env.MONGO_URI || '',
  mongoDbName: process.env.MONGO_DB_NAME || 'S7 SAFWAN',
  mongoEncryptionKey: process.env.MONGO_ENCRYPTION_KEY || '',
};

module.exports = settings;
