import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import { comparisonTokens } from "./util.js";

export const TextComparePreferencesDialog = GObject.registerClass(
  {
    GTypeName: "TextComparePreferencesDialog",
    Template: getResourceUri("preferences.ui"),
    InternalChildren: [
      "system",
      "dark",
      "light",
      "comparison_token_settings",
      "case_sensitivity_settings",
    ],
    Properties: {
      theme: GObject.ParamSpec.string(
        "theme",
        "Theme",
        "Preferred theme",
        GObject.ParamFlags.READWRITE,
        ""
      ),
      comparisonToken: GObject.ParamSpec.string(
        "comparisonToken",
        "comparison_token",
        "Preferred comparison token",
        GObject.ParamFlags.READWRITE,
        ""
      ),
    },
  },
  class TextComparePreferencesDialog extends Adw.PreferencesDialog {
    constructor(options = {}) {
      super(options);

      this.setComparisonTokenModel();

      this.settings = Gio.Settings.new(pkg.name);
      this.settings.bind(
        "preferred-theme",
        this,
        "theme",
        Gio.SettingsBindFlags.DEFAULT
      );
      this.settings.bind(
        "comparison-token",
        this,
        "comparisonToken",
        Gio.SettingsBindFlags.DEFAULT
      );
      this.settings.bind(
        "case-sensitivity",
        this._case_sensitivity_settings,
        "active",
        Gio.SettingsBindFlags.DEFAULT
      );

      this.bind_property_full(
        "theme",
        this._system,
        "active",
        GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE,
        (_, theme) => [true, theme === "system"],
        (_, theme) => [theme, "system"]
      );

      this.bind_property_full(
        "theme",
        this._light,
        "active",
        GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE,
        (_, theme) => [true, theme === "light"],
        (_, theme) => [theme, "light"]
      );

      this.bind_property_full(
        "theme",
        this._dark,
        "active",
        GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE,
        (_, theme) => [true, theme === "dark"],
        (_, theme) => [theme, "dark"]
      );

      this.bind_property_full(
        "comparisonToken",
        this._comparison_token_settings,
        "selected",
        GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE,
        (_, token) => {
          const comparisonToken = comparisonTokens.find(
            ({ key }) => key === token
          );

          if (!comparisonToken) {
            throw new Error(
              "Mismatch between difficulty keys in the settings and in comparisonTokens array"
            );
          }

          const model = this._comparison_token_settings.model;

          for (let i = 0; i < model.get_n_items(); i++) {
            const stringObject = model.get_item(i);

            if (stringObject?.string === comparisonToken.description) {
              return [true, i];
            }
          }
          return [false, 0];
        },
        (_, selected) => {
          const stringObject =
            this._comparison_token_settings.model.get_item(selected);

          if (stringObject?.string) {
            const comparisonToken = comparisonTokens.find(
              ({ description }) => description === stringObject?.string
            );

            if (!comparisonToken) {
              throw new Error(
                "There is a mismatch between comparison token descriptions in the settings model and comparisonTokens array"
              );
            }

            return [true, comparisonToken.key];
          }

          return [false, "mixed"];
        }
      );
    }

    setComparisonTokenModel = () => {
      const _comparisonTokens = comparisonTokens.map(
        ({ description }) => description
      );
      this._comparison_token_settings.model =
        Gtk.StringList.new(_comparisonTokens);

      const propExpression = Gtk.PropertyExpression.new(
        Gtk.StringObject,
        null,
        "string"
      );

      this._comparison_token_settings.expression = propExpression;
    };
  }
);
