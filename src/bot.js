const { Client, Collection } = require('discord.js');
const { readdirSync } = require('node:fs');
const { default: axios } = require('axios');
const logger = require('./modules/logger');
const { localize } = require('./modules/localization');
const { ownerId, developerIds } = require('../config');
const { QuickDB } = require('quick.db');
const { randomNumber } = require('@tolga1452/toolbox.js');

const client = new Client({
    intents: [
        'Guilds',
        'GuildMessages',
        'MessageContent',
        'DirectMessages',
        'GuildMessageTyping',
        'DirectMessageTyping'
    ]
});
const db = new QuickDB();

client.commands = new Collection();

const commandFiles = readdirSync('src/commands').filter(file => file.endsWith('.js'));

if (commandFiles.length > 0) logger('info', 'COMMAND', 'Found', commandFiles.length.toString(), 'commands');
else logger('warning', 'COMMAND', 'No commands found');

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    client.commands.set(command.data.name, command);

    logger('success', 'COMMAND', 'Loaded command', command.data.name);
};

client.on('ready', () => {
    logger('info', 'BOT', 'Logged in as', client.user.tag);
    logger('info', 'COMMAND', 'Registering commands');

    axios.put(`https://discord.com/api/v10/applications/${client.user.id}/commands`, client.commands.map(command => command.data.toJSON()), {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${process.env.DISCORD_TOKEN}`
        }
    }).then(() => logger('success', 'COMMAND', 'Registered commands')).catch(error => logger('error', 'COMMAND', 'Error while registering commands', `${error.response.status} ${error.response.statusText}\n`, JSON.stringify(error.response.data, null, 4)));
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand() || interaction.isContextMenuCommand()) {
        logger('debug', 'COMMAND', 'Received command', `${interaction.commandName} (${interaction.commandId})`, 'from', interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'DMs', 'by', `${interaction.user.tag} (${interaction.user.id})`);

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            logger('warning', 'COMMAND', 'Command ', interaction.commandName, 'not found');

            return interaction.reply({
                content: localize(interaction.locale, 'NOT_FOUND', 'Command'),
                ephemeral: true
            });
        };
        if (command.category === 'Owner' && interaction.user.id !== ownerId) {
            logger('debug', 'COMMAND', 'Command', interaction.commandName, 'blocked for', interaction.user.tag, 'because it is owner only');

            return interaction.reply({
                content: localize(interaction.locale, 'OWNER_ONLY'),
                ephemeral: true
            });
        };
        if (command.category === 'Developer' && !developerIds.includes(interaction.user.id)) {
            logger('debug', 'COMMAND', 'Command', interaction.commandName, 'blocked for', interaction.user.tag, 'because it is developer only');

            return interaction.reply({
                content: localize(interaction.locale, 'DEVELOPER_ONLY'),
                ephemeral: true
            });
        };

        try {
            await command.execute(interaction);
        } catch (error) {
            logger('error', 'COMMAND', 'Error while executing command:', `${error.message}\n`, error.stack);

            return interaction.reply({
                content: localize(interaction.locale, 'COMMAND_ERROR', 'command', error.message),
                ephemeral: true
            }).catch(() => interaction.editReply({
                content: localize(interaction.locale, 'COMMAND_ERROR', 'command', error.message)
            }));
        };
    } else if (interaction.isMessageComponent()) {
        logger('debug', 'COMMAND', 'Received message component', `${interaction.customId} (${interaction.componentType})`, 'from', interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'DMs', 'by', `${interaction.user.tag} (${interaction.user.id})`);

        try {
            switch (interaction.customId) {
                default: {
                    logger('warning', 'COMMAND', 'Message component', interaction.customId, 'not found');

                    return interaction.reply({
                        content: localize(interaction.locale, 'NOT_FOUND', 'Message component'),
                        ephemeral: true
                    });
                }
            };
        } catch (error) {
            logger('error', 'COMMAND', 'Error while executing message component:', `${error.message}\n`, error.stack);

            return interaction.reply({
                content: localize(interaction.locale, 'COMMAND_ERROR', 'message component', error.message),
                ephemeral: true
            }).catch(() => interaction.editReply({
                content: localize(interaction.locale, 'COMMAND_ERROR', 'message component', error.message)
            }));
        }
    } else if (interaction.isModalSubmit()) {
        logger('debug', 'COMMAND', 'Received modal submit', interaction.customId, 'from', interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'DMs', 'by', `${interaction.user.tag} (${interaction.user.id})`);

        try {
            switch (interaction.customId) {
                default: {
                    logger('warning', 'COMMAND', 'Modal', interaction.customId, 'not found');

                    return interaction.reply({
                        content: localize(interaction.locale, 'NOT_FOUND', 'Modal'),
                        ephemeral: true
                    });
                }
            };
        } catch (error) {
            logger('error', 'COMMAND', 'Error while executing modal:', `${error.message}\n`, error.stack);

            return interaction.reply({
                content: localize(interaction.locale, 'COMMAND_ERROR', 'modal', error.message),
                ephemeral: true
            }).catch(() => interaction.editReply({
                content: localize(interaction.locale, 'COMMAND_ERROR', 'modal', error.message)
            }));
        };
    };
})
    .on('messageCreate', async message => {
        try {
            if (message.author.bot) return;
            if (message.guild && !message.mentions.users.has(client.user.id)) {
                let guild = await db.get(`guilds.${message.guild.id}`) ?? {};
    
                if (!message.mentions.users.has(client.user.id)) {
                    if (!guild?.randomChat?.status) return;
    
                    let possibility = randomNumber(0, 100);
    
                    if (possibility < (100 - (guild?.randomChat?.possibility ?? 10))) return;
                } else if (!guild?.aiChannel?.status || message.channel.id !== guild?.aiChannel?.channel) return;
            };
    
            let user = await db.get(`users.${message.author.id}`) ?? {
                usage: 0,
                premium: false
            };
            let locale = message.locale;
    
            if (user.usage >= 25 && !user.premium) return message.reply(localize('en-US', 'LIMIT_REACHED', 30));
    
            await message.channel.sendTyping();
    
            let messages = message.channel.messages.cache.toJSON();
    
            messages.pop();
    
            function respond() {
                let respondMessage = response.data.choices[0].message.content.replace(/User: .*\nReplied Message:\n.*\nMessage:/g, '').replace(/User: .*\nMessage:\n/g, '').replace(/Message:\n/g, '');

                message.reply({
                    content: respondMessage,
                    allowedMentions: {
                        parse: [],
                        repliedUser: true
                    }
                });
    
                user.usage++;
    
                db.set(`users.${message.author.id}`, user);

                console.log(`${message.author.username} (${message.author.id}) used the bot. Usage: ${user.usage}`);
            };
    
            let data = {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                }
            };
            let response;
    
            messages = messages.map(msg => ({
                role: msg.author.id === client.user.id ? 'assistant' : 'user',
                content: `User: ${msg.member?.displayName ?? msg.author.displayName}\nMessage:\n${msg.cleanContent}`,
                name: msg.author.id
            }));
    
            messages.push({
                role: 'system',
                content: `You are AI Land. You are chatting in a Discord server. Here are some information about your environment:\nServer: ${message.guild?.name ?? 'DMs'}${message.guild ? `\nServer Description: ${message.guild.description ?? 'None'}` : ''}\nChannel: ${message.channel.name}\nChannel Description: ${message.channel.topic ?? 'None'}`,
            });
    
            let reply;
    
            if (message.reference?.messageId) reply = await message.fetchReference();
    
            messages.push({
                role: 'user',
                content: `User: ${message.member?.displayName ?? message.author.displayName}${reply ? `\nReplied Message:\n${reply.cleanContent}` : ''}\nMessage:\n${message.cleanContent}`,
                name: message.author.id
            });
            messages.push({
                role: 'system',
                content: 'You will NOT respond something like "User: AI Land\nReplied Message:\n...\nMessage\n...". You will only respond with to the message above. No any informations.'
            })
    
            // log last 5 messages
            console.log(messages.slice(-5));
    
            response = await axios.post('https://beta.purgpt.xyz/openai/chat/completions', {
                model: 'gpt-4',
                messages,
                fallbacks: ['gpt-3.5-turbo-16k', 'gpt-3.5-turbo'],
                max_tokens: 4000,
                maxTokens: 4000
            }, data).catch(() => null);
    
            if (response?.status === 200) return respond();
    
            response = await axios.post('https://beta.purgpt.xyz/hugging-face/chat/completions', {
                model: 'llama-2-70b-chat',
                messages,
                fallbacks: ['llama-2-13b-chat', 'llama-2-7b-chat', 'llama-80b']
            }, data).catch(() => null);
    
            if (response?.status === 200) return respond();
    
            response = await axios.post('https://beta.purgpt.xyz/purgpt/chat/completions', {
                model: 'vicuna-7b-v1.5-16k',
                messages,
                stream: true,
                max_tokens: 4000,
                maxTokens: 4000
            }, data).catch(() => null);
    
            if (response?.status === 200) return respond();
            else return message.reply(localize(locale, 'MODELS_DOWN'));
        } catch (error) {
            console.log('Error', error);
        };
    });

async function runAtMidnight() {
    let users = await db.get('users') ?? {};

    for (let user in users) {
        await db.set(`users.${user}.usage`, 0);
    };

    console.log('Reset usage');
};

function startInterval() {
    const now = new Date();
    const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0
    );
    const timeUntilMidnight = midnight - now;

    setTimeout(() => {
        runAtMidnight();
        setInterval(runAtMidnight, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
};

startInterval();

client.login(process.env.DISCORD_TOKEN);