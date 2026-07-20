import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users } from "../db/schema";

/**
 * Create an admin or sales user.
 * Usage: npm run user:create -- <email> <password> <name...> [--role admin|sales]
 */
async function main() {
  const args = process.argv.slice(2);
  const roleIdx = args.indexOf("--role");
  let role: "admin" | "sales" = "admin";
  if (roleIdx !== -1) {
    const r = args[roleIdx + 1];
    if (r !== "admin" && r !== "sales") throw new Error("--role must be admin or sales");
    role = r;
    args.splice(roleIdx, 2);
  }
  const [email, password, ...nameParts] = args;
  if (!email || !password || nameParts.length === 0) {
    console.error("Usage: npm run user:create -- <email> <password> <name...> [--role admin|sales]");
    process.exit(1);
  }
  if (password.length < 10) throw new Error("Password must be at least 10 characters");

  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .insert(users)
    .values({ email: email.toLowerCase(), passwordHash, name: nameParts.join(" "), role })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, name: nameParts.join(" "), role, active: true },
    });
  console.log(`User ${email} (${role}) created/updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
