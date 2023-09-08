const { default: axios } = require("axios");
const { SlashCommandBuilder, ChatInputCommandInteraction } = require("discord.js");
const { QuickDB } = require("quick.db");
const { localize } = require("../modules/localization");
const EmbedMaker = require("../modules/embed");

const db = new QuickDB();

module.exports = {
    category: 'General',
    data: new SlashCommandBuilder()
        .setName('ask')
        .setNameLocalizations({
            tr: 'sor'
        })
        .setDescription("Asks something to the AI")
        .setDescriptionLocalizations({
            tr: 'Yapay zekaya bir şey sorar'
        })
        .addStringOption(option => option
            .setName('question')
            .setDescription('The question you want to ask')
            .setDescriptionLocalizations({
                tr: 'Sormak istediğiniz soru'
            })
            .setRequired(true)
        )
        .addBooleanOption(option => option
            .setName('debug')
            .setDescription('Debug mode. Default: false')
            .setDescriptionLocalizations({
                tr: 'Hata ayıklama modu'
            })
            .setRequired(false)
        ),
    /**
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();

        let question = interaction.options.getString('question');
        let debug = interaction.options.getBoolean('debug') ?? false;
        let user = await db.get(`users.${interaction.user.id}`) ?? {
            usage: 0,
            premium: false
        };
        let locale = interaction.locale;

        if (user.usage >= 30 && !user.premium) return interaction.editReply(localize(locale, 'LIMIT_REACHED', 30));

        async function respond() {
            await interaction.editReply({
                content: response.data.choices[0].message.content,
                embeds: debug ? [
                    new EmbedMaker(interaction.client)
                        .setColor('9b59b6')
                        .setTitle('Debug')
                        .setFields(
                            {
                                name: 'Model',
                                value: response.data.model ?? 'Unknown',
                                inline: true
                            },
                            {
                                name: 'Provider',
                                value: response.data.provider ?? 'Unknown',
                                inline: true
                            }
                        )
                ] : []
            });

            user.usage++;

            await db.set(`users.${interaction.user.id}`, user);
        };

        async function respondStream() {
            let started = false;
            let counter = 0;
            let text = '';
            let model;
            let provider;

            response.data.on('data', async chunk => {
                console.log('Chunk:', chunk.toString());

                counter++;

                let data = chunk.toString();

                async function done() {
                    if (counter >= 1) await interaction.editReply(text);

                    user.usage++;

                    await db.set(`users.${interaction.user.id}`, user);

                    console.log(`${interaction.user.username} used`, user.usage);
                };

                if (data === '[DONE]') return await done();

                data = data.split('\n\n');

                let foundDone = false;

                data = data.map(d => {
                    d = d.replace('data: ', '');

                    if (d === '[DONE]') {
                        foundDone = true;

                        return null;
                    };

                    let json;

                    try {
                        json = JSON.parse(d);
                    } catch (error) {
                        return null;
                    };

                    if (json.model) model = json.model;
                    if (json.provider) provider = json.provider;

                    return json.choices[0].delta.content;
                }).filter(d => d);

                for (let t of data) {
                    if (typeof t === 'object') text += JSON.stringify(t);
                    else text += t;
                };

                if (foundDone) return await done();

                if (started) {
                    if (counter >= 10) {
                        await interaction.editReply(text);

                        counter = 0;
                    };
                } else {
                    started = true;

                    await interaction.editReply({
                        content: text,
                        embeds: debug ? [
                            new EmbedMaker(interaction.client)
                                .setColor('9b59b6')
                                .setTitle('Debug')
                                .setFields(
                                    {
                                        name: 'Model',
                                        value: model ?? 'Unknown',
                                        inline: true
                                    },
                                    {
                                        name: 'Provider',
                                        value: provider ?? 'Unknown',
                                        inline: true
                                    }
                                )
                        ] : []
                    });
                };
            });
        };

        let data = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
            }
        };
        let response = await axios.post('https://beta.purgpt.xyz/purgpt/completions', {
            model: 'pur-001',
            prompt: question,
            fallbacks: ['pur-rp'],
            max_tokens: 4000,
            maxTokens: 4000
        }, data).catch(() => null);

        console.log('Response from pur-001:', response?.data);

        if (response?.status === 200) return respond();

        response = await axios.post('https://beta.purgpt.xyz/purgpt/chat/completions', {
            model: 'vicuna-7b-v1.5-16k',
            messages: [
                {
                    role: 'user',
                    content: question
                }
            ],
            stream: true,
            max_tokens: 4000,
            maxTokens: 4000
        }, {
            ...data,
            responseType: 'stream'
        }).catch(() => null);

        console.log('Response from vicuna-7b-v1.5-16k:', response?.data);

        if (response?.status === 200) return respondStream();

        response = await axios.post('https://beta.purgpt.xyz/openai/chat/completions', {
            model: 'gpt-4',
            messages: [
                {
                    role: 'user',
                    content: question
                }
            ],
            fallbacks: ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
            stream: true,
            max_tokens: 4000,
            maxTokens: 4000
        }, {
            ...data,
            responseType: 'stream'
        }).catch(() => null);

        console.log('Response from gpt-4:', response?.data);

        if (response?.status === 200) return respondStream();

        response = await axios.post('https://beta.purgpt.xyz/hugging-face/chat/completions', {
            model: 'llama-2-70b-chat',
            messages: [
                {
                    role: 'user',
                    content: question
                }
            ],
            fallbacks: ['llama-2-13b-chat', 'llama-2-7b-chat', 'llama-80b']
        }, data).catch(() => null);

        console.log('Response from llama-2-70b-chat:', response?.data);

        if (response?.status === 200) return respondStream();

        response = await axios.post('https://beta.purgpt.xyz/hugging-face/chat/completions', {
            model: 'llama-2-70b-chat',
            messages: [
                {
                    role: 'user',
                    content: question
                }
            ],
            fallbacks: ['llama-2-13b-chat', 'llama-2-7b-chat', 'llama-80b'],
            stream: true,
            max_tokens: 4000,
            maxTokens: 4000
        }, {
            ...data,
            responseType: 'stream'
        }).catch(() => null);

        console.log('Response from llama-2-70b-chat:', response?.data);

        if (response?.status === 200) return respondStream();
        else return interaction.editReply(localize(locale, 'MODELS_DOWN'));
    }
};