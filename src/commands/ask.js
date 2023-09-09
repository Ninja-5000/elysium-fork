const { default: axios } = require("axios");
const { SlashCommandBuilder, ChatInputCommandInteraction } = require("discord.js");
const { QuickDB } = require("quick.db");
const { localize } = require("../modules/localization");
const EmbedMaker = require("../modules/embed");
const { request, RequestMethod } = require("fetchu.js");

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
                tr: 'Hata ayıklama modu. Varsayılan: false'
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

        if (user.usage >= 25 && !user.premium) return interaction.editReply(localize(locale, 'LIMIT_REACHED', 25));

        async function respond() {
            await interaction.editReply({
                content: response.body.choices[0].message.content,
                embeds: debug ? [
                    new EmbedMaker(interaction.client)
                        .setColor('9b59b6')
                        .setTitle('Debug')
                        .setFields(
                            {
                                name: 'Model',
                                value: response.body.model ?? 'Unknown',
                                inline: true
                            },
                            {
                                name: 'Provider',
                                value: response.body.provider ?? 'Unknown',
                                inline: true
                            }
                        )
                ] : []
            });

            user.usage++;

            await db.set(`users.${interaction.user.id}`, user);
        };

        let response;

        response = await request({
            url: 'https://beta.purgpt.xyz/openai/chat/completions',
            method: RequestMethod.Post,
            body: {
                model: 'gpt-4-32k',
                messages: [
                    {
                        role: 'user',
                        content: question
                    }
                ],
                fallbacks: ['gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
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
            url: 'https://beta.purgpt.xyz/hugging-face/chat/completions',
            method: RequestMethod.Post,
            body: {
                model: 'llama-2-70b-chat',
                messages: [
                    {
                        role: 'user',
                        content: question
                    }
                ],
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
                messages: [
                    {
                        role: 'user',
                        content: question
                    }
                ],
                max_tokens: 2000,
                maxTokens: 2000
            },
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
            }
        });

        if (response.ok) return respond();
        else return interaction.editReply(localize(locale, 'MODELS_DOWN'));
    }
};