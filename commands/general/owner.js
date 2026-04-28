async function ownerCommand(sock, chatId) {
    const devNumbers = ["+92 334521646"]; 
    const botOwnerName = "DEV S7 SAFWAN"; // Hardcoded display name
    
    const contacts = devNumbers.map((number, index) => ({
        vcard: [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${botOwnerName}${devNumbers.length > 1 ? ` ${index + 1}` : ''}`,
            `TEL;waid=${number.replace(/[\s+]/g, '')}:${number}`,
            'END:VCARD'
        ].join('\n')
    }));

    await sock.sendMessage(chatId, {
        text: [
            '┌ ❏ *⌜ OWNER CONTACTS ⌟* ❏',
            '│',
            ...devNumbers.map((num) => `├◆ ${num}`),
            '└ ❏'
        ].join('\n')
    });

    await sock.sendMessage(chatId, {
        contacts: { displayName: botOwnerName, contacts }
    });
}

module.exports = ownerCommand;