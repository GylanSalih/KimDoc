const mappings = new Map(
  [
    ["Code Reviewed", "🚧"],
    ["In Code Review", "🚧"],
    ["Merged", ":merge:"],
    ["PM Reviewed", ":merge:"],
    ["Geschlossen", ":merge:"],
    ["Ready for Release", ":merge:"],
    ["Heute erstellt", ":pullrequest:"],
  ],
);

export const getStatusEmoji = (status: string): string | null => {
  if (!mappings.has(status)) {
    return null;
  }

  return mappings.get(status) ?? null;
};
