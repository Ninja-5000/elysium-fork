const { SlashCommandBuilder, ChatInputCommandInteraction } = require("discord.js");
const { QuickDB } = require("quick.db");
const { localize } = require("../modules/localization");

const db = new QuickDB();

module.exports = {
    category: 'General',
    data: new SlashCommandBuilder()
    .setName('switch-model')
    .setDescription('Switches the AI model for chat')
    .setDescriptionLocalizations({
        tr: 'Sohbet için AI modelini değiştirir'
    })
    .addStringOption(option => option.setName('model').setDescription('The model to switch to').setDescriptionLocalizations({
        tr: 'Geçilecek model'
        }).setRequired(true).addChoices(
            {
                name: 'Automatic (Default, Recommended)',
                value: 'auto'
            },
            {
                name: 'OpenAI Models (Recommended for functions)',
                value: 'openai'
            },
            {
                name: 'LLama Models',
                value: 'llama'
            },
            {
                name: 'PurGPT Models (Recommended for role-plays)',
                value: 'purgpt'
            }
        )),
    /**
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();

        let model = interaction.options.getString('model');

        await db.set(`users.${interaction.user.id}.model`, model);
        
        await interaction.editReply(localize(interaction.locale, 'SWITCH_MODEL_SUCCESS'));
    }
};z