const Token = require("secret_stuff.json");
const Discord = require("discord.js");
const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
  if (msg.content === "TEST") {
    msg.reply("HEYYYY");
  }
});

client.login(Token.token);
