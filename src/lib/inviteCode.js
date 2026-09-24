const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente caratteri ambigui (0/O, 1/I/L)

export function generateInviteCode(length = 8) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
