import { randomBytes, createECDH } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const wrangler = resolve("node_modules", "wrangler", "bin", "wrangler.js");
const ecdh = createECDH("prime256v1");
ecdh.generateKeys();

const secrets = {
  INVITE_PEPPER: randomBytes(48).toString("base64url"),
  VAPID_PUBLIC_KEY: ecdh.getPublicKey().toString("base64url"),
  VAPID_PRIVATE_KEY: ecdh.getPrivateKey().toString("base64url"),
};

for (const [name, value] of Object.entries(secrets)) {
  const result = spawnSync(
    process.execPath,
    [wrangler, "secret", "put", name, "--config", "wrangler.jsonc"],
    { input: `${value}\n`, stdio: ["pipe", "inherit", "inherit"] },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("CrewSync production secrets configured.");
