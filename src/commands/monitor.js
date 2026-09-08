const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const db = require("../database/db");
const { getInstagramAccount } = require("../utils/instagram");
const { createProfileCard } = require("../utils/profileCard");

const PROFILE_CARDS_DIR =
  process.env.PROFILE_CARDS_DIR ||
  path.join(process.cwd(), "profile-cards");

console.log("🔥 NEW SAVING MONITOR.JS LOADED");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("monitor")
    .setDescription("Start monitoring an Instagram account")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Instagram username")
        .setRequired(true)
    ),

  async execute(interaction) {
    // =====================================================
    // ACKNOWLEDGE DISCORD IMMEDIATELY
    // =====================================================

    await interaction.deferReply({
      ephemeral: false,
    });

    try {
      // ===================================================
      // GET USERNAME
      // ===================================================

      const username = interaction.options
        .getString("username")
        .trim()
        .replace(/^@/, "");

      if (!username) {
        return interaction.editReply({
          content: "❌ Please provide a valid Instagram username.",
        });
      }

      // ===================================================
      // CHECK EXISTING MONITOR
      // ===================================================

      const existing = db
        .prepare(
          "SELECT * FROM monitors WHERE username = ?"
        )
        .get(username);

      if (existing) {
        return interaction.editReply({
          content: `❌ **${username}** pehle se monitor ho raha hai.`,
        });
      }

      console.log(
        `🔍 Fetching Instagram data for @${username}...`
      );

      // ===================================================
      // FETCH INSTAGRAM
      // ===================================================

      const instagramData =
        await getInstagramAccount(username);

      console.log(
        "📦 Instagram data:",
        instagramData
      );

      // ===================================================
      // FOLLOWERS
      // ===================================================

      let followers = "N/A";
      let formattedFollowers = "N/A";

      if (
        instagramData &&
        instagramData.followersCount !== null &&
        instagramData.followersCount !== undefined
      ) {
        followers = String(
          instagramData.followersCount
        );

        formattedFollowers = Number(
          instagramData.followersCount
        ).toLocaleString("en-US");

        console.log(
          `✅ @${username}: ${formattedFollowers} followers fetched`
        );
      } else {
        console.log(
          `⚠️ Followers fetch nahi hue for @${username}`
        );
      }

      // ===================================================
      // CREATE DATABASE MONITOR
      // ===================================================

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
          followers,
          "Running",
          "Under review",
          createdAt,
          interaction.channelId,
          null,
          0,
          0,
          "edited"
        );

      const monitorId =
        Number(result.lastInsertRowid);

      console.log(
        `🆔 MONITOR ID CREATED: ${monitorId}`
      );

      // ===================================================
      // GENERATE PROFILE CARD
      // ===================================================

      let profileAttachment = null;

      if (instagramData) {
        try {
          console.log(
            `🎨 Generating profile card for @${username}...`
          );

          const cardBuffer =
            await createProfileCard({
              username:
                instagramData.username ||
                username,

              fullName:
                instagramData.fullName ||
                "",

              followersCount:
                instagramData.followersCount,

              followingCount:
                instagramData.followingCount,

              postsCount:
                instagramData.postsCount,

              profilePicUrl:
                instagramData.profilePicUrl,

              verified:
                instagramData.verified ||
                false,
            });

          // =================================================
          // VERIFY BUFFER
          // =================================================

          if (
            !cardBuffer ||
            !Buffer.isBuffer(cardBuffer)
          ) {
            throw new Error(
              "createProfileCard did not return a valid Buffer"
            );
          }

          console.log(
            `✅ PROFILE CARD GENERATED (${cardBuffer.length} bytes)`
          );

          // =================================================
          // CREATE PROFILE-CARDS FOLDER
          // =================================================

          const cardsFolder =
            path.resolve(PROFILE_CARDS_DIR);

          fs.mkdirSync(
            cardsFolder,
            {
              recursive: true,
            }
          );

          console.log(
            `📁 PROFILE CARDS FOLDER: ${cardsFolder}`
          );

          // =================================================
          // SAVE CARD
          // =================================================

          const cardPath =
            path.resolve(
              cardsFolder,
              `${monitorId}.png`
            );

          fs.writeFileSync(
            cardPath,
            cardBuffer
          );

          // =================================================
          // VERIFY SAVED FILE
          // =================================================

          if (!fs.existsSync(cardPath)) {
            throw new Error(
              `Profile card write failed: ${cardPath}`
            );
          }

          const savedFile =
            fs.statSync(cardPath);

          console.log(
            `✅ PROFILE CARD SAVED: ${cardPath}`
          );

          console.log(
            `💾 SAVED FILE SIZE: ${savedFile.size} bytes`
          );

          // =================================================
          // DISCORD ATTACHMENT
          // =================================================

          profileAttachment =
            new AttachmentBuilder(
              cardBuffer,
              {
                name:
                  "instagram-profile.png",
              }
            );

          console.log(
            "📎 PROFILE CARD ATTACHMENT READY"
          );

        } catch (error) {
          console.error(
            "❌ PROFILE CARD GENERATION/SAVE ERROR:",
            error
          );
        }
      }

      // ===================================================
      // MONITOR EMBED
      // ===================================================

      const embed =
        new EmbedBuilder()
          .setColor(0x2b2d31)

          .setTitle(
            "Echo Unban Monitor"
          )

          .setDescription(
            `**Username:** ${username}\n` +
            `**Status:** 🟡 Monitoring\n` +
            `**Followers:** ${formattedFollowers}\n` +
            `**Time:** Running\n` +
            `**Review:** Under review\n` +
            `**Auto Complete:** Off`
          )

          .setTimestamp();

      // ===================================================
      // SHOW PROFILE CARD
      // ===================================================

      if (profileAttachment) {
        embed.setImage(
          "attachment://instagram-profile.png"
        );
      }

      // ===================================================
      // BUTTONS
      // ===================================================

      const buttons =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                `monitor_edit:${monitorId}`
              )
              .setLabel("Edit")
              .setEmoji("✏️")
              .setStyle(
                ButtonStyle.Primary
              ),

            new ButtonBuilder()
              .setCustomId(
                `monitor_complete:${monitorId}`
              )
              .setLabel("Complete")
              .setEmoji("✅")
              .setStyle(
                ButtonStyle.Success
              ),

            new ButtonBuilder()
              .setCustomId(
                `monitor_delete:${monitorId}`
              )
              .setLabel("Delete")
              .setEmoji("🗑️")
              .setStyle(
                ButtonStyle.Danger
              )
          );

      // ===================================================
      // SEND MONITOR MESSAGE
      // ===================================================

      const replyOptions = {
        embeds: [embed],
        components: [buttons],
      };

      if (profileAttachment) {
        replyOptions.files = [
          profileAttachment,
        ];
      }

      await interaction.editReply(
        replyOptions
      );

      // ===================================================
      // GET MESSAGE
      // ===================================================

      const message =
        await interaction.fetchReply();

      // ===================================================
      // SAVE DISCORD MESSAGE ID
      // ===================================================

      db.prepare(`
        UPDATE monitors
        SET
          message_id = ?,
          channel_id = ?
        WHERE id = ?
      `).run(
        message.id,
        interaction.channelId,
        monitorId
      );

      console.log(
        `✅ MONITOR READY: @${username} | ID ${monitorId}`
      );

    } catch (error) {
      console.error(
        "❌ MONITOR COMMAND ERROR:",
        error
      );

      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content:
              "❌ Monitor create karte waqt error aa gaya. Console check karo.",
          });
        }
      } catch (replyError) {
        console.error(
          "❌ Failed to send error reply:",
          replyError.message
        );
      }
    }
  },
};