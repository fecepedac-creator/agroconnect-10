process.env.ESLINT_USE_FLAT_CONFIG = "false";

const path = require("node:path");
const {ESLint} = require("eslint");

async function main() {
  const functionsDir = path.resolve(__dirname, "..");
  const eslint = new ESLint({
    cwd: functionsDir,
    useEslintrc: true,
  });
  const results = await eslint.lintFiles(["src/**/*.ts"]);
  const formatter = await eslint.loadFormatter("stylish");
  const output = formatter.format(results);

  if (output) {
    process.stdout.write(output);
  }

  const errors = results.reduce((total, result) => total + result.errorCount, 0);
  const warnings = results.reduce((total, result) => total + result.warningCount, 0);
  const warningBudget = 45;
  if (errors > 0 || warnings > warningBudget) {
    if (warnings > warningBudget) {
      console.error(`Functions lint warning budget exceeded: ${warnings} > ${warningBudget}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
