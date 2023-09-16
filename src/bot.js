const { Client, Collection, ChannelType, MessageType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readdirSync, writeFileSync } = require('node:fs');
const { default: axios } = require('axios');
const logger = require('./modules/logger');
const { localize } = require('./modules/localization');
const { ownerId, developerIds } = require('../config');
const { QuickDB } = require('quick.db');
const { randomNumber } = require('@tolga1452/toolbox.js');
const { request, RequestMethod } = require("fetchu.js");
const timer = require('./modules/timer');
const EmbedMaker = require('./modules/embed');
const express = require('express');
const { execSync } = require('node:child_process');
const { IpFilter } = require('express-ipfilter');

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
const app = express();

app.use(express.json());

client.commands = new Collection();

const commandFiles = readdirSync('src/commands').filter(file => file.endsWith('.js'));

if (commandFiles.length > 0) logger('info', 'COMMAND', 'Found', commandFiles.length.toString(), 'commands');
else logger('warning', 'COMMAND', 'No commands found');

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    client.commands.set(command.data.name, command);

    logger('success', 'COMMAND', 'Loaded command', command.data.name);
};

client.on('ready', async () => {
    logger('info', 'BOT', 'Logged in as', client.user.tag);
    logger('info', 'COMMAND', 'Registering commands');

    axios.put(`https://discord.com/api/v10/applications/${client.user.id}/commands`, client.commands.map(command => command.data.toJSON()), {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${process.env.DISCORD_TOKEN}`
        }
    }).then(() => logger('success', 'COMMAND', 'Registered commands')).catch(error => logger('error', 'COMMAND', 'Error while registering commands', `${error.response.status} ${error.response.statusText}\n`, JSON.stringify(error.response.data, null, 4)));

    let deniedIps = await axios.get('https://raw.githubusercontent.com/X4BNet/lists_vpn/main/ipv4.txt');

    deniedIps = deniedIps.data.split('\n');

    app.use(IpFilter(deniedIps));
    app.listen(3200, () => console.log('Listening on port 3200'));

    /*
    let users = await db.get('users') ?? {};

    await db.delete('verified');

    for (let user of Object.keys(users)) {
        await db.delete(`users.${user}.verified`);
    };
    */
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

        let [id, ...args] = interaction.customId.split(':');

        try {
            switch (id) {
                case 'functions':
                    await interaction.deferReply({ ephemeral: true });

                    let functions = await db.get(`functions.${args[0]}`);

                    if (!functions) return interaction.editReply({
                        content: localize(interaction.locale, 'FUNCTIONS_DELETED'),
                        ephemeral: true
                    });

                    interaction.editReply({
                        embeds: [
                            new EmbedMaker(client)
                                .setTitle(localize(interaction.locale, 'USED_FUNCTIONS'))
                                .setFields(...functions.map(func => ({
                                    name: `\`${func.name}\``,
                                    value: `- **Parameters:** ${JSON.stringify(func.parameters)}\n- **Response:** ${func.response.length > 200 ? func.response.slice(0, 200) + '...' : func.response}`
                                })))
                        ]
                    });
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

                if (message.mentions.users.has(client.user.id) || (guild?.aiChannel?.status && guild?.aiChannel?.channel === message.channelId) || (guild?.randomChat?.status && possibility > (100 - (guild?.randomChat?.possibility ?? 1))) || (message.channel.isThread() && (await message.channel.fetchStarterMessage())?.author?.id === client.user.id)) { }
                else return;
            };

            let user = await db.get(`users.${message.author.id}`) ?? {
                usage: 0,
                premium: false
            };
            let guild = await db.get(`guilds.${message.guild.id}`);
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

            if (message.mentions.users.has(client.user.id) && !(await db.has(`users.${message.author.id}.verified`))) return message.reply({
                content: localize(locale, 'NOT_VERIFIED'),
                components: [
                    new ActionRowBuilder()
                        .setComponents(
                            new ButtonBuilder()
                                .setLabel(localize(locale, 'VERIFY_NOW'))
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://discord.com/api/oauth2/authorize?client_id=786480896928645131&redirect_uri=https%3A%2F%2Felysium-verify.glitch.me%2F&response_type=code&scope=identify')
                        )
                ]
            });

            await message.channel.sendTyping();

            let messages = message.channel.messages.cache.toJSON();

            messages.pop();

            let functions = [];

            async function respond() {
                let respondMessage = (response?.body?.choices?.[0]?.message?.content ?? 'An error occured, please try again later.').replace(/(User:(\n| ).*|)(\nUser Roles:(\n| ).*|)(\nReplied Message Author:(\n| ).*|)(\nReplied Message:(\n| ).*|)(\nMessage:(\n| )|)/g, '')

                if (functions.length > 0) {
                    await db.set(`functions.${message.id}`, functions);

                    timer('custom', { // 24 hours
                        time: 24 * 60 * 60 * 1000,
                        callback: async () => await db.delete(`functions.${c.messageId}`),
                        config: {
                            messageId: message.id
                        }
                    });
                };

                message.reply({
                    content: respondMessage,
                    allowedMentions: {
                        parse: [],
                        repliedUser: false
                    },
                    components: functions.length > 0 ? [
                        new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`functions:${message.id}`)
                                    .setLabel(localize(locale, 'SHOW_FUNCTIONS'))
                                    .setStyle(ButtonStyle.Secondary)
                            )
                    ] : []
                }).catch(() => null);

                if (message.mentions.users.has(client.user.id) || (guild.randomChat.status && guild.randomChat.channel === message.channelId)) {
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

                if (msg.reference?.messageId) reply = await msg.fetchReference().catch(() => null);

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
                content: `User: ${message.member?.displayName ?? message.author.displayName}${message.member ? `\nUser Roles: ${message.member.roles.cache.map(role => `@${role.name}`).join(', ')}` : ''}${reply ? `\nReplied Message Author:\n${reply.member?.displayName ?? reply.author.displayName}\nReplied Message:\n${reply.cleanContent}` : ''}\nMessage:\n${message.type === MessageType.UserJoin ? 'User has been joined to the server.' : message.cleanContent}`,
                name: message.author.id
            });

            // log last 5 messages
            console.log(messages.slice(-5));

            let requestFunctions = [
                {
                    name: 'fetch_channels',
                    description: 'Fetches all channels in the server.',
                    parameters: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'fetch_roles',
                    description: 'Fetches all roles in the server.',
                    parameters: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'fetch_emojis',
                    description: 'Fetches all emojis in the server.',
                    parameters: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'fetch_pins',
                    description: 'Fetches all pins in the server.',
                    parameters: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'search_members',
                    description: 'Searches members in the server.',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                description: 'Name of the member to search.'
                            }
                        },
                        required: ['name']
                    }
                },
                {
                    name: 'web_search',
                    description: 'Search Google and return top 10 results',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Query to search on Google.'
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'search_ai_tools',
                    description: 'Searches AI tools',
                    parameters: {
                        type: 'object',
                        properties: {
                            limit: {
                                type: 'number',
                                description: 'Limit of the results.'
                            },
                            search: {
                                type: 'string',
                                description: 'Query to search AI tools.'
                            }
                        },
                        required: ['search']
                    }
                },
                {
                    name: 'draw_image',
                    description: 'Draws an image',
                    parameters: {
                        type: 'object',
                        properties: {
                            prompt: {
                                type: 'string',
                                description: 'The prompt you want to draw.'
                            },
                            count: {
                                type: 'number',
                                description: 'The number of images you want to draw.'
                            }
                        },
                        required: ['prompt']
                    }
                }
            ];

            async function useFunction(functionName, parameters) {
                if (functionName === 'fetch_channels') return JSON.stringify((await message.guild.channels.fetch()).filter(channel => channel && channel.type !== ChannelType.GuildCategory).toJSON().map(channel => `#${channel.name} (<#${channel.id}>)`));
                else if (functionName === 'fetch_roles') return JSON.stringify((await message.guild.roles.fetch()).toJSON().map(role => `@${role.name}`));
                else if (functionName === 'search_members') return JSON.stringify(message.guild.members.cache.filter(member => member.displayName.toLowerCase().includes(parameters.name.toLowerCase())).toJSON().map(member => `@${member.displayName} (<@${member.id}>)`));
                else if (functionName === 'fetch_emojis') return JSON.stringify(message.guild.emojis.cache.toJSON().map(emoji => `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`));
                else if (functionName === 'fetch_pins') return JSON.stringify((await message.channel.messages.fetchPinned()).toJSON().map(message => `@${message.author.username} (<@${message.author.id}>)\n${message.cleanContent}`));
                else if (functionName === 'web_search') {
                    let results = (await axios.post('https://websearch.plugsugar.com/api/plugins/websearch', {
                        query: parameters.query
                    })).data;

                    return JSON.stringify(results);
                } else if (functionName === 'search_ai_tools') {
                    let results = (await axios.post('https://www.aitoolhunt.com/api/fetchtools', {
                        limit: parameters.limit ?? 20,
                        search: parameters.search,
                        start: 0
                    })).data;

                    return JSON.stringify(results);
                } else if (functionName === 'draw_image') {
                    let results = await request({
                        url: 'https://beta.purgpt.xyz/stabilityai/images/generations',
                        method: RequestMethod.Post,
                        body: {
                            model: 'sdxl',
                            prompt: parameters.prompt,
                            n: parameters.count ?? 1
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                        }
                    });

                    return results.ok ? JSON.stringify(results.body.data) : 'Function call failed.';
                };
            };

            response = await request({
                url: 'https://api.openai.com/v1/chat/completions',
                method: RequestMethod.Post,
                body: {
                    model: 'gpt-3.5-turbo-0613',
                    messages: messages.slice(-5),
                    max_tokens: 1900,
                    functions: requestFunctions
                },
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
                }
            }, {
                isNotOk: response => console.log('openai is dead', response.status, response.statusText)
            });

            if (response.ok) {
                let end = false;

                console.log('Used model', response.body.model);
                console.log('Response', JSON.stringify(response.body, null, 4));

                while (!end) {
                    let isFunction = response.body?.choices?.[0]?.finish_reason === 'function_call';

                    if (!isFunction) {
                        end = true;

                        break;
                    };

                    let usedFunction = response.body.choices[0].message?.function_call;
                    let functionResponse;
                    let parameters = {};

                    if (usedFunction.arguments) parameters = JSON.parse(usedFunction.arguments);

                    console.log('Function call detected', usedFunction, parameters);

                    functionResponse = await useFunction(usedFunction.name, parameters);

                    console.log('Function response', functionResponse);

                    messages.push({
                        role: 'function',
                        name: usedFunction.name,
                        content: functionResponse
                    });
                    messages.push({
                        role: 'system',
                        content: 'You will NOT repeat functions.'
                    });
                    functions.push({
                        name: usedFunction.name,
                        parameters,
                        response: functionResponse
                    });

                    // wait 1 second to prevent rate limit
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    response = await request({
                        url: 'https://api.openai.com/v1/chat/completions',
                        method: RequestMethod.Post,
                        body: {
                            model: 'gpt-3.5-turbo-0613',
                            messages: messages.slice(-5),
                            max_tokens: 1900,
                            functions: requestFunctions
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
                        }
                    }, {
                        isOk: response => console.log('Function call OK', JSON.stringify(response.body, null, 4)),
                        isNotOk: response => console.log(JSON.stringify(response.body, null, 4))
                    });

                    if (!response.ok) response = await request({
                        url: 'https://beta.purgpt.xyz/openai/chat/completions',
                        method: RequestMethod.Post,
                        body: {
                            model: 'gpt-4-0613',
                            messages,
                            fallbacks: ['gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-0613', 'gpt-4', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo'],
                            max_tokens: 1900,
                            maxTokens: 1900,
                            functions: requestFunctions
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                        }
                    }, {
                        isNotOk: response => console.log(JSON.stringify(response.body, null, 4))
                    });
                };

                return respond();
            };

            response = await request({
                url: 'https://beta.purgpt.xyz/openai/chat/completions',
                method: RequestMethod.Post,
                body: {
                    model: 'gpt-4-0613',
                    messages,
                    fallbacks: ['gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-0613', 'gpt-4', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo'],
                    max_tokens: 1900,
                    maxTokens: 1900,
                    functions: requestFunctions
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
                console.log('Response', JSON.stringify(response.body, null, 4));

                while (!end) {
                    let isFunction = response.body.choices[0].finish_reason === 'function_call';

                    if (!isFunction) {
                        end = true;

                        break;
                    };

                    let usedFunction = response.body.choices[0].message?.function_call;
                    let functionResponse;
                    let parameters = {};

                    console.log('Function call detected', usedFunction);

                    if (usedFunction.arguments) parameters = JSON.parse(usedFunction.arguments);

                    functionResponse = await useFunction(usedFunction.name, parameters);

                    messages.push({
                        role: 'function',
                        name: usedFunction.name,
                        content: functionResponse
                    });
                    messages.push({
                        role: 'system',
                        content: 'You will NOT repeat functions.'
                    });
                    functions.push({
                        name: usedFunction.name,
                        parameters,
                        response: functionResponse
                    });

                    // wait 1 second to prevent rate limit
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    response = await request({
                        url: 'https://beta.purgpt.xyz/openai/chat/completions',
                        method: RequestMethod.Post,
                        body: {
                            model: 'gpt-4-0613',
                            messages,
                            fallbacks: ['gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-0613', 'gpt-4', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo'],
                            max_tokens: 1900,
                            maxTokens: 1900,
                            functions: requestFunctions
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                        }
                    }, {
                        isNotOk: response => console.log(JSON.stringify(response.body, null, 4))
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
                    max_tokens: 1900,
                    maxTokens: 1900
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
                    max_tokens: 1900,
                    maxTokens: 1900,
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

client.on('messageCreate', async message => {
    if (!message.content || message.content === '') return;

    let enabled = await db.get(`training.${message.author.id}`);

    if (message.channelId !== '1152249802420134020' && !enabled) return;

    if (!(await db.has('trainMessages'))) await db.set('trainMessages', []);

    await db.push('trainMessages', message.cleanContent);
});

app.get('/verify', async (req, res) => {
    let key = req.headers.authorization;

    if (key !== process.env.VERIFY_KEY) return res.status(401).send('Unauthorized');

    res.status(204).send();

    let user = req.query.user.replaceAll('.', '_');
    let id = req.query.id;

    if (await db.has(`verified.${user}`)) {
        if (!client.users.cache.get(id).dmChannel) await client.users.cache.get(id).createDM();

        return client.users.cache.get(id).send({
            content: 'Your verification denied because you are probably using multiple accounts. If you think this is a mistake, please join our Discord server.',
            components: [
                new ActionRowBuilder()
                    .setComponents(
                        new ButtonBuilder()
                            .setLabel('Join Discord Server')
                            .setStyle(ButtonStyle.Link)
                            .setURL('https://discord.gg/experiments')
                    )
            ]
        }).catch(() => null);
    } else {
        await db.set(`verified.${user}`, id);
        await db.set(`users.${id}.verified`, user);

        if (!client.users.cache.get(id).dmChannel) await client.users.cache.get(id).createDM();

        return client.users.cache.get(id).send('You are successfully verified!').catch(() => null);
    };
});

async function runAtMidnight() {
    let users = await db.get('users') ?? {};

    for (let user in users) {
        await db.set(`users.${user}.usage`, 0);
    };

    console.log('Reset usage');

    let data = await db.get('trainMessages');

    writeFileSync('./trainMessages.json', JSON.stringify((data ?? []).filter(message => message.length > 0), null, 4), 'utf-8');
    execSync('git add . && git commit -m "Save train messages" && git push');

    console.log('Saved train messages');
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