const day = 24 * 60 * 60 * 1000, // in ms
tempMsgLifespan = 60000, // in ms
error = 0xf44336;
module.exports = {
  getProfile(userDataEntry) {
    return `**BCBW account created**: ${new Date(userDataEntry.joined).toString()}\n`
      + `**BCBW**: ${userDataEntry.money}\n`
      + `**daily streak**: ${Date.now() - userDataEntry.lastDaily > day * 2 ? 0 : userDataEntry.dailyStreak}\n`
      + `\n__**Inventory**__\n`
      + `coming later (sorry i'm very lazy)\n`
      + `\n__**Stats**__\n`
      + `times mined: ${userDataEntry.stats.timesMined}\n`
      + `GAME wins: ${userDataEntry.stats.timesWonGame}\n`
      + `GAME losses: ${userDataEntry.stats.timesLostGame}\n`
      + `GAME hint purchases: ${userDataEntry.stats.hintPurchases}`
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
    channel.send({
      embed: {
        color: error,
        title: "there was a problem:",
        description: "```" + err.message + "```"
      }
    });
  }
};
