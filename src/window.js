import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GtkSource from "gi://GtkSource?version=5";
import {
  diffChars,
  diffWords,
  diffWordsWithSpace,
  diffSentences,
  diffLines,
  diffTrimmedLines,
  diffArrays,
} from "./js-diff.js";

GObject.type_ensure(GtkSource.View.$gtype);

export const TextCompareWindow = GObject.registerClass(
  {
    GTypeName: "TextCompareWindow",
    Template: getResourceUri("window.ui"),
    InternalChildren: [
      // Main stack
      "main_stack",
      // Toast overlay
      "toast_overlay",
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
  class TextCompareWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });
      this.createActions();
      this.createBuffer();
      this.loadStyles();
      this.bindSettings();
      this.setPreferredColorScheme();

      this.toast = new Adw.Toast({ timeout: 1 });
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
        const textBefore = this.buffer_before.text.normalize("NFC");
        const textAfter = this.buffer_after.text.normalize("NFC");

        if (!textBefore && !textAfter) {
          this.displayToast(_("New and old text are both empty"));
          return;
        }
        let isCaseSenitive = this.settings.get_boolean("case-sensitivity");
        let comparisonToken = this.settings.get_string("comparison-token");

        if ("characters" === comparisonToken || "words" === comparisonToken) {
          const byteCountBefore = textBefore.length * 2;
          const byteCountAfter = textAfter.length * 2;

          if (byteCountBefore > 10_000 || byteCountAfter > 10_000) {
            this._main_stack.visible_child_name = "error_view";
            return;
          }
        }

        const locale = new Intl.DateTimeFormat().resolvedOptions().locale;

        const options = {
          ignoreCase: !isCaseSenitive,
          callback: this.compareStrings,
        };

        if (comparisonToken === "characters") {
          diffChars(textBefore, textAfter, options);
        }

        if (comparisonToken === "words") {
          options.intlSegmenter = new Intl.Segmenter(locale, {
            granularity: "word",
          });
          diffWordsWithSpace(textBefore, textAfter, options);
        }

        if (comparisonToken === "lines") {
          diffLines(textBefore, textAfter, options);
        }

        if (comparisonToken === "sentences") {
          const sentenceSeg = new Intl.Segmenter(locale, {
            granularity: "sentence",
          });

          const tokensOldText = Array.from(
            sentenceSeg.segment(textBefore),
            ({ segment }) => segment
          );

          const tokensNewText = Array.from(
            sentenceSeg.segment(textAfter),
            ({ segment }) => segment
          );

          diffArrays(tokensOldText, tokensNewText, options);
        }
      });

      const goBackAction = new Gio.SimpleAction({
        name: "go-back",
      });
      goBackAction.connect("activate", () => {
        this._main_stack.visible_child_name = "main_view";
      });

      this.add_action(checkDiffAction);
      this.add_action(goBackAction);
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

    compareStrings = (changeObjects) => {
      try {
        if (!changeObjects) {
          this.displayToast("Comparison Failed");
          return;
        }
        let oldStr = "";
        let newStr = "";
        let result = "";
        let offset = [];

        for (let { added, removed, value } of changeObjects) {
          value = Array.isArray(value) ? value.join("") : value;

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
      } catch (error) {
        console.error(error);
        this.displayToast(_("Comparison Failed"));
      }
    };

    displayToast = (message) => {
      this.toast.dismiss();
      this.toast.title = message;
      this._toast_overlay.add_toast(this.toast);
    };
  }
);
