const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'status',
    description: 'Track WhatsApp contact/group online status and activity',
    usage: '.status +923*********\n.status @mention\n.status reply_to_message\n.status group',
    
    async execute(sock, chatId, message, args) {
        let targetNumber = '';
        let targetJid = '';
        let isGroupCheck = false;
        
        // Check if checking group status
        if (args[0] && args[0].toLowerCase() === 'group') {
            isGroupCheck = true;
            targetJid = chatId;
            
            if (!chatId.includes('@g.us')) {
                await sock.sendMessage(chatId, {
                    text: '❌ *This command can only be used in a group*\n\nUse `.status group` inside a group to get group status.'
                }, { quoted: message });
                return;
            }
        }
        // Method 1: Get from args (phone number)
        else if (args[0] && args[0].match(/^[\+0-9]+$/)) {
            let phone = args[0].replace(/[^0-9]/g, '');
            if (!phone.startsWith('92') && !phone.startsWith('91') && !phone.startsWith('1')) {
                phone = '92' + phone;
            }
            targetNumber = phone;
            targetJid = `${phone}@s.whatsapp.net`;
        }
        // Method 2: Get from mentioned user
        else if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
            targetNumber = targetJid.split('@')[0];
        }
        // Method 3: Get from replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedMsg = message.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quotedMsg.key && quotedMsg.key.participant) {
                targetJid = quotedMsg.key.participant;
                targetNumber = targetJid.split('@')[0];
            } else if (quotedMsg.key && quotedMsg.key.remoteJid && !quotedMsg.key.remoteJid.includes('@g.us')) {
                targetJid = quotedMsg.key.remoteJid;
                targetNumber = targetJid.split('@')[0];
            }
        }
        // Method 4: Get from current chat (if private)
        else if (!chatId.includes('@g.us')) {
            targetJid = chatId;
            targetNumber = chatId.split('@')[0];
        }
        
        if (!targetJid && !isGroupCheck) {
            await sock.sendMessage(chatId, {
                text: '❌ *Please specify a contact or group*\n\n*Usage:*\n`.status +923********`\n`.status @mention`\n`.status group` (in group)\n`.status` (in private chat)\n*Reply to a message* with `.status`'
            }, { quoted: message });
            return;
        }
        
        // Send loading message
        await sock.sendMessage(chatId, {
            text: '🔍 *Fetching status information...*\n━━━━━━━━━━━━━━━━━━━━━'
        }, { quoted: message });
        
        try {
            if (isGroupCheck) {
                // Handle GROUP status
                await handleGroupStatus(sock, chatId, message, targetJid);
            } else {
                // Handle INDIVIDUAL status
                await handleIndividualStatus(sock, chatId, message, targetJid, targetNumber);
            }
        } catch (error) {
            console.error('Status check error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *Error fetching status*`
            }, { quoted: message });
        }
    }
};

// Handle Individual Contact Status
async function handleIndividualStatus(sock, chatId, message, targetJid, targetNumber) {
    // Get profile picture
    let profilePicUrl = 'https://i.imgur.com/2wzGhpF.jpeg';
    try {
        profilePicUrl = await sock.profilePictureUrl(targetJid, 'image');
    } catch (err) {
        // Use default
    }
    
    // Get status/about
    let aboutStatus = 'Not available';
    let aboutTime = null;
    try {
        const status = await sock.fetchStatus(targetJid);
        if (status && status.status) {
            aboutStatus = status.status;
            aboutTime = status.setAt;
        }
    } catch (err) {
        aboutStatus = 'No status set';
    }
    
    // Get presence data (if available - limited)
    let isOnline = false;
    try {
        const presenceData = await sock.presenceSubscribe(targetJid);
        if (presenceData) {
            isOnline = presenceData === 'available';
        }
    } catch (err) {
        // Presence not available
    }
    
    // Get contact name from database
    let contactName = 'Unknown';
    const userDataPath = './data/users.json';
    if (fs.existsSync(userDataPath)) {
        try {
            const users = JSON.parse(fs.readFileSync(userDataPath));
            const cleanNumber = targetNumber.replace(/[^0-9]/g, '');
            if (users[cleanNumber]) {
                contactName = users[cleanNumber].name || 'Unknown';
            }
        } catch (err) {}
    }
    
    // Get country info
    const countryInfo = getCountryFromCode(targetNumber);
    
    // Get stored status history
    const statusHistory = getStatusHistory(targetNumber);
    
    // Get message stats
    const messageStats = await getMessageStats(targetJid);
    
    // Build status message
    const statusText = `
✈️ *━━━━━━━━━━━━━━━━━━━━━* ✈️
     📊 *CONTACT STATUS* 📊
✈️ *━━━━━━━━━━━━━━━━━━━━━* ✈️

👤 *Name:* 
   ${contactName}

📞 *Number:* 
   +${targetNumber}

🌍 *Country:* 
   ${countryInfo.flag} ${countryInfo.name}

🟢 *Current Status:* 
   ${isOnline ? '🟢 ONLINE' : '⚫ OFFLINE'}

💬 *About/Bio:* 
   ${aboutStatus}
   ${aboutTime ? `_Updated: ${formatTime(aboutTime)}_` : ''}

━━━━━━━━━━━━━━━━━━━━━

📈 *ACTIVITY STATS:*

📨 *Total Interactions:* 
   ${messageStats.totalMessages}

⏱️ *Last Active:* 
   ${messageStats.lastActive || 'Never'}

🕐 *Most Active Hour:* 
   ${messageStats.peakHour}:00

━━━━━━━━━━━━━━━━━━━━━

${statusHistory ? `📜 *RECENT STATUS HISTORY:*
${statusHistory}

` : ''}

━━━━━━━━━━━━━━━━━━━━━

💫 *S7 SAFWAN* 💫
    `;
    
    // Send with profile picture
    await sock.sendMessage(chatId, {
        image: { url: profilePicUrl },
        caption: statusText,
        mentions: [targetJid]
    }, { quoted: message });
    
    // Store this check in history
    storeStatusCheck(targetNumber, isOnline, aboutStatus);
}

// Handle Group Status
async function handleGroupStatus(sock, chatId, message, groupJid) {
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(groupJid);
        
        // Get group profile picture
        let groupPicUrl = 'https://i.imgur.com/2wzGhpF.jpeg';
        try {
            groupPicUrl = await sock.profilePictureUrl(groupJid, 'image');
        } catch (err) {
            // Use default
        }
        
        // Get group admins
        const participants = groupMetadata.participants;
        const groupAdmins = participants.filter(p => p.admin);
        const totalMembers = participants.length;
        const totalAdmins = groupAdmins.length;
        
        // Get online members (if presence is available)
        let onlineCount = 0;
        let onlineMembers = [];
        
        // Try to get presence for some members (limited by API)
        try {
            for (const member of participants.slice(0, 5)) { // Limit to first 5 to avoid rate limits
                try {
                    const presence = await sock.presenceSubscribe(member.id);
                    if (presence === 'available') {
                        onlineCount++;
                        onlineMembers.push(member.id.split('@')[0]);
                    }
                } catch (err) {
                    // Presence not available
                }
            }
        } catch (err) {
            // Ignore presence errors
        }
        
        // Get group description
        const description = groupMetadata.desc?.toString() || 'No description';
        
        // Get group creation time (if available from metadata)
        const createdTime = groupMetadata.creation || null;
        
        // Calculate group activity based on stored data
        const groupActivity = await getGroupActivity(groupJid);
        
        // Build group status message
        const groupStatusText = `
✈️ *━━━━━━━━━━━━━━━━━━━━━* ✈️
     👥 *GROUP STATUS* 👥
✈️ *━━━━━━━━━━━━━━━━━━━━━* ✈️

📛 *Group Name:* 
   ${groupMetadata.subject}

🆔 *Group ID:* 
   ${groupJid}

👥 *Members:* 
   ${totalMembers} total

👑 *Admins:* 
   ${totalAdmins}

🟢 *Currently Online:* 
   ~${onlineCount} members (approx)

━━━━━━━━━━━━━━━━━━━━━

📝 *Description:* 
   ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}

📅 *Created:* 
   ${createdTime ? formatTime(createdTime) : 'Unknown'}

━━━━━━━━━━━━━━━━━━━━━

📊 *GROUP ACTIVITY:*

💬 *Total Messages (bot):* 
   ${groupActivity.totalMessages}

📈 *Avg Daily Messages:* 
   ${groupActivity.avgDaily}

🔥 *Most Active Day:* 
   ${groupActivity.mostActiveDay || 'N/A'}

👤 *Top Contributors:* 
${groupActivity.topContributors}

━━━━━━━━━━━━━━━━━━━━━

👨‍💼 *Admin List:*
${groupAdmins.slice(0, 10).map((admin, i) => `${i+1}. @${admin.id.split('@')[0]}`).join('\n')}
${groupAdmins.length > 10 ? `\n*+${groupAdmins.length - 10} more admins*` : ''}

━━━━━━━━━━━━━━━━━━━━━

💫 *S7 SAFWAN* 💫
    `;
    
    // Send group status with picture
    await sock.sendMessage(chatId, {
        image: { url: groupPicUrl },
        caption: groupStatusText,
        mentions: groupAdmins.map(admin => admin.id)
    }, { quoted: message });
    
    // Store group check in history
    storeGroupCheck(groupJid, totalMembers, onlineCount);
    
    } catch (error) {
        console.error('Group status error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *Failed to get group status*\n\nMake sure the bot is admin in the group and has necessary permissions.'
        }, { quoted: message });
    }
}

// Helper: Get country from phone code
function getCountryFromCode(phoneNumber) {
    const cleanNumber = String(phoneNumber).replace(/[^0-9]/g, '');
    
    const countryMap = [
    { code: '93', name: 'Afghanistan', flag: '🇦🇫' },
    { code: '355', name: 'Albania', flag: '🇦🇱' },
    { code: '213', name: 'Algeria', flag: '🇩🇿' },
    { code: '376', name: 'Andorra', flag: '🇦🇩' },
    { code: '244', name: 'Angola', flag: '🇦🇴' },
    { code: '1-268', name: 'Antigua and Barbuda', flag: '🇦🇬' },
    { code: '54', name: 'Argentina', flag: '🇦🇷' },
    { code: '374', name: 'Armenia', flag: '🇦🇲' },
    { code: '61', name: 'Australia', flag: '🇦🇺' },
    { code: '43', name: 'Austria', flag: '🇦🇹' },
    { code: '994', name: 'Azerbaijan', flag: '🇦🇿' },
    { code: '1-242', name: 'Bahamas', flag: '🇧🇸' },
    { code: '973', name: 'Bahrain', flag: '🇧🇭' },
    { code: '880', name: 'Bangladesh', flag: '🇧🇩' },
    { code: '1-246', name: 'Barbados', flag: '🇧🇧' },
    { code: '375', name: 'Belarus', flag: '🇧🇾' },
    { code: '32', name: 'Belgium', flag: '🇧🇪' },
    { code: '501', name: 'Belize', flag: '🇧🇿' },
    { code: '229', name: 'Benin', flag: '🇧🇯' },
    { code: '975', name: 'Bhutan', flag: '🇧🇹' },
    { code: '591', name: 'Bolivia', flag: '🇧🇴' },
    { code: '387', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
    { code: '267', name: 'Botswana', flag: '🇧🇼' },
    { code: '55', name: 'Brazil', flag: '🇧🇷' },
    { code: '673', name: 'Brunei', flag: '🇧🇳' },
    { code: '359', name: 'Bulgaria', flag: '🇧🇬' },
    { code: '226', name: 'Burkina Faso', flag: '🇧🇫' },
    { code: '257', name: 'Burundi', flag: '🇧🇮' },
    { code: '238', name: 'Cabo Verde', flag: '🇨🇻' },
    { code: '855', name: 'Cambodia', flag: '🇰🇭' },
    { code: '237', name: 'Cameroon', flag: '🇨🇲' },
    { code: '1', name: 'Canada', flag: '🇨🇦' },
    { code: '236', name: 'Central African Republic', flag: '🇨🇫' },
    { code: '235', name: 'Chad', flag: '🇹🇩' },
    { code: '56', name: 'Chile', flag: '🇨🇱' },
    { code: '86', name: 'China', flag: '🇨🇳' },
    { code: '57', name: 'Colombia', flag: '🇨🇴' },
    { code: '269', name: 'Comoros', flag: '🇰🇲' },
    { code: '242', name: 'Congo (Republic)', flag: '🇨🇬' },
    { code: '243', name: 'Congo (DR)', flag: '🇨🇩' },
    { code: '506', name: 'Costa Rica', flag: '🇨🇷' },
    { code: '225', name: "Côte d'Ivoire", flag: '🇨🇮' },
    { code: '385', name: 'Croatia', flag: '🇭🇷' },
    { code: '53', name: 'Cuba', flag: '🇨🇺' },
    { code: '357', name: 'Cyprus', flag: '🇨🇾' },
    { code: '420', name: 'Czech Republic', flag: '🇨🇿' },
    { code: '45', name: 'Denmark', flag: '🇩🇰' },
    { code: '253', name: 'Djibouti', flag: '🇩🇯' },
    { code: '1-767', name: 'Dominica', flag: '🇩🇲' },
    { code: '1-809', name: 'Dominican Republic', flag: '🇩🇴' },
    { code: '593', name: 'Ecuador', flag: '🇪🇨' },
    { code: '20', name: 'Egypt', flag: '🇪🇬' },
    { code: '503', name: 'El Salvador', flag: '🇸🇻' },
    { code: '240', name: 'Equatorial Guinea', flag: '🇬🇶' },
    { code: '291', name: 'Eritrea', flag: '🇪🇷' },
    { code: '372', name: 'Estonia', flag: '🇪🇪' },
    { code: '268', name: 'Eswatini', flag: '🇸🇿' },
    { code: '251', name: 'Ethiopia', flag: '🇪🇹' },
    { code: '679', name: 'Fiji', flag: '🇫🇯' },
    { code: '358', name: 'Finland', flag: '🇫🇮' },
    { code: '33', name: 'France', flag: '🇫🇷' },
    { code: '241', name: 'Gabon', flag: '🇬🇦' },
    { code: '220', name: 'Gambia', flag: '🇬🇲' },
    { code: '995', name: 'Georgia', flag: '🇬🇪' },
    { code: '49', name: 'Germany', flag: '🇩🇪' },
    { code: '233', name: 'Ghana', flag: '🇬🇭' },
    { code: '30', name: 'Greece', flag: '🇬🇷' },
    { code: '1-473', name: 'Grenada', flag: '🇬🇩' },
    { code: '502', name: 'Guatemala', flag: '🇬🇹' },
    { code: '224', name: 'Guinea', flag: '🇬🇳' },
    { code: '245', name: 'Guinea-Bissau', flag: '🇬🇼' },
    { code: '592', name: 'Guyana', flag: '🇬🇾' },
    { code: '509', name: 'Haiti', flag: '🇭🇹' },
    { code: '504', name: 'Honduras', flag: '🇭🇳' },
    { code: '36', name: 'Hungary', flag: '🇭🇺' },
    { code: '354', name: 'Iceland', flag: '🇮🇸' },
    { code: '91', name: 'India', flag: '🇮🇳' },
    { code: '62', name: 'Indonesia', flag: '🇮🇩' },
    { code: '98', name: 'Iran', flag: '🇮🇷' },
    { code: '964', name: 'Iraq', flag: '🇮🇶' },
    { code: '353', name: 'Ireland', flag: '🇮🇪' },
    { code: '972', name: 'Israel', flag: '🇮🇱' },
    { code: '39', name: 'Italy', flag: '🇮🇹' },
    { code: '1-876', name: 'Jamaica', flag: '🇯🇲' },
    { code: '81', name: 'Japan', flag: '🇯🇵' },
    { code: '962', name: 'Jordan', flag: '🇯🇴' },
    { code: '7', name: 'Kazakhstan', flag: '🇰🇿' },
    { code: '254', name: 'Kenya', flag: '🇰🇪' },
    { code: '686', name: 'Kiribati', flag: '🇰🇮' },
    { code: '850', name: 'North Korea', flag: '🇰🇵' },
    { code: '82', name: 'South Korea', flag: '🇰🇷' },
    { code: '383', name: 'Kosovo', flag: '🇽🇰' },
    { code: '965', name: 'Kuwait', flag: '🇰🇼' },
    { code: '996', name: 'Kyrgyzstan', flag: '🇰🇬' },
    { code: '856', name: 'Laos', flag: '🇱🇦' },
    { code: '371', name: 'Latvia', flag: '🇱🇻' },
    { code: '961', name: 'Lebanon', flag: '🇱🇧' },
    { code: '266', name: 'Lesotho', flag: '🇱🇸' },
    { code: '231', name: 'Liberia', flag: '🇱🇷' },
    { code: '218', name: 'Libya', flag: '🇱🇾' },
    { code: '423', name: 'Liechtenstein', flag: '🇱🇮' },
    { code: '370', name: 'Lithuania', flag: '🇱🇹' },
    { code: '352', name: 'Luxembourg', flag: '🇱🇺' },
    { code: '261', name: 'Madagascar', flag: '🇲🇬' },
    { code: '265', name: 'Malawi', flag: '🇲🇼' },
    { code: '60', name: 'Malaysia', flag: '🇲🇾' },
    { code: '960', name: 'Maldives', flag: '🇲🇻' },
    { code: '223', name: 'Mali', flag: '🇲🇱' },
    { code: '356', name: 'Malta', flag: '🇲🇹' },
    { code: '692', name: 'Marshall Islands', flag: '🇲🇭' },
    { code: '222', name: 'Mauritania', flag: '🇲🇷' },
    { code: '230', name: 'Mauritius', flag: '🇲🇺' },
    { code: '52', name: 'Mexico', flag: '🇲🇽' },
    { code: '691', name: 'Micronesia', flag: '🇫🇲' },
    { code: '373', name: 'Moldova', flag: '🇲🇩' },
    { code: '377', name: 'Monaco', flag: '🇲🇨' },
    { code: '976', name: 'Mongolia', flag: '🇲🇳' },
    { code: '382', name: 'Montenegro', flag: '🇲🇪' },
    { code: '212', name: 'Morocco', flag: '🇲🇦' },
    { code: '258', name: 'Mozambique', flag: '🇲🇿' },
    { code: '95', name: 'Myanmar', flag: '🇲🇲' },
    { code: '264', name: 'Namibia', flag: '🇳🇦' },
    { code: '674', name: 'Nauru', flag: '🇳🇷' },
    { code: '977', name: 'Nepal', flag: '🇳🇵' },
    { code: '31', name: 'Netherlands', flag: '🇳🇱' },
    { code: '64', name: 'New Zealand', flag: '🇳🇿' },
    { code: '505', name: 'Nicaragua', flag: '🇳🇮' },
    { code: '227', name: 'Niger', flag: '🇳🇪' },
    { code: '234', name: 'Nigeria', flag: '🇳🇬' },
    { code: '389', name: 'North Macedonia', flag: '🇲🇰' },
    { code: '47', name: 'Norway', flag: '🇳🇴' },
    { code: '968', name: 'Oman', flag: '🇴🇲' },
    { code: '92', name: 'Pakistan', flag: '🇵🇰' },
    { code: '680', name: 'Palau', flag: '🇵🇼' },
    { code: '970', name: 'Palestine', flag: '🇵🇸' },
    { code: '507', name: 'Panama', flag: '🇵🇦' },
    { code: '675', name: 'Papua New Guinea', flag: '🇵🇬' },
    { code: '595', name: 'Paraguay', flag: '🇵🇾' },
    { code: '51', name: 'Peru', flag: '🇵🇪' },
    { code: '63', name: 'Philippines', flag: '🇵🇭' },
    { code: '48', name: 'Poland', flag: '🇵🇱' },
    { code: '351', name: 'Portugal', flag: '🇵🇹' },
    { code: '974', name: 'Qatar', flag: '🇶🇦' },
    { code: '40', name: 'Romania', flag: '🇷🇴' },
    { code: '7', name: 'Russia', flag: '🇷🇺' },
    { code: '250', name: 'Rwanda', flag: '🇷🇼' },
    { code: '1-869', name: 'Saint Kitts and Nevis', flag: '🇰🇳' },
    { code: '1-758', name: 'Saint Lucia', flag: '🇱🇨' },
    { code: '1-784', name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
    { code: '685', name: 'Samoa', flag: '🇼🇸' },
    { code: '378', name: 'San Marino', flag: '🇸🇲' },
    { code: '239', name: 'São Tomé and Príncipe', flag: '🇸🇹' },
    { code: '966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '221', name: 'Senegal', flag: '🇸🇳' },
    { code: '381', name: 'Serbia', flag: '🇷🇸' },
    { code: '248', name: 'Seychelles', flag: '🇸🇨' },
    { code: '232', name: 'Sierra Leone', flag: '🇸🇱' },
    { code: '65', name: 'Singapore', flag: '🇸🇬' },
    { code: '421', name: 'Slovakia', flag: '🇸🇰' },
    { code: '386', name: 'Slovenia', flag: '🇸🇮' },
    { code: '677', name: 'Solomon Islands', flag: '🇸🇧' },
    { code: '252', name: 'Somalia', flag: '🇸🇴' },
    { code: '27', name: 'South Africa', flag: '🇿🇦' },
    { code: '211', name: 'South Sudan', flag: '🇸🇸' },
    { code: '34', name: 'Spain', flag: '🇪🇸' },
    { code: '94', name: 'Sri Lanka', flag: '🇱🇰' },
    { code: '249', name: 'Sudan', flag: '🇸🇩' },
    { code: '597', name: 'Suriname', flag: '🇸🇷' },
    { code: '46', name: 'Sweden', flag: '🇸🇪' },
    { code: '41', name: 'Switzerland', flag: '🇨🇭' },
    { code: '963', name: 'Syria', flag: '🇸🇾' },
    { code: '886', name: 'Taiwan', flag: '🇹🇼' },
    { code: '992', name: 'Tajikistan', flag: '🇹🇯' },
    { code: '255', name: 'Tanzania', flag: '🇹🇿' },
    { code: '66', name: 'Thailand', flag: '🇹🇭' },
    { code: '670', name: 'Timor-Leste', flag: '🇹🇱' },
    { code: '228', name: 'Togo', flag: '🇹🇬' },
    { code: '676', name: 'Tonga', flag: '🇹🇴' },
    { code: '1-868', name: 'Trinidad and Tobago', flag: '🇹🇹' },
    { code: '216', name: 'Tunisia', flag: '🇹🇳' },
    { code: '90', name: 'Turkey', flag: '🇹🇷' },
    { code: '993', name: 'Turkmenistan', flag: '🇹🇲' },
    { code: '688', name: 'Tuvalu', flag: '🇹🇻' },
    { code: '256', name: 'Uganda', flag: '🇺🇬' },
    { code: '380', name: 'Ukraine', flag: '🇺🇦' },
    { code: '971', name: 'United Arab Emirates', flag: '🇦🇪' },
    { code: '44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '1', name: 'USA', flag: '🇺🇸' },
    { code: '598', name: 'Uruguay', flag: '🇺🇾' },
    { code: '998', name: 'Uzbekistan', flag: '🇺🇿' },
    { code: '678', name: 'Vanuatu', flag: '🇻🇺' },
    { code: '379', name: 'Vatican City', flag: '🇻🇦' },
    { code: '58', name: 'Venezuela', flag: '🇻🇪' },
    { code: '84', name: 'Vietnam', flag: '🇻🇳' },
    { code: '967', name: 'Yemen', flag: '🇾🇪' },
    { code: '260', name: 'Zambia', flag: '🇿🇲' },
    { code: '263', name: 'Zimbabwe', flag: '🇿🇼' },
];
    
    for (const country of countryMap) {
        if (cleanNumber.startsWith(country.code)) {
            return country;
        }
    }
    
    return { name: 'Unknown', flag: '🌍', code: 'Unknown' };
}

// Helper: Format time
function formatTime(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
}

// Helper: Get message stats for individual
async function getMessageStats(jid) {
    const statsPath = './data/message_stats.json';
    if (!fs.existsSync(statsPath)) {
        return { totalMessages: 0, lastActive: 'Never', peakHour: 12 };
    }
    
    try {
        const stats = JSON.parse(fs.readFileSync(statsPath));
        const cleanJid = jid.split('@')[0];
        
        if (stats[cleanJid]) {
            return {
                totalMessages: stats[cleanJid].total || 0,
                lastActive: stats[cleanJid].lastActive ? formatTime(stats[cleanJid].lastActive) : 'Never',
                peakHour: stats[cleanJid].peakHour || 12
            };
        }
    } catch (err) {}
    
    return { totalMessages: 0, lastActive: 'Never', peakHour: 12 };
}

// Helper: Get group activity
async function getGroupActivity(groupJid) {
    const statsPath = './data/group_stats.json';
    if (!fs.existsSync(statsPath)) {
        return {
            totalMessages: 0,
            avgDaily: 0,
            mostActiveDay: 'N/A',
            topContributors: '  No data yet'
        };
    }
    
    try {
        const stats = JSON.parse(fs.readFileSync(statsPath));
        const groupId = groupJid.split('@')[0];
        
        if (stats[groupId]) {
            const topList = stats[groupId].topContributors || [];
            const topText = topList.slice(0, 5).map((u, i) => `  ${i+1}. ${u.name || u.number}`).join('\n');
            
            return {
                totalMessages: stats[groupId].total || 0,
                avgDaily: stats[groupId].avgDaily || 0,
                mostActiveDay: stats[groupId].mostActiveDay || 'N/A',
                topContributors: topText || '  No data yet'
            };
        }
    } catch (err) {}
    
    return {
        totalMessages: 0,
        avgDaily: 0,
        mostActiveDay: 'N/A',
        topContributors: '  No data yet'
    };
}

// Helper: Store status check in history
function storeStatusCheck(number, isOnline, status) {
    const historyPath = './data/status_history.json';
    let history = {};
    
    if (fs.existsSync(historyPath)) {
        try {
            history = JSON.parse(fs.readFileSync(historyPath));
        } catch (err) {}
    }
    
    if (!history[number]) {
        history[number] = [];
    }
    
    history[number].push({
        timestamp: new Date().toISOString(),
        online: isOnline,
        status: status
    });
    
    // Keep only last 50 entries
    if (history[number].length > 50) {
        history[number] = history[number].slice(-50);
    }
    
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

// Helper: Store group check
function storeGroupCheck(groupJid, memberCount, onlineCount) {
    const historyPath = './data/group_status_history.json';
    let history = {};
    
    if (fs.existsSync(historyPath)) {
        try {
            history = JSON.parse(fs.readFileSync(historyPath));
        } catch (err) {}
    }
    
    const groupId = groupJid.split('@')[0];
    if (!history[groupId]) {
        history[groupId] = [];
    }
    
    history[groupId].push({
        timestamp: new Date().toISOString(),
        members: memberCount,
        online: onlineCount
    });
    
    if (history[groupId].length > 50) {
        history[groupId] = history[groupId].slice(-50);
    }
    
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

// Helper: Get status history
function getStatusHistory(number) {
    const historyPath = './data/status_history.json';
    if (!fs.existsSync(historyPath)) return null;
    
    try {
        const history = JSON.parse(fs.readFileSync(historyPath));
        if (!history[number] || history[number].length === 0) return null;
        
        const recent = history[number].slice(-5).reverse();
        let historyText = '';
        
        for (const entry of recent) {
            const time = formatTime(entry.timestamp);
            const statusIcon = entry.online ? '🟢' : '⚫';
            historyText += `${statusIcon} ${time} - ${entry.online ? 'Online' : 'Offline'}\n`;
        }
        
        return historyText;
    } catch (err) {
        return null;
    }
}