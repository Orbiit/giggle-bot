const day = 24 * 60 * 60 * 1000, // in ms
tempMsgLifespan = 60000, // in ms
error = 0xf44336;
module.exports = {
  getProfile(userDataEntry, marketData) {
    return `**BCBW account created**: ${new Date(userDataEntry.joined).toString()}`
      + `\n**BCBW**: ${userDataEntry.money}`
      + `\n**daily streak**: ${Date.now() - userDataEntry.lastDaily > day * 2 ? 0 : userDataEntry.dailyStreak}`
      + `\n\n__**Inventory**__`
      + (this.getInventory(userDataEntry, marketData) || "\nnothing")
      + `\n\n__**Stats**__`
      + `\ntimes mined: ${userDataEntry.stats.timesMined}`
      + `\nGAME wins: ${userDataEntry.stats.timesWonGame}`
      + `\nGAME losses: ${userDataEntry.stats.timesLostGame}`
      + `\nGAME hint purchases: ${userDataEntry.stats.hintPurchases}`
      + `\ntimes they robbed: ${userDataEntry.stats.timesRobbed}`
      + `\ntimes was robbed: ${userDataEntry.stats.timesGotRobbed}`
      + `\nmoney from robbing others: ${userDataEntry.stats.moneyFromRobbing}`
      + `\nmoney lost from robbers: ${userDataEntry.stats.moneyLostFromRobbing}`
      + `\ntimes got caught: ${userDataEntry.stats.timesGotCaught}`
      + `\ntimes caught a robber: ${userDataEntry.stats.timesCaughtRobber}`
      + `\ncoffee consumed: ${userDataEntry.stats.coffeeConsumed}`
      + `\ntimes attacked a robber: ${userDataEntry.stats.timesAttackedRobber}`
  },
  tempReply(origMsg, time, ...message) {
    if (!time || typeof time !== "number") {
      message.splice(0, 0, time);
      time = 0;
    }
    let promise = origMsg.channel.send(...message);
    promise.then(msg => {
      msg.delete(time || tempMsgLifespan).then(() => {
        origMsg.reactions.map(r => r.me ? r.remove().catch(err => {}) : 0);
      });
    }).catch(err => {
      this.sendError(origMsg.channel, err);
    });
    return promise;
  },
  permaSend(origMsg, ...message) {
    let promise = origMsg.channel.send(...message);
    promise.then(msg => {
      msg.delete(time || tempMsgLifespan).then(() => {
        origMsg.reactions.map(r => r.me ? r.remove().catch(err => {}) : 0);
      });
    }).catch(err => {
      this.sendError(origMsg.channel, err);
    });
    return promise;
  },
  getKnowledgeFields(user) {
    let fields = [
      {name: "avatar ID", value: user.avatar},
      {name: "avatar URL (optional)", value: user.avatarURL},
      {name: "bot?", value: user.bot},
      {name: "creation time", value: user.createdAt.toString()},
      {name: "creation timestamp", value: user.createdTimestamp},
      {name: "default avatar URL", value: user.defaultAvatarURL},
      {name: "discriminator", value: user.discriminator},
      {name: "avatar URL", value: user.displayAvatarURL},
      {name: "user id", value: user.id},
      {name: "presence status", value: user.presence.status},
      {name: "tag", value: user.tag},
      {name: "username", value: user.username}
    ];
    if (user.lastMessage) {
      fields.push({name: "last message content", value: "```" + user.lastMessage.content + "```"});
      fields.push({name: "last message ID", value: user.lastMessageID});
    }
    if (user.presence.game) {
      fields.push({name: "presence game name", value: user.presence.game.name});
      fields.push({name: "presence game streaming?", value: user.presence.game.streaming});
      fields.push({name: "presence game type", value: user.presence.game.type});
      fields.push({name: "presence game url (optional)", value: user.presence.game.url + ""});
    }
    return fields;
  },
  sendError(channel, err) {
    if (err.message === "time is not defined") return;
    channel.send({
      embed: {
        color: error,
        title: "there was a problem:",
        description: "```" + err.message + "```"
      }
    });
  },
  getInventory(userDataEntry, marketData) {
    let content = "";
    for (let item in userDataEntry.inventory) {
      if (userDataEntry.inventory[item] === 0) continue;
      content += `\n${marketData[item].emoji} x${userDataEntry.inventory[item]} (${item})`;
    }
    return content;
  }
};
