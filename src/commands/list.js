const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database/db");

function formatFollowers(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "N/A";
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .trim();

  if (!/^\d+$/.test(cleaned)) {
    return String(value);
  }

  return Number(cleaned).toLocaleString("en-US");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("Show all monitored accounts"),

  async execute(interaction) {
    const rows = db
      .prepare(`
        SELECT *
        FROM monitors
        ORDER BY id DESC
      `)
      .all();

    if (!rows.length) {
      return interaction.reply(
        "❌ No monitored accounts."
      );
    }

    const edited = rows.filter(
      (r) => r.monitor_type !== "real"
    );

    const real = rows.filter(
      (r) => r.monitor_type === "real"
    );

    const embed = new EmbedBuilder()
      .setTitle("📋 Echo Unban Monitor")
      .setColor(0x2b2d31)
      .setTimestamp();

    // =========================
    // EDITED / MANUAL
    // =========================

    if (edited.length) {
      let value = "";

      for (const r of edited) {
        value +=
          `**@${r.username}**\n` +
          `Status: ${r.status || "Monitoring"}\n` +
          `Followers: ${formatFollowers(r.followers)}\n` +
          `Time: ${r.timeframe || "Running"}\n\n`;
      }

      embed.addFields({
        name: `🟡 Edited / Manual (${edited.length})`,
        value: value.slice(0, 1024),
        inline: false,
      });
    } else {
      embed.addFields({
        name: "🟡 Edited / Manual",
        value: "No edited monitors.",
        inline: false,
      });
    }

    // =========================
    // REAL MONITORS
    // =========================

    if (real.length) {
      let value = "";

      for (const r of real) {
        const streak =
          Number(r.recovery_streak || 0);

        value +=
          `**@${r.username}**\n` +
          `Status: ${r.status || "Monitoring"}\n` +
          `Followers: ${formatFollowers(r.followers)}\n` +
          `Recovery Check: ${streak}/2\n` +
          `Time: ${r.timeframe || "Running"}\n\n`;
      }

      embed.addFields({
        name: `🟢 Real Monitoring (${real.length})`,
        value: value.slice(0, 1024),
        inline: false,
      });
    } else {
      embed.addFields({
        name: "🟢 Real Monitoring",
        value: "No real monitors.",
        inline: false,
      });
    }

    await interaction.reply({
      embeds: [embed],
    });
  },
};