function esc(value) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function generateVCard(data) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(data.name)}`, `TEL;TYPE=CELL:${esc(data.phone)}`];

  if (data.extraPhone) {
    lines.push(`TEL;TYPE=OTHER:${esc(data.extraPhone)}`);
  }

  if (data.email) {
    lines.push(`EMAIL:${esc(data.email)}`);
  }

  if (data.address || data.postcode) {
    lines.push(`ADR:;;${esc(data.address || "")};;${esc(data.postcode || "")}`);
  }

  if (data.hashtag) {
    lines.push(`NOTE:${esc(data.hashtag)}`);
  }

  lines.push("END:VCARD");

  return `${lines.join("\r\n")}\r\n`;
}

module.exports = {
  generateVCard,
};