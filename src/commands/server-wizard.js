const { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, GuildFeature, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionCollector, ComponentType, InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { localize } = require("../modules/localization");
const EmbedMaker = require("../modules/embed");
const { QuickDB } = require("quick.db");
const { default: axios } = require("axios");
const { emojis } = require("../../config");

const db = new QuickDB();

module.exports = {
    category: 'Owner',
    data: new SlashCommandBuilder()
        .setName('server-wizard')
        .setNameLocalizations({
            tr: 'sunucu-sihirbazi'
        })
        .setDescription('Personalize your server with AI')
        .setDescriptionLocalizations({
            tr: 'Sunucunu yapay zeka ile kişiselleştir'
        })
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand
            .setName('setup-channels')
            .setNameLocalizations({
                tr: 'kanalları-ayarla'
            })
            .setDescription('Setup channels for your server')
            .setDescriptionLocalizations({
                tr: 'Sunucunuz için kanalları ayarlayın'
            })
            .addStringOption(option => option
                .setName('prompt')
                .setNameLocalizations({
                    tr: 'açıklama'
                })
                .setDescription('Prompt to setup channels')
                .setDescriptionLocalizations({
                    tr: 'Kanalları ayarlamak için açıklama'
                })
                .setRequired(true)
            )
        ),
    /**
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        let reply = await interaction.deferReply({
            fetchReply: true
        });

        let subcommand = interaction.options.getSubcommand();
        let user = await db.get(`users.${interaction.user.id}`) ?? {
            usage: 0,
            premium: false
        };
        let locale = interaction.locale;

        if (user.usage >= 25 && !user.premium) return interaction.editReply(localize(locale, 'LIMIT_REACHED', 25));
        if (subcommand === 'setup-channels') {
            let prompt = interaction.options.getString('prompt');
            let messages = [
                {
                    role: 'system',
                    content: 'You are Server Wizard. You will setup channels for a server. You will respond with array of channels like this:\n[{"type": "category", "name": "Example Category", "channels": [{"type": "text", "name": "example-text"}, {"type": "voice", "name": "Example Voice"}, {"type": "forum", "name": "example-forum"}, {"type": "announcement", "name": "Example Announcement"}, {"type": "stage", "name": "Example Stage"}]}, {"type": "category", "name": "Example Category 2", "channels": [{"type": "text", "name": "example-text-2"}, {"type": "voice", "name": "Example Voice 2"}, {"type": "forum", "name": "example-forum-2"}, {"type": "announcement", "name": "Example Announcement 2"}, {"type": "stage", "name": "Example Stage 2"}]}]'
                },
                {
                    role: 'system',
                    content: "Let's do some practice."
                },
                {
                    role: 'user',
                    content: 'Prompt to setup channels:\nCreate a gaming server with at least 2 categories',
                    name: 'example_user'
                },
                {
                    role: 'assistant',
                    content: '[\n  {\n    \"type\": \"category\",\n    \"name\": \"General\",\n    \"channels\": [\n      {\n        \"type\": \"text\",\n        \"name\": \"general-chat\"\n      },\n      {\n        \"type\": \"voice\",\n        \"name\": \"Voice Chat\"\n      }\n    ]\n  },\n  {\n    \"type\": \"category\",\n    \"name\": \"Game Discussion\",\n    \"channels\": [\n      {\n        \"type\": \"text\",\n        \"name\": \"game-news\"\n      },\n      {\n        \"type\": \"text\",\n        \"name\": \"game-strategies\"\n      },\n      {\n        \"type\": \"voice\",\n        \"name\": \"Game Voice Chat\"\n      }\n    ]\n  }\n]',
                    name: 'example_assistant'
                },
                {
                    role: 'user',
                    content: 'Can you please add a channel for announcements?',
                    name: 'example_user'
                },
                {
                    role: 'assistant',
                    content: '[\n  {\n    \"type\": \"category\",\n    \"name\": \"General\",\n    \"channels\": [\n      {\n        \"type\": \"text\",\n        \"name\": \"general-chat\"\n      },\n      {\n        \"type\": \"voice\",\n        \"name\": \"Voice Chat\"\n      }\n    ]\n  },\n  {\n    \"type\": \"category\",\n    \"name\": \"Game Discussion\",\n    \"channels\": [\n      {\n        \"type\": \"text\",\n        \"name\": \"game-news\"\n      },\n      {\n        \"type\": \"text\",\n        \"name\": \"game-strategies\"\n      },\n      {\n        \"type\": \"voice\",\n        \"name\": \"Game Voice Chat\"\n      }\n    ]\n  },\n  {\n    \"type\": \"category\",\n    \"name\": \"Announcements\",\n    \"channels\": [\n      {\n        \"type\": \"announcement\",\n        \"name\": \"announcements\"\n      }\n    ]\n  }\n]',
                    name: 'example_assistant'
                },
                {
                    role: 'system',
                    content: 'Great! Now you are ready to setup channels for a server. Do not forget, YOU WILL ONLY RESPOND WITH ARRAY OF CHANNELS. NOT WITH ANYTHING ELSE. And you will use your creativity to setup channels for a server.'
                },
                {
                    role: 'user',
                    content: `Prompt to setup channels:\n${prompt}`
                }
            ];
            let response = await axios.post('https://beta.purgpt.xyz/openai/chat/completions', {
                model: 'gpt-4',
                messages,
                fallbacks: ['gpt-3.5-turbo-16k', 'gpt-3.5-turbo'],
                temperature: 2
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                }
            }).catch(() => null);

            if (response?.status !== 200) return interaction.editReply(localize(locale, 'MODELS_DOWN'));

            let message = response.data.choices[0].message;

            messages.push(message.content);

            let channels;

            try {
                channels = JSON.parse(message);
            } catch (error) {
                return interaction.editReply(localize(locale, 'INVALID_RESPONSE'));
            };

            if (!Array.isArray(channels)) return interaction.editReply(localize(locale, 'INVALID_RESPONSE'));

            await interaction.editReply({
                embeds: [
                    new EmbedMaker(interaction.client)
                        .setTitle('Channels')
                        .setDescription(channels.map(channel => `- ${channel.type === 'category' ? emojis.categoryChannel : channel.type === 'text' ? emojis.textChannel : channel.type === 'voice' ? emojis.voiceChannel : channel.type === 'forum' ? emojis.forumChannel : channel.type === 'announcement' ? emojis.announcementChannel : emojis.stageChannel} ${channel.name}${channel.type === 'category' ? `\n${channel.channels.map(subchannel => `  - ${subchannel.type === 'text' ? emojis.textChannel : subchannel.type === 'voice' ? emojis.voiceChannel : subchannel.type === 'forum' ? emojis.forumChannel : subchannel.type === 'announcement' ? emojis.announcementChannel : emojis.stageChannel} ${subchannel.name}`).join('\n')}` : ''}`).join('\n'))
                ],
                components: [
                    new ActionRowBuilder()
                        .setComponents(
                            new ButtonBuilder()
                                .setCustomId('setup')
                                .setEmoji(emojis.update)
                                .setLabel('Setup Channels')
                                .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                .setCustomId('follow-up')
                                .setEmoji(emojis.send)
                                .setLabel('Add Follow Up')
                                .setStyle(ButtonStyle.Secondary)
                        )
                ]
            });

            const collector = new InteractionCollector(interaction.client, {
                message: reply.id,
                idle: 300000,
                filter: int => int.user.id === interaction.user.id
            });

            collector.on('collect', async int => {
                if (int.customId === 'follow-up') int.showModal(
                    new ModalBuilder()
                        .setCustomId('follow-up-modal')
                        .setTitle('Follow Up')
                        .setComponents(
                            new ActionRowBuilder()
                                .setComponents(
                                    new TextInputBuilder()
                                        .setCustomId('message')
                                        .setLabel('Message')
                                        .setRequired(true)
                                        .setStyle(TextInputStyle.Paragraph)
                                )
                        )
                );
                else if (int.customId === 'follow-up-modal') {
                    await int.deferUpdate();
                    await interaction.editReply({
                        content: ''
                    })

                    let message = int.fields.getTextInputValue('message');

                    messages.push({
                        role: 'user',
                        content: message
                    });

                    let response = await axios.post('https://beta.purgpt.xyz/openai/chat/completions', {
                        model: 'gpt-4',
                        messages,
                        fallbacks: ['gpt-3.5-turbo-16k', 'gpt-3.5-turbo'],
                        temperature: 2
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${process.env.PURGPT_API_KEY}`
                        }
                    }).catch(error => console.error(error?.response ?? error));

                    if (response?.status !== 200) return interaction.editReply(localize(locale, 'MODELS_DOWN'));

                    let responseMessage = response.data.choices[0].message;

                    messages.push(responseMessage);

                    let channels;

                    try {
                        channels = JSON.parse(responseMessage.content);
                    } catch (error) {
                        return interaction.editReply(localize(locale, 'INVALID_RESPONSE'));
                    };

                    if (!Array.isArray(channels)) return interaction.editReply(localize(locale, 'INVALID_RESPONSE'));

                    await interaction.editReply({
                        embeds: [
                            new EmbedMaker(interaction.client)
                                .setTitle('Channels')
                                .setDescription(channels.map(channel => `- ${channel.type === 'category' ? emojis.categoryChannel : channel.type === 'text' ? emojis.textChannel : channel.type === 'voice' ? emojis.voiceChannel : channel.type === 'forum' ? emojis.forumChannel : channel.type === 'announcement' ? emojis.announcementChannel : emojis.stageChannel} ${channel.name}${channel.type === 'category' ? `\n${channel.channels.map(subchannel => `  - ${subchannel.type === 'text' ? emojis.textChannel : subchannel.type === 'voice' ? emojis.voiceChannel : subchannel.type === 'forum' ? emojis.forumChannel : subchannel.type === 'announcement' ? emojis.announcementChannel : emojis.stageChannel} ${subchannel.name}`).join('\n')}` : ''}`).join('\n'))
                        ]
                    });
                } else if (int.customId === 'setup') {
                    await int.deferUpdate();

                    for (let channel of channels) {
                        if (!channel.type || !channel.name || !['category', 'text', 'voice', 'forum', 'announcement', 'stage'].includes(channel.type)) return interaction.editReply(localize(locale, 'INVALID_RESPONSE'));

                        if (channel.type === 'category') {
                            let category = await interaction.guild.channels.create({
                                type: ChannelType.GuildCategory,
                                name: channel.name
                            });

                            for (let subchannel of channel.channels) {
                                if (!subchannel.type || !subchannel.name || !['text', 'voice', 'forum', 'announcement', 'stage'].includes(subchannel.type)) return interaction.editReply(localize(locale, 'INVALID_RESPONSE'));

                                await interaction.guild.channels.create({
                                    name: subchannel.name,
                                    type: subchannel.type === 'text' ? ChannelType.GuildText : subchannel.type === 'voice' ? ChannelType.GuildVoice : subchannel.type === 'forum' ? ChannelType.GuildForum : subchannel.type === 'announcement' ? (interaction.guild.features.includes(GuildFeature.Community) ? ChannelType.GuildAnnouncement : ChannelType.GuildText) : ChannelType.GuildStageVoice,
                                    parent: category.id
                                });

                                await new Promise(resolve => setTimeout(resolve, 1000));
                            };
                        } else await interaction.guild.channels.create({
                            name: channel.name,
                            type: channel.type === 'text' ? ChannelType.GuildText : channel.type === 'voice' ? ChannelType.GuildVoice : channel.type === 'forum' ? ChannelType.GuildForum : channel.type === 'announcement' ? (interaction.guild.features.includes(GuildFeature.Community) ? ChannelType.GuildAnnouncement : ChannelType.GuildText) : ChannelType.GuildStageVoice,
                        });

                        await new Promise(resolve => setTimeout(resolve, 1000));
                    };

                    await interaction.editReply({
                        content: localize(locale, 'CHANNELS_SETUP'),
                        components: [],
                        embeds: []
                    });
                };
            });
        };
    }
};