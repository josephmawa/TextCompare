import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import Gio from "gi://Gio";

import { diffChars, diffWords, diffWordsWithSpace } from "./js-diff.js";

export const CompareWindow = GObject.registerClass(
  {
    GTypeName: "CompareWindow",
    Template: getResourceUri("window.ui"),
    InternalChildren: [
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
    }

    createBuffer = () => {
      this.buffer_before = Gtk.TextBuffer.new(null);
      this.buffer_after = Gtk.TextBuffer.new(null);
      this.buffer_result = Gtk.TextBuffer.new(null);

      const tagTableResult = this.buffer_result.tag_table;

      tagTableResult.add(
        new Gtk.TextTag({
          name: "redForeground",
          foreground: "red",
        })
      );
      tagTableResult.add(
        new Gtk.TextTag({
          name: "blueForeground",
          foreground: "blue",
        })
      );

      this._text_view_before.buffer = this.buffer_before;
      this._text_view_after.buffer = this.buffer_after;
      this._text_view_result.buffer = this.buffer_result;
    };

    createActions = () => {
      const checkDiffAction = new Gio.SimpleAction({
        name: "check-diff",
      });

      checkDiffAction.connect("activate", () => {
        const textBefore = this.buffer_before.text;
        const textAfter = this.buffer_after.text;

        if (!textBefore && !textAfter) return;

        const changeObjects = diffWordsWithSpace(textBefore, textAfter);
        console.log(changeObjects);

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
          let tagName = "";

          console.log("a = %s, b = %s", a, b);
          if (!added && removed) {
            tagName = "redForeground";
          }

          if (added && !removed) {
            tagName = "blueForeground";
          }
          this.buffer_result.apply_tag_by_name(tagName, startIter, endIter);
        }
      });

      this.add_action(checkDiffAction);
    };
  }
);
