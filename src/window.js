import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GtkSource from "gi://GtkSource?version=5";
import { diffChars, diffWords, diffWordsWithSpace } from "./js-diff.js";

GObject.type_ensure(GtkSource.View.$gtype);

export const CompareWindow = GObject.registerClass(
  {
    GTypeName: "CompareWindow",
    Template: getResourceUri("window.ui"),
    InternalChildren: [
      // Toggle Buttons
      "old_text_button",
      "new_text_button",
      "comparison_button",
      // Source views
      "text_view_before",
      "text_view_after",
      "text_view_result",
    ],
  },
  class CompareWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });
      this.createActions();
      this.createBuffer();
      this.loadStyles();
      this.bindSettings();
      this.setPreferredColorScheme();
    }

    createBuffer = () => {
      this.buffer_before = new GtkSource.Buffer();
      this.buffer_after = new GtkSource.Buffer();
      this.buffer_result = new GtkSource.Buffer();

      const tagTableResult = this.buffer_result.tag_table;

      tagTableResult.add(
        new Gtk.TextTag({
          name: "redForeground",
          foreground: "#b30000",
        })
      );
      tagTableResult.add(
        new Gtk.TextTag({
          name: "redBackground",
          background: "#fadad7",
        })
      );
      tagTableResult.add(
        new Gtk.TextTag({
          name: "blueForeground",
          foreground: "#406619",
        })
      );
      tagTableResult.add(
        new Gtk.TextTag({
          name: "blueBackground",
          background: "#eaf2c2",
        })
      );

      this._text_view_before.buffer = this.buffer_before;
      this._text_view_after.buffer = this.buffer_after;
      this._text_view_result.buffer = this.buffer_result;
    };

    createActions = () => {
      const checkDiffAction = new Gio.SimpleAction({
        name: "compare",
      });

      checkDiffAction.connect("activate", () => {
        const textBefore = this.buffer_before.text;
        const textAfter = this.buffer_after.text;

        if (!textBefore && !textAfter) return;

        const changeObjects = diffWords(textBefore, textAfter);

        let oldStr = "";
        let newStr = "";
        let result = "";
        let offset = [];

        for (const { added, removed, value } of changeObjects) {
          if (!added && !removed) {
            oldStr += value;
            newStr += value;
            result += value;

            continue;
          }

          if (!added && removed) {
            const i = [...result].length;
            oldStr += value;
            result += value;

            offset.push({
              a: i,
              b: i + [...value].length,
              added,
              removed,
            });

            continue;
          }

          if (added && !removed) {
            const i = [...result].length;
            newStr += value;
            result += value;

            offset.push({
              a: i,
              b: i + [...value].length,
              added,
              removed,
            });
          }
        }
        this.buffer_before.text = oldStr;
        this.buffer_after.text = newStr;
        this.buffer_result.text = result;

        for (const { a, b, added, removed } of offset) {
          const startIter = this.buffer_result.get_iter_at_offset(a);
          const endIter = this.buffer_result.get_iter_at_offset(b);
          let backgroundTagName = "";
          let foregroundTagName = "";

          if (!added && removed) {
            backgroundTagName = "redBackground";
            foregroundTagName = "redForeground";
          }

          if (added && !removed) {
            backgroundTagName = "blueBackground";
            foregroundTagName = "blueForeground";
          }
          this.buffer_result.apply_tag_by_name(
            foregroundTagName,
            startIter,
            endIter
          );
          this.buffer_result.apply_tag_by_name(
            backgroundTagName,
            startIter,
            endIter
          );
        }
      });

      this.add_action(checkDiffAction);
    };

    bindSettings = () => {
      this.settings = Gio.Settings.new(pkg.name);
      this.settings.bind(
        "window-width",
        this,
        "default-width",
        Gio.SettingsBindFlags.DEFAULT
      );
      this.settings.bind(
        "window-height",
        this,
        "default-height",
        Gio.SettingsBindFlags.DEFAULT
      );
      this.settings.bind(
        "window-maximized",
        this,
        "maximized",
        Gio.SettingsBindFlags.DEFAULT
      );

      this.settings.bind(
        "show-old-text",
        this._old_text_button,
        "active",
        Gio.SettingsBindFlags.DEFAULT
      );
      this.settings.bind(
        "show-new-text",
        this._new_text_button,
        "active",
        Gio.SettingsBindFlags.DEFAULT
      );
      this.settings.bind(
        "show-comparison",
        this._comparison_button,
        "active",
        Gio.SettingsBindFlags.DEFAULT
      );

      this._old_text_button.bind_property(
        "active",
        this._text_view_before.parent,
        "visible",
        GObject.BindingFlags.SYNC_CREATE
      );

      this._new_text_button.bind_property(
        "active",
        this._text_view_after.parent,
        "visible",
        GObject.BindingFlags.SYNC_CREATE
      );

      this._comparison_button.bind_property(
        "active",
        this._text_view_result.parent,
        "visible",
        GObject.BindingFlags.SYNC_CREATE
      );

      this.settings.connect(
        "changed::preferred-theme",
        this.setPreferredColorScheme
      );
    };

    loadStyles = () => {
      const cssProvider = new Gtk.CssProvider();
      cssProvider.load_from_resource(getResourcePath("index.css"));

      Gtk.StyleContext.add_provider_for_display(
        this.display,
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_USER
      );
    };

    setPreferredColorScheme = () => {
      const preferredColorScheme = this.settings.get_string("preferred-theme");

      const { DEFAULT, FORCE_LIGHT, FORCE_DARK } = Adw.ColorScheme;
      let colorScheme = DEFAULT;

      if (preferredColorScheme === "system") {
        colorScheme = DEFAULT;
      }

      if (preferredColorScheme === "light") {
        colorScheme = FORCE_LIGHT;
      }

      if (preferredColorScheme === "dark") {
        colorScheme = FORCE_DARK;
      }

      const styleManager = this.application.get_style_manager();
      styleManager.color_scheme = colorScheme;

      const editorColorScheme = styleManager.dark ? "Adwaita-dark" : "Adwaita";
      const schemeManager = GtkSource.StyleSchemeManager.get_default();
      const scheme = schemeManager.get_scheme(editorColorScheme);

      this._text_view_before.buffer.set_style_scheme(scheme);
      this._text_view_after.buffer.set_style_scheme(scheme);
      this._text_view_result.buffer.set_style_scheme(scheme);
    };
  }
);
