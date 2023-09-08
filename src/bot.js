const { Client, Collection } = require('discord.js');
const { readdirSync } = require('node:fs');
const { default: axios } = require('axios');
const logger = require('./modules/logger');
const { localize } = require('./modules/localization');
const { ownerId, developerIds } = require('../config');
const { QuickDB } = require('quick.db');

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
        if (message.author.bot) return;
        if (!message.mentions.users.has(client.user.id)) return;

        let user = await db.get(`users.${message.author.id}`) ?? {
            usage: 0,
            premium: false
        };
        let locale = message.locale;

        if (user.usage >= 30 && !user.premium) return message.reply(localize(locale, 'LIMIT_REACHED', 30));

        await message.channel.sendTyping();

        let messages = (await message.channel.messages.fetch()).toJSON().filter(msg => msg.content?.length > 0);
        let responseMessage;

        async function respondStream() {
            let started = false;
            let counter = 0;
            let text = '';

            response.data.on('data', async chunk => {
                console.log('Chunk:', chunk.toString());

                counter++;

                let data = chunk.toString();

                async function done() {
                    if (counter >= 1) {
                        if (responseMessage) await responseMessage.edit(text);
                    }

                    user.usage++;

                    await db.set(`users.${message.author.id}`, user);

                    console.log(`${message.author.username} used`, user.usage);
                }

                if (data === '[DONE]') return await done();

                data = data.split('\n\n');

                let foundDone = false;

                data = data.map(d => {
                    d = d.replace('data: ', '');

                    if (d === '[DONE]') {
                        foundDone = true;

                        return null;
                    }

                    let json;

                    try {
                        json = JSON.parse(d);
                    } catch (error) {
                        return null;
                    }

                    if (json.model) model = json.model;
                    if (json.provider) provider = json.provider;

                    return json.choices[0].delta.content;
                }).filter(d => d);

                for (let t of data) {
                    if (typeof t === 'object') text += JSON.stringify(t);
                    else text += t;
                }

                if (foundDone) return await done();

                if (started) {
                    if (counter >= 10) {
                        if (responseMessage) await responseMessage.edit(text);

                        counter = 0;
                    }
                } else {
                    started = true;
                    responseMessage = await message.reply({
                        content: text,
                        allowedMentions: {
                            parse: [],
                            repliedUser: true
                        }
                    });
                }
            });
        }

        let data = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
            }
        };
        let response;

        messages = messages.map(msg => ({
            role: msg.author.id === client.user.id ? 'assistant' : 'user',
            content: msg.cleanContent,
            name: msg.author.username
        }));

        response = await axios.post('https://beta.purgpt.xyz/purgpt/chat/completions', {
            model: 'vicuna-7b-v1.5-16k',
            messages,
            stream: true,
            max_tokens: 4000,
            maxTokens: 4000
        }, {
            ...data,
            responseType: 'stream'
        }).catch(() => null);

        if (response?.status === 200) return respondStream();

        response = await axios.post('https://beta.purgpt.xyz/openai/chat/completions', {
            model: 'gpt-4',
            messages,
            fallbacks: ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
            stream: true,
            max_tokens: 4000,
            maxTokens: 4000
        }, {
            ...data,
            responseType: 'stream'
        }).catch(() => null);

        if (response?.status === 200) return respondStream();

        response = await axios.post('https://beta.purgpt.xyz/hugging-face/chat/completions', {
            model: 'llama-2-70b-chat',
            messages,
            fallbacks: ['llama-2-13b-chat', 'llama-2-7b-chat', 'llama-80b']
        }, data).catch(() => null);

        if (response?.status === 200) return respondStream();

        response = await axios.post('https://beta.purgpt.xyz/hugging-face/chat/completions', {
            model: 'llama-2-70b-chat',
            messages,
            fallbacks: ['llama-2-13b-chat', 'llama-2-7b-chat', 'llama-80b'],
            stream: true,
            max_tokens: 4000,
            maxTokens: 4000
        }, {
            ...data,
            responseType: 'stream'
        }).catch(() => null);

        if (response?.status === 200) return respondStream();
        else return message.reply(localize(locale, 'MODELS_DOWN'));
    });

client.login(process.env.DISCORD_TOKEN);