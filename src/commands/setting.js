const { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } = require("discord.js");
const { QuickDB } = require("quick.db");

const db = new QuickDB();

module.exports = {
    category: 'Moderator',
    data: new SlashCommandBuilder()
        .setName('setting')
        .setDescription("Manage the bot's settings")
        .setDescriptionLocalizations({
            tr: 'Bot ayarlarını yönetin'
        })
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommandGroup(group => group
            .setName('random-chat')
            .setNameLocalizations({
                tr: 'rastgele-sohbet'
            })
            .setDescription('Random chat settings')
            .setDescriptionLocalizations({
                tr: 'Rastgele sohbet ayarları'
            })
            .addSubcommand(subcommand => subcommand
                .setName('toggle')
                .setNameLocalizations({
                    tr: 'aç-kapat'
                })
                .addBooleanOption(option => option
                    .setName('status')
                    .setNameLocalizations({
                        tr: 'durum'
                    })
                    .setDescription('The status you want to set')
                    .setDescriptionLocalizations({
                        tr: 'Ayarlamak istediğiniz durum'
                    })
                    .setRequired(true)
                )
            )
        )
        .addSubcommandGroup(group => group
            .setName('ai-channel')
            .setNameLocalizations({
                tr: 'yapay-zeka-kanalı'
            })
            .setDescription('AI channel settings')
            .setDescriptionLocalizations({
                tr: 'Yapay zeka kanalı ayarları'
            })
            .addSubcommand(subcommand => subcommand
                .setName('toggle')
                .setNameLocalizations({
                    tr: 'aç-kapat'
                })
                .addBooleanOption(option => option
                    .setName('status')
                    .setNameLocalizations({
                        tr: 'durum'
                    })
                    .setDescription('The status you want to set')
                    .setDescriptionLocalizations({
                        tr: 'Ayarlamak istediğiniz durum'
                    })
                    .setRequired(true)
                )
            )
            .addSubcommand(subcommand => subcommand
                .setName('set')
                .setNameLocalizations({
                    tr: 'ayarla'
                })
                .setDescription('Set the AI channel')
                .setDescriptionLocalizations({
                    tr: 'Yapay zeka kanalını ayarlayın'
                })
                .addChannelOption(option => option
                    .setName('channel')
                    .setNameLocalizations({
                        tr: 'kanal'
                    })
                    .setDescription('The channel you want to set')
                    .setDescriptionLocalizations({
                        tr: 'Ayarlamak istediğiniz kanal'
                    })
                    .setRequired(true)
                )
            )
        ),
    /**
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();

        let subcommandGroup = interaction.options.getSubcommandGroup();
        let subcommand = interaction.options.getSubcommand();
        let guild = await db.get(`guilds.${interaction.guild.id}`) ?? {};

        if (subcommandGroup === 'random-chat') {
            if (subcommand === 'toggle') {
                let status = interaction.options.getBoolean('status');

                if (!guild.randomChat) guild.randomChat = {
                    status: false
                };

                guild.randomChat.status = status;

                await db.set(`guilds.${interaction.guild.id}`, guild);
            };
        } else if (subcommandGroup === 'ai-channel') {
            if (subcommand === 'toggle') {
                let status = interaction.options.getBoolean('status');

                if (!guild.aiChannel) guild.aiChannel = {
                    status: false,
                    channel: null
                };

                guild.aiChannel.status = status;

                await db.set(`guilds.${interaction.guild.id}`, guild);
            } else if (subcommand === 'set') {
                let channel = interaction.options.getChannel('channel');

                if (!guild.aiChannel) guild.aiChannel = {
                    status: false,
                    channel: null
                };

                guild.aiChannel.channel = channel.id;

                await db.set(`guilds.${interaction.guild.id}`, guild);
            };
        };
    }
};