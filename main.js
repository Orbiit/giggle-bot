const Discord = require("discord.js");
const client = new Discord.Client();

const Token = require("./secret_stuff.json");
const words = require("./items.json");
const commands = require("./command-list.json");
const botinfo = require("./about.json");

const thumbs_up = "👍";
const thumbs_down = "👎";
const ok = "👌";
const left = "⬅";
const right = "➡";
const up = "🔼";
const down = "🔽";
const colour = 0x00BCD4;

const maxWordsPerPage = 10;

let paginations = [],
paginationData = {},
externalEchoChannel = null;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
  if (msg.author.id === client.user.id) return;
  if (/\b(hate|hated|hates|hating)\b/i.test(msg.content)) {
    msg.channel.send(`hey hey hey <@${msg.author.id}> don't be so negative! try this:`
      + "```"
      + msg.content
        .replace(/hate/g, "love")
        .replace(/hated/g, "loved")
        .replace(/hates/g, "loves")
        .replace(/hating/g, "loving")
      + "```");
    msg.react(thumbs_down);
  } else if (msg.mentions.users.has(client.user.id)) {
    if (/\b(help|(your *)?commands?)\b/i.test(msg.content)) {
      let content = [];
      msg.channel.send({
        embed: {
          footer: {
            text: `good luck!`
          },
          description: Object.keys(commands).map(c => {
            return `**\`${c}\`** ${commands[c]}`;
          }).join("\n\n"),
          title: "command list",
          color: colour
        }
      });
    } else if (/\bwho\b/i.test(msg.content)) {
      let content = [];
      msg.channel.send({
        embed: {
          footer: {
            text: `VARIANT: ${botinfo.variant}`
          },
          description: botinfo.description + "\n\n" + `My insides: ${botinfo.repo}`,
          title: `ABOUT ${botinfo.name}`,
          color: colour,
          url: botinfo.repo
        }
      });
    } else {
      msg.channel.send(`<@${msg.author.id}> DON'T MENTION ME YET`);
    }
    msg.react(ok);
  } else if (/\bpag(e|ination) *test\b/i.test(msg.content)) {
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
  } else if (/\buse *this *channel\b/i.test(msg.content)) {
    externalEchoChannel = msg.channel;
    msg.react(ok);
  } else if (/\bdumb\b/i.test(msg.content) && /\bbot\b/i.test(msg.content)) {
    msg.channel.send(`DID I JUST HEAR "dumb" AND "bot" USED TOGETHER??!!??!11!?1/!?`);
    msg.react(thumbs_down);
  } else {
    let echo = /echo(c?)(e?)(s?):([^]*)/im.exec(msg.content),
    // c - enclose in codeblock; e - external; s - don't trim ("strict")
    ofNotHaveRegex = /\b(could|might|should|will|would)(?:'?ve| +have)\b/gi,
    ofNotHave = ofNotHaveRegex.exec(msg.content);
    if (echo) {
      let circumfix = echo[1] ? "```" : "",
      content = echo[3] ? echo[4] : echo[4].trim();
      ((echo[2] ? externalEchoChannel : null) || msg.channel)
        .send(circumfix + content + circumfix);
    } else if (ofNotHave) {
      msg.channel.send(
        `<@${msg.author.id}> no it's` + "```"
        + msg.content.replace(ofNotHaveRegex, "$1 of") + "```"
      );
      msg.react(thumbs_down);
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
    let pages = Math.ceil(words.length / maxWordsPerPage);
    if (reaction.emoji.name === left && paginationData[id].page > 0)
      paginationData[id].page--, paginationData[id].cursor = 0;
    else if (reaction.emoji.name === right && paginationData[id].page < pages - 1)
      paginationData[id].page++, paginationData[id].cursor = 0;
    else if (reaction.emoji.name === up && paginationData[id].cursor > 0)
      paginationData[id].cursor--;
    else if (reaction.emoji.name === down) {
      let max = maxWordsPerPage;
      if (paginationData[id].page === pages - 1) max = words.length % maxWordsPerPage;
      if (paginationData[id].cursor < max - 1)
        paginationData[id].cursor++;
    }
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
