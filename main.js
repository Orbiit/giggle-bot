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
const tree = "🌳";
const colour = 0x00BCD4;

const maxWordsPerPage = 10;

let paginations = [],
paginationData = {},
externalEchoChannel = null,
reactTarget = null,
emojiInfos = {};

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
  if (msg.author.id === client.user.id) return;
  if (/\b(hate|hated|hates|hating|hatred|hater|haters)\b/i.test(msg.content)) {
    let hat = {h: "l", H: "L", a: "o", A: "O", t: "v", T: "V"};
    msg.channel.send(`hey hey hey <@${msg.author.id}> don't be so negative! try this:`
      + "```" + msg.content.replace(
        /\b(hat)(e(s|d|rs?)?|ing)\b/gi,
        (m, c1, c2) => c1.split("").map(l => hat[l]).join("") + c2
      ).replace(/hatred/g, "love") + "```");
    msg.react(thumbs_down);
  } else if (msg.mentions.users.has(client.user.id) || /^moofy,? */.test(msg.content)) {
    let sendOK = true;
    if (/\b(help|((your|ur) *)?commands?)\b/i.test(msg.content)) {
      let content = [];
      msg.channel.send({
        embed: {
          footer: {
            text: `good luck!`
          },
          description: Object.keys(commands).map(c => {
            return `**\`${c.replace(/TREE/g, tree)}\`** ${commands[c].replace(/TREE/g, tree)}`;
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
      let deleteRegex = /\bdelete *([0-9]+)\b/i.exec(msg.content),
      react = /\breact *(\S{1,2})/i.exec(msg.content);
      if (deleteRegex) {
        if (Math.floor(Math.random() * 4)) {
          msg.channel.send(`<@${msg.author.id}> nahhh`);
          sendOK = false;
          msg.react(thumbs_down);
        } else {
          msg.channel.fetchMessages({limit: +deleteRegex[1]}).then(msgs => {
            msgs.map(msg => {
              if (msg.author.id === client.user.id) msg.delete();
            });
          });
        }
      } else if (react) {
        try {
          if (!reactTarget) throw new Error("which message?");
          if (react[1] === thumbs_up || react[1] === thumbs_down)
            throw new Error("don't dare you try to manipulate votes!");
          reactTarget.react(react[1]);
        } catch (e) {
          msg.channel.send(`<@${msg.author.id}> **\`\`\`${e.toString().toUpperCase()}\`\`\`**`);
        }
      } else {
        msg.channel.send(`<@${msg.author.id}> DON'T MENTION ME YET`);
      }
    }
    if (sendOK) msg.react(ok);
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
  } else if (/\binspect *emoji\b/i.test(msg.content)) {
    let embed = new Discord.RichEmbed({
      footer: {
        text: `react to set emoji`
      },
      description: "awaiting reaction",
      title: "emoji inspector",
      color: colour
    });
    msg.channel.send({
      embed: embed
    }).then(msg => {
      emojiInfos[msg.id] = {
        embed: embed,
        msg: msg
      };
    });
    msg.react(ok);
  } else if (/\bkeepInventory\b/i.test(msg.content) && msg.author.username === "Gamepro5") {
    msg.channel.send(`<@${msg.author.id}>` + " make sure you set `keepInventory` to `false` :)");
    msg.react(thumbs_down);
  } else {
    let echo = /echo(c?)(e?)(s?):([^]+)/im.exec(msg.content),
    // c - enclose in codeblock; e - external; s - don't trim ("strict")
    ofNotHaveRegex = /\b(could|might|should|will|would)(?:'?ve| +have)\b/gi,
    ofNotHave = ofNotHaveRegex.exec(msg.content);
    if (echo) {
      let circumfix = echo[1] ? "```" : "",
      content = (echo[3] ? echo[4] : echo[4].trim()) || "/shrug";
      ((echo[2] ? externalEchoChannel : null) || msg.channel)
        .send(circumfix + content + circumfix);
    } else if (ofNotHave) {
      msg.channel.send(
        `<@${msg.author.id}> no it's` + "```"
        + msg.content.replace(ofNotHaveRegex, "$1 OF") + "```"
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
function messageReactionUpdate(reaction, id) {
  let pages = Math.ceil(words.length / maxWordsPerPage);
  switch (reaction) {
    case left:
      if (paginationData[id].page > 0)
        paginationData[id].page--, paginationData[id].cursor = 0;
      break;
    case right:
      if (paginationData[id].page < pages - 1)
        paginationData[id].page++, paginationData[id].cursor = 0;
      break;
    case up:
      if (paginationData[id].cursor > 0)
        paginationData[id].cursor--;
      break;
    case down:
      let max = maxWordsPerPage;
      if (paginationData[id].page === pages - 1) max = words.length % maxWordsPerPage;
      if (paginationData[id].cursor < max - 1)
        paginationData[id].cursor++;
      break;
    case ok:
      paginationData[id].embed.setFooter("selected");
      paginationData[id].msg.edit(paginationData[id].embed);

      let word = words[paginationData[id].page * maxWordsPerPage + paginationData[id].cursor];
      paginationData[id].msg.channel.send(`"${word}" is spelled \`${word.toUpperCase().split("").join("-")}\``);

      paginationData[id].msg.reactions.map(r => {
        r.remove(client.user);
      });

      delete paginationData[id];
      paginations.splice(paginations.indexOf(id), 1);
      return true;
    default:
      return false;
  }
  updatePagination(paginationData[id]);
  return true;
}

client.on("messageReactionAdd", (reaction, user) => {
  if (client.user.id === user.id) return;
  let id = reaction.message.id;
  if (emojiInfos[id]) {
    emojiInfos[id].embed.setDescription(
      `**id**: \`${reaction.emoji.id}\`\n`
      + `**identifier**: \`${reaction.emoji.identifier}\`\n`
      + `**name**: \`${reaction.emoji.name}\``
    );
    emojiInfos[id].embed.setFooter("selected");
    emojiInfos[id].msg.edit(emojiInfos[id].embed);
    delete emojiInfos[id];
  } else if (reaction.emoji.name === tree) {
    reactTarget = reaction.message;
  } else if (~paginations.indexOf(id) && messageReactionUpdate(reaction.emoji.name, id));
});
client.on("messageReactionRemove", (reaction, user) => {
  let id = reaction.message.id;
  if (~paginations.indexOf(id) && messageReactionUpdate(reaction.emoji.name, id));
});

client.login(Token.token);
