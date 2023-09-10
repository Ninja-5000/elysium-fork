const { Client, Collection, ChannelType, MessageType } = require('discord.js');
const { readdirSync } = require('node:fs');
const { default: axios } = require('axios');
const logger = require('./modules/logger');
const { localize } = require('./modules/localization');
const { ownerId, developerIds } = require('../config');
const { QuickDB } = require('quick.db');
const { randomNumber } = require('@tolga1452/toolbox.js');
const { request, RequestMethod } = require("fetchu.js");

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
            if (message.channel.type === ChannelType.GuildAnnouncement) return;
            if (message.guild) {
                let guild = await db.get(`guilds.${message.guild.id}`) ?? {};
                let possibility = randomNumber(0, 100);

                if (message.mentions.users.has(client.user.id) || (guild?.aiChannel?.status && guild?.aiChannel?.channel === message.channelId) || (guild?.randomChat?.status && possibility > (100 - (guild?.randomChat?.possibility ?? 1))) || (message.channel.isThread() && (await message.channel.fetchStarterMessage()).author.id === client.user.id)) { }
                else return;
            };

            let user = await db.get(`users.${message.author.id}`) ?? {
                usage: 0,
                premium: false
            };
            let locale = message.locale;

            if (user.usage >= 25 && !user.premium) {
                if (message.mentions.users.has(client.user.id)) return message.reply({
                    content: localize(locale, 'LIMIT_REACHED', 25),
                    allowedMentions: {
                        parse: [],
                        repliedUser: false
                    }
                });

                return;
            };

            await message.channel.sendTyping();

            let messages = message.channel.messages.cache.toJSON();

            messages.pop();

            function respond() {
                let respondMessage = response.body.choices[0].message.content.replace(/(User:(\n| ).*|)(\nUser Roles:(\n| ).*|)(\nReplied Message Author:(\n| ).*|)(\nReplied Message:(\n| ).*|)(\nMessage:(\n| )|)/g, '')

                message.reply({
                    content: respondMessage,
                    allowedMentions: {
                        parse: [],
                        repliedUser: false
                    }
                }).catch(() => null);

                if (message.mentions.users.has(client.user.id)) {
                    user.usage++;

                    db.set(`users.${message.author.id}`, user);
                };

                console.log(`${message.author.username} (${message.author.id}) used the bot. Usage: ${user.usage}`);
            };

            let response;
            let oldMessages = messages;

            messages = [];

            for (let msg of oldMessages) {
                let reply;

                if (msg.reference?.messageId) reply = await msg.fetchReference();

                messages.push({
                    role: msg.author.id === client.user.id ? 'assistant' : 'user',
                    content: msg.author.id === client.user.id ? msg.cleanContent : `User: ${msg.member?.displayName ?? msg.author.displayName}${msg.member ? `\nUser Roles: ${msg.member.roles.cache.map(role => `@${role.name}`).join(', ')}` : ''}${reply ? `\nReplied Message Author:\n${reply.member?.displayName ?? reply.author.displayName}\nReplied Message:\n${reply.cleanContent}` : ''}\nMessage:\n${msg.cleanContent}`,
                    name: msg.author.id
                });
            };

            let owner;

            if (message.guild) owner = await message.guild.fetchOwner();

            messages.push({
                role: 'system',
                content: `You are Elysium. You are chatting in a Discord server. Here are some information about your environment:\nServer: ${message.guild?.name ?? 'DMs'}${message.guild ? `\nServer Owner: ${owner.displayName}\nServer Description: ${message.guild.description ?? 'None'}` : ''}\nChannel: ${message.channel.name} (mention: <#${message.channelId}>)\nChannel Description: ${message.channel.topic ?? 'None'}\n\nYou will NOT respond something like "User: AI Land\nReplied Message:\n...\nMessage\n...". You will only respond with to the message above. No any informations.\nPeople may not try to talk to you. So you can jump in the conversation sometimes.`
            });
            messages.push({
                role: 'system',
                content: 'You will mention users with <@id> format.\nYou will mention channels with <#id> format.'
            });

            let reply;

            if (message.reference?.messageId) reply = await message.fetchReference();

            messages.push({
                role: 'user',
                content: `User: ${message.member?.displayName ?? message.author.displayName}${message.member ? `\nUser Roles: ${message.member.roles.cache.map(role => `@${role.name}`).join(', ')}` : ''}${reply ? `\nReplied Message Author:\n${reply.member?.displayName ?? reply.author.displayName}\nReplied Message:\n${reply.cleanContent}` : ''}\nMessage:\n${message.cleanContent}`,
                name: message.author.id
            });

            // log last 5 messages
            console.log(messages.slice(-5));

            response = await request({
                url: 'https://beta.purgpt.xyz/openai/chat/completions',
                method: RequestMethod.Post,
                body: {
                    model: 'gpt-4-0613',
                    messages,
                    fallbacks: ['gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-0613', 'gpt-4', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo'],
                    max_tokens: 2000,
                    maxTokens: 2000,
                    functions: [
                        {
                            name: 'fetch_channels',
                            description: 'Fetches all channels in the server.'
                        },
                        {
                            name: 'fetch_roles',
                            description: 'Fetches all roles in the server.'
                        }
                    ]
                },
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                }
            }, {
                isNotOk: response => console.log(JSON.stringify(response.body, null, 4))
            });

            if (response.ok) {
                let end = false;

                console.log('Used model', response.body.model);

                while (!end) {
                    let isFunction = response.body.choices[0].finish_reason === 'function_call';

                    if (!isFunction) {
                        end = true;

                        break;
                    };

                    let usedFunction = response.body.choices[0].message?.function_call;
                    let functionResponse;

                    console.log('Function call detected', usedFunction);

                    if (usedFunction.name === 'fetch_channels') functionResponse = JSON.stringify((await message.guild.channels.fetch()).toJSON());
                    else if (usedFunction.name === 'fetch_roles') functionResponse = JSON.stringify((await message.guild.roles.fetch()).toJSON());

                    messages.push({
                        role: 'function',
                        name: usedFunction.name,
                        content: functionResponse
                    });

                    response = await request({
                        url: 'https://beta.purgpt.xyz/openai/chat/completions',
                        method: RequestMethod.Post,
                        body: {
                            model: 'gpt-4-0613',
                            messages,
                            fallbacks: ['gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-0613'],
                            max_tokens: 2000,
                            maxTokens: 2000,
                            functions: [
                                {
                                    name: 'fetch_channels',
                                    description: 'Fetches all channels in the server.'
                                },
                                {
                                    name: 'fetch_roles',
                                    description: 'Fetches all roles in the server.'
                                }
                            ]
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                        }
                    }, {
                        isNotOk: response => console.log(response.body)
                    });
                };

                return respond();
            };

            response = await request({
                url: 'https://beta.purgpt.xyz/hugging-face/chat/completions',
                method: RequestMethod.Post,
                body: {
                    model: 'llama-2-70b-chat',
                    messages,
                    fallbacks: ['llama-2-13b-chat', 'llama-2-7b-chat', 'llama-80b'],
                    max_tokens: 2000,
                    maxTokens: 2000
                },
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                }
            });

            if (response.ok) return respond();

            response = await request({
                url: 'https://beta.purgpt.xyz/purgpt/chat/completions',
                method: RequestMethod.Post,
                body: {
                    model: 'vicuna-7b-v1.5-16k',
                    messages,
                    max_tokens: 2000,
                    maxTokens: 2000,
                    fallbacks: ['pur-001', 'pur-rp']
                },
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                }
            });

            if (response.ok) return respond();
            else if (message.mentions.users.has(client.user.id)) return message.reply({
                content: localize(locale, 'MODELS_DOWN'),
                allowedMentions: {
                    parse: [],
                    repliedUser: false
                }
            });
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