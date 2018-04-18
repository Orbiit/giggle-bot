const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();

const Helper = require("./helper-commands.js");
const EvilEval = require("./evil-eval.js");
const Token = require("./secret_stuff.json");
const words = require("./items.json");
const commands = require("./command-list.json");
const botinfo = require("./about.json");
const userData = require("./users.json");
const marketData = require("./market-items.json");
const robberies = require("./rob-state.json");
const houseData = require("./house.json");

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
const DemoCoinVerification = "🤔";
const colour = 0x00BCD4;

const maxItemsPerPage = 10;
const day = 24 * 60 * 60 * 1000;
const DemoCoinID = "432014777724698625";
const BCBWperDemoCoin = 1000;
const robRate = 10; // BCBW per second
const withdrawFee = 0.05;
const ConvertChannelID = "433441820102361110";
const DiscowID = "427609586032443392";
const CowBitperBCBW = 2;
const CowBotID = "427890474708238339";

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
    list: Object.keys(marketData).filter(i => marketData[i].buyable),
    onselect(name, channel, setTitle, otherStuff) {
      let item = marketData[name];
      setTitle(item.emoji + " " + name);
      questionAwaits[otherStuff.reactor.id] = {
        type: "marketBuy",
        args: name
      };
      return `${item.description}\n\nPrice: **\`${item.price}\`** bitcoin but worse`
        + `\nHow many do you want to buy? (\`cancel\` to cancel)`;
    }
  },
  profiles: {
    name: "profile list",
    get list() {
      return Object.values(userData).map(u => u.name).filter(uname => uname !== "<@undefined>");
    },
    onselect(username, channel, setTitle) {
      let userID;
      for (userID in userData) if (userData[userID].name === username) break;
      setTitle(`${username}'s profile`);
      return Helper.getProfile(userData[userID], marketData);
    }
  },
  customEmojis: {
    name: "custom emoji list",
    list: [],
    onselect(emoji, channel, setTitle, otherStuff) {
      emoji = channel.guild.emojis.get(/<a?:.+?:([0-9]+)>/.exec(emoji)[1]);
      setTitle(`<${emoji.animated ? "a" : ""}:${emoji.identifier}>`)
      otherStuff.embed.addField("animated?", emoji.animated, true);
      otherStuff.embed.addField("creation time", emoji.createdAt.toISOString(), true);
      otherStuff.embed.addField("creation timestamp", emoji.createdTimestamp, true);
      otherStuff.embed.addField("ID", emoji.id, true);
      otherStuff.embed.addField("identifier", `\`${emoji.identifier}\``, true);
      otherStuff.embed.addField("managed by external service?", emoji.managed, true);
      otherStuff.embed.addField("requires colons?", emoji.requiresColons, true);
      otherStuff.embed.addField("URL", emoji.url, true);
      return "";
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
      if (args === "bad") Helper.permaSend(msg, "we can feel bad together!");
      else Helper.permaSend(msg, "oh i'm very sorry to hear that");
    } else if (ok) {
      if (args === "ok") Helper.permaSend(msg, "good to know");
      else Helper.permaSend(msg, "that's ok too");
    } else if (good) {
      if (args === "good") Helper.permaSend(msg, "yay we can be the happy group");
      else Helper.permaSend(msg, "that's good!");
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
        Helper.tempReply(msg, `**${userData[msg.author.id].name}** you don't have enough bitcoin but worse :/`);
        msg.react(thumbs_down);
      } else {
        userData[msg.author.id].money -= totalCost;
        prepareUserForItem(msg.author.id, name);
        userData[msg.author.id].inventory[name] += quantity;
        updateUserData();
        Helper.tempReply(msg, `**${userData[msg.author.id].name}** thank you for your purchase.\n`
          + `you bought ${marketData[name].emoji} x${quantity} (${name}) for \`${totalCost}\` bitcoin but worse`);
        msg.react(ok);
      }
    }
    else if (msg.content.toLowerCase() === "cancel" || msg.content.toLowerCase() === "nvm") msg.react(ok);
    else return false;
    return true;
  },
  game(msg, args, questionAwait) {
    if (args.purchaseHint) {
      if (msg.content[0].toLowerCase() === "y") {
        if (userData[msg.author.id].money < 50) {
          msg.react(thumbs_down);
          Helper.tempReply(msg, 1000, `${args.username}, not enough money!`);
        } else {
          args.hinted.push(args.purchaseHint);
          userData[msg.author.id].money -= 50;
          userData[msg.author.id].stats.hintPurchases++;
          Helper.tempReply(msg, 1000, `${args.username}, purchased! :)`);
          updateUserData();
          msg.react(ok);
        }
      } else {
        Helper.tempReply(msg, 1000, `${args.username}, canceled purchase! :)`);
        msg.react(ok);
      }
      args.purchaseHint = false;
    } else if (args.started) {
      let hint = /^hint *([0-9]+)\b/i.exec(msg.content);
      if (hint) {
        hint = +hint[1];
        if (hint > args.word.length || hint < 1) {
          msg.react(thumbs_down);
          Helper.tempReply(msg, 1000, `${args.username}, the letter is out of range`);
        } else if (~args.hinted.indexOf(hint)) {
          msg.react(thumbs_down);
          Helper.tempReply(msg, 1000, `${args.username}, i already gave you the hint!`);
        } else {
          Helper.tempReply(msg, `${args.username}, purchase letter #${hint} for **\`50\`** bitcoin but worse? (y/n)`);
          args.purchaseHint = hint;
        }
      } else {
        args.tries++;
        if (~msg.content.toLowerCase().indexOf(args.word)) {
          let reward = args.word.length * 53;
          userData[msg.author.id].money += reward;
          userData[msg.author.id].stats.timesWonGame++;
          Helper.tempReply(msg, `${args.username} just won **\`${reward}\`** bitcoin but worse!`);
          questionAwait.dontAutoKill = false;
        } else if (msg.content.toLowerCase() === "cancel") {
          Helper.tempReply(msg, `cancel game. hints and penalties were not refunded. the word was **${args.word}**`);
          questionAwait.dontAutoKill = false;
          args.tries--;
        } else if (args.tries >= 5 || userData[msg.author.id].money < 50) {
          userData[msg.author.id].stats.timesLostGame++;
          Helper.tempReply(msg, `${args.username} lost. the word was **${args.word}**`);
          questionAwait.dontAutoKill = false;
        } else {
          userData[msg.author.id].money -= 50;
          Helper.tempReply(msg, 1000, `${args.username}, nope! **\`50\`** bitcoin but worse penalty!`);
        }
        updateUserData();
      }
    } else {
      prepareUser(msg.author.id);
      args.word = words[Math.floor(Math.random() * words.length)];
      args.hinted = [];
      args.started = true;
      args.purchaseHint = false;
      args.username = `**${userData[msg.author.id].name}**`;
      args.tries = 0;
      msg.react(ok);
    }
    let content = `**GAME** ${args.tries} out of 5 tries\nPlayer: <@${msg.author.id}>`
      + "\nTens digit not displayed:```\n"
      + args.word.split("").map((l, i) => !questionAwait.dontAutoKill || ~args.hinted.indexOf(i + 1) ? l : "_").join(" ")
      + "\n" + args.word.split("").map((l, i) => (i + 1) % 10).join(" ")
      + "```\nTo buy a hint: `hint [nth letter, 1-indexed]` (eg `hint 3` for the third letter)"
      + "\n`cancel` to end game.";
      // + "\nDEBUG:```" + `
      // word:${args.word}
      // hints:${JSON.stringify(args.hinted)}
      // started:${args.started}
      // purchasing hint:${args.purchaseHint}
      // not stopping:${questionAwait.dontAutoKill}
      // ` + "```";
    args.msg.edit(content);
    return true;
  },
  robbery(msg, args, questionAwait) {
    if (!robberies[msg.author.id]) {
      questionAwait.dontAutoKill = false;
      return false;
    }
    let run = /\brun\b/i.test(msg.content);
    if (run || /\bmy *progress\b/i.test(msg.content)) {
      let stolenMoney = Math.floor((Date.now() - args.startTime - 5000) * robRate / 1000);
      if (stolenMoney < 0) stolenMoney = 0;
      if (args.bank) {
        let totalBankMoney = Object.values(userData).map(u => u.bankMoney)
          .reduce((a, b) => a + b);
        stolenMoney = Math.min(stolenMoney, totalBankMoney);
      } else {
        stolenMoney = Math.min(stolenMoney, userData[args.victim].money)
      }
      if (run) {
        userData[msg.author.id].lastRobbery = Date.now();
        if (args.bank) {
          let stealDistribution = {},
          peopleWithBankMoney = Object.keys(userData).filter(u => userData[u].bankMoney),
          done = false,
          moneyToDistribute = stolenMoney,
          extraMoney = stolenMoney % peopleWithBankMoney.length;
          while (!done) {
            let allOK = true,
            moneyPerUser = Math.floor(moneyToDistribute / peopleWithBankMoney.length); // money can disappear through rounding
            for (let i = 0; i < peopleWithBankMoney.length; i++) {
              let u = peopleWithBankMoney[i];
              if (moneyPerUser > userData[u].bankMoney) {
                allOK = false;
                stealDistribution[u] = userData[u].bankMoney;
                moneyToDistribute -= userData[u].bankMoney;
                peopleWithBankMoney.splice(i--, 1);
              } else {
                stealDistribution[u] = moneyPerUser;
              }
            }
            if (allOK) done = true;
          }
          let DEBUG_STRING = `DEBUG. total stolen: ${stolenMoney}`
          Object.keys(stealDistribution).map(u => {
            DEBUG_STRING += `\n${userData[u].name} lost ${stealDistribution[u]} (orig: ${userData[u].bankMoney})`;
            userData[u].bankMoney -= stealDistribution[u];
            userData[u].stats.moneyLostFromRobbing += stealDistribution[u];
          });
          Helper.tempReply(msg, `**${userData[msg.author.id].name}** successfully `
            + `robbed **\`${stolenMoney}\`** bitcoin but worse from **__MOOFY BANK SERVICES__**`);
          Helper.tempReply(msg, DEBUG_STRING);
        } else {
          userData[args.victim].money -= stolenMoney;
          userData[args.victim].stats.moneyLostFromRobbing += stolenMoney;
          Helper.tempReply(msg, `**${userData[msg.author.id].name}** successfully `
            + `robbed **\`${stolenMoney}\`** bitcoin but worse from **${userData[args.victim].name}**`);
        }
        userData[msg.author.id].money += stolenMoney;
        userData[msg.author.id].stats.moneyFromRobbing += stolenMoney;
        updateUserData();
        msg.react(ok);
        delete robberies[msg.author.id];
        updateRobState();
        questionAwait.dontAutoKill = false;
      } else {
        msg.react(ok);
        Helper.tempReply(msg, `**${userData[msg.author.id].name}**, you have stolen `
          + `**\`${stolenMoney}\`** bitcoin but worse so far. type \`run\` to escape now`);
      }
      return true;
    }
    return false;
  }
};

let paginations = [],
paginationData = {},
externalEchoChannel = null,
reactTarget = null,
emojiInfos = {},
scheduledUserDataUpdate = null,
questionAwaits = {},
exchanges = {},
scheduledRobStateUpdate = null,
ConvertChannel = null,
silenceTimeout = null;

const latestUserVersion = 20;
function prepareUser(id) {
  if (typeof id !== "string") id = id.toString();
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
    case 3:
      userData[id].stats.timesMined = 0;
      userData[id].lastMine = 0;
    case 4:
      userData[id].stats.timesWonGame = 0;
      userData[id].stats.timesLostGame = 0;
      userData[id].stats.hintPurchases = 0;
    // me trying to figure out fetchUser before I found out the problem wasn't here
    case 5: case 6: case 7: case 8: case 9: case 10: case 11: case 12: case 13:
      if (userData[id].name && ~userData[id].name.indexOf("@")) {
        let mentionRegex = /<@!?([0-9]+)>/.exec(userData[id].name);
        if (mentionRegex) {
          client.fetchUser(mentionRegex[1]).then(user => {
            userData[id].name = user.username;
          });
        } else {
          userData[id].name = userData[id].name.replace(/@/g, "[at]");
        }
      }
    case 14:
      userData[id].stats.timesRobbed = 0;
      userData[id].stats.timesGotRobbed = 0;
      userData[id].stats.moneyFromRobbing = 0;
      userData[id].stats.moneyLostFromRobbing = 0;
      userData[id].stats.timesGotCaught = 0;
      userData[id].stats.timesCaughtRobber = 0;
    case 15:
      userData[id].stats.coffeeConsumed = 0;
      if (userData[id].stats.moneyLostFromRobbing < 0)
        userData[id].stats.moneyLostFromRobbing *= -1;
    case 16:
      userData[id].bankMoney = 0;
    case 17:
      userData[id].bannedFromBank = false;
      userData[id].stats.timesAttackedRobber = 0;
    case 18:
      userData[id].lastRobbery = 0;
      if (userData[id].stats.moneyLostFromRobbing < 0)
        userData[id].stats.moneyLostFromRobbing *= -1;
    case 19:
      userData[id].inHouse = false;
      userData[id].houseFeatures = {};
      userData[id].houseSecurityLvl = 0;
      userData[id].robHelpLvl = 0;
  }
  userData[id].v = latestUserVersion;
  updateUserData();
}
function prepareUserForItem(userID, itemName, inventory = "inventory") {
  if (userData[userID][inventory][itemName] === undefined)
    userData[userID][inventory][itemName] = 0;
}

function updateUserData() {
  if (scheduledUserDataUpdate !== null) clearTimeout(scheduledUserDataUpdate);
  scheduledUserDataUpdate = setTimeout(() => {
    scheduledUserDataUpdate = null;
    fs.writeFile("./users.json", JSON.stringify(userData), () => {});
  }, 100);
}
function updateRobState() {
  if (scheduledRobStateUpdate !== null) clearTimeout(scheduledRobStateUpdate);
  scheduledRobStateUpdate = setTimeout(() => {
    scheduledRobStateUpdate = null;
    fs.writeFile("./rob-state.json", JSON.stringify(robberies), () => {});
  }, 100);
}
function setGame() {
  client.user.setPresence({
    game: {
      name: "you",
      type: 3
    }
  });
}

const DESIRED_EXCHANGE_RATE = 0.01; // universal:BCBW
const MAXIMUM_EXCHANGE_RATE = 1; // universal:BCBW
const UNIVERSAL_TOTAL = 100000; // universal?
function calculateUniversalExchangeRate() {
  let total = 0; // BCBW
  let govMoney = UNIVERSAL_TOTAL / MAXIMUM_EXCHANGE_RATE; // ???

  Object.values(userData).forEach(u => total += u.money + u.bankMoney);
  return 1 / (govMoney + total) * UNIVERSAL_TOTAL;
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  Object.keys(userData).map(id => userData[id].v < latestUserVersion ? prepareUser(id) : 0);
  ConvertChannel = client.channels.get(ConvertChannelID);
  setGame();
});

client.on("message", msg => {
  let message = msg.content,
  channel = msg.channel,
  userID = msg.author.id;
  if (userID === client.user.id) return;
  if (silenceTimeout !== null) return;
  if (questionAwaits[userID]) {
    let valid = questionResponseResponders[questionAwaits[userID].type](msg, questionAwaits[userID].args, questionAwaits[userID]);
    if (!questionAwaits[userID].dontAutoKill) delete questionAwaits[userID];
    if (valid) return;
  } else if (robberies[userID]) {
    questionAwaits[userID] = {
      type: "robbery",
      args: robberies[userID],
      dontAutoKill: true
    };
  }
  let sendOK = true;
  prepareUser(userID);
  if (~botinfo.universalers.indexOf(userID) && msg.mentions.members.has(client.user.id)) {
    if (msg.embeds[0]) {
      let embed = msg.embeds[0];
      if (embed.title === "convert") {
        try {
          let exec = /<@!?([0-9]+)> *([0-9.\-]+)/i.exec(embed.description),
          user = exec[1],
          amount = +exec[2];
          prepareUser(user);
          if (isNaN(amount) || amount < 0)
            throw new Error("i don't like that \"positive number\" you have there");
          else {
            msg.react(ok);
            const conversionRate = calculateUniversalExchangeRate();
            userData[user].money += Math.floor(amount / conversionRate);
            updateUserData();
          }
        } catch (e) {
          Helper.permaSend(msg, "```" + e.toString() + "```");
          sendOK = false;
          msg.react(thumbs_down);
        }
        return;
      }
    }
  }
  if (message.slice(-20) === "REPLACE COLON PLEASE") {
    message = message.replace(/COLON/g, ":");
  }
  if (/\b(hate|hated|hates|hating|hatred|hater|haters)\b/i.test(message)) {
    let hat = {h: "l", H: "L", a: "o", A: "O", t: "v", T: "V"};
    Helper.permaSend(msg, `hey hey hey <@${userID}> don't be so negative! try this:`
      + "```" + message.replace(
        /\b(hat)(e(s|d|rs?)?|ing)\b/gi,
        (m, c1, c2) => c1.split("").map(l => hat[l]).join("") + c2
      ).replace(/hatred/gi, "love") + "```");
    sendOK = false;
    msg.react(thumbs_down);
  } else if (message.slice(0, 6).toLowerCase() === "moofy:") {
    let command = message.toLowerCase().split(/ +/).slice(1).join(" "),
    conclusive = false,
    item;
    for (let security in houseData) {
      if (houseData[security].command === command) {
        conclusive = true;
        item = security;
      }
    }
    if (conclusive) {
      prepareUserForItem(userID, item, "houseFeatures");
      if (userData[userID].money < houseData[item].cost) {
        Helper.tempReply(msg, `**${userData[userID].name}** you don't have enough bitcoin but worse`);
        sendOK = false;
        msg.react(thumbs_down);
      } else if (userData[userID].houseFeatures[item] >= houseData[item].maximum) {
        Helper.tempReply(msg, `**${userData[userID].name}** you have too many ${item}`);
        sendOK = false;
        msg.react(thumbs_down);
      } else {
        userData[userID].money -= houseData[item].cost;
        userData[userID].houseFeatures[item]++;
        if (houseData[item].security !== undefined)
          userData[userID].houseSecurityLvl += houseData[item].security;
        else
          userData[userID].robHelpLvl += houseData[item].assist;
        updateUserData();
        Helper.tempReply(msg, `**${userData[userID].name}** purchased 1x ${item} for **\`${houseData[item].cost}\`** bitcoin but worse`);
      }
    } else if (command === "house enter") {
      if (userData[userID].inHouse) {
        Helper.tempReply(msg, `**${userData[userID].name}** you're already in your house silly`);
        sendOK = false;
        msg.react(thumbs_down);
      } else if (!userData[userID].houseFeatures.house) {
        Helper.tempReply(msg, `**${userData[userID].name}** you don't have a house!`);
        sendOK = false;
        msg.react(thumbs_down);
      } else {
        userData[userID].inHouse = true;
        updateUserData();
      }
    } else if (command === "house exit") {
      if (!userData[userID].inHouse) {
        Helper.tempReply(msg, `**${userData[userID].name}** you're already outside your house silly`);
        sendOK = false;
        msg.react(thumbs_down);
      } else {
        userData[userID].inHouse = false;
        updateUserData();
      }
    } else if (command === "my house") {
      msg.author.createDM().then(channel => {
        channel.send({
          embed: {
            color: colour,
            title: "Your house",
            description: `**Total security**: ${userData[userID].houseSecurityLvl}`
              + `\n**Total robber assist**: ${userData[userID].robHelpLvl}`
              + `\nYou are **${userData[userID].inHouse ? "" : "not "}in** your house.`,
            fields: Object.keys(userData[userID].houseFeatures).map(f => ({
              name: f,
              value: userData[userID].houseFeatures[f],
              inline: true
            }))
          }
        });
      });
    } else if (command.slice(0, 13) === "get universal") {
      let total = 0;
      Object.values(userData).forEach(u => total += u.money + u.bankMoney);
      // to universal = given amount / (government money + total) * universal total
      // universal total is 1 million (1000000)
      // maydoh recommends:
      // a universal total of 10000
      // and government money of 10000
      const conversionRate = calculateUniversalExchangeRate();
      if (command.length === 13) {
        Helper.permaSend(msg, `total BCBW: \`${total}\`. \`1\` BCBW = \`${conversionRate}\` universal`);
      } else {
        let amount = +command.slice(13).trim();
        Helper.permaSend(msg, `\`${amount}\` BCBW = \`${amount * conversionRate}\` universal.`
          + `\n\`${amount}\` universal = \`${amount / conversionRate}\` BCBW`);
      }
    } else if (command.slice(0, 12) === "feature info") {
      let featureName = command.slice(12).trim(),
      feature = houseData[featureName];
      if (feature) {
        Helper.tempReply(msg, {
          embed: {
            title: featureName,
            fields: [
              {name: "cost", value: feature.cost, inline: true},
              {name: "maximum", value: feature.maximum, inline: true},
              feature.security !== undefined
                ? {name: "security", value: feature.security, inline: true}
                : {name: "assist", value: feature.assist, inline: true}
            ],
            color: colour
          }
        })
      } else {
        Helper.tempReply(msg, `**${userData[userID].name}** that's not a name of a feature`);
        sendOK = false;
        msg.react(thumbs_down);
      }
    } else {
      Helper.tempReply(msg, {
        embed: {
          color: colour,
          title: "Property system",
          description: Object.keys(houseData).map(f => {
            return `\`moofy: ${houseData[f].command}\` - buys a **${f}**`;
          }).join("\n")
            + `\n\`moofy: house enter\` - enters your house`
            + `\n\`moofy: house exit\` - exits your house`
            + `\n\`moofy: my house\` - DMs information about your house to you`
            + `\n\`moofy: feature info [feature name]\` - gives more information about the feature`
        }
      });
    }
  } else if (userID !== DiscowID && userID !== CowBotID && (msg.mentions.users.has(client.user.id) || /^moofy,? */i.test(message))) {
    let moreInfo = /\bt(?:ell)? *me? *(?:more)? *a(?:bout)? *([a-z]+)(?: *#?([0-9]+))?/i.exec(message);
    if (moreInfo) {
      let query = moreInfo[1].trim().toLowerCase(),
      resultIndex = +moreInfo[2] || 1,
      results = Object.keys(commands).filter(c => ~c.toLowerCase().indexOf(query));
      if (results.length === 0) {
        Helper.tempReply(msg, `couldn't find the command you were looking for (try \`@moofy-bot your commands\` for the full list)`);
        sendOK = false;
        msg.react(thumbs_down);
      } else {
        if (resultIndex > results.length) resultIndex = results.length;
        let command = results[resultIndex - 1];
        Helper.tempReply(msg, {
          embed: {
            title: `**\`${command}\`**`,
            description: commands[command].replace(/TREE/g, tree)
              + `\n\nOther results (use \`@moofy-bot tell me more about ${query} #n\`):\n`
              + results.map((c, i) => `${i + 1}. \`${c}\``).join("\n"),
            color: colour
          }
        });
      }
    } else if (/\b(help|((your|ur) *)?commands?|command *format)\b/i.test(message)) {
      initPagination(msg, "commandList");
    } else if (/\bwho\b/i.test(message)) {
      let content = [];
      Helper.tempReply(msg, {
        embed: {
          footer: {
            text: `VARIANT: ${botinfo.variant}`
          },
          description: botinfo.description + `\n\nMy insides: ${botinfo.repo}\nSpam your server too: ${botinfo.invite}`,
          title: `ABOUT ${botinfo.name}`,
          color: colour,
          url: botinfo.repo
        }
      });
    } else if (/\bhow *(r|are) *(u|you)\b/i.test(message)) {
      let feelings = ["good", "ok", "bad"],
      feeling = feelings[Math.floor(Math.random() * feelings.length)];
      Helper.permaSend(msg, `i'm feeling ${feeling}. and you?`)
      questionAwaits[userID] = {
        type: "howRU",
        args: feeling
      };
    } else if (/\bmarket\b/i.test(message)) {
      initPagination(msg, "market");
    } else if (/\bGAME\b/.test(message)) {
      Helper.permaSend(msg, "loading...").then(msg => {
        msg.edit("say anything to start");
        questionAwaits[userID] = {
          type: "game",
          args: {
            msg: msg,
            started: false
          },
          dontAutoKill: true
        };
      });
    } else if (/\bGAME\b/i.test(message)) {
      Helper.tempReply(msg, `NOT LOUD ENOUGH <@${userID}>`);
    } else if (/\bprofiles\b/i.test(message)) {
      initPagination(msg, "profiles");
    } else if (/\bleader(?:board)?\b/i.test(message)) {
      let peopleMoney = Object.values(userData).filter(u => u.money > 0)
        .sort((a, b) => b.money - a.money),
      digitLengths = peopleMoney[0].money.toString().length,
      spaces = " ".repeat(digitLengths);
      Helper.permaSend(msg, {
        embed: {
          color: colour,
          title: "people with the most bitcoin but worse",
          description: peopleMoney.map(u => `\`+${(spaces + u.money).slice(-digitLengths)}\` **${u.name}**`).join("\n")
        }
      });
    } else if (/\bSHUT *UP\b/.test(message)) {
      if (silenceTimeout !== null) clearTimeout(silenceTimeout);
      Helper.tempReply(msg, `**MOOFY WILL NOW IGNORE COMMANDS FOR A SECOND**`);
      silenceTimeout = setTimeout(() => {
        silenceTimeout = null;
        setGame();
      }, 1000);
      client.user.setPresence({
        game: {
          name: "no one",
          type: "LISTENING"
        }
      });
    } else {
      let deleteRegex = /\bdelete *([0-9]+)\b/i.exec(message),
      reactCustom = /\breact *<a?:.+?:([0-9]+)>/i.exec(message),
      react = /\breact *([^\sa-z0-9]{1,2})/i.exec(message),
      buy = /\bbuy *([0-9]+|max(?:imum)?) *(\S{1,2})/i.exec(message),
      getProfile = /\bprofile *<@!?([0-9]+)>/i.exec(message);
      if (deleteRegex) {
        let amount = +deleteRegex[1];
        if (amount > 100) {
          Helper.tempReply(msg, `<@${userID}> due to technical limitations i can't delete more than 100`);
          sendOK = false;
          msg.react(thumbs_down);
        } else if (Math.floor(Math.random() * 4)) {
          Helper.tempReply(msg, `<@${userID}> nahhh`);
          sendOK = false;
          msg.react(thumbs_down);
        } else {
          channel.fetchMessages({limit: amount}).then(msgs => {
            msgs.map(msg => {
              if (msg.author.id === client.user.id) {
                msg.delete();
              } else {
                msg.reactions.filter(r => r.me).map(r => r.remove());
              }
            });
          });
          sendOK = false;
        }
      } else if (reactCustom) {
        try {
          if (!reactTarget) throw new Error("which message?");
          reactTarget.react(client.emojis.get(reactCustom[1])).catch(err => {
            Helper.sendError(channel, err)
          });
        } catch (e) {
          Helper.permaSend(msg, `<@${userID}> **\`\`\`${e.toString().toUpperCase()}\`\`\`**`);
          sendOK = false;
        }
      } else if (react) {
        try {
          if (!reactTarget) throw new Error("which message?");
          if (react[1] === thumbs_up || react[1] === thumbs_down)
            throw new Error("don't dare you try to manipulate votes!");
          reactTarget.react(react[1]).catch(err => {
            Helper.sendError(channel, err)
          });
        } catch (e) {
          Helper.permaSend(msg, `<@${userID}> **\`\`\`${e.toString().toUpperCase()}\`\`\`**`);
          sendOK = false;
        }
      } else if (buy) {
        let item = getItem(buy[2]);
        if (item === null) {
          sendOK = false;
          msg.react(thumbs_down);
          Helper.tempReply(msg, `**${userData[userID].name}**, that isn't an item i know of`);
        } else if (!marketData[item].buyable) {
          sendOK = false;
          msg.react(thumbs_down);
          Helper.tempReply(msg, `**${userData[userID].name}**, they don't sell that these days`);
        } else {
          let quantity;
          if (buy[1][0] === "m") quantity = Math.floor(userData[userID].money / marketData[item].price);
          else quantity = +buy[1];
          let totalCost = quantity * marketData[item].price;
          if (totalCost > userData[userID].money) {
            Helper.tempReply(msg, `**${userData[userID].name}** you don't have enough bitcoin but worse :/`);
            msg.react(thumbs_down);
            sendOK = false;
          } else {
            userData[userID].money -= totalCost;
            prepareUserForItem(msg.author.id, item);
            userData[userID].inventory[item] += quantity;
            updateUserData();
            Helper.tempReply(msg, `**${userData[userID].name}** thank you for your purchase.\n`
              + `you bought ${marketData[item].emoji} x${quantity} (${item}) for \`${totalCost}\` bitcoin but worse`);
          }
        }
      } else if (getProfile) {
        let userDataEntry = userData[userID];
        Helper.permaSend(msg, {
          embed: {
            title: `${userDataEntry.name}'s profile`,
            description: Helper.getProfile(userDataEntry, marketData),
            color: colour
          }
        });
      } else {
        Helper.tempReply(msg, `<@${userID}> DON'T MENTION ME`);
        sendOK = false;
      }
    }
  } else if (/^pag(e|ination) *test\b/i.test(message)) {
    initPagination(msg, "speller");
  } else if (/^use *this *channel\b/i.test(message)) {
    externalEchoChannel = channel;
  } else if (/\bdumb\b/i.test(message) && /\bbot\b/i.test(message)) {
    Helper.permaSend(msg, `DID I JUST HEAR "dumb" AND "bot" USED TOGETHER??!!??!11!?1/!?`);
    sendOK = false;
    msg.react(thumbs_down);
  } else if (/^inspect *emoji\b/i.test(message)) {
    let embed = new Discord.RichEmbed({
      footer: {
        text: `react to set emoji`
      },
      description: "awaiting reaction",
      title: "emoji inspector",
      color: colour
    });
    Helper.permaSend(msg, {
      embed: embed
    }).then(msg => {
      emojiInfos[msg.id] = {
        embed: embed,
        msg: msg
      };
    });
  } else if (/\bkeepInventory\b/i.test(message) && msg.author.username === "Gamepro5") {
    Helper.permaSend(msg, `<@${userID}>` + " make sure you set `keepInventory` to `false` :)");
    sendOK = false;
    msg.react(thumbs_down);
  } else if (/^my *daily\b/i.test(message)) {
    let now = Date.now(),
    timeSince = now - userData[userID].lastDaily,
    addendum = "";
    if (timeSince >= day) {
      userData[userID].money += 500;
      if (timeSince > day * 2 && userData[userID].lastDaily > 0) {
        addendum = `\nrip, you lost your ${userData[userID].dailyStreak}-day streak`
        userData[userID].dailyStreak = 0;
      }
      userData[userID].lastDaily = now;
      userData[userID].dailyStreak++;
      updateUserData();
      Helper.tempReply(msg, `<@${userID}> good job! here's **\`500\`** bitcoin but worse for you :D\n`
        + `(${userData[userID].dailyStreak}-day streak!)` + addendum);
    } else {
      let lastDaily = new Date(userData[userID].lastDaily);
      Helper.tempReply(msg, `<@${userID}> be patient! you last got your daily at `
        + `${(lastDaily.getHours() + 11) % 12 + 1}:${("0" + lastDaily.getMinutes()).slice(-2)} ${lastDaily.getHours() < 12 ? "a" : "p"}m`);
      sendOK = false;
      msg.react(thumbs_down);
    }
  } else if (/^i *want *to *mine\b/i.test(message)) {
    if (userData[userID].inHouse) {
      Helper.tempReply(msg, `**${userData[userID].name}**, don't mine inside your house silly`);
      sendOK = false;
      msg.react(thumbs_down);
    } else if (userData[userID].inventory.pickaxe >= 1 || userData[userID].inventory["specialized pickaxe"] >= 1) {
      let now = Date.now(),
      usingSpecial = userData[userID].inventory["specialized pickaxe"] >= 1;
      if (now - userData[userID].lastMine < 600000) {
        sendOK = false;
        Helper.tempReply(msg, `you're still tired from your last mining session, **${userData[userID].name}**`);
      } else {
        let brokenPickaxe, amount,
        demoCoinMined = false;
        if (usingSpecial) {
          amount = Math.floor(Math.random() ** 3 * 100000 + 500);
          if (brokenPickaxe = Math.floor(Math.random() * 5) === 0) {
            amount = Math.ceil(amount * (1 - Math.random() / 2));
            userData[userID].inventory["specialized pickaxe"]--;
          } else if (Math.floor(Math.random() * 2) === 0) {
            prepareUserForItem(msg.author.id, "DemoCoin geode");
            userData[userID].inventory["DemoCoin geode"]++;
            demoCoinMined = true;
            amount = 0;
          }
        } else {
          amount = Math.floor(Math.random() ** 6 * 1000 + 50);
          if (brokenPickaxe = Math.floor(Math.random() * 3) === 0) {
            amount = Math.ceil(amount * (1 - Math.random()));
            userData[userID].inventory.pickaxe--;
          }
        }
        userData[userID].money += amount;
        userData[userID].stats.timesMined++;
        userData[userID].lastMine = now;
        updateUserData();
        if (usingSpecial && demoCoinMined) {
          Helper.tempReply(msg, `**${userData[userID].name}** just mined a DEMOCOIN GEODE`
            + (brokenPickaxe ? `\nyour pickaxe broke :(` : ""));
        } else {
          Helper.tempReply(msg, `**${userData[userID].name}** just mined **\`${amount}\`** bitcoin but worse!`
            + (brokenPickaxe ? `\nyour pickaxe broke :(` : ""));
        }
      }
    } else {
      Helper.tempReply(msg, `**${userData[userID].name}**, you don't have a pickaxe`);
      sendOK = false;
      msg.react(thumbs_down);
    }
  } else if (userID === DemoCoinID) {
    if (msg.embeds[0]) {
      let embed = msg.embeds[0],
      command = embed.title.trim().split(/\s+/);
      if (command[0] === "convert") {
        try {
          let amount = +command[1],
          user = /<@!?([0-9]+)>/.exec(embed.description)[1];
          prepareUser(user);
          if (isNaN(amount) || amount < 0)
            throw new Error("i don't like that \"positive number\" you have there");
          else {
            msg.react(ok);
            userData[user].money += Math.floor(amount * BCBWperDemoCoin);
            updateUserData();
          }
        } catch (e) {
          Helper.permaSend(msg, "```" + e.toString() + "```");
          sendOK = false;
          msg.react(thumbs_down);
        }
      } else {
        sendOK = false;
      }
    } else {
      sendOK = false;
    }
  } else if (/^HEY\b/.test(message)) {
    Helper.tempReply(msg, `**${userData[userID].name}**, the \`HEY\` command is now deprecated. please use \`attack\``);
    sendOK = false;
    msg.react(thumbs_down);
  } else if (/^my *bank *acc(?:ount)?\b/i.test(message)) {
    if (userData[userID].inHouse) {
      Helper.tempReply(msg, `**${userData[userID].name}**, the bank doesn't have a website. you have to leave your house and go there in person.`);
      sendOK = false;
      msg.react(thumbs_down);
    } else if (userData[userID].bannedFromBank) {
      Helper.tempReply(msg, `you were banned from the bank on ${new Date(userData[userID].bannedFromBank).toString()}`);
    } else {
      Helper.tempReply(msg, `you have **\`${userData[userID].bankMoney}\`** bitcoin but worse protected by MOOFY BANK SERVICES`);
    }
  } else if (/^my *progress\b/i.test(message)) {
    Helper.tempReply(msg, `you aren't robbing right now. robbers: `
      + (Object.keys(robberies).map(id => `**${(userData[id] || {}).name}**`).join(", ") || "none"));
  } else if (/^rob *(?:the|l')? *bank\b/i.test(message)) {
    if (userData[userID].inHouse) {
      Helper.tempReply(msg, `**${userData[userID].name}**, the bank doesn't have a website. you have to leave your house and go there in person.`);
      sendOK = false;
      msg.react(thumbs_down);
    } else if (robberies[userID]) {
      sendOK = false;
      msg.react(thumbs_down);
      Helper.tempReply(msg, `**${userData[userID].name}**, you're a bit busy with another robbery at the moment.`);
    } else if (Date.now() - userData[userID].lastRobbery < 1800000) {
      sendOK = false;
      msg.react(thumbs_down);
      Helper.tempReply(msg, `**${userData[userID].name}**, you're still tired from your last robbery`);
    } else {
      if (channel.type !== "dm") {
        robberies[userID] = {
          bank: true,
          startTime: Date.now()
        };
        questionAwaits[userID] = {
          type: "robbery",
          args: robberies[userID],
          dontAutoKill: true
        };
        userData[msg.author.id].stats.timesRobbed++;
        updateUserData();
        updateRobState();
        Helper.permaSend(msg, `**${userData[userID].name.toUpperCase()}** IS STEALING `
          + `FROM THE ***__MOOFY BANK SERVICES__***. TYPE **\`ATTACK\`**`
          + ` TO ATTACK THE ROBBER.\nThere is no backing out now. Type \`my progress\` to`
          + ` see how much money you stole, and \`run\` to escape with your BCBW.`
          + `\n\n@everyone you might want to wake up`);
      } else {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `**${userData[userID].name}**, **${userData[victim].name}** doesn't live here!`);
      }
    }
  } else if (/^idea *(for|4)? *moofy:/i.test(message)) {
    let idea = "\n".repeat(3) + "@" + msg.author.tag + " SAID:\n" + message.slice(message.indexOf(":") + 1).trim();
    fs.readFile('./ideas.txt', (err, data) => {
      fs.writeFile('./ideas.txt', data + idea, () => {});
    });
    Helper.tempReply(msg, `<@${userID}> saved`);
  } else if (/^post *embed:/i.test(message)) {
    let json = message.slice(message.indexOf(":") + 1).replace(/convert/gi, "");
    try {
      json = JSON.parse(json);
      if (json.timestamp) json.timestamp = new Date(json.timestamp);
      channel.send("as requested:", {embed: json}).catch(err => {
        Helper.sendError(channel, err);
      });
    } catch (e) {
      sendOK = false;
      msg.react(thumbs_down);
      Helper.tempReply(msg, `there was a problem:\`\`\`\n${e}\`\`\`see https://discord.js.org/#/docs/main/stable/class/RichEmbed for more info`);
    }
  } else if (/^call *police\b/i.test(message)) {
    let personRobberies = Object.keys(robberies).filter(r => userData[r].inHouse);
    if (personRobberies.length > 0) {
      personRobberies.map(r => {
        let fine = userData[r] > 12000 ? 4000 : Math.floor(userData[r].money / 3);
        userData[r].money -= fine;
        userData[userID].money += fine;
        userData[r].timesGotCaught++;
        userData[userID].timesCaughtRobber++;
        updateUserData();
        Helper.permaSend(msg, `**${userData[r].name}** caught! they will be forced to `
          + `return the stolen money and pay **\`${fine}\`** bitcoin but worse `
          + `to **${userData[userID].name}** for their service.`);
        delete robberies[r];
      });
      updateRobState();
    } else {
      let objects = ["bird", "bee", "pickle", "car", "performer", "clock", "pencil",
        "tree", "plane", "hallucination", "superhero who forgot to put on their jacket this morning",
        "dictator", "cloud of poison gas", "cat"];
      Helper.tempReply(msg, `**${userData[userID].name}**, there aren't any ongoing house robberies. that was probably a `
        + objects[Math.floor(Math.random() * objects.length)]);
      sendOK = false;
      msg.react(thumbs_down);
    }
  } else if (/^what *('?re|are) *(the)? *emojis? *(on)? *(this)? *server\b/i.test(message)) {
    pageTypes.customEmojis.list = msg.guild.emojis.map(e => `<${e.animated ? "a" : ""}:${e.identifier}>`);
    initPagination(msg, "customEmojis");
  } else if (message.slice(0, 11) === "eval: ```js") {
    if (~botinfo.makers.indexOf(userID)) {
      Helper.permaSend(msg, EvilEval.EVAL(message.slice(11, -3), msg));
    } else {
      Helper.tempReply(msg, `**${userData[userID].name}**, you do not have the permissions`);
    }
  } else {
    let echo = /^echo([cxseu]*):([^]+)/im.exec(message),
    ofNotHaveRegex = /\b(could|might|should|will|would)(?:'?ve| +have)\b/gi,
    ofNotHave = ofNotHaveRegex.exec(message),
    random = /^(actually *)?(?:pick *)?(?:a *)?rand(?:om)? *num(?:ber)? *(?:d'|from|between)? *([0-9]+) *(?:-|to|t'|&|and|n')? *([0-9]+)/i.exec(message),
    getMoney = /^(my|<@!?([0-9]+)>(?: *'?s)?) *(?:money|bcbw)\b/i.exec(message),
    setName = /^my *name *(?:'s|is) +(.+)/i.exec(message),
    giveMoney = /^give *<@!?([0-9]+)> *([0-9]+) *(?:money|bcbw)\b/i.exec(message),
    getInventory = /^(my|<@!?([0-9]+)>(?: *'?s)?) *inv(?:entory)?\b/i.exec(message),
    convertMoney = /^(?:exchange|convert) *([0-9]+) *bcbw *(?:to|2) *([a-z]+)\b/i.exec(message),
    rob = /^(?:rob|steal) *(?:from|d')? *<@!?([0-9]+)>/i.exec(message),
    consume = /^(?:consume|eat|drink) *(\S{1,2})/i.exec(message),
    bankPut = /^put *([0-9]+) *(?:money|bcbw)? *in *(?:the|l')? *bank\b/i.exec(message),
    bankTake = /^take *([0-9]+) *(?:money|bcbw)? *(?:from|d') *(?:the|l')? *bank\b/i.exec(message),
    attack = /^attack *([0-9]*)\b/i.exec(message),
    knowledge = /^what *do *(?:yo)?u *know *ab(?:ou)?t *(me\b|<@!?([0-9]+)>)/.exec(message);
    if (echo) { // cxseu
      let flags = echo[1].toLowerCase(),
      circumfix = ~flags.indexOf("c") ? "```" : "",
      content = (~flags.indexOf("s") ? echo[2] : echo[2].trim()) || "/shrug";
      if (~flags.indexOf("u")) content = content.replace(/```/g, "");
      content = circumfix + content + circumfix;
      if (~flags.indexOf("e")) content = {
        embed: {
          description: content,
          color: colour
        }
      };
      ((~flags.indexOf("x") ? externalEchoChannel : null) || channel)
        .send(content);
    } else if (ofNotHave) {
      Helper.permaSend(msg,
        `<@${userID}> no it's` + "```"
        + message.replace(ofNotHaveRegex, "$1 OF") + "```"
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
      Helper.tempReply(msg, `<@${userID}> hmmm... I choose... **${r}**!`);
    } else if (getMoney) {
      let user = getMoney[1].toLowerCase() === "my" ? userID : getMoney[2];
      prepareUser(user);
      Helper.tempReply(msg, `**${userData[user].name}** has **\`${userData[user].money}\`** bitcoin but worse`);
    } else if (setName) {
      if (setName[1].length < 2 || setName[1].length > 20) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `the length of your name is too extreme, sorry!`);
      } else if (~setName[1].indexOf("@")) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `i have been instructed to disallow the usage of @ in names, sorry!`);
      } else if (~setName[1].indexOf("﷽")) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `i have been instructed to disallow the usage of ﷽ in names, sorry!`);
      } else if (!/[a-z0-9]/i.test(setName[1].normalize('NFD'))) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `your name must include an alphanumeric character!`);
      } else {
        updateUserData(userData[userID].name = setName[1].trim());
        Helper.tempReply(msg, `hi, nice to meet you **${userData[userID].name}**`);
      }
    } else if (giveMoney) {
      let given = giveMoney[1],
      amount = +giveMoney[2];
      prepareUser(given);
      if (amount > 0 && amount <= userData[userID].money) {
        updateUserData(userData[userID].money -= amount);
        updateUserData(userData[given].money += amount);
        updateUserData();
        Helper.tempReply(msg, `**${userData[userID].name}** gave **\`${amount}\`** bitcoin but worse to **${userData[given].name}**`);
      } else {
        sendOK = false;
        Helper.tempReply(msg, `sorry, can't work with that amount <@${userID}>`);
        msg.react(thumbs_down);
      }
    } else if (getInventory) {
      let user = getInventory[1].toLowerCase() === "my" ? userID : getInventory[2];
      prepareUser(user);
      Helper.tempReply(msg, `**${userData[user].name}** has:${Helper.getInventory(userData[user], marketData) || "\n\n...nothing! :("}`);
    } else if (convertMoney) {
      let amount = +convertMoney[1],
      currency = convertMoney[2].toLowerCase();
      if (userData[userID].money < amount) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `you don't have that much bitcoin but worse, **${userData[userID].name}**`);
      } else switch (currency) {
        case "democoin":
        case "dc":
          sendOK = false;
          Helper.tempReply(msg, `waiting for verification from <@${DemoCoinID}>`, {
            embed: {
              title: `convert ${amount / BCBWperDemoCoin}`,
              description: `<@${userID}>`,
              color: colour
            }
          }).then(embedMsg => {
            exchanges[embedMsg.id] = (userID, reactionEmoji) => {
              if (userID !== DemoCoinID || reactionEmoji !== DemoCoinVerification) return false;
              userData[userID].money -= amount;
              updateUserData();
              msg.react(ok);
              embedMsg.delete();
              return true;
            };
          });
          break;
        case "mooney":
        case "mn":
        case "cowbit":
        case "cb":
          const conversionRate = calculateUniversalExchangeRate();
          ConvertChannel.send(`<@${currency[0] === "m" ? DiscowID : CowBotID}>`, {
            embed: {
              title: `convert`,
              description: `<@${userID}> ${amount * conversionRate}`,
              color: colour
            }
          }).then(embedMsg => {
            exchanges[embedMsg.id] = (reactorID, reactionEmoji) => {
              if (reactionEmoji !== ok || reactorID !== DiscowID && reactorID !== CowBotID) return false;
              userData[userID].money -= amount;
              updateUserData();
              msg.react(ok);
              // embedMsg.delete();
              return true;
            };
          });
          sendOK = false;
          break;
        default:
          sendOK = false;
          msg.react(thumbs_down);
          Helper.tempReply(msg, `that's not a currency i can convert to, **${userData[userID].name}**`);
      }
    } else if (rob) {
      if (userData[userID].inHouse) {
        Helper.tempReply(msg, `**${userData[userID].name}** you doofus! you can't rob with your pants off! put on your pants and leave your house!`);
        sendOK = false;
        msg.react(thumbs_down);
      } else if (robberies[userID]) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `**${userData[userID].name}**, you're a bit busy with another robbery at the moment.`);
      } else if (Date.now() - userData[userID].lastRobbery < 1800000) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `**${userData[userID].name}**, you're still tired from your last robbery`);
      } else {
        let victim = rob[1];
        prepareUser(victim);
        if (channel.type !== "dm" && channel.members.has(victim)) {
          let successful = true;
          if (userData[victim].inHouse) {
            let random = Math.random() * 500 + 250;
            random -= userData[victim].houseSecurityLvl;
            random += userData[victim].robHelpLvl;
            if (random < 500) {
              successful = false;
              Helper.tempReply(msg, `**${userData[userID].name}** was tried to rob **${userData[victim].name}** in their house but was caught by the house's security features.`);
            }
          }
          if (successful) {
            robberies[userID] = {
              victim: victim,
              startTime: Date.now()
            };
            questionAwaits[userID] = {
              type: "robbery",
              args: robberies[userID],
              dontAutoKill: true
            };
            userData[msg.author.id].stats.timesRobbed++;
            userData[victim].stats.timesGotRobbed++;
            updateUserData();
            updateRobState();
            Helper.permaSend(msg, `**${userData[userID].name.toUpperCase()}** IS STEALING `
              + `FROM **${userData[victim].name.toUpperCase()}**. `
              + (userData[victim].inHouse
                ? `TYPE **\`CALL POLICE\`** TO CATCH THE ROBBER.`
                : `TYPE **\`ATTACK\`** TO FIGHT THE ROBBER.`)
              + `\nThere is no backing out now. Type \`my progress\` to`
              + ` see how much money you stole, and \`run\` to escape with your BCBW.`
              + `\n\n<@${victim}> you might want to wake up`);
          }
        } else {
          sendOK = false;
          msg.react(thumbs_down);
          Helper.tempReply(msg, `**${userData[userID].name}**, **${userData[victim].name}** doesn't live here!`);
        }
      }
    } else if (consume) {
      let item = getItem(consume[1]);
      if (item === null) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `**${userData[userID].name}**, that isn't an item i know of`);
      } else if (!marketData[item].consumable) {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `**${userData[userID].name}**, i don't think you should eat that`);
      } else if (userData[userID].inventory[item] >= 1) {
        userData[userID].inventory[item]--;
        switch (item) {
          case "moofy coffee":
            let affect = Math.floor(Math.random() * 480000 + 300000);
            userData[userID].stats.coffeeConsumed++;
            userData[userID].lastMine -= affect;
            userData[userID].lastRobbery -= affect;
            Helper.tempReply(msg, `**${userData[userID].name}**: *drinks coffee* yAayayYAYAYYAYAYAYAYAYAYYA *shakes violently*`);
            break;
          case "DemoCoin geode":
            let amount = Math.floor(Math.random() ** 3 * 1000000 + 5000) / 1000;
            Helper.tempReply(msg, `**${userData[userID].name}**: *chomps violently into the plastic jewel* whoa **${amount}** DemoCoins hidden within!`);
            Helper.tempReply(msg, `waiting for verification from <@${DemoCoinID}>`, {
              embed: {
                title: `convert ${amount}`,
                description: `<@${userID}>`,
                color: colour
              }
            }).then(embedMsg => {
              exchanges[embedMsg.id] = () => {
                embedMsg.delete();
              };
            });
            break;
          default:
            Helper.tempReply(msg, `**${userData[userID].name}**, item consumed`);
        }
        updateUserData();
      } else {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `**${userData[userID].name}**, you don't have any of that item.`);
      }
    } else if (bankPut) {
      let amount = +bankPut[1];
      if (userData[userID].inHouse) {
        Helper.tempReply(msg, `**${userData[userID].name}**, the bank doesn't have a website. you have to leave your house and go there in person.`);
        sendOK = false;
        msg.react(thumbs_down);
      } else if (userData[userID].bannedFromBank) {
        Helper.tempReply(msg, `you were banned from the bank on ${new Date(userData[userID].bannedFromBank).toString()}`);
      } else if (amount <= userData[userID].money) {
        userData[userID].bankMoney += amount;
        userData[userID].money -= amount;
        updateUserData();
        Helper.tempReply(msg, `thank you for trusting the MOOFY BANK SERVICES`);
      } else {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `you don't have that much money you silly`);
      }
    } else if (bankTake) {
      let amount = +bankTake[1];
      if (userData[userID].inHouse) {
        Helper.tempReply(msg, `**${userData[userID].name}**, the bank doesn't have a website. you have to leave your house and go there in person.`);
        sendOK = false;
        msg.react(thumbs_down);
      } else if (userData[userID].bannedFromBank) {
        Helper.tempReply(msg, `you were banned from the bank on ${new Date(userData[userID].bannedFromBank).toString()}`);
      } else if (amount <= userData[userID].bankMoney) {
        userData[userID].bankMoney -= amount;
        userData[userID].money += Math.floor(amount * (1 - withdrawFee));
        updateUserData();
        Helper.tempReply(msg, `thank you for trusting the MOOFY BANK SERVICES. we've taken ${withdrawFee * 100}% of the money as payment`);
      } else {
        sendOK = false;
        msg.react(thumbs_down);
        Helper.tempReply(msg, `you don't have that much money in the bank you silly`);
      }
    } else if (attack) {
      let times = +(attack[1] || 1),
      messages = [],
      reactedThumbsdown = false;
      function attackOnce() {
        let robbers = Object.keys(robberies).filter(r => r !== userID && !userData[r].inHouse),
        continueAttacking = times-- > 1;
        if (robbers.length > 0) {
          let gunName = "gun that shoots money";
          if (userData[userID].inventory[gunName] > 0) {
            let r = robbers[Math.floor(Math.random() * robbers.length)];
            userData[userID].inventory[gunName]--;
            if (userData[r].inventory[gunName] > 0) {
              userData[r].inventory[gunName]--;
              messages.push(`**${userData[r].name}** was shot! they have ${userData[r].inventory[gunName]} guns left`);
            } else {
              if (robberies[r].bank) {
                userData[r].bannedFromBank = Date.now();
                if (userData[userID].bannedFromBank) {
                  userData[userID].bannedFromBank = false;
                  messages.push(`<@${userID}> for your service the MOOFY BANK SERVICES`
                    + ` has decided to unban you`);
                }
                messages.push(`**${userData[r].name}** caught! they will be forced to `
                  + `return the stolen money and will be banned from MOOFY BANK SERVICES`);
              } else {
                let fine = userData[r] > 12000 ? 4000 : Math.floor(userData[r].money / 3);
                userData[r].money -= fine;
                userData[userID].money += fine;
                messages.push(`**${userData[r].name}** caught! they will be forced to `
                  + `return the stolen money and pay **\`${fine}\`** bitcoin but worse `
                  + `to **${userData[userID].name}** for their service.`);
              }
              userData[r].timesGotCaught++;
              userData[userID].timesAttackedRobber++;
              delete robberies[r];
              updateRobState();
            }
            updateUserData();
          } else {
            messages.push(`**${userData[userID].name}**, you need a gun to attack`);
            if (!reactedThumbsdown) {
              reactedThumbsdown = true;
              msg.react(thumbs_down);
            }
            continueAttacking = false;
          }
        } else {
          let objects = ["cucumber", "blueberry", "trash can", "flying octopus",
            "grandma baking cookies", "mirror", "hallucination", "bypasser",
            "suspicious-looking person leaving the MOOFY BANK SERVICES with a bag of bitcoin but worse on his back"];
          messages.push(`**${userData[userID].name}** accidentally attacked a `
            + objects[Math.floor(Math.random() * objects.length)]);
          if (!reactedThumbsdown) {
            reactedThumbsdown = true;
            msg.react(thumbs_down);
          }
          continueAttacking = false;
        }
        return continueAttacking;
      }
      while (attackOnce());
      if (messages.length > 10) {
        messages.splice(3, messages.length - 10);
        messages[3] = "[...]";
      }
      Helper.tempReply(msg, messages.join("\n"));
    } else if (knowledge) {
      (knowledge[1].toLowerCase() === "me"
        ? new Promise(resolve => resolve(msg.author))
        : client.fetchUser(knowledge[2]))
      .then(user => {
        Helper.tempReply(msg, {
          embed: {
            color: colour,
            title: "what I know about you",
            fields: Helper.getKnowledgeFields(user),
            footer: {
              icon_url: user.displayAvatarURL,
              text: user.tag
            },
            author: {
              icon_url: user.displayAvatarURL,
              name: user.tag,
              url: user.defaultAvatarURL
            }
          }
        });
      });
    } else {
      sendOK = false;
    }
  }
  if (sendOK) msg.react(ok);
});

function initPagination(msg, type) {
  if (pageTypes[type].list.length === 0) {
    Helper.permaSend(msg, {
      embed: {
        footer: {
          text: "nothing to select"
        },
        description: "*nothing*",
        title: `${pageTypes[type].name} - page 1 of 1`,
        color: colour
      }
    });
    return;
  }
  let embed = new Discord.RichEmbed({
    footer: {
      text: `react/unreact to switch pages`
    },
    description: "loading...",
    title: "loading...",
    color: colour
  });
  Helper.permaSend(msg, {
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
        reactor: user,
        embed: page.embed
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

function getItem(emoji) {
  for (let item in marketData)
    if (marketData[item].emoji === emoji) return item;
  return null;
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
  } else if (exchanges[id]) {
    if (exchanges[id](user.id, reaction.emoji.name)) {
      delete exchanges[id];
    }
  } else if (reaction.emoji.name === tree) {
    reactTarget = reaction.message;
  } else if (~paginations.indexOf(id) && messageReactionUpdate(reaction.emoji.name, id, user));
});

client.on("messageReactionRemove", (reaction, user) => {
  let id = reaction.message.id;
  if (~paginations.indexOf(id) && messageReactionUpdate(reaction.emoji.name, id, user));
});

client.on("error", err => {
  err = err.message;
  if (err.length > 100) console.log("YOU HAVE AN ERROR:\n" + err.slice(0, 49) + "..." + err.slice(-49));
  else console.log("YOU HAVE AN ERROR:\n" + err);
  client.destroy().then(() => client.login(Token.token));
});

process.on('unhandledRejection', (reason, p) => {
  reason = reason.message;
  if (reason.length > 100) console.log("UNHAPPY REJECT PROBLEM:\n" + reason.slice(0, 49) + "..." + reason.slice(-49));
  else console.log("UNHAPPY REJECT PROBLEM:\n" + reason);
  // console.log('REJECTION PROBLEM at: Promise', p, 'reason:', reason);
  // client.destroy().then(() => client.login(Token.token));
});

client.login(Token.token);
