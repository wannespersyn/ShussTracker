// Uppercase, no 0/O/1/I — hard to mistype when read off a phone screen or
// said out loud. Shared by crew invite codes and guest claim codes.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}
