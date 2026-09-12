require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const db = require("./database/db");

const monitor = require("./commands/monitor");
const realmonitor = require("./commands/realmonitor");
const list = require("./commands/list");
const edit = require("./commands/edit");
const dashboard = require("./commands/dashboard");

const { getInstagramAccount } = require("./utils/instagram");
const { createProfileCard } = require("./utils/profileCard");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const MONITOR_INTERVAL_MS = Math.max(
  30_000,
  Number(process.env.MONITOR_INTERVAL_SECONDS || 60) * 1000
);

const PROFILE_CARDS_DIR =
  process.env.PROFILE_CARDS_DIR ||
  path.join(process.cwd(), "profile-cards");

const RECOVERY_CONFIRMATIONS = Math.max(
  1,
  Number(process.env.RECOVERY_CONFIRMATIONS || 2)
);

let monitorCheckRunning = false;

/* =========================
   FORMAT DURATION
========================= */

function formatDuration(startTime) {
  const totalSeconds = Math.max(
    0,
    Math.floor((Date.now() - Number(startTime)) / 1000)
  );

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  const parts = [];

  if (days) {
    parts.push(
      `${days} day${days === 1 ? "" : "s"}`
    );
  }

  if (hours) {
    parts.push(
      `${hours} hour${hours === 1 ? "" : "s"}`
    );
  }

  if (minutes) {
    parts.push(
      `${minutes} minute${minutes === 1 ? "" : "s"}`
    );
  }

  parts.push(
    `${seconds} second${seconds === 1 ? "" : "s"}`
  );

  return parts.join(", ");
}

/* =========================
   FORMAT FOLLOWERS
========================= */

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

/* =========================
   PARSE TIMER
========================= */

function parseTimer(input) {
  if (!input) return null;

  const value = input.toLowerCase().trim();

  if (
    [
      "off",
      "none",
      "disable",
      "disabled",
      "0",
    ].includes(value)
  ) {
    return null;
  }

  const regex = /(\d+)\s*(d|h|m|s)/g;

  let totalMilliseconds = 0;
  let found = false;
  let match;

  while ((match = regex.exec(value)) !== null) {
    found = true;

    const amount = Number(match[1]);

    if (match[2] === "d") {
      totalMilliseconds +=
        amount * 86400000;
    }

    if (match[2] === "h") {
      totalMilliseconds +=
        amount * 3600000;
    }

    if (match[2] === "m") {
      totalMilliseconds +=
        amount * 60000;
    }

    if (match[2] === "s") {
      totalMilliseconds +=
        amount * 1000;
    }
  }

  if (
    !found ||
    totalMilliseconds <= 0
  ) {
    return undefined;
  }

  return totalMilliseconds;
}

/* =========================
   MONITOR BUTTONS
========================= */

function createButtons(monitorId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(
        `monitor_edit:${monitorId}`
      )
      .setLabel("Edit")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(
        `monitor_complete:${monitorId}`
      )
      .setLabel("Complete")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(
        `monitor_delete:${monitorId}`
      )
      .setLabel("Delete")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );
}

/* =========================
   AUTO TIMER TEXT
========================= */

function getAutoTimerText(
  autoCompleteAt
) {
  if (!autoCompleteAt) {
    return "Off";
  }

  const secondsLeft = Math.max(
    0,
    Math.floor(
      (Number(autoCompleteAt) -
        Date.now()) /
        1000
    )
  );

  if (secondsLeft <= 0) {
    return "Completing...";
  }

  const days = Math.floor(
    secondsLeft / 86400
  );

  const hours = Math.floor(
    (secondsLeft % 86400) / 3600
  );

  const minutes = Math.floor(
    (secondsLeft % 3600) / 60
  );

  const seconds = secondsLeft % 60;

  const pieces = [];

  if (days) {
    pieces.push(`${days}d`);
  }

  if (hours) {
    pieces.push(`${hours}h`);
  }

  if (minutes) {
    pieces.push(`${minutes}m`);
  }

  if (
    seconds ||
    !pieces.length
  ) {
    pieces.push(`${seconds}s`);
  }

  return pieces.join(" ");
}

/* =========================
   MONITOR EMBED
========================= */

function createMonitorEmbed(data) {
  const lastChecked =
    data.last_checked_at
      ? `<t:${Math.floor(
          Number(
            data.last_checked_at
          ) / 1000
        )}:R>`
      : "Not checked yet";

  const streak = Number(
    data.recovery_streak || 0
  );

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "Echo Unban Monitor",
      iconURL:
        client.user?.displayAvatarURL(),
    })
    .setDescription(
      `**Username:** @${data.username}\n` +
        `**Status:** ${
          data.status || "Monitoring"
        }\n` +
        `**Followers:** ${formatFollowers(
          data.followers
        )}\n` +
        `**Time:** Running\n` +
        `**Review:** ${
          data.review || "Under review"
        }\n` +
        `**Live Monitor:** 🟢 ON\n` +
        `**Recovery Check:** ${streak}/${RECOVERY_CONFIRMATIONS}\n` +
        `**Last Check:** ${lastChecked}\n` +
        `**Auto Complete Timer:** ${getAutoTimerText(
          data.auto_complete_at
        )}`
    )
    .setTimestamp()
    .setFooter({
      text:
        "Echo Monitor • Live Instagram Monitoring",
    });
}

/* =========================
   SAVED PROFILE CARD
========================= */

async function getSavedCardAttachment(
  monitorId
) {
  const cardPath = path.join(
    PROFILE_CARDS_DIR,
    `${monitorId}.png`
  );

  if (!fs.existsSync(cardPath)) {
    console.log(
      `⚠️ Saved profile card not found: ${cardPath}`
    );

    return null;
  }

  console.log(
    `📎 Using saved profile card: ${cardPath}`
  );

  return new AttachmentBuilder(
    cardPath,
    {
      name: "instagram-profile.png",
    }
  );
}

/* =========================
   CREATE FRESH PROFILE CARD
========================= */

async function saveFreshProfileCard(
  monitorId,
  profile
) {
  if (!profile) {
    console.log(
      "⚠️ Cannot create profile card: profile is null"
    );

    return null;
  }

  try {
    console.log(
      `🎨 Generating profile card for @${profile.username}...`
    );

    const buffer =
      await createProfileCard(profile);

    if (!Buffer.isBuffer(buffer)) {
      throw new Error(
        "Profile card did not return a Buffer"
      );
    }

    console.log(
      `✅ PROFILE CARD GENERATED (${buffer.length} bytes)`
    );

    const folder =
      PROFILE_CARDS_DIR;

    fs.mkdirSync(folder, {
      recursive: true,
    });

    const cardPath = path.join(
      folder,
      `${monitorId}.png`
    );

    fs.writeFileSync(
      cardPath,
      buffer
    );

    console.log(
      `💾 PROFILE CARD SAVED: ${cardPath}`
    );

    return new AttachmentBuilder(
      cardPath,
      {
        name:
          "instagram-profile.png",
      }
    );
  } catch (error) {
    console.error(
      "❌ Profile card error:",
      error
    );

    return null;
  }
}

/* =========================
   VALID RECOVERED PROFILE
========================= */

function isValidRecoveredProfile(
  profile
) {
  return Boolean(
    profile &&
      profile.username &&
      (
        profile.followersCount !==
          null &&
        profile.followersCount !==
          undefined ||
        profile.profilePicUrl
      )
  );
}

/* =========================
   COMPLETE MONITOR
========================= */

async function completeMonitor(
  data,
  channel,
  freshProfile = null
) {
  const locked = db
    .prepare(`
      UPDATE monitors
      SET status = 'Completing',
          auto_complete_at = NULL
      WHERE id = ?
        AND status != 'Unbanned'
        AND status != 'Completing'
    `)
    .run(data.id);

  if (locked.changes !== 1) {
    console.log(
      `ℹ️ @${data.username} already completing/completed.`
    );

    return false;
  }

  console.log(
    `🏁 Completing monitor @${data.username}`
  );

  const automaticTimeframe =
    formatDuration(data.created_at);

  const automaticReview =
    "Successful Unban";

  const unbannedAt =
    Date.now();

  let profile =
    freshProfile;

  /* =========================
     FETCH FRESH PROFILE
  ========================= */

  if (!profile) {
    console.log(
      `🔍 Fetching fresh Instagram profile for @${data.username} before completion...`
    );

    profile =
      await getInstagramAccount(
        data.username
      ).catch((error) => {
        console.error(
          `❌ Fresh profile fetch failed for @${data.username}:`,
          error
        );

        return null;
      });
  }

  /* =========================
     FOLLOWERS
  ========================= */

  let followers =
    data.followers || "N/A";

  if (
    profile &&
    profile.followersCount !==
      null &&
    profile.followersCount !==
      undefined
  ) {
    followers = String(
      profile.followersCount
    );
  }

  console.log(
    `👥 Final followers for @${data.username}: ${followers}`
  );

  /* =========================
     PROFILE CARD
  ========================= */

  let profileAttachment =
    null;

  if (profile) {
    profileAttachment =
      await saveFreshProfileCard(
        data.id,
        profile
      );
  }

  if (!profileAttachment) {
    profileAttachment =
      await getSavedCardAttachment(
        data.id
      );
  }

  if (profileAttachment) {
    console.log(
      "🔗 PROFILE CARD ATTACHMENT READY"
    );
  } else {
    console.log(
      "⚠️ No profile card attachment available"
    );
  }

  /* =========================
     UPDATE DATABASE
  ========================= */

  db.prepare(`
    UPDATE monitors
    SET status = ?,
        followers = ?,
        timeframe = ?,
        review = ?,
        auto_complete_at = NULL,
        last_checked_at = ?,
        last_check_ok = 1,
        recovery_streak = ?
    WHERE id = ?
  `).run(
    "Unbanned",
    String(followers),
    automaticTimeframe,
    automaticReview,
    unbannedAt,
    RECOVERY_CONFIRMATIONS,
    data.id
  );

  /* =========================
     DELETE OLD MONITOR MESSAGE
  ========================= */

  if (data.message_id) {
    const oldMessage =
      await channel.messages
        .fetch(data.message_id)
        .catch(() => null);

    if (oldMessage) {
      await oldMessage
        .delete()
        .catch(() => null);
    }
  }

  /* =========================
     RECOVERY EMBED
  ========================= */

  const completedEmbed =
    new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(
        `Account Recovered | @${data.username} 🏆✅`
      )
      .setDescription(
        `**Followers:** ${formatFollowers(
          followers
        )}\n` +
          `⏱️ **Time Taken:** ${automaticTimeframe}`
      )
      .setTimestamp(
        unbannedAt
      )
      .setFooter({
        text:
          "Echo Monitor • Recovery Successful",
      });

  if (profileAttachment) {
    completedEmbed.setImage(
      "attachment://instagram-profile.png"
    );
  }

  /* =========================
     TEXT + EMBED + IMAGE
  ========================= */

  const sendOptions = {
    content:
      `🏆 **Account Recovered | @${data.username}**\n` +
      `👥 **Followers:** ${formatFollowers(
        followers
      )}\n` +
      `⏱️ **Time Taken:** ${automaticTimeframe}`,

    embeds: [
      completedEmbed,
    ],
  };

  if (profileAttachment) {
    sendOptions.files = [
      profileAttachment,
    ];
  }

  /* =========================
     SEND FINAL MESSAGE
  ========================= */

  try {
    await channel.send(
      sendOptions
    );

    console.log(
      `📨 Recovery notification sent for @${data.username}`
    );
  } catch (error) {
    console.error(
      `❌ Failed to send recovery notification for @${data.username}:`,
      error
    );

    db.prepare(`
      UPDATE monitors
      SET status = 'Monitoring'
      WHERE id = ?
    `).run(data.id);

    return false;
  }

  /* =========================
     REMOVE COMPLETED MONITOR
  ========================= */

  db.prepare(`
    DELETE FROM monitors
    WHERE id = ?
  `).run(data.id);

  console.log(
    `🗑️ Completed monitor removed from database: @${data.username}`
  );

  console.log(
    `🏆 COMPLETED @${data.username}`
  );

  return true;
}

/* =========================
   UPDATE MONITOR MESSAGE
========================= */

async function updateMonitorMessage(
  data,
  channel
) {
  const message =
    data.message_id
      ? await channel.messages
          .fetch(data.message_id)
          .catch(() => null)
      : null;

  if (!message) {
    return;
  }

  const embed =
    createMonitorEmbed(data);

  const attachment =
    await getSavedCardAttachment(
      data.id
    );

  const options = {
    embeds: [embed],
    components: [
      createButtons(data.id),
    ],
  };

  if (attachment) {
    embed.setImage(
      "attachment://instagram-profile.png"
    );

    options.files = [
      attachment,
    ];
  }

  await message
    .edit(options)
    .catch(() => null);
}

/* =========================
   REAL LIVE MONITORS
========================= */

async function checkLiveMonitors() {
  if (monitorCheckRunning) {
    return;
  }

  monitorCheckRunning = true;

  try {
    const rows =
      db.prepare(`
        SELECT *
        FROM monitors
        WHERE status = 'Monitoring'
          AND monitor_type = 'real'
      `).all();

    if (!rows.length) {
      return;
    }

    console.log(
      `🔎 Live monitor check: ${rows.length} account(s)`
    );

    for (const data of rows) {
      try {
        const profile =
          await getInstagramAccount(
            data.username
          );

        const now =
          Date.now();

        if (
          isValidRecoveredProfile(
            profile
          )
        ) {
          const newStreak =
            Number(
              data.recovery_streak ||
                0
            ) + 1;

          db.prepare(`
            UPDATE monitors
            SET followers = ?,
                last_checked_at = ?,
                last_check_ok = 1,
                recovery_streak = ?
            WHERE id = ?
              AND status = 'Monitoring'
          `).run(
            String(
              profile.followersCount ??
                data.followers ??
                "N/A"
            ),
            now,
            newStreak,
            data.id
          );

          console.log(
            `🟢 @${data.username} accessible (${newStreak}/${RECOVERY_CONFIRMATIONS})`
          );

          if (
            newStreak >=
            RECOVERY_CONFIRMATIONS
          ) {
            if (!data.channel_id) {
              continue;
            }

            const channel =
              await client.channels
                .fetch(
                  data.channel_id
                )
                .catch(() => null);

            if (
              channel?.isTextBased()
            ) {
              await completeMonitor(
                {
                  ...data,
                  recovery_streak:
                    newStreak,
                },
                channel,
                profile
              );
            }
          }
        } else {
          db.prepare(`
            UPDATE monitors
            SET last_checked_at = ?,
                last_check_ok = 0,
                recovery_streak = 0
            WHERE id = ?
              AND status = 'Monitoring'
          `).run(
            now,
            data.id
          );

          console.log(
            `🔴 @${data.username} still unavailable / no valid profile`
          );
        }
      } catch (error) {
        console.error(
          `❌ Live check failed for @${data.username}:`,
          error.message
        );
      }
    }
  } finally {
    monitorCheckRunning =
      false;
  }
}

/* =========================
   TIMED COMPLETIONS
========================= */

async function checkTimedCompletions() {
  const now =
    Date.now();

  const dueMonitors =
    db.prepare(`
      SELECT *
      FROM monitors
      WHERE auto_complete_at IS NOT NULL
        AND auto_complete_at <= ?
        AND status != 'Unbanned'
        AND status != 'Completing'
    `).all(now);

  for (const data of dueMonitors) {
    if (!data.channel_id) {
      continue;
    }

    const channel =
      await client.channels
        .fetch(
          data.channel_id
        )
        .catch(() => null);

    if (
      !channel?.isTextBased()
    ) {
      continue;
    }

    console.log(
      `⏰ Timer completing @${data.username}`
    );

    await completeMonitor(
      data,
      channel
    );
  }
}

/* =========================
   BOT READY
========================= */

client.once(
  Events.ClientReady,
  async (readyClient) => {
    console.log(
      `✅ Logged in as ${readyClient.user.tag}`
    );

    console.log(
      `🟢 Live monitoring: every ${
        MONITOR_INTERVAL_MS /
        1000
      }s`
    );

    console.log(
      `🛡️ Recovery confirmations: ${RECOVERY_CONFIRMATIONS}`
    );

    await checkLiveMonitors()
      .catch(console.error);

    await checkTimedCompletions()
      .catch(console.error);

    setInterval(
      async () => {
        await checkLiveMonitors()
          .catch((error) =>
            console.error(
              "❌ Live monitor loop:",
              error
            )
          );

        await checkTimedCompletions()
          .catch((error) =>
            console.error(
              "❌ Timer loop:",
              error
            )
          );
      },
      MONITOR_INTERVAL_MS
    );
  }
);

/* =========================
   INTERACTIONS
========================= */

client.on(
  Events.InteractionCreate,
  async (interaction) => {
    try {
      /* =========================
         SLASH COMMANDS
      ========================= */

      if (
        interaction.isChatInputCommand()
      ) {
        if (
          interaction.commandName ===
          "monitor"
        ) {
          return await monitor.execute(
            interaction
          );
        }

        if (
          interaction.commandName ===
          "realmonitor"
        ) {
          return await realmonitor.execute(
            interaction
          );
        }

        if (
          interaction.commandName ===
          "list"
        ) {
          return await list.execute(
            interaction
          );
        }

        if (
          interaction.commandName ===
          "edit"
        ) {
          return await edit.execute(
            interaction
          );
        }

        if (
          interaction.commandName ===
          "dashboard"
        ) {
          return await dashboard.execute(
            interaction
          );
        }

        if (
          interaction.commandName ===
          "ping"
        ) {
          return await interaction.reply(
            "🏓 Pong! Bot working."
          );
        }

        return;
      }

      /* =========================
         EDIT BUTTON
      ========================= */

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "monitor_edit:"
        )
      ) {
        const monitorId =
          interaction.customId.split(
            ":"
          )[1];

        const data =
          db.prepare(
            "SELECT * FROM monitors WHERE id = ?"
          ).get(monitorId);

        if (!data) {
          return await interaction.reply({
            content:
              "❌ Monitor record nahi mila.",
            ephemeral: true,
          });
        }

        const modal =
          new ModalBuilder()
            .setCustomId(
              `monitor_edit_modal:${monitorId}`
            )
            .setTitle(
              `Edit ${data.username}`.slice(
                0,
                45
              )
            );

        const statusInput =
          new TextInputBuilder()
            .setCustomId(
              "status"
            )
            .setLabel(
              "Status"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setValue(
              String(
                data.status ||
                  "Monitoring"
              )
            )
            .setRequired(true)
            .setMaxLength(100);

        const followersInput =
          new TextInputBuilder()
            .setCustomId(
              "followers"
            )
            .setLabel(
              "Followers"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setValue(
              String(
                data.followers ||
                  "N/A"
              )
            )
            .setRequired(true)
            .setMaxLength(100);

        const reviewInput =
          new TextInputBuilder()
            .setCustomId(
              "review"
            )
            .setLabel(
              "Review"
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setValue(
              String(
                data.review ||
                  "Under review"
              )
            )
            .setRequired(true)
            .setMaxLength(1000);

        const timerInput =
          new TextInputBuilder()
            .setCustomId(
              "auto_complete"
            )
            .setLabel(
              "Auto Complete After"
            )
            .setPlaceholder(
              "30m / 2h / 1d 4h / Off"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(50);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            statusInput
          ),
          new ActionRowBuilder().addComponents(
            followersInput
          ),
          new ActionRowBuilder().addComponents(
            reviewInput
          ),
          new ActionRowBuilder().addComponents(
            timerInput
          )
        );

        return await interaction.showModal(
          modal
        );
      }

      /* =========================
         EDIT MODAL
      ========================= */

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "monitor_edit_modal:"
        )
      ) {
        await interaction.deferReply({
          ephemeral: true,
        });

        const monitorId =
          interaction.customId.split(
            ":"
          )[1];

        const data =
          db.prepare(
            "SELECT * FROM monitors WHERE id = ?"
          ).get(monitorId);

        if (!data) {
          return await interaction.editReply({
            content:
              "❌ Monitor record nahi mila.",
          });
        }

        const status =
          interaction.fields
            .getTextInputValue(
              "status"
            )
            .trim();

        const followers =
          interaction.fields
            .getTextInputValue(
              "followers"
            )
            .trim();

        const review =
          interaction.fields
            .getTextInputValue(
              "review"
            )
            .trim();

        const timerText =
          interaction.fields
            .getTextInputValue(
              "auto_complete"
            )
            .trim();

        let autoCompleteAt =
          data.auto_complete_at;

        if (timerText) {
          const parsedTimer =
            parseTimer(
              timerText
            );

          if (
            parsedTimer ===
            undefined
          ) {
            return await interaction.editReply({
              content:
                "❌ Timer galat hai. Examples: `30m`, `2h`, `1d 4h`, `45m 30s`, `Off`",
            });
          }

          autoCompleteAt =
            parsedTimer === null
              ? null
              : Date.now() +
                parsedTimer;
        }

        db.prepare(`
          UPDATE monitors
          SET status = ?,
              followers = ?,
              review = ?,
              auto_complete_at = ?,
              channel_id = ?
          WHERE id = ?
        `).run(
          status,
          followers,
          review,
          autoCompleteAt,
          interaction.channelId,
          monitorId
        );

        const updatedData = {
          ...data,
          status,
          followers,
          review,
          auto_complete_at:
            autoCompleteAt,
          channel_id:
            interaction.channelId,
        };

        const oldMessage =
          data.message_id
            ? await interaction.channel.messages
                .fetch(
                  data.message_id
                )
                .catch(
                  () => null
                )
            : null;

        if (oldMessage) {
          await oldMessage
            .delete()
            .catch(
              () => null
            );
        }

        const embed =
          createMonitorEmbed(
            updatedData
          );

        const attachment =
          await getSavedCardAttachment(
            monitorId
          );

        const options = {
          embeds: [embed],
          components: [
            createButtons(
              monitorId
            ),
          ],
        };

        if (attachment) {
          embed.setImage(
            "attachment://instagram-profile.png"
          );

          options.files = [
            attachment,
          ];
        }

        const newMessage =
          await interaction.channel.send(
            options
          );

        db.prepare(`
          UPDATE monitors
          SET message_id = ?,
              channel_id = ?
          WHERE id = ?
        `).run(
          newMessage.id,
          interaction.channelId,
          monitorId
        );

        return await interaction.editReply({
          content:
            "✅ Monitor updated.",
        });
      }

      /* =========================
         MANUAL COMPLETE
      ========================= */

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "monitor_complete:"
        )
      ) {
        await interaction.deferUpdate();

        const monitorId =
          interaction.customId.split(
            ":"
          )[1];

        const data =
          db.prepare(
            "SELECT * FROM monitors WHERE id = ?"
          ).get(monitorId);

        if (!data) {
          return;
        }

        data.message_id =
          interaction.message.id;

        data.channel_id =
          interaction.channelId;

        await completeMonitor(
          data,
          interaction.channel
        );

        return;
      }

      /* =========================
         DELETE
      ========================= */

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "monitor_delete:"
        )
      ) {
        await interaction.deferUpdate();

        const monitorId =
          interaction.customId.split(
            ":"
          )[1];

        db.prepare(`
          DELETE FROM monitors
          WHERE id = ?
        `).run(monitorId);

        await interaction.message
          .delete()
          .catch(
            () => null
          );

        console.log(
          `🗑️ Monitor deleted: ${monitorId}`
        );

        return;
      }
    } catch (error) {
      console.error(
        "❌ Interaction error:",
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction
          .reply({
            content:
              "❌ Bot me error aaya. Terminal check karo.",
            ephemeral: true,
          })
          .catch(
            () => null
          );
      }
    }
  }
);

/* =========================
   LOGIN
========================= */

client
  .login(
    process.env.DISCORD_TOKEN
  )
  .catch((error) => {
    console.error(
      "❌ Bot login error:",
      error
    );
  });