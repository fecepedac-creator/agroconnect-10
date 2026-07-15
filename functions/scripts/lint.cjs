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
  if (errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
