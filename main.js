const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();

const Token = require("./secret_stuff.json");
const words = require("./items.json");
const commands = require("./command-list.json");
const botinfo = require("./about.json");
const userData = require("./users.json");

const thumbs_up = "👍";
const thumbs_down = "👎";
const ok = "👌";
const left = "⬅";
const right = "➡";
const up = "🔼";
const down = "🔽";
const tree = "🌳";
const selected = "▶";
const unselected = "⬛";
const colour = 0x00BCD4;

const maxItemsPerPage = 10;
const latestUserVersion = 2;

const pageTypes = {
  speller: {
    name: "speller",
    list: words,
    onselect(word, channel) {
      channel.send(`"${word}" is spelled \`${word.toUpperCase().split("").join("-")}\``);
    }
  },
  commandList: {
    name: "command list",
    list: Object.keys(commands).map(c => `\`${c}\``),
    onselect(command, channel, index, setTitle) {
      setTitle(`**${command}**`);
      return commands[command.slice(1, -1)].replace(/TREE/g, tree);
    }
  }
};

let paginations = [],
paginationData = {},
externalEchoChannel = null,
reactTarget = null,
emojiInfos = {},
scheduledUserDataUpdate = null;

Object.keys(userData).map(id => userData[id].v < latestUserVersion ? prepareUser(id) : 0);
function prepareUser(id) {
  if (!userData[id]) userData[id] = {v: 0};
  if (userData[id].v === latestUserVersion) return;
  switch (userData[id].v) {
    case 0:
      userData[id].money = 0;
      userData[id].stats = {};
      userData[id].joined = Date.now();
      userData[id].name = `<@${id}>`;
    case 1:
      userData[id].inventory = {};
  }
  userData[id].v = latestUserVersion;
  updateUserData();
}

function updateUserData() {
  if (scheduledUserDataUpdate !== null) clearTimeout(scheduledUserDataUpdate);
  scheduledUserDataUpdate = setTimeout(() => {
    scheduledUserDataUpdate = null;
    fs.writeFile("./users.json", JSON.stringify(userData), () => {});
  }, 100);
}

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
      initPagination(msg, "commandList");
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
    initPagination(msg, "speller");
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
    ofNotHave = ofNotHaveRegex.exec(msg.content),
    random = /\b(actually\s*)?(?:pick\s*)?(?:a\s*)?rand(?:om)?\s*num(?:ber)?\s*(?:d'|from|between)?\s*([0-9]+)\s*(?:-|to|t'|&|and|n')?\s*([0-9]+)/i.exec(msg.content),
    getMoney = /(\bmy|<@!?([0-9]+)>(?:'?s)?)\s*(?:money|bcbw)/i.exec(msg.content),
    setName = /\bmy\s*name\s*(?:'s|is)\s+(.+)/i.exec(msg.content);
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
    } else if (random) {
      let r,
      nums = [+random[2], +random[3]],
      min = Math.min(...nums), max = Math.max(...nums);
      if (random[1]) {
        r = Math.floor(Math.random() * (max - min + 1) + min);
      } else {
        let randomDigits = [7, 6, 3, 5, 4, 9, 8, 2, 1, 0]; // most to least "random"
        r = "";
        while (+r <= max - min) {
          r += randomDigits[Math.floor(Math.random() ** 3 * 10)];
        }
        r = +r.slice(0, -1) + min;
      }
      msg.channel.send(`<@${msg.author.id}> hmmm... I choose... **${r}**!`);
    } else if (getMoney) {
      let user = getMoney[1] === "my" ? msg.author.id : getMoney[2];
      prepareUser(user);
      msg.channel.send(`**${userData[user].name}** has **\`${userData[user].money}\`** bitcoin but worse`);
    } else if (setName) {
      prepareUser(msg.author.id);
      updateUserData(userData[msg.author.id].name = setName[1].trim());
      msg.channel.send(`hi, nice to meet you **${userData[msg.author.id].name}**`);
    }
  }
});

function initPagination(msg, type) {
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
        cursor: 0,
        type: type
      };
      updatePagination(paginationData[msg.id]);
    })
    .catch(console.error);
  });
}
function updatePagination(page) {
  let content = "",
  offset = page.page * maxItemsPerPage,
  list = pageTypes[page.type].list;
  for (let i = 0; i < maxItemsPerPage; i++) {
    if (i + offset >= list.length) break;
    content += "\n" + (i === page.cursor ? selected : unselected) + " ";
    content += `**${list[i + offset]}**`;
  }
  page.embed.setTitle(`${pageTypes[page.type].name} - page ${page.page + 1} of ${Math.ceil(list.length / maxItemsPerPage)}`);
  page.embed.setDescription(content);
  page.msg.edit(page.embed);
}
function messageReactionUpdate(reaction, id) {
  let page = paginationData[id],
  list = pageTypes[page.type].list,
  pages = Math.ceil(list.length / maxItemsPerPage);
  switch (reaction) {
    case left:
      if (page.page > 0)
        page.page--, page.cursor = 0;
      break;
    case right:
      if (page.page < pages - 1)
        page.page++, page.cursor = 0;
      break;
    case up:
      if (page.cursor > 0)
        page.cursor--;
      break;
    case down:
      let max = maxItemsPerPage;
      if (page.page === pages - 1) max = list.length % maxItemsPerPage;
      if (page.cursor < max - 1)
        page.cursor++;
      break;
    case ok:
      let index = page.page * maxItemsPerPage + page.cursor,
      chosen = pageTypes[page.type].list[index],
      newContent = pageTypes[page.type].onselect(chosen, page.msg.channel, index, newTitle => {
        page.embed.setTitle(newTitle);
      });
      if (newContent !== undefined) page.embed.setDescription(newContent);

      page.embed.setFooter("selected");
      page.msg.edit(page.embed);
      page.msg.reactions.map(r => {
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
