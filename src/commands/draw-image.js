const { default: axios } = require("axios");
const { SlashCommandBuilder, ChatInputCommandInteraction } = require("discord.js");
const { QuickDB } = require("quick.db");
const { localize } = require("../modules/localization");
const EmbedMaker = require("../modules/embed");

const db = new QuickDB();

module.exports = {
    category: 'General',
    data: new SlashCommandBuilder()
        .setName('draw-image')
        .setNameLocalizations({
            tr: 'resim-çiz'
        })
        .setDescription('Draws an image')
        .setDescriptionLocalizations({
            tr: 'Bir resim çizer'
        })
        .addStringOption(option => option
            .setName('prompt')
            .setDescription('The prompt you want to draw')
            .setDescriptionLocalizations({
                tr: 'Çizmek istediğiniz şey'
            })
            .setRequired(true)
        )
        .addIntegerOption(option => option
            .setName('count')
            .setNameLocalizations({
                tr: 'sayı'
            })
            .setDescription('The number of images you want to draw. Default: 1')
            .setDescriptionLocalizations({
                tr: 'Çizmek istediğiniz resim sayısı. Varsayılan: 1'
            })
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(4)
        )
        .addStringOption(option => option
            .setName('style')
            .setDescription('The style you want to draw. Default: Regular')
            .setDescriptionLocalizations({
                tr: 'Çizmek istediğiniz tarz. Varsayılan: Normal'
            })
            .setRequired(false)
            .setChoices(
                {
                    name: 'Regular',
                    name_localizations: {
                        tr: 'Normal'
                    },
                    value: 'regular'
                },
                {
                    name: 'Anime',
                    value: 'anime'
                }
            )
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

        let prompt = interaction.options.getString('prompt');
        let count = interaction.options.getInteger('count') ?? 1;
        let style = interaction.options.getString('style') ?? 'regular';
        let debug = interaction.options.getBoolean('debug') ?? false;
        let user = await db.get(`users.${interaction.user.id}`) ?? {
            usage: 0,
            premium: false
        };
        let locale = interaction.locale;

        if (user.usage >= 25 && !user.premium) return interaction.editReply(localize(locale, 'LIMIT_REACHED', 25));

        async function respond() {
            await interaction.editReply({
                files: response.data.data.map(image => image.url),
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

        let data = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
            }
        };
        let response;

        if (style === 'regular') {
            response = await axios.post('https://beta.purgpt.xyz/stabilityai/images/generations', {
                model: 'sdxl',
                prompt,
                n: count,
                fallbacks: ['stable-diffusion-2.1', 'stable-diffusion-1.5', 'stable-diffusion-1.4', 'stable-diffusion']
            }, data).catch(() => null);

            if (response?.status === 200) return respond();

            response = await axios.post('https://beta.purgpt.xyz/prodia/images/generations', {
                model: 'anything-diffusion-5',
                prompt,
                n: count,
                fallbacks: ['anything-diffusion-4.5', 'anything-diffusion-3']
            }, data).catch(() => null);

            if (response?.status === 200) return respond();

            response = await axios.post('https://beta.purgpt.xyz/openai/images/generations', {
                model: 'dall-e',
                prompt,
                n: count
            }, data).catch(() => null);
        } else if (style === 'anime') {
            response = await axios.post('https://beta.purgpt.xyz/prodia/images/generations', {
                model: 'anime-diffusion',
                prompt,
                n: count
            }, data).catch(() => null);
        };

        if (response?.status === 200) return respond();
        else return interaction.editReply(localize(locale, 'MODELS_DOWN'));
    }
};