const day = 24 * 60 * 60 * 1000;
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
  }
};
