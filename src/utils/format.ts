export const formatTextWithHTML = (text: string): string => {
  // Split the text into individual lines
  const lines = text.split("\n");

  // Format each line with HTML markup
  const formattedLines = lines.map((line) => {
    // Check if the line starts with a ticket number
    const match = line.match(/^(\w+-\d+-\w+-\w+-\w+)-(\w+)/);
    if (match) {
      const [, ticketNumber, description] = match;
      return `<div>${ticketNumber}</div><div>- ${
        description.split("-").map((part) => decodeURIComponent(part)).join(" ")
      }</div>`;
    } else {
      // Encode the line and replace newlines with HTML line breaks
      return `<div>${line.replace(/\n/g, "<br>")}</div>`;
    }
  });

  // Join the formatted lines with newlines
  return formattedLines.join("\n");
};

export const commitMessageToTicket = (message: string): string | null => {
  return message.split(":")?.[0] ?? null;
};
