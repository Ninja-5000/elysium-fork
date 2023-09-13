const { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const EmbedMaker = require("../modules/embed");
const { localize } = require("../modules/localization");
const { emojis } = require("../../config");

module.exports = {
    category: 'General',
    data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription("Shows information about the premium")
    .setDescriptionLocalizations({
        tr: 'Premium hakkında bilgi gösterir'
    }),
    /**
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();

        let locale = interaction.locale;

        interaction.editReply({
            embeds: [
                new EmbedMaker(interaction.client)
                .setTitle(`${emojis.premium} Premium`)
                .setDescription(localize(locale, 'PREMIUM_DESCRIPTION'))
                .setFields(
                    {
                        name: localize(locale, 'WHAT_WILL_YOU_GET'),
                        value: localize(locale, 'PREMIUM_PERKS')
                    },
                    {
                        name: `${emojis.premium} ${localize(locale, 'BUY_NOW')}`,
                        value: `- [${localize(locale, 'BUY_ON_GITHUB')}](https://github.com/sponsors/Tolga1452/sponsorships?sponsor=Tolga1452&tier_id=316102&preview=false)\n- [${localize(locale, 'BUY_ON_SERVER')}](https://discord.gg/experiments)`
                    }
                )
            ]
        });
    }
};