const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();

const Token = require("./secret_stuff.json");
const words = require("./items.json");
const commands = require("./command-list.json");
const botinfo = require("./about.json");
const userData = require("./users.json");
const marketData = require("./market-items.json");
const robberies = require("./rob-state.json");

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
      return `**BCBW account created**: ${new Date(userData[userID].joined).toString()}\n`
        + `**BCBW**: ${userData[userID].money}\n`
        + `**daily streak**: ${userData[userID].dailyStreak}\n`
        + `\n__**Inventory**__\n`
        + `coming soon (sorry i'm lazy)\n`
        + `\n__**Stats**__\n`
        + `times mined: ${userData[userID].stats.timesMined}\n`
        + `GAME wins: ${userData[userID].stats.timesWonGame}\n`
        + `GAME losses: ${userData[userID].stats.timesLostGame}\n`
        + `GAME hint purchases: ${userData[userID].stats.hintPurchases}`
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
          msg.channel.send(`${args.username}, not enough money!`);
        } else {
          args.hinted.push(args.purchaseHint);
          userData[msg.author.id].money -= 50;
          userData[msg.author.id].stats.hintPurchases++;
          msg.channel.send(`${args.username}, purchased! :)`);
          updateUserData();
          msg.react(ok);
        }
      } else {
        msg.channel.send(`${args.username}, canceled purchase! :)`);
        msg.react(ok);
      }
      args.purchaseHint = false;
    } else if (args.started) {
      let hint = /^hint *([0-9]+)\b/i.exec(msg.content);
      if (hint) {
        hint = +hint[1];
        if (hint > args.word.length || hint < 1) {
          msg.react(thumbs_down);
          msg.channel.send(`${args.username}, the letter is out of range`);
        } else if (~args.hinted.indexOf(hint)) {
          msg.react(thumbs_down);
          msg.channel.send(`${args.username}, i already gave you the hint!`);
        } else {
          msg.channel.send(`${args.username}, purchase letter #${hint} for **\`50\`** bitcoin but worse? (y/n)`);
          args.purchaseHint = hint;
        }
      } else {
        args.tries++;
        if (~msg.content.toLowerCase().indexOf(args.word)) {
          let reward = args.word.length * 53;
          userData[msg.author.id].money += reward;
          userData[msg.author.id].stats.timesWonGame++;
          msg.channel.send(`${args.username} just won **\`${reward}\`** bitcoin but worse!`);
          questionAwait.dontAutoKill = false;
        } else if (msg.content.toLowerCase() === "cancel") {
          msg.channel.send(`cancel game. hints and penalties were not refunded. the word was **${args.word}**`);
          questionAwait.dontAutoKill = false;
          args.tries--;
        } else if (args.tries >= 5 || userData[msg.author.id].money < 50) {
          userData[msg.author.id].stats.timesLostGame++;
          msg.channel.send(`${args.username} lost. the word was **${args.word}**`);
          questionAwait.dontAutoKill = false;
        } else {
          userData[msg.author.id].money -= 50;
          msg.channel.send(`${args.username}, nope! **\`50\`** bitcoin but worse penalty!`);
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
      let stolenMoney = Math.min(Math.floor((Date.now() - args.startTime) * robRate / 1000),
        userData[args.victim].money);
      if (run) {
        userData[args.victim].money -= stolenMoney;
        userData[args.victim].stats.moneyLostFromRobbing -= stolenMoney;
        userData[msg.author.id].money += stolenMoney;
        userData[msg.author.id].stats.moneyFromRobbing += stolenMoney;
        updateUserData();
        msg.react(ok);
        msg.channel.send(`**${userData[msg.author.id].name}** successfully `
          + `robbed **\`${stolenMoney}\`** bitcoin but worse from **${userData[args.victim].name}**`);
        delete robberies[msg.author.id];
        updateRobState();
        questionAwait.dontAutoKill = false;
      } else {
        msg.react(ok);
        msg.channel.send(`**${userData[msg.author.id].name}**, you have stolen `
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
scheduledRobStateUpdate = null;

const latestUserVersion = 17;
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
function updateRobState() {
  if (scheduledRobStateUpdate !== null) clearTimeout(scheduledRobStateUpdate);
  scheduledRobStateUpdate = setTimeout(() => {
    scheduledRobStateUpdate = null;
    fs.writeFile("./rob-state.json", JSON.stringify(robberies), () => {});
  }, 100);
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  Object.keys(userData).map(id => userData[id].v < latestUserVersion ? prepareUser(id) : 0);
});

client.on("message", msg => {
  let message = msg.content,
  channel = msg.channel,
  userID = msg.author.id;
  if (userID === client.user.id) return;
  if (questionAwaits[userID]) {
    let valid = questionResponseResponders[questionAwaits[userID].type](msg, questionAwaits[userID].args, questionAwaits[userID]);
    if (!questionAwaits[userID].dontAutoKill) delete questionAwaits[userID];
    if (valid) return;
  }
  let sendOK = true;
  prepareUser(userID);
  if (/\b(hate|hated|hates|hating|hatred|hater|haters)\b/i.test(message)) {
    let hat = {h: "l", H: "L", a: "o", A: "O", t: "v", T: "V"};
    channel.send(`hey hey hey <@${userID}> don't be so negative! try this:`
      + "```" + message.replace(
        /\b(hat)(e(s|d|rs?)?|ing)\b/gi,
        (m, c1, c2) => c1.split("").map(l => hat[l]).join("") + c2
      ).replace(/hatred/g, "love") + "```");
    sendOK = false;
    msg.react(thumbs_down);
  } else if (msg.mentions.users.has(client.user.id) || /^moofy,? */i.test(message)) {
    let moreInfo = /\btell *me *more *about *([a-z]+)(?: *#?([0-9]+))?/i.exec(message);
    if (moreInfo) {
      let query = moreInfo[1].trim().toLowerCase(),
      resultIndex = +moreInfo[2] || 1,
      results = Object.keys(commands).filter(c => ~c.toLowerCase().indexOf(query));
      if (results.length === 0) {
        channel.send(`couldn't find the command you were looking for (try \`@moofy-bot your commands\` for the full list)`);
        sendOK = false;
        msg.react(thumbs_down);
      } else {
        if (resultIndex > results.length) resultIndex = results.length;
        let command = results[resultIndex - 1];
        channel.send({
          embed: {
            title: `**\`${command}\`**`,
            description: commands[command].replace(/TREE/g, tree)
              + `\n\nOther results (use \`@moofy-bot tell me more about ${query} #n\`):\n`
              + results.map((c, i) => `${i + 1}. \`${c}\``).join("\n")
          }
        });
      }
    } else if (/\b(help|((your|ur) *)?commands?|command *format)\b/i.test(message)) {
      initPagination(msg, "commandList");
    } else if (/\bwho\b/i.test(message)) {
      let content = [];
      channel.send({
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
      channel.send(`i'm feeling ${feeling}. and you?`)
      questionAwaits[userID] = {
        type: "howRU",
        args: feeling
      };
    } else if (/\bmarket\b/i.test(message)) {
      initPagination(msg, "market");
    } else if (/\bGAME\b/.test(message)) {
      channel.send("loading...").then(msg => {
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
      channel.send(`NOT LOUD ENOUGH <@${userID}>`);
    } else if (/\bprofiles?\b/i.test(message)) {
      initPagination(msg, "profiles");
    } else if (/\bleader(?:board)?\b/i.test(message)) {
      let peopleMoney = Object.values(userData).filter(u => u.money > 0)
        .sort((a, b) => b.money - a.money),
      digitLengths = peopleMoney[0].money.toString().length,
      spaces = " ".repeat(digitLengths);
      channel.send({
        embed: {
          color: colour,
          title: "people with the most bitcoin but worse",
          description: peopleMoney.map(u => `\`+${(spaces + u.money).slice(-digitLengths)}\` **${u.name}**`).join("\n")
        }
      });
    } else {
      let deleteRegex = /\bdelete *([0-9]+)\b/i.exec(message),
      react = /\breact *(\S{1,2})/i.exec(message);
      if (deleteRegex) {
        let amount = +deleteRegex[1];
        if (amount > 100) {
          channel.send(`<@${userID}> due to technical limitations i can't delete more than 100`);
          sendOK = false;
          msg.react(thumbs_down);
        } else if (Math.floor(Math.random() * 4)) {
          channel.send(`<@${userID}> nahhh`);
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
      } else if (react) {
        try {
          if (!reactTarget) throw new Error("which message?");
          if (react[1] === thumbs_up || react[1] === thumbs_down)
            throw new Error("don't dare you try to manipulate votes!");
          reactTarget.react(react[1]);
        } catch (e) {
          channel.send(`<@${userID}> **\`\`\`${e.toString().toUpperCase()}\`\`\`**`);
          sendOK = false;
        }
      } else {
        channel.send(`<@${userID}> DON'T MENTION ME`);
        sendOK = false;
      }
    }
  } else if (/^pag(e|ination) *test\b/i.test(message)) {
    initPagination(msg, "speller");
  } else if (/^use *this *channel\b/i.test(message)) {
    externalEchoChannel = channel;
  } else if (/\bdumb\b/i.test(message) && /\bbot\b/i.test(message)) {
    channel.send(`DID I JUST HEAR "dumb" AND "bot" USED TOGETHER??!!??!11!?1/!?`);
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
    channel.send({
      embed: embed
    }).then(msg => {
      emojiInfos[msg.id] = {
        embed: embed,
        msg: msg
      };
    });
  } else if (/\bkeepInventory\b/i.test(message) && msg.author.username === "Gamepro5") {
    channel.send(`<@${userID}>` + " make sure you set `keepInventory` to `false` :)");
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
      channel.send(`<@${userID}> good job! here's **\`500\`** bitcoin but worse for you :D\n`
        + `(${userData[userID].dailyStreak}-day streak!)` + addendum);
    } else {
      let lastDaily = new Date(userData[userID].lastDaily);
      channel.send(`<@${userID}> be patient! you last got your daily at `
        + `${(lastDaily.getHours() + 11) % 12 + 1}:${("0" + lastDaily.getMinutes()).slice(-2)} ${lastDaily.getHours() < 12 ? "a" : "p"}m`);
      sendOK = false;
      msg.react(thumbs_down);
    }
  } else if (/^i *want *to *mine\b/i.test(message)) {
    if (userData[userID].inventory.pickaxe >= 1) {
      let now = Date.now();
      if (now - userData[userID].lastMine < 600000) {
        sendOK = false;
        channel.send(`you're still tired from your last mining session, **${userData[userID].name}**`);
      } else {
        let brokenPickaxe = Math.floor(Math.random() * 3) === 0,
        amount = Math.floor(Math.random() ** 6 * 1000 + 50);
        if (brokenPickaxe) {
          amount = Math.ceil(amount * (1 - Math.random()));
          userData[userID].inventory.pickaxe--;
        }
        userData[userID].money += amount;
        userData[userID].stats.timesMined++;
        userData[userID].lastMine = now;
        updateUserData();
        channel.send(`**${userData[userID].name}** just mined **\`${amount}\`** bitcoin but worse!`
          + (brokenPickaxe ? `\nyour pickaxe broke :(` : ""));
      }
    } else {
      channel.send(`**${userData[userID].name}**, you don't have a pickaxe`);
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
          channel.send("```" + e.toString() + "```");
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
    if (Object.keys(robberies).length > 0) {
      Object.keys(robberies).map(r => {
        let fine = userData[r] > 12000 ? 4000 : Math.floor(userData[r].money / 3);
        userData[r].money -= fine;
        userData[userID].money += fine;
        userData[r].timesGotCaught++;
        userData[userID].timesCaughtRobber++;
        updateUserData();
        channel.send(`**${userData[r].name}** caught! they will be forced to `
          + `return the stolen money and pay **\`${fine}\`** bitcoin but worse `
          + `to **${userData[userID].name}** for their service.`);
        delete robberies[r];
      });
      updateRobState();
    } else {
      let objects = ["bird", "bee", "pickle", "car", "performer", "clock", "pencil",
        "tree", "plane", "hallucination", "superhero who forgot to put on their jacket this morning",
        "dictator", "cloud of poison gas", "cat"];
      channel.send(`**${userData[userID].name}**, there aren't any ongoing robberies. that was probably a `
        + objects[Math.floor(Math.random() * objects.length)]);
      sendOK = false;
      msg.react(thumbs_down);
    }
  } else if (/^my *bank *acc(?:ount)?\b/i.test(message)) {
    channel.send(`you have **\`${userData[userID].bankMoney}\`** bitcoin but worse protected by MOOFY BANK SERVICES`);
  } else if (/^my *progress\b/i.test(message)) {
    channel.send(`you aren't robbing right now. robbers: `
      + (Object.keys(robberies).map(id => `**${(userData[id] || {}).name}**`).join(", ") || "none"));
  } else {
    let echo = /^echo(c?)(x?)(s?)(e?):([^]+)/im.exec(message),
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
    bankPut = /^put *([0-9]+) *(?:money|bcbw) *in *(?:the|l')? *bank\b/i.exec(message),
    bankTake = /^take *([0-9]+) *(?:money|bcbw) *(?:from|d') *(?:the|l')? *bank\b/i.exec(message);
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
      ((echo[2] ? externalEchoChannel : null) || channel)
        .send(content);
    } else if (ofNotHave) {
      channel.send(
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
      channel.send(`<@${userID}> hmmm... I choose... **${r}**!`);
    } else if (getMoney) {
      let user = getMoney[1].toLowerCase() === "my" ? userID : getMoney[2];
      prepareUser(user);
      channel.send(`**${userData[user].name}** has **\`${userData[user].money}\`** bitcoin but worse`);
    } else if (setName) {
      if (setName[1].length < 2 || setName[1].length > 20) {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`the length of your name is too extreme, sorry!`);
      } else if (~setName[1].indexOf("@")) {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`i have been instructed to disallow the usage of @ in names, sorry!`);
      } else if (~setName[1].indexOf("﷽")) {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`i have been instructed to disallow the usage of ﷽ in names, sorry!`);
      } else if (!/[a-z0-9]/i.test(setName[1].normalize('NFD'))) {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`your name must include an alphanumeric character!`);
      } else {
        updateUserData(userData[userID].name = setName[1].trim());
        channel.send(`hi, nice to meet you **${userData[userID].name}**`);
      }
    } else if (giveMoney) {
      let given = giveMoney[1],
      amount = +giveMoney[2];
      prepareUser(given);
      if (amount > 0 && amount <= userData[userID].money) {
        updateUserData(userData[userID].money -= amount);
        updateUserData(userData[given].money += amount);
        updateUserData();
        channel.send(`**${userData[userID].name}** gave **\`${amount}\`** bitcoin but worse to **${userData[given].name}**`);
      } else {
        sendOK = false;
        channel.send(`sorry, can't work with that amount <@${userID}>`);
        msg.react(thumbs_down);
      }
    } else if (getInventory) {
      let user = getInventory[1].toLowerCase() === "my" ? userID : getInventory[2];
      prepareUser(user);
      let content = "";
      for (let item in userData[user].inventory) {
        if (userData[user].inventory[item] === 0) continue;
        content += `\n${marketData[item].emoji} x${userData[user].inventory[item]} (${item})`;
      }
      channel.send(`**${userData[user].name}** has:${content || "\n\n...nothing! :("}`);
    } else if (convertMoney) {
      let amount = +convertMoney[1],
      currency = convertMoney[2].toLowerCase();
      if (userData[userID].money < amount) {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`you don't have that much bitcoin but worse, **${userData[userID].name}**`);
      } else switch (currency) {
        case "democoin":
        case "dc":
          sendOK = false;
          channel.send(`waiting for verification from <@${DemoCoinID}>`, {
            embed: {
              title: `convert ${amount / BCBWperDemoCoin}`,
              description: `<@${userID}>`
            }
          }).then(embedMsg => {
            exchanges[embedMsg.id] = () => {
              userData[userID].money -= amount;
              updateUserData();
              msg.react(ok);
              embedMsg.delete();
            };
          });
          break;
        default:
          sendOK = false;
          msg.react(thumbs_down);
          channel.send(`that's not a currency i can convert to, **${userData[userID].name}**`);
      }
    } else if (rob) {
      if (robberies[userID]) {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`**${userData[userID].name}**, you're a bit busy with another robbery at the moment.`);
      } else {
        let victim = rob[1];
        prepareUser(victim);
        if (channel.type !== "dm" && channel.members.has(victim)) {
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
          channel.send(`**${userData[userID].name.toUpperCase()}** IS STEALING `
            + `FROM **${userData[victim].name.toUpperCase()}**. TYPE **\`HEY\`**`
            + ` TO CATCH.\nThere is no backing out now. Type \`my progress\` to`
            + ` see how much money you stole, and \`run\` to escape with your BCBW.`
            + `\n\n<@${victim}> you might want to wake up`);
        } else {
          sendOK = false;
          msg.react(thumbs_down);
          channel.send(`**${userData[userID].name}**, **${userData[victim].name}** doesn't live here!`);
        }
      }
    } else if (consume) {
      let item;
      for (item in marketData) if (marketData[item].emoji === consume[1]) break;
      if (marketData[item].emoji !== consume[1]) {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`**${userData[userID].name}**, that isn't an item i know of`);
      } else if (marketData[item].consumable) {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`**${userData[userID].name}**, i don't think you should eat that`);
      } else if (userData[userID].inventory[item] >= 1) {
        userData[userID].inventory[item]--;
        switch (item) {
          case "moofy coffee":
            let affect = Math.floor(Math.random() * 480000 + 180000);
            userData[userID].stats.coffeeConsumed++;
            userData[userID].lastMine -= affect;
            channel.send(`**${userData[userID].name}**: *drinks coffee* yAayayYAYAYYAYAYAYAYAYAYYA *shakes violently*`);
            break;
          default:
            channel.send(`**${userData[userID].name}**, item consumed`);
        }
        updateUserData();
      } else {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`NO. BAD **${userData[userID].name.toUpperCase()}**. YOU HAVEN'T PURCHASED IT YET.`);
      }
    } else if (bankPut) {
      let amount = +bankPut[1];
      if (amount <= userData[userID].money) {
        userData[userID].bankMoney += amount;
        userData[userID].money -= amount;
        updateUserData();
        channel.send(`thank you for trusting the MOOFY BANK SERVICES`);
      } else {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`you don't have that much money you silly`);
      }
    } else if (bankTake) {
      let amount = +bankTake[1];
      if (amount <= userData[userID].bankMoney) {
        userData[userID].bankMoney -= amount;
        userData[userID].money += Math.floor(amount * (1 - withdrawFee));
        updateUserData();
        channel.send(`thank you for trusting the MOOFY BANK SERVICES. we've taken ${withdrawFee * 100}% of the money as payment`);
      } else {
        sendOK = false;
        msg.react(thumbs_down);
        channel.send(`you don't have that much money in the bank you silly`);
      }
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
  } else if (exchanges[id]) {
    if (user.id === DemoCoinID && reaction.emoji.name === DemoCoinVerification) {
      exchanges[id]();
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
  console.error(err);
  // client.destroy().then(() => client.login());
});

client.login(Token.token);
