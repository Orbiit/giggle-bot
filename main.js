const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();

const Token = require("./secret_stuff.json");
const words = require("./items.json");
const commands = require("./command-list.json");
const botinfo = require("./about.json");
const userData = require("./users.json");
const marketData = require("./market-items.json");

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
const latestUserVersion = 3;
const day = 24 * 60 * 60 * 1000;

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
    onselect(command, channel, setTitle, otherStuff) {
      setTitle(`**${command}**`);
      return commands[command.slice(1, -1)].replace(/TREE/g, tree);
    }
  },
  market: {
    name: "market",
    list: Object.keys(marketData),
    onselect(name, channel, setTitle, otherStuff) {
      let item = marketData[name];
      setTitle(item.emoji + " " + name);
      questionAwaits[otherStuff.reactor.id] = {
        type: "marketBuy",
        args: name
      };
      return `Price: **\`${item.price}\`** bitcoin but worse\n`
        + `\nHow many do you want to buy? (\`cancel\` to cancel)`;
    }
  }
};
const questionResponseResponders = {
  howRU(msg, args) {
    let same = /\b(same|agree|also|too)\b/i.test(msg.content),
    bad = same && args === "bad" || /\b(bad|sad|mad|unhappy|horrible)\b/i.test(msg.content),
    ok = same && args === "ok" || /\b(ok|meh|idk|eh+)\b/i.test(msg.content),
    good = same && args === "good" || /\b(good|great|happy|excited)\b/i.test(msg.content);
    if (bad) {
      if (args === "bad") msg.channel.send("we can feel bad together!");
      else msg.channel.send("oh i'm very sorry to hear that");
    } else if (ok) {
      if (args === "ok") msg.channel.send("good to know");
      else msg.channel.send("that's ok too");
    } else if (good) {
      if (args === "good") msg.channel.send("yay we can be the happy group");
      else msg.channel.send("that's good!");
    } else {
      return false;
    }
    return true;
  },
  marketBuy(msg, name) {
    let quantity = Math.abs(Math.round(+msg));
    if (!isNaN(quantity)) {
      let item = marketData[name],
      totalCost = quantity * item.price;
      prepareUser(msg.author.id);
      if (totalCost > userData[msg.author.id].money) {
        msg.channel.send(`**${userData[msg.author.id].name}** you don't have enough bitcoin but worse :/`);
        msg.react(thumbs_down);
      } else {
        userData[msg.author.id].money -= totalCost;
        prepareUserForItem(msg.author.id, name);
        userData[msg.author.id].inventory[name] += quantity;
        updateUserData();
        msg.channel.send(`**${userData[msg.author.id].name}** thank you for your purchase.\n`
          + `you bought ${quantity}x ${name} for \`${totalCost}\` bitcoin but worse`);
        msg.react(ok);
      }
    }
    else if (msg.toLowerCase() === "cancel" || msg.toLowerCase() === "nvm") msg.react(ok);
    else return false;
    return true;
  }
};

let paginations = [],
paginationData = {},
externalEchoChannel = null,
reactTarget = null,
emojiInfos = {},
scheduledUserDataUpdate = null,
questionAwaits = {};

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
    case 2:
      userData[id].lastDaily = 0;
      userData[id].dailyStreak = 0;
  }
  userData[id].v = latestUserVersion;
  updateUserData();
}
function prepareUserForItem(userID, itemName) {
  if (userData[userID].inventory[itemName] === undefined)
    userData[userID].inventory[itemName] = 0;
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
  if (questionAwaits[msg.author.id]) {
    let invalid = questionResponseResponders[questionAwaits[msg.author.id].type](msg, questionAwaits[msg.author.id].args);
    delete questionAwaits[msg.author.id];
    if (!invalid) return;
  }
  let sendOK = true;
  if (/\b(hate|hated|hates|hating|hatred|hater|haters)\b/i.test(msg.content)) {
    let hat = {h: "l", H: "L", a: "o", A: "O", t: "v", T: "V"};
    msg.channel.send(`hey hey hey <@${msg.author.id}> don't be so negative! try this:`
      + "```" + msg.content.replace(
        /\b(hat)(e(s|d|rs?)?|ing)\b/gi,
        (m, c1, c2) => c1.split("").map(l => hat[l]).join("") + c2
      ).replace(/hatred/g, "love") + "```");
    sendOK = false;
    msg.react(thumbs_down);
  } else if (msg.mentions.users.has(client.user.id) || /^moofy,? */.test(msg.content)) {
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
    } else if (/\bhow *(r|are) *(u|you)\b/i.test(msg.content)) {
      let feelings = ["good", "ok", "bad"],
      feeling = feelings[Math.floor(Math.random() * feelings.length)];
      msg.channel.send(`i'm feeling ${feeling}. and you?`)
      questionAwaits[msg.author.id] = {
        type: "howRU",
        args: feeling
      };
    } else if (/\bmarket\b/i.test(msg.content)) {
      initPagination(msg, "market");
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
          sendOK = false;
        }
      } else {
        msg.channel.send(`<@${msg.author.id}> DON'T MENTION ME YET`);
        sendOK = false;
      }
    }
  } else if (/\bpag(e|ination) *test\b/i.test(msg.content)) {
    initPagination(msg, "speller");
  } else if (/\buse *this *channel\b/i.test(msg.content)) {
    externalEchoChannel = msg.channel;
  } else if (/\bdumb\b/i.test(msg.content) && /\bbot\b/i.test(msg.content)) {
    msg.channel.send(`DID I JUST HEAR "dumb" AND "bot" USED TOGETHER??!!??!11!?1/!?`);
    sendOK = false;
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
  } else if (/\bkeepInventory\b/i.test(msg.content) && msg.author.username === "Gamepro5") {
    msg.channel.send(`<@${msg.author.id}>` + " make sure you set `keepInventory` to `false` :)");
    sendOK = false;
    msg.react(thumbs_down);
  } else if (/\bmy *daily\b/i.test(msg.content)) {
    prepareUser(msg.author.id);
    let now = Date.now(),
    timeSince = now - userData[msg.author.id].lastDaily,
    addendum = "";
    if (timeSince >= day) {
      userData[msg.author.id].money += 500;
      if (timeSince > day * 2 && userData[msg.author.id].lastDaily > 0) {
        addendum = `\nrip, you lost your ${userData[msg.author.id].dailyStreak}-day streak`
        userData[msg.author.id].dailyStreak = 0;
      }
      userData[msg.author.id].lastDaily = now;
      userData[msg.author.id].dailyStreak++;
      updateUserData();
      msg.channel.send(`<@${msg.author.id}> good job! here's **\`500\`** bitcoin but worse for you :D\n`
        + `(${userData[msg.author.id].dailyStreak}-day streak!)` + addendum);
    } else {
      let lastDaily = new Date(userData[msg.author.id].lastDaily);
      msg.channel.send(`<@${msg.author.id}> be patient! you last got your daily at `
        + `${(lastDaily.getHours() + 11) % 12 + 1}:${("0" + lastDaily.getMinutes()).slice(-2)} ${lastDaily.getHours() < 12 ? "a" : "p"}m`);
      sendOK = false;
      msg.react(thumbs_down);
    }
  } else {
    let echo = /echo(c?)(x?)(s?)(e?):([^]+)/im.exec(msg.content),
    ofNotHaveRegex = /\b(could|might|should|will|would)(?:'?ve| +have)\b/gi,
    ofNotHave = ofNotHaveRegex.exec(msg.content),
    random = /\b(actually *)?(?:pick *)?(?:a *)?rand(?:om)? *num(?:ber)? *(?:d'|from|between)? *([0-9]+) *(?:-|to|t'|&|and|n')? *([0-9]+)/i.exec(msg.content),
    getMoney = /(\bmy|<@!?([0-9]+)>(?:'?s)?) *(?:money|bcbw)/i.exec(msg.content),
    setName = /\bmy *name *(?:'s|is) +(.+)/i.exec(msg.content),
    giveMoney = /\bgive *<@!?([0-9]+)> *([0-9]+) *(?:money|bcbw)\b/i.exec(msg.content),
    getInventory = /(\bmy|<@!?([0-9]+)>(?:'?s)?) *inv(?:entory)?/i.exec(msg.content);
    if (echo) {
      let circumfix = echo[1] ? "```" : "",
      content = (echo[3] ? echo[5] : echo[5].trim()) || "/shrug";
      content = circumfix + content + circumfix;
      if (echo[4]) content = {
        embed: {
          description: content,
          color: colour
        }
      };
      ((echo[2] ? externalEchoChannel : null) || msg.channel)
        .send(content);
    } else if (ofNotHave) {
      msg.channel.send(
        `<@${msg.author.id}> no it's` + "```"
        + msg.content.replace(ofNotHaveRegex, "$1 OF") + "```"
      );
      sendOK = false;
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
    } else if (giveMoney) {
      let given = giveMoney[1],
      amount = +giveMoney[2];
      prepareUser(given);
      prepareUser(msg.author.id);
      if (amount > 0 && amount <= userData[msg.author.id].money) {
        updateUserData(userData[msg.author.id].money -= amount);
        updateUserData(userData[given].money += amount);
        updateUserData();
        msg.channel.send(`**${userData[msg.author.id].name}** gave **\`${amount}\`** bitcoin but worse to **${userData[given].name}**`);
      } else {
        sendOK = false;
        msg.channel.send(`sorry, can't work with that amount <@${msg.author.id}>`);
        msg.react(thumbs_down);
      }
    } else if (getInventory) {
      let user = getInventory[1] === "my" ? msg.author.id : getInventory[2];
      prepareUser(user);
      let content = "";
      for (let item in userData[user].inventory) {
        content += `\n${marketData[item].emoji} x${userData[user].inventory[item]}`;
      }
      msg.channel.send(`**${userData[user].name}** has:${content || "\n\n...nothing! :("}`);
    } else {
      sendOK = false;
    }
  }
  if (sendOK) msg.react(ok);
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
function messageReactionUpdate(reaction, messageID, user) {
  let page = paginationData[messageID],
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
      newContent = pageTypes[page.type].onselect(chosen, page.msg.channel, newTitle => {
        page.embed.setTitle(newTitle);
      }, {
        index: index,
        reactor: user
      });
      if (newContent !== undefined) page.embed.setDescription(newContent);

      page.embed.setFooter("selected");
      page.msg.edit(page.embed);
      page.msg.reactions.map(r => {
        r.remove(client.user);
      });

      delete paginationData[messageID];
      paginations.splice(paginations.indexOf(messageID), 1);
      return true;
    default:
      return false;
  }
  updatePagination(paginationData[messageID]);
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
  } else if (~paginations.indexOf(id) && messageReactionUpdate(reaction.emoji.name, id, user));
});
client.on("messageReactionRemove", (reaction, user) => {
  let id = reaction.message.id;
  if (~paginations.indexOf(id) && messageReactionUpdate(reaction.emoji.name, id, user));
});

client.login(Token.token);
