import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
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

const handlerIds = {
  beforeHandlerId: null,
  afterHandlerId: null,
};

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
      // Check Button
      "check_button",
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

      if (!this.handleBufferChange) {
        this.handleBufferChange = this.debounce(this.performComparison, 300);
      }

      if (!this.settings) {
        this.settings = Gio.Settings.new(pkg.name);
      }

      const realTimeComparisonEnabled = this.settings.get_boolean(
        "real-time-comparison"
      );

      if (realTimeComparisonEnabled) {
        handlerIds.beforeHandlerId = this.buffer_before.connect(
          "changed",
          this.handleBufferChange
        );
        handlerIds.afterHandlerId = this.buffer_after.connect(
          "changed",
          this.handleBufferChange
        );
      }

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

    performComparison = () => {
      const textBefore = this.buffer_before.text.normalize("NFC");
      const textAfter = this.buffer_after.text.normalize("NFC");

      if (!textBefore && !textAfter) {
        const realTimeComparisonEnabled = this.settings.get_boolean(
          "real-time-comparison"
        );

        if (!realTimeComparisonEnabled) {
          this.displayToast(_("New and old text are both empty"));
        }
        
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
    };

    createActions = () => {
      const checkDiffAction = new Gio.SimpleAction({
        name: "compare",
      });
      checkDiffAction.connect("activate", () => {
        this.performComparison();
      });

      const goBackAction = new Gio.SimpleAction({
        name: "go-back",
      });
      goBackAction.connect("activate", () => {
        this._main_stack.visible_child_name = "main_view";
      });

      this.add_action(checkDiffAction);
      this.add_action(goBackAction);

      if (!this.settings) {
        this.settings = Gio.Settings.new(pkg.name);
      }

      this.settings.bind(
        "real-time-comparison",
        checkDiffAction,
        "enabled",
        Gio.SettingsBindFlags.INVERT_BOOLEAN
      );
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
      /**
       * When real time comparison is activated,
       * the check button is hidden. However, hiding
       * a button alone doesn't prevent it from being
       * triggered via keyboard shortcut. Therefore,
       * the button must be hidden and the action bound
       * to it must be disabled. Check this.createActions
       *  method.
       *
       * FIXME: In addition to being invisible, the button
       * needs to be disabled.
       */
      this.settings.bind(
        "real-time-comparison",
        this._check_button,
        "visible",
        Gio.SettingsBindFlags.INVERT_BOOLEAN
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

      // Update comparison when preferences change
      this.settings.connect("changed::case-sensitivity", () => {
        const realTimeComparisonEnabled = this.settings.get_boolean(
          "real-time-comparison"
        );

        if (realTimeComparisonEnabled) {
          this.performComparison();
        }
      });

      this.settings.connect("changed::comparison-token", () => {
        const realTimeComparisonEnabled = this.settings.get_boolean(
          "real-time-comparison"
        );

        if (realTimeComparisonEnabled) {
          this.performComparison();
        }
      });

      this.settings.connect("changed::real-time-comparison", () => {
        const realTimeComparisonEnabled = this.settings.get_boolean(
          "real-time-comparison"
        );

        if (realTimeComparisonEnabled) {
          handlerIds.beforeHandlerId = this.buffer_before.connect(
            "changed",
            this.handleBufferChange
          );
          handlerIds.afterHandlerId = this.buffer_after.connect(
            "changed",
            this.handleBufferChange
          );

          this.performComparison();
        } else {
          if (handlerIds.beforeHandlerId) {
            this.buffer_before.disconnect(handlerIds.beforeHandlerId);
            handlerIds.beforeHandlerId = null;
          }

          if (handlerIds.afterHandlerId) {
            this.buffer_after.disconnect(handlerIds.afterHandlerId);
            handlerIds.afterHandlerId = null;
          }
        }
      });
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
        let result = "";
        let offset = [];

        for (let { added, removed, value } of changeObjects) {
          value = Array.isArray(value) ? value.join("") : value;
          result += value;

          if (added || removed) {
            const i = [...result].length - [...value].length;
            offset.push({
              a: i,
              b: i + [...value].length,
              added,
              removed,
            });
          }
        }

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

    debounce = (callback, wait = 300) => {
      let debounceTimeout = null;

      return (...args) => {
        if (debounceTimeout) {
          GLib.source_remove(debounceTimeout);
        }

        debounceTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, wait, () => {
          callback(...args);
          debounceTimeout = null;
          return GLib.SOURCE_REMOVE;
        });
      };
    };
  }
);
