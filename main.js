const Discord = require("discord.js");
const client = new Discord.Client();

const Token = require("./secret_stuff.json");
const words = require("./items.json");

const ok = "👌";
const left = "⬅";
const right = "➡";
const up = "🔼";
const down = "🔽";
const colour = 0x00BCD4;

const maxWordsPerPage = 10;

let paginations = [],
paginationData = {};

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
  if (/\bpag(e|ination)\s*test\b/i.test(msg.content)) {
    let embed = new Discord.RichEmbed({
      footer: {
        text: `react/unreact to switch pages`
      },
      description: "loading...",
      title: "loading...",
      color: colour
    });
    msg.channel.send({
      embed: embed
    })
    .then(msg => {
      msg.react(left)
      .then(() => msg.react(right))
      .then(() => msg.react(up))
      .then(() => msg.react(down))
      .then(() => msg.react(ok))
      .then(() => {
        paginations.push(msg.id);
        paginationData[msg.id] = {
          embed: embed,
          msg: msg,
          page: 0,
          cursor: 0
        };
        updatePagination(paginationData[msg.id]);
      })
      .catch(console.error);
    });
    msg.react(ok);
  } else {
    let echo = /echo(c?):(.*)/i.exec(msg.content);
    if (echo) {
      let circumfix = echo[1] ? "```" : ""
      msg.channel.send(circumfix + echo[2] + circumfix);
    }
  }
});

function updatePagination(page) {
  page.embed.setTitle(`speller - page ${page.page + 1}`);
  let content = "",
  offset = page.page * maxWordsPerPage;
  for (let i = 0; i < maxWordsPerPage; i++) {
    if (i + offset >= words.length) break;
    content += "\n" + (i === page.cursor ? ">" : " ") + " ";
    content += words[i + offset];
  }
  page.embed.setDescription("```" + content + "```");
  page.msg.edit(page.embed);
}
function messageReactionUpdate(reaction, user) {
  if (client.user.id === user.id) return;
  let id = reaction.message.id;
  if (~paginations.indexOf(id)) {
    if (reaction.emoji.name === left && paginationData[id].page > 0)
      paginationData[id].page--, paginationData[id].cursor = 0;
    else if (reaction.emoji.name === right && paginationData[id].page < Math.ceil(words.length / maxWordsPerPage) - 1)
      paginationData[id].page++, paginationData[id].cursor = 0;
    else if (reaction.emoji.name === up && paginationData[id].cursor > 0)
      paginationData[id].cursor--;
    else if (reaction.emoji.name === down && paginationData[id].cursor < maxWordsPerPage - 1)
      paginationData[id].cursor++;
    else if (reaction.emoji.name === ok) {
      paginationData[id].embed.setFooter("selected");
      paginationData[id].msg.edit(paginationData[id].embed);

      let word = words[paginationData[id].page * maxWordsPerPage + paginationData[id].cursor];
      paginationData[id].msg.channel.send(`"${word}" is spelled \`${word.toUpperCase().split("").join("-")}\``);

      paginationData[id].msg.reactions.map(r => {
        r.remove(client.user);
      });

      delete paginationData[id];
      paginations.splice(paginations.indexOf(id), 1);
      return;
    }
    updatePagination(paginationData[id]);
  }
}

client.on("messageReactionAdd", messageReactionUpdate);
client.on("messageReactionRemove", messageReactionUpdate);

client.login(Token.token);
