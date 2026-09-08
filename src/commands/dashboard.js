const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

const db = require("../database/db");

function formatDurationMs(ms) {
  if (!ms || ms <= 0) return "N/A";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length ? parts.join(" ") : "<1m";
}

function timeframeToMs(value) {
  if (!value) return 0;

  const text = String(value);

  let total = 0;

  const day = text.match(/(\d+)\s*day/i);
  const hour = text.match(/(\d+)\s*hour/i);
  const minute = text.match(/(\d+)\s*minute/i);
  const second = text.match(/(\d+)\s*second/i);

  if (day) total += Number(day[1]) * 86400000;
  if (hour) total += Number(hour[1]) * 3600000;
  if (minute) total += Number(minute[1]) * 60000;
  if (second) total += Number(second[1]) * 1000;

  return total;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Show Echo Monitor statistics"),

  async execute(interaction) {
    try {
      const total = db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM monitors
        `)
        .get().count;

      const monitoring = db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM monitors
          WHERE status != 'Unbanned'
        `)
        .get().count;

      const completed = db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM monitors
          WHERE status = 'Unbanned'
        `)
        .get().count;

      const lastCompleted = db
        .prepare(`
          SELECT username
          FROM monitors
          WHERE status = 'Unbanned'
          ORDER BY id DESC
          LIMIT 1
        `)
        .get();

      const completedRows = db
        .prepare(`
          SELECT timeframe
          FROM monitors
          WHERE status = 'Unbanned'
        `)
        .all();

      const durations = completedRows
        .map((row) => timeframeToMs(row.timeframe))
        .filter((value) => value > 0);

      let averageMs = 0;

      if (durations.length > 0) {
        averageMs =
          durations.reduce((a, b) => a + b, 0) /
          durations.length;
      }

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("📊 Echo Monitor Dashboard")
        .setDescription(
          `🟡 **Monitoring:** ${monitoring}\n` +
          `✅ **Completed:** ${completed}\n` +
          `📈 **Total Accounts:** ${total}\n` +
          `⏱️ **Average Recovery Time:** ${formatDurationMs(averageMs)}\n` +
          `🏆 **Last Completed:** ${
            lastCompleted
              ? `@${lastCompleted.username}`
              : "N/A"
          }`
        )
        .setTimestamp()
        .setFooter({
          text: "Echo Monitor",
        });

      return await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("❌ Dashboard error:", error);

      return await interaction.reply({
        content: "❌ Dashboard load nahi ho paya.",
        ephemeral: true,
      });
    }
  },
};