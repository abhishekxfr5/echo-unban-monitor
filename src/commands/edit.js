const { SlashCommandBuilder } = require("discord.js");
const db = require("../database/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit monitored account details")
    .addStringOption(option =>
      option.setName("username").setDescription("Username").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("status").setDescription("Status").setRequired(false)
    )
    .addStringOption(option =>
      option.setName("followers").setDescription("Followers").setRequired(false)
    )
    .addStringOption(option =>
      option.setName("timeframe").setDescription("Timeframe").setRequired(false)
    )
    .addStringOption(option =>
      option.setName("review").setDescription("Review text").setRequired(false)
    ),

  async execute(interaction) {
    const username = interaction.options.getString("username");
    const status = interaction.options.getString("status");
    const followers = interaction.options.getString("followers");
    const timeframe = interaction.options.getString("timeframe");
    const review = interaction.options.getString("review");

    const existing = db.prepare("SELECT * FROM monitors WHERE username = ?").get(username);

    if (!existing) {
      return interaction.reply({
        content: "❌ Username monitor list me nahi mila.",
        ephemeral: true,
      });
    }

    db.prepare(`
      UPDATE monitors
      SET status = ?, followers = ?, timeframe = ?, review = ?
      WHERE username = ?
    `).run(
      status || existing.status,
      followers || existing.followers,
      timeframe || existing.timeframe,
      review || existing.review,
      username
    );

    await interaction.reply(
      `✅ Updated **${username}**\n` +
      `Status: **${status || existing.status}**\n` +
      `Followers: **${followers || existing.followers}**\n` +
      `Timeframe: **${timeframe || existing.timeframe}**\n` +
      `Review: **${review || existing.review}**`
    );
  },
};