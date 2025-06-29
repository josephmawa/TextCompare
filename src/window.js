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
import { settings } from "./util.js";

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
      "main_stack",
      "panels_stack",
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
      // Scroll windows
      "old_txt_scroll_win",
      "new_txt_scroll_win",
      "comparison_txt_scroll_win",
    ],
  },
  class TextCompareWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });
      this.createActions();
      this.createBuffer();
      this.loadStyles();
      this.bindSettings();
      this.bindSourceViewColorScheme();
      this.updateStyleClasses();

      this.toast = new Adw.Toast({ timeout: 1 });
    }

    createBuffer = () => {
      this.buffer_before = new GtkSource.Buffer();
      this.buffer_after = new GtkSource.Buffer();
      this.buffer_result = new GtkSource.Buffer();

      if (!this.handleBufferChange) {
        this.handleBufferChange = this.debounce(this.performComparison, 300);
      }

      const realTimeComparisonEnabled = settings.get_boolean(
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
        const realTimeComparisonEnabled = settings.get_boolean(
          "real-time-comparison"
        );

        if (!realTimeComparisonEnabled) {
          this.displayToast(_("New and old text are both empty"));
        }

        return;
      }
      let isCaseSenitive = settings.get_boolean("case-sensitivity");
      let comparisonToken = settings.get_string("comparison-token");

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

      settings.bind(
        "real-time-comparison",
        checkDiffAction,
        "enabled",
        Gio.SettingsBindFlags.INVERT_BOOLEAN
      );
    };

    bindSettings = () => {
      settings.bind(
        "window-width",
        this,
        "default-width",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
        "window-height",
        this,
        "default-height",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
        "window-maximized",
        this,
        "maximized",
        Gio.SettingsBindFlags.DEFAULT
      );

      settings.bind(
        "show-old-text",
        this._old_text_button,
        "active",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
        "show-new-text",
        this._new_text_button,
        "active",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
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
      settings.bind(
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

      // Update comparison when preferences change
      settings.connect("changed::case-sensitivity", () => {
        const realTimeComparisonEnabled = settings.get_boolean(
          "real-time-comparison"
        );

        if (realTimeComparisonEnabled) {
          this.performComparison();
        }
      });

      settings.connect("changed::comparison-token", () => {
        const realTimeComparisonEnabled = settings.get_boolean(
          "real-time-comparison"
        );

        if (realTimeComparisonEnabled) {
          this.performComparison();
        }
      });

      settings.connect("changed::real-time-comparison", () => {
        const realTimeComparisonEnabled = settings.get_boolean(
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

      this._old_text_button.connect("toggled", () => {
        this.updateStyleClasses();
      });
      this._new_text_button.connect("toggled", () => {
        this.updateStyleClasses();
      });
      this._comparison_button.connect("toggled", () => {
        this.updateStyleClasses();
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

    bindSourceViewColorScheme = () => {
      const styleManager = this.application.get_style_manager();
      styleManager.connect("notify::dark", () => {
        this.setSourceViewColorScheme(styleManager);
      });
      this.setSourceViewColorScheme(styleManager);
    };

    setSourceViewColorScheme = (styleManager) => {
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

    updateStyleClasses = () => {
      const oldTxtBtnActive = this._old_text_button.active;
      const newTxtBtnActive = this._new_text_button.active;
      const comTxtBtnActive = this._comparison_button.active;

      const scrollWinOldTxt = this._old_txt_scroll_win.get_style_context();
      const scrollWinNewTxt = this._new_txt_scroll_win.get_style_context();
      const scrollWinComTxt =
        this._comparison_txt_scroll_win.get_style_context();

      const activeBtnCount =
        Number(oldTxtBtnActive) +
        Number(newTxtBtnActive) +
        Number(comTxtBtnActive);

      if (activeBtnCount) {
        this._panels_stack.visible_child_name = "panels_visible";
      } else {
        this._panels_stack.visible_child_name = "panels_hidden";
      }

      if (activeBtnCount === 3) {
        if (!scrollWinOldTxt.has_class("border-right")) {
          scrollWinOldTxt.add_class("border-right");
        }
        if (!scrollWinComTxt.has_class("border-left")) {
          scrollWinComTxt.add_class("border-left");
        }
      }

      if (activeBtnCount === 2) {
        if (
          oldTxtBtnActive &&
          newTxtBtnActive &&
          !scrollWinOldTxt.has_class("border-right")
        ) {
          scrollWinOldTxt.add_class("border-right");
        }

        if (
          newTxtBtnActive &&
          comTxtBtnActive &&
          !scrollWinComTxt.has_class("border-left")
        ) {
          scrollWinComTxt.add_class("border-left");
        }

        if (
          oldTxtBtnActive &&
          comTxtBtnActive &&
          scrollWinOldTxt.has_class("border-right")
        ) {
          scrollWinOldTxt.remove_class("border-right");
        }

        if (
          oldTxtBtnActive &&
          comTxtBtnActive &&
          !scrollWinComTxt.has_class("border-left")
        ) {
          scrollWinComTxt.add_class("border-left");
        }
      }

      if (activeBtnCount === 1) {
        if (oldTxtBtnActive && scrollWinOldTxt.has_class("border-right")) {
          scrollWinOldTxt.remove_class("border-right");
        }

        if (comTxtBtnActive && scrollWinComTxt.has_class("border-left")) {
          scrollWinComTxt.remove_class("border-left");
        }
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
