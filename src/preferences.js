import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import { comparisonTokens, settings } from "./util.js";

export const TextComparePreferencesDialog = GObject.registerClass(
  {
    GTypeName: "TextComparePreferencesDialog",
    Template: getResourceUri("preferences.ui"),
    InternalChildren: [
      "comparison_token_settings",
      "case_sensitivity_settings",
      "real_time_comparison_settings",
    ],
    Properties: {
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

      settings.bind(
        "comparison-token",
        this,
        "comparisonToken",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
        "case-sensitivity",
        this._case_sensitivity_settings,
        "active",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
        "real-time-comparison",
        this._real_time_comparison_settings,
        "active",
        Gio.SettingsBindFlags.DEFAULT
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
            throw new Error("Comparison token not found");
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
              throw new Error("Comparison token not found");
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

      const propertyExpression = Gtk.PropertyExpression.new(
        Gtk.StringObject,
        null,
        "string"
      );
      this._comparison_token_settings.expression = propertyExpression;
    };
  }
);
