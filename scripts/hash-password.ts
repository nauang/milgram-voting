import { hashPassword } from "../src/lib/password";

const MIN_PASSWORD_LENGTH = 12;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
}

async function main(): Promise<void> {
  const password = await readStdin();
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Use uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${await hashPassword(password)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
