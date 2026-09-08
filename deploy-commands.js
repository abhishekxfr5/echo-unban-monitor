require("dotenv").config();

const { REST, Routes } = require("discord.js");

const monitor = require("./src/commands/monitor");
const realmonitor = require("./src/commands/realmonitor");
const list = require("./src/commands/list");
const edit = require("./src/commands/edit");
const dashboard = require("./src/commands/dashboard");

const commands = [
  monitor.data.toJSON(),
  realmonitor.data.toJSON(),
  list.data.toJSON(),
  edit.data.toJSON(),
  dashboard.data.toJSON(),
];

const rest = new REST({
  version: "10",
}).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("🔄 Deploying commands...");

    await rest.put(
      Routes.applicationCommands(
        process.env.CLIENT_ID
      ),
      {
        body: commands,
      }
    );

    console.log("✅ Commands deployed!");

    console.log(
      "📦 Registered:",
      commands
        .map((command) => `/${command.name}`)
        .join(", ")
    );

  } catch (error) {
    console.error(
      "❌ Command deployment failed:",
      error
    );
  }
})();