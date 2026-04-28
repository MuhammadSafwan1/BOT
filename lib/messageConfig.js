const settings = require('../settings');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: settings.newsletterJid || '120363419197664425@newsletter',
            newsletterName: 'S7 SAFWAN',
            serverMessageId: -1
        }
    }
};

module.exports = {
    channelInfo
};
