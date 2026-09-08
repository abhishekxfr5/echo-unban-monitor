const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const db = require("../database/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("realmonitor")
    .setDescription("Start real Instagram recovery monitoring")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Instagram username to monitor")
        .setRequired(true)
    ),

  async execute(interaction) {
    const username = interaction.options
      .getString("username")
      .trim()
      .replace(/^@/, "");

    // =========================================
    // ACKNOWLEDGE DISCORD IMMEDIATELY
    // =========================================

    await interaction.deferReply();

    try {
      // =========================================
      // CHECK EXISTING MONITOR
      // =========================================

      const existing = db
        .prepare(
          "SELECT * FROM monitors WHERE username = ?"
        )
        .get(username);

      if (existing) {
        return await interaction.editReply({
          content:
            `❌ **@${username}** already monitor ho raha hai.`,
        });
      }

      // =========================================
      // CREATE MONITOR
      // =========================================

      const createdAt = Date.now();

      const result = db
        .prepare(`
          INSERT INTO monitors (
            username,
            status,
            followers,
            timeframe,
            review,
            created_at,
            channel_id,
            last_checked_at,
            last_check_ok,
            recovery_streak,
            monitor_type
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          username,
          "Monitoring",
          "N/A",
          "Running",
          "Real Monitoring",
          createdAt,
          interaction.channelId,
          null,
          0,
          0,
          "real"
        );

      const monitorId =
        Number(result.lastInsertRowid);

      // =========================================
      // EMBED
      // =========================================

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(
          "🟢 Real Instagram Monitoring"
        )
        .setDescription(
          `**Username:** @${username}\n` +
          `**Status:** 🟢 Monitoring\n` +
          `**Type:** Real Recovery Monitor\n` +
          `**Started:** <t:${Math.floor(
            createdAt / 1000
          )}:R>\n\n` +
          `Your account is being monitored for recovery.\n` +
          `When the account becomes available again, you will receive a full profile notification.`
        )
        .setTimestamp()
        .setFooter({
          text:
            "Echo Monitor • Real Recovery Monitoring",
        });

      // =========================================
      // STOP BUTTON
      // =========================================

      const buttons =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              `monitor_delete:${monitorId}`
            )
            .setLabel("Stop Monitoring")
            .setEmoji("🛑")
            .setStyle(
              ButtonStyle.Danger
            )
        );

      // =========================================
      // SEND AFTER DEFER
      // =========================================

      const message =
        await interaction.editReply({
          embeds: [embed],
          components: [buttons],
        });

      // =========================================
      // SAVE MESSAGE ID
      // =========================================

      db.prepare(`
        UPDATE monitors
        SET message_id = ?,
            channel_id = ?
        WHERE id = ?
      `).run(
        message.id,
        interaction.channelId,
        monitorId
      );

      console.log(
        `🟢 REAL MONITOR STARTED: @${username} | ID ${monitorId}`
      );

    } catch (error) {
      console.error(
        "❌ REAL MONITOR ERROR:",
        error
      );

      if (
        interaction.deferred ||
        interaction.replied
      ) {
        await interaction.editReply({
          content:
            "❌ Real monitor start nahi ho saka. Terminal check karo.",
          embeds: [],
          components: [],
        }).catch(() => {});
      }
    }
  },
};