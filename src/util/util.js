import Gio from "gi://Gio";

export const settings = Gio.Settings.new(pkg.name);
export const comparisonTokens = [
  {
    key: "characters",
    description: _("Characters"),
  },
  {
    key: "words",
    description: _("Words"),
  },
  {
    key: "lines",
    description: _("Lines"),
  },
  {
    key: "sentences",
    description: _("Sentences"),
  },
];
