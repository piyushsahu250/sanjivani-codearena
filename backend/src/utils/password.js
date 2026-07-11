const crypto = require("crypto");

// Ambiguous characters (I/l/1, O/0) excluded — these passwords are read off a screen and
// re-typed by hand on first login.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "@#$%";

function randomChar(charset) {
  return charset[crypto.randomInt(charset.length)];
}

// Generates a unique, cryptographically random temporary password for a new or reset account.
// Replaces the old shared patterns (`${instituteName}@123`, and the fixed literal "Sanjivani@1")
// that gave every account at an institute, or every reset account platform-wide, the exact same
// password — predictable from public info in the first case, and identical-across-many-accounts
// in both, which is exactly the "reused/breached password" pattern browser password managers
// flag. mustChangePassword still forces rotation on first login regardless; this just removes
// the exploitable window before that happens.
function generateTempPassword() {
  const chars = [
    randomChar(UPPER), randomChar(UPPER),
    randomChar(LOWER), randomChar(LOWER), randomChar(LOWER),
    randomChar(DIGITS), randomChar(DIGITS),
    randomChar(SYMBOLS),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

module.exports = { generateTempPassword };
