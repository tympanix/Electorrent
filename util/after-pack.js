const util = require("util");
const exec = util.promisify(require("child_process").exec);
const path = require("path")

exports.default = async function(context) {
  const electronPlatformNameLoweredCase = context.electronPlatformName.toLowerCase();

  if (electronPlatformNameLoweredCase.startsWith("lin")) {
    const chromeSandbox = path.join(context.appOutDir, "chrome-sandbox");
    console.log(`Changing permissions for ${chromeSandbox}`);
    await exec(`chmod 4755 ${chromeSandbox}`);
  }
};
