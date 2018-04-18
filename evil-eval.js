module.exports = {
  EVAL(code, msg) {
    try {
      return "```\n" + eval(code) + "\n```";
    } catch (err) {
      return {
        embed: {
          color: 0xf44336,
          title: "ERROR",
          description: "```\n" + err.message + "\n```"
        }
      };
    }
  }
}
